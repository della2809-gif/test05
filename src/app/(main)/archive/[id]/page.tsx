"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Sparkles, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ARCHIVE_CATEGORIES,
  CATEGORY_COLORS,
  type ArchiveCategoryKey,
} from "@/lib/constants";
import type { Archive, ArchiveAttachment, ArchiveCategory } from "@/types/database";

const CATEGORY_OPTIONS = Object.entries(ARCHIVE_CATEGORIES).map(
  ([value, label]) => ({ value, label })
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArchiveDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [archive, setArchive] = useState<Archive | null>(null);
  const [attachments, setAttachments] = useState<ArchiveAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<ArchiveCategory>("personal");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI reorganize
  const [reorganizing, setReorganizing] = useState(false);
  const [reorganizedContent, setReorganizedContent] = useState<string | null>(null);

  const fetchArchive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/archives/${id}`);
      if (!res.ok) {
        router.replace("/archive");
        return;
      }
      const json = await res.json();
      const data = json.data as Archive & { attachments: ArchiveAttachment[] };
      setArchive(data);
      setAttachments(data.attachments ?? []);
      setEditTitle(data.title);
      setEditCategory(data.category);
      setEditContent(data.content);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  function handleStartEdit() {
    if (!archive) return;
    setEditTitle(archive.title);
    setEditCategory(archive.category);
    setEditContent(archive.content);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  async function handleSave() {
    if (!archive) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/archives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          category: editCategory,
          content: editContent,
        }),
      });

      if (!res.ok) {
        toast.error("수정에 실패했습니다");
        return;
      }

      const json = await res.json();
      setArchive(json.data as Archive);
      setIsEditing(false);
      toast.success("수정되었습니다");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/archives/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("삭제에 실패했습니다");
        return;
      }
      toast.success("삭제되었습니다");
      router.replace("/archive");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  async function handleReorganize() {
    setReorganizing(true);
    setReorganizedContent(null);
    try {
      const res = await fetch(`/api/archives/${id}/reorganize`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("재정리에 실패했습니다");
        return;
      }
      const json = await res.json();
      setReorganizedContent(json.data.reorganizedContent as string);
    } finally {
      setReorganizing(false);
    }
  }

  async function handleApplyReorganized() {
    if (!reorganizedContent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/archives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reorganizedContent }),
      });
      if (!res.ok) {
        toast.error("수정에 실패했습니다");
        return;
      }
      const json = await res.json();
      setArchive(json.data as Archive);
      setEditContent(json.data.content);
      setReorganizedContent(null);
      toast.success("재정리 내용이 적용되었습니다");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelReorganized() {
    setReorganizedContent(null);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!archive) return null;

  const colors = CATEGORY_COLORS[archive.category as ArchiveCategoryKey];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:px-6">
        <button
          onClick={() => router.push("/archive")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary hover:bg-surface-hover transition-colors"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        {isEditing ? (
          <>
            <Button
              variant="secondary"
              onClick={handleCancelEdit}
              disabled={saving}
              className="h-8 px-3 text-xs"
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              className="h-8 px-3 text-xs"
            >
              저장
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={handleReorganize}
              loading={reorganizing}
              className="h-8 px-3 text-xs gap-1.5"
              disabled={reorganizing}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI 재정리</span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleStartEdit}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">수정</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 px-3 text-xs gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">삭제</span>
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Title */}
          {isEditing ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                제목
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목을 입력하세요"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{archive.title}</h1>
          )}

          {/* Category + Date */}
          <div className="flex flex-wrap items-center gap-3">
            {isEditing ? (
              <div className="w-40">
                <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                  카테고리
                </label>
                <Select
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as ArchiveCategory)
                  }
                  options={CATEGORY_OPTIONS}
                />
              </div>
            ) : (
              <Badge color={{ bg: colors.bg, text: colors.text }}>
                {ARCHIVE_CATEGORIES[archive.category as ArchiveCategoryKey]}
              </Badge>
            )}

            <span className="text-xs text-muted-foreground">
              {format(new Date(archive.updated_at), "yyyy. M. d. a h:mm", {
                locale: ko,
              })}
            </span>
          </div>

          {/* Content */}
          {isEditing ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                내용
              </label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="내용을 입력하세요"
                rows={12}
                className="resize-y"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {archive.content}
              </p>
            </div>
          )}

          {/* AI Reorganize Preview */}
          {reorganizing && (
            <div className="rounded-xl border border-primary/30 bg-primary-subtle p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  AI가 재정리 중...
                </span>
              </div>
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            </div>
          )}

          {reorganizedContent && !reorganizing && (
            <div className="rounded-xl border border-primary/30 bg-primary-subtle p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    AI 재정리 결과
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleCancelReorganized}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleApplyReorganized}
                    loading={saving}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    적용
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {reorganizedContent}
              </p>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-foreground-secondary mb-2">
                첨부파일
              </h2>
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <span className="text-sm text-foreground truncate">
                      {att.file_name}
                    </span>
                    <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(att.file_size)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="아카이브 삭제"
        description="정말 삭제하시겠습니까? 삭제된 아카이브는 복구할 수 없습니다."
        confirmText="삭제"
        confirmVariant="destructive"
        loading={deleting}
      />
    </div>
  );
}
