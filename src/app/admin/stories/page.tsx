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
import { BookOpen, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { CategoryBar } from "@/components/ui/category-bar";
import { CategoryCombobox } from "@/components/ui/category-combobox";

interface Story {
  id: string;
  name: string | null;
  summary: string;
  tags: string[] | null;
  category: string | null;
  full_text: string | null;
  is_team_story: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  name: "",
  summary: "",
  full_text: "",
  category: "",
  tags: "",
  is_team_story: false,
  is_active: true,
};

export default function AdminStoriesPage() {
  const [items, setItems] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Story | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("스토리 목록을 불러오지 못했습니다.");
    } else {
      setItems((data as Story[]) ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: Story) {
    setEditItem(item);
    setForm({
      name: item.name ?? "",
      summary: item.summary,
      full_text: item.full_text ?? "",
      category: item.category ?? "",
      tags: (item.tags ?? []).join(", "),
      is_team_story: item.is_team_story,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.summary.trim()) {
      toast.error("요약을 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: form.name.trim() || null,
      summary: form.summary.trim(),
      full_text: form.full_text.trim() || null,
      category: form.category || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      is_team_story: form.is_team_story,
      is_active: form.is_active,
    };

    if (editItem) {
      const { data, error } = await (supabase.from("stories") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();

      if (error) {
        toast.error("스토리 수정에 실패했습니다.");
      } else {
        setItems((prev) => prev.map((t) => (t.id === editItem.id ? (data as Story) : t)));
        toast.success("스토리가 수정되었습니다.");
        closeDialog();
        const s = data as Story;
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "story",
            sourceId: s.id,
            sourceName: s.name ?? s.summary.slice(0, 40),
            text: [s.summary, s.full_text].filter(Boolean).join("\n\n"),
          }),
        }).catch(() => {});
      }
    } else {
      const { data, error } = await supabase
        .from("stories")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        toast.error("스토리 생성에 실패했습니다.");
      } else {
        setItems((prev) => [data as Story, ...prev]);
        toast.success("스토리가 생성되었습니다.");
        closeDialog();
        const s = data as Story;
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "story",
            sourceId: s.id,
            sourceName: s.name ?? s.summary.slice(0, 40),
            text: [s.summary, s.full_text].filter(Boolean).join("\n\n"),
          }),
        }).catch(() => {});
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("stories")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("스토리 삭제에 실패했습니다.");
    } else {
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("스토리가 삭제되었습니다.");
      fetch("/api/admin/embed", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "story", sourceId: deleteTarget.id }),
      }).catch(() => {});
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
      item.summary.toLowerCase().includes(search.toLowerCase()) ||
      (item.tags ?? []).some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = categoryFilter === null || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">스토리 DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">건강회복·비즈니스 성공 사례를 저장합니다. → 성공 스토리 지플릿에서 참조합니다.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          스토리 추가
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="요약 또는 태그로 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="stories"
        onCategoriesChange={loadItems}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="스토리가 없습니다"
          description={search ? "검색 조건에 맞는 스토리가 없습니다." : "첫 번째 스토리를 추가해보세요."}
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
                  <span className="font-medium text-foreground truncate">
                    {item.name ?? item.summary.slice(0, 40)}
                  </span>
                  {item.category && (
                    <Badge variant="outline">{item.category}</Badge>
                  )}
                  {item.is_team_story && (
                    <Badge variant="outline">팀 스토리</Badge>
                  )}
                  <Badge variant={item.is_active ? "success" : "outline"}>
                    {item.is_active ? "활성" : "비활성"}
                  </Badge>
                </div>
                <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">{item.summary}</p>
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
        title={editItem ? "스토리 수정" : "스토리 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">이름 (선택)</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="스토리 이름 (선택)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">요약 *</label>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="스토리 요약을 입력하세요..."
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">전체 내용</label>
            <Textarea
              value={form.full_text}
              onChange={(e) => setForm((f) => ({ ...f, full_text: e.target.value }))}
              placeholder="스토리 전체 내용을 입력하세요..."
              rows={5}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="stories"
              value={form.category}
              onChange={(v) => setForm((f) => ({ ...f, category: v }))}
              options={categories}
              placeholder="카테고리 선택 또는 입력 (선택)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">태그 (쉼표로 구분)</label>
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="건강, 비즈니스, 성공 (쉼표로 구분)"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_team_story}
                onChange={(e) => setForm((f) => ({ ...f, is_team_story: e.target.checked }))}
                className="rounded"
              />
              팀 스토리
            </label>
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
        title="스토리 삭제"
        description={`이 스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
