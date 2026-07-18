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
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { toast } from "sonner";
import { Package, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { CategoryBar } from "@/components/ui/category-bar";
import type { AdminProduct } from "@/types/database";

interface ProductForm {
  product_number: string;
  name: string;
  price: string;
  score: string;
  description: string;
  keywords: string;
  symptoms: string;
  target_audience: string;
  recommended_situation: string;
  caution: string;
  category: string;
  sub_category: string;
  tags: string;
  aliases: string;
  usana_iq_url: string;
}

const EMPTY_FORM: ProductForm = {
  product_number: "",
  name: "",
  price: "",
  score: "",
  description: "",
  keywords: "",
  symptoms: "",
  target_audience: "",
  recommended_situation: "",
  caution: "",
  category: "",
  sub_category: "",
  tags: "",
  aliases: "",
  usana_iq_url: "",
};

function parseArrayField(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinArrayField(arr: unknown): string {
  if (!arr) return "";
  if (Array.isArray(arr)) return arr.join(", ");
  if (typeof arr === "string") {
    // PostgreSQL array literal "{tag1,tag2}" → parse
    const clean = arr.replace(/^\{|\}$/g, "");
    return clean;
  }
  return "";
}

function productToForm(item: AdminProduct): ProductForm {
  return {
    product_number: item.product_number ?? "",
    name: item.name,
    price: item.price != null ? String(item.price) : "",
    score: item.score != null ? String(item.score) : "",
    description: item.description ?? "",
    keywords: item.keywords ?? "",
    symptoms: item.symptoms ?? "",
    target_audience: item.target_audience ?? "",
    recommended_situation: item.recommended_situation ?? "",
    caution: item.caution ?? "",
    category: item.category ?? "",
    sub_category: item.sub_category ?? "",
    tags: joinArrayField(item.tags),
    aliases: joinArrayField(item.aliases),
    usana_iq_url: item.usana_iq_url ?? "",
  };
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admin_products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("제품 목록을 불러오지 못했습니다.");
    } else {
      setItems((data as AdminProduct[]) ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: AdminProduct) {
    setEditItem(item);
    setForm(productToForm(item));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    setForm(EMPTY_FORM);
  }

  function setField(key: keyof ProductForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("제품명을 입력해주세요.");
      return;
    }
    if (!form.price.trim()) {
      toast.error("가격을 입력해주세요.");
      return;
    }
    if (!form.score.trim()) {
      toast.error("점수를 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      product_number: form.product_number.trim() || null,
      name: form.name.trim(),
      price: Number(form.price),
      score: Number(form.score),
      description: form.description.trim() || null,
      keywords: form.keywords.trim() || null,
      symptoms: form.symptoms.trim() || null,
      target_audience: form.target_audience.trim() || null,
      recommended_situation: form.recommended_situation.trim() || null,
      caution: form.caution.trim() || null,
      category: form.category.trim() || null,
      sub_category: form.sub_category.trim() || null,
      tags: parseArrayField(form.tags) as unknown as string | null,
      aliases: parseArrayField(form.aliases) as unknown as string | null,
      usana_iq_url: form.usana_iq_url.trim() || null,
    };

    if (editItem) {
      const { data, error } = await (supabase.from("admin_products") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();

      if (error) {
        toast.error("제품 수정에 실패했습니다.");
      } else {
        setItems((prev) =>
          prev.map((p) => (p.id === editItem.id ? (data as AdminProduct) : p))
        );
        toast.success("제품이 수정되었습니다.");
        closeDialog();
      }
    } else {
      const { data, error } = await supabase
        .from("admin_products")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        toast.error("제품 추가에 실패했습니다.");
      } else {
        setItems((prev) => [data as AdminProduct, ...prev]);
        toast.success("제품이 추가되었습니다.");
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
      .from("admin_products")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("제품 삭제에 실패했습니다.");
    } else {
      setItems((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success("제품이 삭제되었습니다.");
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  const categories = Array.from(
    new Set(items.map((item) => item.category).filter(Boolean))
  ) as string[];

  const filtered = items.filter(
    (item) =>
      (!search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.product_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.keywords ?? "").toLowerCase().includes(search.toLowerCase())) &&
      (categoryFilter === null || item.category === categoryFilter)
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">제품 DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            USANA 제품 정보를 저장합니다. → 자동견적·건강상담 지플릿에서 참조합니다.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          제품 추가
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제품명, 제품번호 또는 키워드로 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="admin_products"
        onCategoriesChange={loadItems}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="제품이 없습니다"
          description={
            search
              ? "검색 조건에 맞는 제품이 없습니다."
              : "첫 번째 제품을 추가해보세요."
          }
          action={
            !search ? (
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4" />
                추가
              </Button>
            ) : undefined
          }
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
                  {item.product_number && (
                    <span className="text-xs text-foreground-tertiary font-mono">
                      #{item.product_number}
                    </span>
                  )}
                  <span className="font-medium text-foreground truncate">
                    {item.name}
                  </span>
                  {item.category && (
                    <Badge variant="outline">{item.category}</Badge>
                  )}
                  {item.sub_category && (
                    <Badge variant="outline" className="text-foreground-tertiary">
                      {item.sub_category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-foreground-secondary">
                    {item.price.toLocaleString("ko-KR")}원
                  </p>
                  <span className="text-xs text-foreground-tertiary">
                    점수 {item.score}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-foreground-secondary mt-1 line-clamp-1">
                    {item.description}
                  </p>
                )}
                {item.usana_iq_url && (
                  <a
                    href={item.usana_iq_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                  >
                    유사IQ 바로가기
                  </a>
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
        title={editItem ? "제품 수정" : "새 제품 추가"}
        className="md:max-w-2xl"
      >
        <div className="space-y-5">
          {/* 기본 정보 */}
          <div>
            <p className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-3">
              기본 정보
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  제품번호
                </label>
                <Input
                  value={form.product_number}
                  onChange={setField("product_number")}
                  placeholder="예: 100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  제품명 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={setField("name")}
                  placeholder="제품명"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  가격 <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={setField("price")}
                  placeholder="0"
                  min={0}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  점수 <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  value={form.score}
                  onChange={setField("score")}
                  placeholder="0"
                  min={0}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  카테고리
                </label>
                <CategoryCombobox
                  tableName="admin_products"
                  value={form.category}
                  onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  options={categories}
                  placeholder="카테고리 선택 또는 입력 (선택)"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  서브카테고리
                </label>
                <Input
                  value={form.sub_category}
                  onChange={setField("sub_category")}
                  placeholder="예: 비타민"
                />
              </div>
            </div>
          </div>

          {/* 상세 정보 */}
          <div>
            <p className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-3">
              상세 정보
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  설명
                </label>
                <Textarea
                  value={form.description}
                  onChange={setField("description")}
                  placeholder="제품 설명"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    키워드
                  </label>
                  <Input
                    value={form.keywords}
                    onChange={setField("keywords")}
                    placeholder="예: 피로, 활력"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    증상
                  </label>
                  <Input
                    value={form.symptoms}
                    onChange={setField("symptoms")}
                    placeholder="예: 피로감, 무기력"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    대상
                  </label>
                  <Input
                    value={form.target_audience}
                    onChange={setField("target_audience")}
                    placeholder="예: 30대 직장인"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    추천 상황
                  </label>
                  <Input
                    value={form.recommended_situation}
                    onChange={setField("recommended_situation")}
                    placeholder="예: 운동 후, 식사 시"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  주의사항
                </label>
                <Textarea
                  value={form.caution}
                  onChange={setField("caution")}
                  placeholder="주의사항을 입력하세요..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* 태그 */}
          <div>
            <p className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-3">
              태그
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  태그
                </label>
                <Input
                  value={form.tags}
                  onChange={setField("tags")}
                  placeholder="쉼표로 구분 (예: 비타민, 항산화)"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  별명
                </label>
                <Input
                  value={form.aliases}
                  onChange={setField("aliases")}
                  placeholder="쉼표로 구분 (예: 유사나셀제닉스)"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">유사IQ 링크</label>
            <Input
              value={form.usana_iq_url}
              onChange={setField("usana_iq_url")}
              placeholder="https://usanaq.com/... (선택)"
              type="url"
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
        title="제품 삭제"
        description={`"${deleteTarget?.name}" 제품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
