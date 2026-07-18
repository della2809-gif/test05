"use client";

import { useRef, useState } from "react";
import { Upload, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GIPLET_ICON_OPTIONS, isImageIconValue } from "@/lib/giplet-icons";

interface GipletIconPickerProps {
  value: string | null;
  onChange: (name: string | null) => void;
}

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const OUTPUT_SIZE = 256;

// 업로드 이미지를 비율 유지한 채 256×256 정사각형 PNG(투명 배경 패딩)로 리사이즈.
async function resizeToSquarePng(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 변환할 수 없습니다.");

  // 비율 유지 + 중앙 배치, 나머지는 투명 패딩
  const scale = Math.min(OUTPUT_SIZE / img.width, OUTPUT_SIZE / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (OUTPUT_SIZE - w) / 2, (OUTPUT_SIZE - h) / 2, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("이미지를 변환할 수 없습니다.");
  return blob;
}

// 운영자가 지플릿/케이스 카드 아이콘을 고르는 그리드 픽커.
// "자동" 선택(value=null)이면 이름 기반 자동 매칭으로 폴백한다.
// 커스텀 이미지를 업로드하면 value에 public URL이 저장되고, http(s)로 시작하면 이미지로 렌더된다.
export function GipletIconPicker({ value, onChange }: GipletIconPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasImage = isImageIconValue(value);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일 재선택도 트리거되도록 초기화
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("PNG 또는 JPG 이미지만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("이미지 크기는 2MB 이하여야 합니다.");
      return;
    }

    setUploading(true);
    try {
      const resized = await resizeToSquarePng(file);
      const formData = new FormData();
      formData.append("file", resized, "icon.png");

      const res = await fetch("/api/admin/giplet-icons", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드에 실패했습니다.");

      onChange(data.url as string);
      toast.success("아이콘 이미지가 업로드되었습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* 업로드된 커스텀 이미지 미리보기 (픽커에서만 원색 표시) */}
      {hasImage && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value ?? ""}
            alt="업로드된 아이콘"
            className="h-9 w-9 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">커스텀 이미지 사용 중</p>
            <p className="text-[11px] text-foreground-tertiary">
              카드에서는 모노톤(회색조)으로 표시됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground-secondary transition-colors hover:border-border-hover hover:text-foreground"
          >
            <X className="h-3 w-3" />
            제거
          </button>
        </div>
      )}

      {/* 컨테이너 폭과 무관하게 타일을 좌측부터 촘촘히 배치 (넓은 패널에서 grid-cols 고정 시 간격이 벌어지는 문제 방지) */}
      <div className="flex flex-wrap gap-1.5">
        {/* 자동(미지정) 옵션 */}
        <button
          type="button"
          onClick={() => onChange(null)}
          title="자동 (이름으로 매칭)"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border transition-all",
            value == null
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-foreground-tertiary hover:text-foreground hover:border-border-hover",
          )}
        >
          <Wand2 className="h-4 w-4" strokeWidth={2.2} />
        </button>

        {GIPLET_ICON_OPTIONS.map(({ name, label, Icon }) => {
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              title={label}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border transition-all",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-foreground-secondary hover:text-foreground hover:border-border-hover",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </button>
          );
        })}

        {/* 이미지 업로드 타일 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="이미지 업로드"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border transition-all disabled:opacity-50",
            hasImage
              ? "border-primary bg-primary/10 text-primary"
              : "border-dashed border-border bg-surface text-foreground-tertiary hover:text-foreground hover:border-border-hover",
          )}
        >
          {uploading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={2.2} />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <p className="text-[11px] text-foreground-tertiary">
        정사각형 PNG 권장, 자동으로 256×256으로 맞춰집니다. (PNG·JPG, 최대 2MB)
      </p>
    </div>
  );
}
