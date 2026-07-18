"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { CategoryBar } from "@/components/ui/category-bar";
import { toast } from "sonner";
import { ImageIcon, Plus, Search, Pencil, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AdminImage {
  id: string;
  title: string;
  description: string | null;
  script: string | null;
  image_url: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  tags: string[] | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  script: "",
  category: "",
  tags: "",
  is_active: true,
};

export default function AdminImagesPage() {
  const [items, setItems] = useState<AdminImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdminImage | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  // 편집 모드에서 기존 이미지 URL (새 파일 선택 전)
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminImage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admin_images")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("이미지 목록을 불러오지 못했습니다.");
    } else {
      setItems((data as AdminImage[]) ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setEditPreviewUrl(null);
    setDialogOpen(true);
  }

  function openEdit(item: AdminImage) {
    setEditItem(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      script: item.script ?? "",
      category: item.category ?? "",
      tags: (item.tags ?? []).join(", "),
      is_active: item.is_active,
    });
    setSelectedFiles([]);
    setPreviewUrls([]);
    setEditPreviewUrl(item.image_url);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    setForm(EMPTY_FORM);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setEditPreviewUrl(null);
    setUploadProgress(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const invalid = files.find((f) => !allowed.includes(f.type));
    if (invalid) {
      toast.error("JPG, PNG, GIF, WEBP 파일만 업로드 가능합니다.");
      return;
    }
    const oversized = files.find((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      toast.error(`"${oversized.name}" 파일 크기는 10MB 이하여야 합니다.`);
      return;
    }

    setSelectedFiles(files);
    setPreviewUrls(files.map((f) => URL.createObjectURL(f)));
    setEditPreviewUrl(null);
    if (!form.title && files.length > 0) {
      setForm((f) => ({ ...f, title: files[0].name.replace(/\.[^.]+$/, "") }));
    }
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    if (!editItem && selectedFiles.length === 0) {
      toast.error("이미지 파일을 선택해주세요.");
      return;
    }

    setSaving(true);

    // 편집 모드: 기존 단일 파일 처리
    if (editItem) {
      const formData = new FormData();
      formData.append("title", form.title.trim());
      formData.append("description", form.description.trim());
      formData.append("script", form.script.trim());
      formData.append("category", form.category.trim());
      formData.append("tags", form.tags);
      formData.append("is_active", String(form.is_active));
      if (selectedFiles.length > 0) formData.append("file", selectedFiles[0]);

      try {
        const res = await fetch(`/api/admin/images/${editItem.id}`, {
          method: "PATCH",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "저장에 실패했습니다.");
        } else {
          setItems((prev) =>
            prev.map((t) => (t.id === editItem.id ? json.image : t))
          );
          toast.success("이미지가 수정되었습니다.");
          closeDialog();
        }
      } catch {
        toast.error("네트워크 오류가 발생했습니다.");
      }
      setSaving(false);
      return;
    }

    // 추가 모드: 여러 파일을 순차 업로드
    const total = selectedFiles.length;
    const baseTitle = form.title.trim();
    const added: AdminImage[] = [];

    for (let i = 0; i < total; i++) {
      setUploadProgress({ current: i + 1, total });

      const file = selectedFiles[i];
      const title = total > 1 ? `${baseTitle} (${i + 1})` : baseTitle;

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", form.description.trim());
      formData.append("script", form.script.trim());
      formData.append("category", form.category.trim());
      formData.append("tags", form.tags);
      formData.append("is_active", String(form.is_active));
      formData.append("file", file);

      try {
        const res = await fetch("/api/admin/images", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) {
          toast.error(`"${file.name}" 업로드 실패: ${json.error ?? "알 수 없는 오류"}`);
        } else {
          added.push(json.image as AdminImage);
        }
      } catch {
        toast.error(`"${file.name}" 업로드 중 네트워크 오류가 발생했습니다.`);
      }
    }

    if (added.length > 0) {
      setItems((prev) => [...added.reverse(), ...prev]);
      toast.success(
        total > 1
          ? `${total}장 중 ${added.length}장 추가되었습니다.`
          : "이미지가 추가되었습니다."
      );
    }

    setSaving(false);
    setUploadProgress(null);
    if (added.length === total) closeDialog();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const res = await fetch(`/api/admin/images/${deleteTarget.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      toast.error("삭제에 실패했습니다.");
    } else {
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("이미지가 삭제되었습니다.");
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
      (item.script ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      categoryFilter === null || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">이미지 DB</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            마케팅 이미지·비포애프터 자료를 저장합니다. → 이미지 스크립트로 RAG 검색됩니다.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          이미지 추가
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목, 스크립트, 카테고리로 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="admin_images"
        onCategoriesChange={loadItems}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="이미지가 없습니다"
          description={
            search
              ? "검색 조건에 맞는 이미지가 없습니다."
              : "첫 번째 이미지를 추가해보세요."
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-surface overflow-hidden hover:border-border-hover transition-colors"
            >
              {/* 이미지 썸네일 */}
              <div className="aspect-video bg-muted relative">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-foreground-tertiary" />
                  </div>
                )}
              </div>

              {/* 정보 */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">
                        {item.title}
                      </span>
                      <Badge variant={item.is_active ? "success" : "outline"}>
                        {item.is_active ? "활성" : "비활성"}
                      </Badge>
                    </div>
                    {item.category && (
                      <Badge variant="outline" className="mt-1">
                        {item.category}
                      </Badge>
                    )}
                    {item.script && (
                      <p className="text-xs text-foreground-secondary mt-1.5 line-clamp-2">
                        {item.script}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(item)}
                    >
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 다이얼로그 */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={editItem ? "이미지 수정" : "이미지 추가"}
        className="md:max-w-lg"
      >
        <div className="space-y-4">
          {/* 이미지 업로드 */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              이미지 파일 {!editItem && "*"}
              {!editItem && (
                <span className="ml-1.5 text-xs font-normal text-foreground-tertiary">
                  (여러 장 선택 가능)
                </span>
              )}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              className="hidden"
              multiple={!editItem}
            />

            {/* 편집 모드: 기존 단일 이미지 */}
            {editItem && (
              <>
                {editPreviewUrl || previewUrls.length > 0 ? (
                  <div className="relative rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrls[0] ?? editPreviewUrl ?? ""}
                      alt="미리보기"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFiles([]);
                        setPreviewUrls([]);
                        setEditPreviewUrl(editItem?.image_url ?? null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white hover:bg-black/80 transition-colors"
                    >
                      교체
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-border-hover flex flex-col items-center justify-center gap-2 transition-colors text-foreground-tertiary hover:text-foreground"
                  >
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">클릭하여 이미지 업로드</span>
                    <span className="text-xs">JPG, PNG, GIF, WEBP · 최대 10MB</span>
                  </button>
                )}
              </>
            )}

            {/* 추가 모드: 다중 이미지 */}
            {!editItem && (
              <>
                {previewUrls.length > 0 ? (
                  <div className="space-y-2">
                    <div className={`grid gap-2 ${previewUrls.length === 1 ? "grid-cols-1" : previewUrls.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {previewUrls.map((url, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`미리보기 ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(i)}
                            className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {previewUrls.length > 1 && (
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                              {i + 1}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 rounded-lg border border-dashed border-border hover:border-border-hover flex items-center justify-center gap-2 text-sm transition-colors text-foreground-tertiary hover:text-foreground"
                    >
                      <Upload className="h-4 w-4" />
                      다시 선택
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-border-hover flex flex-col items-center justify-center gap-2 transition-colors text-foreground-tertiary hover:text-foreground"
                  >
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">클릭하여 이미지 업로드</span>
                    <span className="text-xs">여러 장 동시 선택 가능 · JPG, PNG, GIF, WEBP · 최대 10MB</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* 제목 */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              제목 *
            </label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="이미지 제목"
            />
          </div>

          {/* 이미지 스크립트 (RAG 핵심) */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              이미지 스크립트
              <span className="ml-1.5 text-xs font-normal text-foreground-tertiary">
                (RAG 검색에 사용됩니다)
              </span>
            </label>
            <Textarea
              value={form.script}
              onChange={(e) => setForm((f) => ({ ...f, script: e.target.value }))}
              placeholder="이 이미지가 언제/어떤 상황에서 쓰이는지 상세히 설명하세요. 예) 비포애프터 비교 이미지, 30대 여성 체중 감량 성공 사례, 10kg 감량, 3개월..."
              rows={4}
            />
          </div>

          {/* 설명 (짧은 부가 정보) */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              설명 <span className="text-xs font-normal text-foreground-tertiary">(선택)</span>
            </label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="짧은 부가 설명 (선택)"
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              카테고리
            </label>
            <CategoryCombobox
              tableName="admin_images"
              value={form.category}
              onChange={(v) => setForm((f) => ({ ...f, category: v }))}
              options={categories}
              placeholder="카테고리 선택 또는 입력 (선택)"
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              태그 <span className="text-xs font-normal text-foreground-tertiary">(쉼표로 구분)</span>
            </label>
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="비포애프터, 성공사례, 제품 (쉼표로 구분)"
            />
          </div>

          {/* 활성화 */}
          <div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
                className="rounded"
              />
              활성화
            </label>
          </div>

          {uploadProgress && (
            <div className="text-sm text-foreground-secondary text-center py-1">
              {uploadProgress.total}장 중 {uploadProgress.current}장 업로드 중...
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={closeDialog}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editItem ? "수정" : (selectedFiles.length > 1 ? `${selectedFiles.length}장 추가` : "추가")}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="이미지 삭제"
        description={`"${deleteTarget?.title}" 이미지를 삭제하시겠습니까? 스토리지 파일도 함께 삭제됩니다.`}
        confirmText="삭제"
        loading={deleting}
      />
    </div>
  );
}
