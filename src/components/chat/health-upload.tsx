"use client";

import { useState, useRef } from "react";
import type { HealthChecklistAnalysis } from "@/app/api/analyze/health-checklist/route";
import { Upload, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface HealthUploadProps {
  onAnalysisComplete?: (analysis: HealthChecklistAnalysis) => void;
}

const AREA_LABELS: Record<string, string> = {
  A: "면역", B: "순환", C: "소화", D: "장관",
  E: "뇌신경", F: "호르몬", G: "호흡", H: "비뇨",
  I: "골격", J: "피부모발",
};

export function HealthUpload({ onAnalysisComplete }: HealthUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<HealthChecklistAnalysis | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles).slice(0, 3 - files.length);
    const combined = [...files, ...arr].slice(0, 3);
    setFiles(combined);
    const newPreviews = arr.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews].slice(0, 3));
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function handleAnalyze() {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("images", f));

    try {
      const res = await fetch("/api/analyze/health-checklist", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "분석에 실패했습니다.");
        return;
      }
      setAnalysis(json.data);
      setExpanded(true);
      onAnalysisComplete?.(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3 my-2">
      <p className="text-sm font-medium text-foreground">건강체크리스트 분석</p>

      {/* 이미지 업로드 영역 */}
      {files.length < 3 && (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-1.5 text-foreground-secondary hover:border-border-hover transition-colors"
        >
          <Upload className="h-5 w-5" />
          <span className="text-sm">사진 추가 (최대 3장)</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* 미리보기 */}
      {previews.length > 0 && (
        <div className="flex gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} className="w-20 h-20 object-cover rounded-lg" alt={`사진 ${i + 1}`} />
              <button
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 분석 버튼 */}
      {files.length > 0 && !analysis && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full rounded-lg bg-foreground text-background py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "분석 중..." : "분석 시작"}
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* 분석 결과 */}
      {analysis && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            분석 결과
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {/* A~J 점수 */}
              <div className="grid grid-cols-5 gap-1.5">
                {Object.entries(analysis.scores).map(([key, val]) => (
                  <div key={key} className="text-center rounded-lg bg-background border border-border p-1.5">
                    <p className="text-xs text-foreground-secondary">{AREA_LABELS[key]}</p>
                    <p className="text-sm font-semibold text-foreground">{val ?? "-"}</p>
                  </div>
                ))}
              </div>
              {/* 요약 */}
              <p className="text-xs text-foreground-secondary bg-background rounded-lg p-2">{analysis.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
