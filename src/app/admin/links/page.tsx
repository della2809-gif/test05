"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, Plus, Search, Pencil, Trash2, ExternalLink } from "lucide-react";
import { CategoryBar } from "@/components/ui/category-bar";

interface LinkItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  title: "",
  url: "",
  description: "",
  category: "",
  tags: "",
  is_active: true,
};

export default function AdminLinksPage() {
  const [items, setItems] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<LinkItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LinkItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("링크 목록을 불러오지 못했습니다.");
    } else {
      setItems((data as LinkItem[]) ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: LinkItem) {
    setEditItem(item);
    setForm({
      title: item.title,
      url: item.url,
      description: item.description ?? "",
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

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    if (!form.url.trim()) {
      toast.error("URL을 입력해주세요.");
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
      url: form.url.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      is_active: form.is_active,
    };

    if (editItem) {
      const { data, error } = await (supabase.from("links") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();

      if (error) {
        toast.error("링크 수정에 실패했습니다.");
      } else {
        setItems((prev) => prev.map((t) => (t.id === editItem.id ? (data as LinkItem) : t)));
        toast.success("링크가 수정되었습니다.");
        closeDialog();
      }
    } else {
      const { data, error } = await supabase
        .from("links")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        toast.error("링크 생성에 실패했습니다.");
      } else {
        setItems((prev) => [data as LinkItem, ...prev]);
        toast.success("링크가 생성되었습니다.");
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
      .from("links")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("링크 삭제에 실패했습니다.");
    } else {
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("링크가 삭제되었습니다.");
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
          <h1 className="text-2xl font-bold text-foreground">링크 DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">인스타그램·카카오채널·기사·웹사이트 등 인터넷 링크를 저장합니다. → 링크 자료 지플릿에서 참조합니다.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          링크 추가
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
        tableName="links"
        onCategoriesChange={loadItems}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="링크가 없습니다"
          description={search ? "검색 조건에 맞는 링크가 없습니다." : "첫 번째 링크를 추가해보세요."}
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
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1 truncate"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  {item.url}
                </a>
                {item.description && (
                  <p className="text-xs text-foreground-secondary mt-1 line-clamp-1">{item.description}</p>
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
        title={editItem ? "링크 수정" : "링크 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">제목 *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="링크 제목"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">URL *</label>
            <Input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com"
              type="url"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">설명</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="링크 설명 (선택)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="links"
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
              placeholder="건강, 비즈니스 (쉼표로 구분)"
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
        title="링크 삭제"
        description={`"${deleteTarget?.title}" 링크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
