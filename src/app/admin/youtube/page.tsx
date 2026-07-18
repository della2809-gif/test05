"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Video, Plus, Search, Pencil, Trash2, ExternalLink } from "lucide-react";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { CategoryBar } from "@/components/ui/category-bar";

interface YoutubeTranscript {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string | null;
  transcript: string | null;
  summary: string | null;
  tags: string[] | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  title: "",
  youtube_url: "",
  video_id: "",
  transcript: "",
  summary: "",
  category: "",
  tags: "",
  is_active: true,
};

function extractVideoId(url: string): string {
  if (!url) return "";
  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?&\s]+)/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/watch?v=VIDEO_ID
  const longMatch = url.match(/[?&]v=([^&\s]+)/);
  if (longMatch) return longMatch[1];
  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/\/embed\/([^?&\s]+)/);
  if (embedMatch) return embedMatch[1];
  return "";
}

export default function AdminYoutubePage() {
  const [items, setItems] = useState<YoutubeTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<YoutubeTranscript | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<YoutubeTranscript | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("youtube_transcripts")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("유튜브 목록을 불러오지 못했습니다.");
    } else {
      setItems((data as YoutubeTranscript[]) ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: YoutubeTranscript) {
    setEditItem(item);
    setForm({
      title: item.title,
      youtube_url: item.youtube_url,
      video_id: item.video_id ?? "",
      transcript: item.transcript ?? "",
      summary: item.summary ?? "",
      category: item.category ?? "",
      tags: (item.tags ?? []).join(", "),
      is_active: item.is_active,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    setForm(EMPTY_FORM);
  }

  function handleUrlChange(url: string) {
    const videoId = extractVideoId(url);
    setForm((f) => ({ ...f, youtube_url: url, video_id: videoId }));
  }

  async function handleAutoFetch() {
    if (!form.video_id) return;
    setFetching(true);
    try {
      const res = await fetch("/api/admin/youtube-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: form.video_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "자막 추출에 실패했습니다");
      } else {
        setForm((f) => ({ ...f, transcript: data.transcript }));
        toast.success(`자막 추출 완료 (${data.length.toLocaleString()}자)`);
      }
    } catch {
      toast.error("자막 추출 중 오류가 발생했습니다");
    } finally {
      setFetching(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    if (!form.youtube_url.trim()) {
      toast.error("유튜브 URL을 입력해주세요.");
      return;
    }

    const videoId = form.video_id.trim() || extractVideoId(form.youtube_url);
    if (!videoId) {
      toast.error("video_id를 추출할 수 없습니다. URL 형식을 확인하거나 직접 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: form.title.trim(),
      youtube_url: form.youtube_url.trim(),
      video_id: videoId,
      transcript: form.transcript.trim() || null,
      summary: form.summary.trim() || null,
      category: form.category.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      is_active: form.is_active,
    };

    if (editItem) {
      const { data, error } = await (supabase.from("youtube_transcripts") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();

      if (error) {
        console.error("YouTube update error:", error);
        if (error.code === "23505") {
          toast.error("이미 등록된 video_id입니다. 다른 video_id를 입력해주세요.");
        } else {
          toast.error(`유튜브 수정에 실패했습니다. (${error.message})`);
        }
      } else {
        setItems((prev) => prev.map((t) => (t.id === editItem.id ? (data as YoutubeTranscript) : t)));
        // 임베딩 재생성 (백그라운드)
        const embedText = `${form.title.trim()}\n${form.transcript.trim() || ""}\n${form.summary.trim() || ""}`.trim();
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "youtube",
            sourceId: editItem.id,
            sourceName: form.title.trim(),
            text: embedText,
          }),
        }).catch(() => {});
        toast.success("유튜브 데이터가 수정되었습니다.");
        closeDialog();
      }
    } else {
      const { data, error } = await supabase
        .from("youtube_transcripts")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        console.error("YouTube insert error:", error);
        if (error.code === "23505") {
          toast.error("이미 등록된 video_id입니다. 기존 항목을 수정하거나 다른 영상을 입력해주세요.");
        } else {
          toast.error(`유튜브 생성에 실패했습니다. (${error.message})`);
        }
      } else {
        const created = data as YoutubeTranscript;
        setItems((prev) => [created, ...prev]);
        // 임베딩 생성 (백그라운드)
        const embedText = `${form.title.trim()}\n${form.transcript.trim() || ""}\n${form.summary.trim() || ""}`.trim();
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "youtube",
            sourceId: created.id,
            sourceName: form.title.trim(),
            text: embedText,
          }),
        }).catch(() => {});
        toast.success("유튜브 데이터가 생성되었습니다.");
        closeDialog();
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("youtube_transcripts")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("유튜브 삭제에 실패했습니다.");
    } else {
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("유튜브 데이터가 삭제되었습니다.");
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  const categories = Array.from(
    new Set(items.map((item) => item.category).filter(Boolean))
  ) as string[];

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      categoryFilter === null || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">유튜브·강의 DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">유튜브 강의 스크립트와 요약을 저장합니다. → 유튜브 강의 지플릿에서 참조합니다.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          추가
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목 또는 카테고리로 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="youtube_transcripts"
        onCategoriesChange={loadItems}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title="유튜브 데이터가 없습니다"
          description={search ? "검색 조건에 맞는 데이터가 없습니다." : "첫 번째 유튜브 데이터를 추가해보세요."}
          action={!search ? <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" />추가</Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 hover:border-border-hover transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">{item.title}</span>
                  {item.category && (
                    <Badge variant="outline">{item.category}</Badge>
                  )}
                  <Badge variant={item.is_active ? "success" : "outline"}>
                    {item.is_active ? "활성" : "비활성"}
                  </Badge>
                </div>
                <a
                  href={item.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-red-500 hover:underline flex items-center gap-1 mt-1 truncate"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  {item.youtube_url}
                </a>
                {item.video_id && (
                  <p className="text-xs text-foreground-tertiary mt-0.5">video_id: {item.video_id}</p>
                )}
                {item.summary && (
                  <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">{item.summary}</p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(item)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={editItem ? "유튜브 데이터 수정" : "유튜브 데이터 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">제목 *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="영상 제목"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">유튜브 URL *</label>
            <Input
              value={form.youtube_url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              type="url"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              video_id *
              <span className="ml-1 text-xs text-foreground-tertiary font-normal">URL 입력 시 자동 추출 · 직접 수정 가능</span>
            </label>
            <Input
              value={form.video_id}
              onChange={(e) => setForm((f) => ({ ...f, video_id: e.target.value.trim() }))}
              placeholder="예: dQw4w9WgXcQ"
              className="font-mono text-sm"
            />
            {!form.video_id && form.youtube_url && (
              <p className="text-xs text-red-500 mt-1">URL에서 video_id를 인식하지 못했습니다. 직접 입력해주세요.</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">스크립트 (선택)</label>
            {form.youtube_url && form.video_id && (
              <div className="flex items-center gap-2 mb-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoFetch}
                  loading={fetching}
                >
                  자동 자막 추출
                </Button>
                <span className="text-xs text-foreground-tertiary">
                  공개 자막이 있는 영상만 가능합니다
                </span>
              </div>
            )}
            <Textarea
              value={form.transcript}
              onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
              placeholder="영상 스크립트를 입력하세요..."
              rows={5}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">요약 (선택)</label>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="영상 요약을 입력하세요..."
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="youtube_transcripts"
              value={form.category}
              onChange={(val) => setForm((f) => ({ ...f, category: val }))}
              options={categories}
              placeholder="카테고리 (선택)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">태그 (쉼표로 구분)</label>
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="건강, 비즈니스, 동기부여 (쉼표로 구분)"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              활성화
            </label>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeDialog} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editItem ? "수정" : "추가"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="유튜브 데이터 삭제"
        description={`"${deleteTarget?.title}" 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
