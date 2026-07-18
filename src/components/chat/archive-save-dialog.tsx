"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ARCHIVE_CATEGORIES } from "@/lib/constants";
import type { ArchiveCategory } from "@/types/database";

interface ArchiveSaveDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  content: string;
}

const categoryOptions = Object.entries(ARCHIVE_CATEGORIES).map(
  ([value, label]) => ({ value, label })
);

export function ArchiveSaveDialog({
  open,
  onClose,
  conversationId,
  content,
}: ArchiveSaveDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ArchiveCategory>("personal");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          title: title.trim() || undefined,
          category,
          content,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장 실패");
      }
      toast.success("아카이브에 저장되었습니다", {
        action: {
          label: "보러가기",
          onClick: () => router.push("/archive"),
        },
      });
      setTitle("");
      setCategory("personal");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="아카이브 저장">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">제목</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="미입력 시 저장 일시로 자동 설정"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">카테고리</label>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as ArchiveCategory)}
            options={categoryOptions}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button className="flex-1" onClick={handleSave} loading={saving}>
            저장
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
