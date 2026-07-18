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
import { Package2, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { CategoryBar } from "@/components/ui/category-bar";

interface PackageComponent {
  product_name: string;
  quantity: number;
}

interface AdminPackage {
  id: string;
  name: string;
  components: PackageComponent[] | null;
  price: number;
  score: number;
  benefit: string | null;
  discount_rate: number | null;
  is_active: boolean;
  category: string | null;
  tags: string[] | null;
  created_at: string;
}

const EMPTY_FORM = {
  name: "",
  price: "",
  score: "",
  benefit: "",
  discount_rate: "",
  is_active: true,
  category: "",
  tags: "",
};

export default function AdminPackagesPage() {
  const [items, setItems] = useState<AdminPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdminPackage | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminPackage | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 구성품(제품명+수량) 편집 상태 — 자동견적 계산의 데이터 원천이라 구조화 입력으로 관리
  const [components, setComponents] = useState<PackageComponent[]>([]);
  // 제품명 자동완성용 제품 이름 목록
  const [productNames, setProductNames] = useState<string[]>([]);

  useEffect(() => {
    loadItems();
    loadProductNames();
  }, []);

  async function loadProductNames() {
    const supabase = createClient();
    const { data } = await supabase.from("admin_products").select("name").order("name");
    setProductNames(((data as { name: string }[] | null) ?? []).map((p) => p.name));
  }

  async function loadItems() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admin_packages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("패키지 목록을 불러오지 못했습니다.");
    } else {
      setItems((data as AdminPackage[]) ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setComponents([]);
    setDialogOpen(true);
  }

  function openEdit(item: AdminPackage) {
    setEditItem(item);
    setForm({
      name: item.name,
      price: String(item.price),
      score: String(item.score),
      benefit: item.benefit ?? "",
      discount_rate: item.discount_rate != null ? String(item.discount_rate) : "",
      is_active: item.is_active,
      category: item.category ?? "",
      tags: (item.tags ?? []).join(", "),
    });
    setComponents(
      (item.components ?? [])
        .filter((c) => c && typeof c.product_name === "string")
        .map((c) => ({ product_name: c.product_name, quantity: Number(c.quantity) || 1 }))
    );
    setDialogOpen(true);
  }

  function addComponent() {
    setComponents((prev) => [...prev, { product_name: "", quantity: 1 }]);
  }

  function updateComponent(idx: number, patch: Partial<PackageComponent>) {
    setComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeComponent(idx: number) {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  }

  // 혜택 설명글에서 구성품을 파싱해 행을 채운다. 7/5 일괄 반영 배치와 동일 규칙:
  // "최종 구성" > "■ 구성" > "구성" 섹션의 "제품명 N통|팩|개|병|박스|세트|매" 줄.
  function importFromBenefit() {
    const lines = form.benefit.split("\n").map((l) => l.trim());
    let start = lines.findIndex((l) => /^최종\s*구성/.test(l));
    if (start === -1) start = lines.findIndex((l) => /^■\s*구성\s*$/.test(l));
    if (start === -1) start = lines.findIndex((l) => /^구성\s*$/.test(l));
    if (start === -1) {
      toast.error('설명글에서 "구성" 섹션을 찾지 못했습니다. "구성" 제목 아래 "제품명 1통" 형식으로 적어주세요.');
      return;
    }
    const parsed: PackageComponent[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      let l = lines[i];
      if (!l) { if (parsed.length > 0) break; else continue; }
      if (/^(■|ㅡ|총액|총점|가격|출처)/.test(l)) break;
      l = l.replace(/^[-•]\s*/, "");
      const m = l.match(/^(.+?)\s+(\d+)\s*(통|팩|개|병|박스|세트|매)\s*$/);
      if (m) parsed.push({ product_name: m[1].trim(), quantity: parseInt(m[2], 10) });
      else if (parsed.length > 0) break;
    }
    if (parsed.length === 0) {
      toast.error('구성품을 파싱하지 못했습니다. "헬스팩 1통" 같은 형식인지 확인해주세요.');
      return;
    }
    setComponents(parsed);
    toast.success(`설명글에서 구성품 ${parsed.length}개를 불러왔습니다.`);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    setForm(EMPTY_FORM);
    setComponents([]);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("패키지 이름을 입력해주세요.");
      return;
    }
    if (!form.price || isNaN(Number(form.price))) {
      toast.error("올바른 가격을 입력해주세요.");
      return;
    }
    if (!form.score || isNaN(Number(form.score))) {
      toast.error("올바른 점수를 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: form.name.trim(),
      // 구성품은 다이얼로그의 구조화 편집기(components 상태)에서 저장한다.
      // 이름이 빈 행은 제외. 자동견적(package-quote-engine)이 이 값을 소비한다.
      components: components
        .filter((c) => c.product_name.trim())
        .map((c) => ({ product_name: c.product_name.trim(), quantity: Math.max(1, Number(c.quantity) || 1) })),
      price: parseInt(form.price, 10),
      score: parseInt(form.score, 10),
      benefit: form.benefit.trim() || null,
      discount_rate: form.discount_rate ? parseFloat(form.discount_rate) : null,
      is_active: form.is_active,
      category: form.category.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
    };

    if (editItem) {
      const { data, error } = await (supabase.from("admin_packages") as any)
        .update(payload)
        .eq("id", editItem.id)
        .select()
        .single();

      if (error) {
        console.error("패키지 수정 오류:", error);
        toast.error(`패키지 수정에 실패했습니다. (${error.message})`);
      } else {
        setItems((prev) => prev.map((t) => (t.id === editItem.id ? (data as AdminPackage) : t)));
        toast.success("패키지가 수정되었습니다.");
        closeDialog();
      }
    } else {
      const { data, error } = await supabase
        .from("admin_packages")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        console.error("패키지 생성 오류:", error);
        toast.error(`패키지 생성에 실패했습니다. (${error.message})`);
      } else {
        setItems((prev) => [data as AdminPackage, ...prev]);
        toast.success("패키지가 생성되었습니다.");
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
      .from("admin_packages")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("패키지 삭제에 실패했습니다.");
    } else {
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("패키지가 삭제되었습니다.");
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
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      categoryFilter === null || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">패키지 DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">제품 묶음 패키지를 저장합니다. → 자동견적 지플릿에서 참조합니다.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          패키지 추가
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 카테고리로 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="admin_packages"
        onCategoriesChange={loadItems}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package2}
          title="패키지가 없습니다"
          description={search ? "검색 조건에 맞는 패키지가 없습니다." : "첫 번째 패키지를 추가해보세요."}
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
                  <span className="font-medium text-foreground truncate">{item.name}</span>
                  {item.category && (
                    <Badge variant="outline">{item.category}</Badge>
                  )}
                  <Badge variant={item.is_active ? "success" : "outline"}>
                    {item.is_active ? "활성" : "비활성"}
                  </Badge>
                  {(item.components?.length ?? 0) > 0 ? (
                    <Badge variant="outline">구성품 {item.components!.length}개</Badge>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">구성품 없음</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-foreground-secondary">
                    {item.price.toLocaleString()}원
                  </span>
                  <span className="text-xs text-foreground-secondary">
                    {item.score}점
                  </span>
                  {item.discount_rate != null && (
                    <span className="text-xs text-foreground-secondary">
                      할인율 {item.discount_rate}%
                    </span>
                  )}
                </div>
                {item.benefit && (
                  <p className="text-xs text-foreground-secondary mt-1 line-clamp-1">{item.benefit}</p>
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
        title={editItem ? "패키지 수정" : "패키지 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">패키지 이름 *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="패키지 이름을 입력하세요"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">가격 (원) *</label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="예: 150000"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">점수 *</label>
              <Input
                type="number"
                value={form.score}
                onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                placeholder="예: 120"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">할인율 (%)</label>
            <Input
              type="number"
              value={form.discount_rate}
              onChange={(e) => setForm((f) => ({ ...f, discount_rate: e.target.value }))}
              placeholder="예: 10.5 (선택)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">혜택 설명</label>
            <Textarea
              value={form.benefit}
              onChange={(e) => setForm((f) => ({ ...f, benefit: e.target.value }))}
              placeholder="혜택 설명을 입력하세요 (선택)"
              rows={3}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground block">
                구성품 <span className="text-xs font-normal text-foreground-tertiary">(자동견적 계산에 사용)</span>
              </label>
              <Button size="sm" variant="outline" onClick={importFromBenefit} type="button">
                설명글에서 불러오기
              </Button>
            </div>
            {components.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                구성품이 없으면 이 패키지는 자동견적 추천에서 구성 내역 없이 표시됩니다.
              </p>
            )}
            <div className="space-y-2">
              {components.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={c.product_name}
                    onChange={(e) => updateComponent(idx, { product_name: e.target.value })}
                    placeholder="제품명 (예: 헬스팩)"
                    list="package-product-names"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={String(c.quantity)}
                    onChange={(e) => updateComponent(idx, { quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-20"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => removeComponent(idx)}
                    className="text-destructive hover:text-destructive flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <datalist id="package-product-names">
              {productNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <Button size="sm" variant="outline" onClick={addComponent} type="button" className="mt-2">
              <Plus className="h-4 w-4" />
              구성품 추가
            </Button>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="admin_packages"
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
              placeholder="예: 다이어트, 해독 (쉼표로 구분)"
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
        title="패키지 삭제"
        description="이 패키지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
