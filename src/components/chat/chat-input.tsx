"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Mic, MicOff, Paperclip, X, FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UPLOAD_SIZE_LIMIT, SUPPORTED_FILE_TYPES } from "@/lib/constants";

const ALLOWED_EXTS = [
  ...SUPPORTED_FILE_TYPES.document,
  ...SUPPORTED_FILE_TYPES.image,
];

interface ChatInputProps {
  onSend: (content: string, files?: File[], messageType?: 'text' | 'voice') => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [isVoiceInput, setIsVoiceInput] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // iOS keyboard: scroll textarea into view when focused
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    function onFocus() {
      setTimeout(() => textarea?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 300);
    }
    textarea.addEventListener("focus", onFocus);
    return () => textarea.removeEventListener("focus", onFocus);
  }, []);

  // 첨부한 이미지 파일의 미리보기(썸네일) URL 생성/정리
  useEffect(() => {
    const urls = files.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : null
    );
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [files]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || disabled) return;
    onSend(trimmed, files.length > 0 ? files : undefined, isVoiceInput ? 'voice' : 'text');
    setValue("");
    setFiles([]);
    setIsVoiceInput(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, files, disabled, onSend, isVoiceInput]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const valid: File[] = [];
    for (const file of selected) {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!ALLOWED_EXTS.includes(ext as typeof ALLOWED_EXTS[number])) {
        toast.error(`지원하지 않는 파일 형식입니다: ${file.name}`);
        continue;
      }
      if (file.size > UPLOAD_SIZE_LIMIT) {
        toast.error(
          `파일이 너무 커서 업로드할 수 없어요 (4.5MB 초과). PC에서 큰 사진은 용량을 줄여 올려주세요: ${file.name}`
        );
        continue;
      }
      valid.push(file);
    }

    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
    }
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleMicClick() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          const res = await fetch("/api/stt", { method: "POST", body: formData });
          if (!res.ok) throw new Error("STT 실패");
          const data = await res.json();
          if (data.text) {
            setValue((prev) => (prev ? `${prev} ${data.text}` : data.text));
            setIsVoiceInput(true);
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
            }
          }
        } catch {
          toast.error("음성 인식에 실패했습니다");
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error("마이크 접근 권한이 필요합니다");
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="mx-auto max-w-3xl space-y-2">
        {/* File previews */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => {
              const isImage = file.type.startsWith("image/");
              const previewUrl = previewUrls[i];
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                >
                  {isImage && previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : isImage ? (
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="ml-0.5 rounded text-muted-foreground hover:text-foreground"
                    aria-label="파일 제거"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* File attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="파일 첨부 (사진 3장 → 자동 건강분석)"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.xlsx,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요 (Ctrl+Enter로 전송)"
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />

          {/* Mic button */}
          <div className="relative shrink-0">
            {recording && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
            )}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={disabled}
              className={cn(
                "rounded-lg p-2 transition-colors disabled:opacity-50",
                recording
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              )}
              aria-label={recording ? "녹음 중지" : "음성 입력"}
            >
              {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          </div>

          {/* Send button */}
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={(!value.trim() && files.length === 0) || disabled}
            aria-label="전송"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
