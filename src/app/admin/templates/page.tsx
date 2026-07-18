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
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { FileText, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { CategoryBar } from "@/components/ui/category-bar";

interface Template {
  id: string;
  title: string;
  category: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = { title: "", category: "", content: "" };

export default function AdminTemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Template | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admin_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("템플릿 목록을 불러오지 못했습니다.");
    } else {
      setItems((data as Template[]) ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: Template) {
    setEditItem(item);
    setForm({ title: item.title, category: item.category ?? "", content: item.content });
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
    if (!form.content.trim()) {
      toast.error("내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      content: form.content.trim(),
    };

    if (editItem) {
      const { data, error } = await (supabase.from("admin_templates") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();

      if (error) {
        toast.error("템플릿 수정에 실패했습니다.");
      } else {
        setItems((prev) => prev.map((t) => (t.id === editItem.id ? (data as Template) : t)));
        toast.success("템플릿이 수정되었습니다.");
        closeDialog();
      }
    } else {
      const { data, error } = await supabase
        .from("admin_templates")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        toast.error("템플릿 생성에 실패했습니다.");
      } else {
        setItems((prev) => [data as Template, ...prev]);
        toast.success("템플릿이 생성되었습니다.");
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
      .from("admin_templates")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("템플릿 삭제에 실패했습니다.");
    } else {
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("템플릿이 삭제되었습니다.");
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
          <h1 className="text-2xl font-bold text-foreground">미팅 시나리오</h1>
          <p className="text-sm text-foreground-secondary mt-1">미팅 흐름 스크립트와 질문 템플릿을 저장합니다. → 미팅 시나리오 지플릿에서 참조합니다.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          템플릿 추가
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
        tableName="admin_templates"
        onCategoriesChange={loadItems}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="템플릿이 없습니다"
          description={search ? "검색 조건에 맞는 템플릿이 없습니다." : "첫 번째 템플릿을 추가해보세요."}
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
                </div>
                <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">{item.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(item.updated_at), "yyyy.MM.dd HH:mm", { locale: ko })}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)} className="text-destructive hover:text-destructive">
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
        title={editItem ? "템플릿 수정" : "템플릿 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">제목 *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="템플릿 제목"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="admin_templates"
              value={form.category}
              onChange={(val) => setForm((f) => ({ ...f, category: val }))}
              options={categories}
              placeholder="카테고리 (선택)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">내용 *</label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="템플릿 내용을 입력하세요..."
              rows={8}
            />
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
        title="템플릿 삭제"
        description={`"${deleteTarget?.title}" 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
