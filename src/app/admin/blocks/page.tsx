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
import { Blocks, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { CategoryBar } from "@/components/ui/category-bar";

interface Block {
  id: string;
  title: string;
  category: string | null;
  content: string;
  // C-1 검색 필드 (20260707000000 마이그레이션). 미적용 환경에선 컬럼이 없어 undefined.
  usage_context?: string | null;
  keywords?: string | null;
  tags?: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = { title: "", category: "", content: "", usage_context: "", keywords: "", tags: "" };

// C-1 확장 컬럼(usage_context/keywords/tags)이 아직 DB에 없을 때(마이그레이션 미적용)
// PostgREST가 돌려주는 에러인지 판별 — 이 경우 기존 3컬럼으로 폴백한다.
function isMissingColumnError(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === "PGRST204" || e.code === "42703" || /column/i.test(e.message ?? ""));
}

// 서버사이드 페이지 크기. Supabase는 요청당 최대 1,000행만 반환하므로, 전체(5,800+)를
// 한 번에 불러오는 방식은 예전 자료가 화면·검색에서 통째로 사라져 보이는 사고를 냈다(7/5).
// 검색·카테고리 필터를 DB 쿼리로 보내고 "더 보기"로 이어 불러온다.
const PAGE_SIZE = 100;

// PostgREST or() 필터 구분자와 충돌하는 문자를 검색어에서 제거
function sanitizeSearch(s: string): string {
  return s.replace(/[,()%]/g, " ").trim();
}

export default function AdminBlocksPage() {
  const [items, setItems] = useState<Block[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Block | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Block | null>(null);
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

  // 카테고리 목록은 화면에 로드된 일부가 아니라 전체 행에서 수집한다 (1,000행씩 페이지네이션)
  async function loadCategories() {
    const supabase = createClient();
    const found = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("admin_blocks")
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
    const term = sanitizeSearch(search);

    const buildQuery = (extended: boolean) => {
      let query = supabase
        .from("admin_blocks")
        .select("*", { count: "exact" });
      if (term) {
        const cols = extended
          ? ["title", "category", "content", "usage_context", "keywords", "tags"]
          : ["title", "category", "content"];
        query = query.or(cols.map((c) => `${c}.ilike.%${term}%`).join(","));
      }
      if (categoryFilter !== null) {
        query = query.eq("category", categoryFilter);
      }
      return query
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
    };

    // C-1: 사용상황·키워드·태그까지 검색. 컬럼 미존재(마이그레이션 미적용) 시 기존 3컬럼으로 폴백
    let { data, count, error } = await buildQuery(true);
    if (error && term && isMissingColumnError(error)) {
      ({ data, count, error } = await buildQuery(false));
    }

    if (error) {
      toast.error("블록 목록을 불러오지 못했습니다.");
    } else {
      setTotalCount(count ?? 0);
      setItems((prev) => (append ? [...prev, ...((data as Block[]) ?? [])] : ((data as Block[]) ?? [])));
    }
    setLoading(false);
    setLoadingMore(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: Block) {
    setEditItem(item);
    setForm({
      title: item.title,
      category: item.category ?? "",
      content: item.content,
      usage_context: item.usage_context ?? "",
      keywords: item.keywords ?? "",
      tags: item.tags ?? "",
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
    if (!form.content.trim()) {
      toast.error("내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const basePayload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      content: form.content.trim(),
    };
    // C-1 검색 필드 — 컬럼 미존재(마이그레이션 미적용) 시 basePayload만으로 재시도한다.
    const payload = {
      ...basePayload,
      usage_context: form.usage_context.trim() || null,
      keywords: form.keywords.trim() || null,
      tags: form.tags.trim() || null,
    };
    // 임베딩 텍스트에도 사용상황·키워드를 포함해 의미 검색 적중률을 높인다.
    const embedText = (b: Block) =>
      [b.title, b.usage_context, b.keywords, b.tags, b.content].filter(Boolean).join("\n");

    if (editItem) {
      let { data, error } = await (supabase.from("admin_blocks") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();
      if (error && isMissingColumnError(error)) {
        ({ data, error } = await (supabase.from("admin_blocks") as any)
          .update(basePayload)
          .eq("id", editItem.id)
          .select()
          .single());
        if (!error) toast.info("검색 필드(사용상황·키워드·태그) 컬럼이 아직 DB에 없어 제목·카테고리·내용만 저장되었습니다.");
      }

      if (error) {
        toast.error("블록 수정에 실패했습니다.");
      } else {
        setItems((prev) => prev.map((b) => (b.id === editItem.id ? (data as Block) : b)));
        toast.success("블록이 수정되었습니다.");
        closeDialog();
        // 자동 임베딩
        const b = data as Block;
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "admin_block", sourceId: b.id, sourceName: b.title, text: embedText(b) }),
        }).catch(() => {});
      }
    } else {
      let { data, error } = await (supabase.from("admin_blocks") as any)
        .insert(payload)
        .select()
        .single();
      if (error && isMissingColumnError(error)) {
        ({ data, error } = await (supabase.from("admin_blocks") as any)
          .insert(basePayload)
          .select()
          .single());
        if (!error) toast.info("검색 필드(사용상황·키워드·태그) 컬럼이 아직 DB에 없어 제목·카테고리·내용만 저장되었습니다.");
      }

      if (error) {
        toast.error("블록 생성에 실패했습니다.");
      } else {
        setItems((prev) => [data as Block, ...prev]);
        setTotalCount((c) => c + 1);
        if ((data as Block).category && !categories.includes((data as Block).category!)) loadCategories();
        toast.success("블록이 생성되었습니다.");
        closeDialog();
        // 자동 임베딩
        const b = data as Block;
        fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "admin_block", sourceId: b.id, sourceName: b.title, text: embedText(b) }),
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
      .from("admin_blocks")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("블록 삭제에 실패했습니다.");
    } else {
      // 임베딩 청크 삭제
      fetch("/api/admin/embed", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "admin_block", sourceId: deleteTarget.id }),
      }).catch(() => {});
      setItems((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success("블록이 삭제되었습니다.");
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">스크립트 DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">카카오톡 문구·상담 멘트·고객 응대 스크립트를 저장합니다. → 스크립트 지플릿에서 RAG 검색으로 참조합니다.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          블록 추가
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목·카테고리·내용으로 전체 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="admin_blocks"
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
          icon={Blocks}
          title="블록이 없습니다"
          description={search ? "검색 조건에 맞는 블록이 없습니다." : "첫 번째 블록을 추가해보세요."}
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
                  <span className="font-medium text-foreground truncate">{item.title}</span>
                  {item.category && (
                    <Badge variant="outline">{item.category}</Badge>
                  )}
                </div>
                <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">{item.content}</p>
                {(item.usage_context || item.keywords) && (
                  <p className="text-xs text-foreground-tertiary mt-1 truncate">
                    {item.usage_context ? `사용상황: ${item.usage_context}` : ""}
                    {item.usage_context && item.keywords ? " · " : ""}
                    {item.keywords ? `키워드: ${item.keywords}` : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(item.updated_at), "yyyy.MM.dd HH:mm", { locale: ko })}
                </p>
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
        title={editItem ? "블록 수정" : "블록 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">제목 *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="블록 제목"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="admin_blocks"
              value={form.category}
              onChange={(val) => setForm((f) => ({ ...f, category: val }))}
              options={categories}
              placeholder="카테고리 (선택)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">사용상황</label>
            <Input
              value={form.usage_context}
              onChange={(e) => setForm((f) => ({ ...f, usage_context: e.target.value }))}
              placeholder="예: 첫 상담에서 영양제 필요성을 물을 때"
            />
            <p className="text-xs text-foreground-tertiary mt-1">
              어떤 상황에서 쓰는 스크립트인지 적으면 &quot;이런 사람에게 뭐라고 말할까&quot; 같은 상황 질문에서도 검색됩니다.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">검색 키워드 (쉼표로 구분)</label>
            <Input
              value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              placeholder="예: 청소기 비유, 자동차 정기점검, 근육통"
            />
            <p className="text-xs text-foreground-tertiary mt-1">
              본문에 없는 표현도 여기에 적으면 챗봇이 이 스크립트를 찾아옵니다.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">태그 (쉼표로 구분)</label>
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="예: 비유, 말버전, 질문지, 사례"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">내용 *</label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="블록 내용을 입력하세요..."
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
        title="블록 삭제"
        description={`"${deleteTarget?.title}" 블록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
