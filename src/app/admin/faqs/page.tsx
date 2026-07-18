"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HelpCircle, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { CategoryBar } from "@/components/ui/category-bar";

interface Faq {
  id: string;
  question: string;
  answer: string;
  tags: string[] | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  question: "",
  answer: "",
  category: "",
  tags: "",
  is_active: true,
};

// 서버사이드 페이지 크기. Supabase는 요청당 최대 1,000행만 반환하므로 전체 로드 방식은
// 1,000건 초과분(예전 자료)이 화면·검색에서 사라져 보인다. (7/5 Script DB와 동일 문제)
const PAGE_SIZE = 100;

// PostgREST or() 필터 구분자와 충돌하는 문자를 검색어에서 제거
function sanitizeSearch(s: string): string {
  return s.replace(/[,()%]/g, " ").trim();
}

export default function AdminFaqsPage() {
  const [items, setItems] = useState<Faq[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Faq | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  // 검색어/카테고리 변경 시 서버 재조회 (검색어는 300ms 디바운스)
  useEffect(() => {
    const t = setTimeout(() => {
      loadItems({ append: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  // 카테고리 목록은 전체 행에서 수집 (1,000행씩 페이지네이션)
  async function loadCategories() {
    const supabase = createClient();
    const found = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("faqs")
        .select("category")
        .range(offset, offset + 999);
      if (error || !data || data.length === 0) break;
      for (const row of data as { category: string | null }[]) {
        if (row.category) found.add(row.category);
      }
      if (data.length < 1000) break;
    }
    setCategories(Array.from(found).sort());
  }

  async function loadItems({ append }: { append: boolean }) {
    if (append) setLoadingMore(true);
    else setLoading(true);

    const supabase = createClient();
    const offset = append ? items.length : 0;
    let query = supabase
      .from("faqs")
      .select("*", { count: "exact" });

    const term = sanitizeSearch(search);
    if (term) {
      query = query.or(`question.ilike.%${term}%,answer.ilike.%${term}%,category.ilike.%${term}%`);
    }
    if (categoryFilter !== null) {
      query = query.eq("category", categoryFilter);
    }

    const { data, count, error } = await query
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      toast.error("FAQ 목록을 불러오지 못했습니다.");
    } else {
      setTotalCount(count ?? 0);
      setItems((prev) => (append ? [...prev, ...((data as Faq[]) ?? [])] : ((data as Faq[]) ?? [])));
    }
    setLoading(false);
    setLoadingMore(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: Faq) {
    setEditItem(item);
    setForm({
      question: item.question,
      answer: item.answer,
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
    if (!form.question.trim()) {
      toast.error("질문을 입력해주세요.");
      return;
    }
    if (!form.answer.trim()) {
      toast.error("답변을 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      is_active: form.is_active,
    };

    if (editItem) {
      const { data, error } = await (supabase.from("faqs") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();

      if (error) {
        toast.error("FAQ 수정에 실패했습니다.");
      } else {
        setItems((prev) => prev.map((t) => (t.id === editItem.id ? (data as Faq) : t)));
        toast.success("FAQ가 수정되었습니다.");
        closeDialog();
        // 자동 임베딩
        const f = data as Faq;
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "faq", sourceId: f.id, sourceName: f.question, text: `${f.question}\n${f.answer}` }),
        }).catch(() => {});
      }
    } else {
      const { data, error } = await supabase
        .from("faqs")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        toast.error("FAQ 생성에 실패했습니다.");
      } else {
        setItems((prev) => [data as Faq, ...prev]);
        setTotalCount((c) => c + 1);
        if ((data as Faq).category && !categories.includes((data as Faq).category!)) loadCategories();
        toast.success("FAQ가 생성되었습니다.");
        closeDialog();
        // 자동 임베딩
        const f = data as Faq;
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "faq", sourceId: f.id, sourceName: f.question, text: `${f.question}\n${f.answer}` }),
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
      .from("faqs")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("FAQ 삭제에 실패했습니다.");
    } else {
      // 임베딩 청크 삭제
      fetch("/api/admin/embed", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "faq", sourceId: deleteTarget.id }),
      }).catch(() => {});
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success("FAQ가 삭제되었습니다.");
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">FAQ DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">자주 묻는 질문과 답변을 저장합니다. → FAQ 지플릿에서 RAG 검색으로 참조합니다.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          FAQ 추가
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="질문·답변·카테고리로 전체 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="faqs"
        onCategoriesChange={() => { loadCategories(); loadItems({ append: false }); }}
      />

      {!loading && (
        <p className="text-xs text-foreground-secondary mb-3">
          총 {totalCount.toLocaleString()}건 중 {items.length.toLocaleString()}건 표시
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="FAQ가 없습니다"
          description={search ? "검색 조건에 맞는 FAQ가 없습니다." : "첫 번째 FAQ를 추가해보세요."}
          action={!search ? <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" />추가</Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 hover:border-border-hover transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">{item.question}</span>
                  {item.category && (
                    <Badge variant="outline">{item.category}</Badge>
                  )}
                  <Badge variant={item.is_active ? "success" : "outline"}>
                    {item.is_active ? "활성" : "비활성"}
                  </Badge>
                </div>
                <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">{item.answer}</p>
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
          {items.length < totalCount && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => loadItems({ append: true })} loading={loadingMore}>
                더 보기 ({(totalCount - items.length).toLocaleString()}건 남음)
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={editItem ? "FAQ 수정" : "FAQ 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">질문 *</label>
            <Input
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="자주 묻는 질문을 입력하세요"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">답변 *</label>
            <Textarea
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              placeholder="답변을 입력하세요..."
              rows={6}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="faqs"
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
              placeholder="건강, 제품, 사용법 (쉼표로 구분)"
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
        title="FAQ 삭제"
        description={`이 FAQ를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
