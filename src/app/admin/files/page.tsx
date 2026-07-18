"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Upload,
  Search,
  Trash2,
  FileText,
  FileSpreadsheet,
  File,
  Power,
  PowerOff,
  Download,
  AlertTriangle,
} from "lucide-react";
import { CategoryBar } from "@/components/ui/category-bar";
import type { AdminFile } from "@/types/database";

const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".xlsx"];
const ACCEPTED = SUPPORTED_EXTENSIONS.join(",");
const PAGE_SIZE = 50;

type AdminFilesListResponse = {
  files: AdminFile[];
  categories: string[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  error?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  const type = fileType.toLowerCase();
  if (type === "pdf" || type === "txt") {
    return <FileText className="h-5 w-5 text-foreground-tertiary flex-shrink-0" />;
  }
  if (type === "xlsx" || type === "xls" || type === "csv") {
    return <FileSpreadsheet className="h-5 w-5 text-foreground-tertiary flex-shrink-0" />;
  }
  return <File className="h-5 w-5 text-foreground-tertiary flex-shrink-0" />;
}

export default function AdminFilesPage() {
  const [items, setItems] = useState<AdminFile[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");

  // Detail(본문 미리보기) dialog state
  const [detailTarget, setDetailTarget] = useState<AdminFile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    content: string;
    content_truncated: boolean;
    chunk_count: number;
    download_url: string | null;
  } | null>(null);
  const [keywordsDraft, setKeywordsDraft] = useState("");
  const [savingKeywords, setSavingKeywords] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async ({
    offset = 0,
    append = false,
    signal,
  }: {
    offset?: number;
    append?: boolean;
    signal?: AbortSignal;
  } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/admin/files?${params.toString()}`, {
        signal,
        cache: "no-store",
      });
      const json = (await res.json()) as AdminFilesListResponse;

      if (!res.ok) {
        toast.error(json.error ?? "파일 목록을 불러오지 못했습니다.");
        return;
      }

      setItems((prev) => (append ? [...prev, ...(json.files ?? [])] : json.files ?? []));
      setCategories(json.categories ?? []);
      setTotal(json.total ?? 0);
      setHasMore(!!json.hasMore);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("파일 목록을 불러오지 못했습니다.");
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [categoryFilter, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadItems({ offset: 0, signal: controller.signal });
    }, search ? 300 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadItems, search]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so same file can be re-selected
    e.target.value = "";

    setPendingFile(file);
    setDescription("");
    setUploadCategory("");
    setUploadDialogOpen(true);
  }

  function closeUploadDialog() {
    setUploadDialogOpen(false);
    setPendingFile(null);
    setDescription("");
    setUploadCategory("");
  }

  async function handleUpload() {
    if (!pendingFile) return;

    // Vercel 서버리스 함수 요청 본문 최대 크기: 4.5MB
    const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024;
    if (pendingFile.size > VERCEL_BODY_LIMIT) {
      toast.error(`파일 크기가 너무 큽니다. 최대 4.5MB까지 업로드할 수 있습니다. (현재: ${(pendingFile.size / 1024 / 1024).toFixed(1)}MB)`);
      closeUploadDialog();
      return;
    }

    setUploading(true);
    closeUploadDialog();

    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      if (uploadCategory.trim()) {
        formData.append("category", uploadCategory.trim());
      }

      const res = await fetch("/api/admin/files", {
        method: "POST",
        body: formData,
      });

      // 413은 Vercel 인프라 응답(JSON 아님)이므로 별도 처리
      if (res.status === 413) {
        toast.error("파일 크기가 너무 큽니다. 최대 4.5MB까지 업로드할 수 있습니다.");
        setUploading(false);
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "파일 업로드에 실패했습니다.");
      } else {
        await loadItems({ offset: 0 });
        toast.success("파일이 업로드되었습니다.");
      }
    } catch (err) {
      console.error("파일 업로드 오류:", err);
      toast.error("파일 업로드에 실패했습니다.");
    }

    setUploading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/files/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "파일 삭제에 실패했습니다.");
      } else {
        setItems((prev) => prev.filter((f) => f.id !== deleteTarget.id));
        toast.success("파일이 삭제되었습니다.");
        setDeleteTarget(null);
      }
    } catch {
      toast.error("파일 삭제에 실패했습니다.");
    }

    setDeleting(false);
  }

  async function handleToggleActive(item: AdminFile) {
    const nextActive = !item.is_active;
    setTogglingId(item.id);

    try {
      const res = await fetch(`/api/admin/files/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "상태 변경에 실패했습니다.");
      } else {
        setItems((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, is_active: nextActive } : f))
        );
        toast.success(nextActive ? "활성화되었습니다." : "비활성화되었습니다.");
      }
    } catch {
      toast.error("상태 변경에 실패했습니다.");
    }

    setTogglingId(null);
  }

  async function openDetail(item: AdminFile) {
    setDetailTarget(item);
    setKeywordsDraft(item.keywords ?? "");
    setDetailData(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/files/${item.id}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "파일 내용을 불러오지 못했습니다.");
      } else {
        setDetailData({
          content: json.content ?? "",
          content_truncated: !!json.content_truncated,
          chunk_count: json.chunk_count ?? 0,
          download_url: json.download_url ?? null,
        });
        setKeywordsDraft((json.file as AdminFile)?.keywords ?? item.keywords ?? "");
      }
    } catch {
      toast.error("파일 내용을 불러오지 못했습니다.");
    }

    setDetailLoading(false);
  }

  function closeDetail() {
    setDetailTarget(null);
    setDetailData(null);
    setKeywordsDraft("");
  }

  async function handleSaveKeywords() {
    if (!detailTarget) return;
    setSavingKeywords(true);

    try {
      const res = await fetch(`/api/admin/files/${detailTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: keywordsDraft }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "키워드 저장에 실패했습니다.");
      } else {
        const updated = json.file as AdminFile;
        setItems((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        setDetailTarget(updated);
        toast.success("검색 키워드가 저장되었습니다.");
      }
    } catch {
      toast.error("키워드 저장에 실패했습니다.");
    }

    setSavingKeywords(false);
  }

  const filtered = items;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">레퍼런스 파일</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            PDF 등 참고 문서를 업로드합니다. → 레퍼런스 DB 지플릿에서 RAG 검색으로 참조합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {uploading && <Spinner size="sm" />}
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            파일 업로드
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="파일명 검색..."
          className="pl-9"
        />
      </div>

      <CategoryBar
        categories={categories}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        tableName="admin_files"
        onCategoriesChange={() => void loadItems({ offset: 0 })}
      />

      <div className="mb-3 text-xs text-foreground-tertiary">
        총 {total.toLocaleString()}개 중 {items.length.toLocaleString()}개 표시
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="업로드된 파일이 없습니다"
          description={
            search
              ? "검색 조건에 맞는 파일이 없습니다."
              : "첫 번째 파일을 업로드해보세요."
          }
          action={
            !search ? (
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
                업로드
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => openDetail(item)}
              className={`flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 hover:border-border-hover transition-colors cursor-pointer ${
                item.is_active ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileTypeIcon fileType={item.file_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {item.file_name}
                    </span>
                    <span className="text-xs text-foreground-secondary flex-shrink-0">
                      {item.file_type.toUpperCase()}
                    </span>
                    <Badge variant={item.is_active ? "success" : "outline"}>
                      {item.is_active ? "활성" : "비활성"}
                    </Badge>
                    {item.category && (
                      <Badge variant="outline">{item.category}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-foreground-secondary">
                      {formatFileSize(item.file_size)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "yyyy.MM.dd HH:mm", {
                        locale: ko,
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive(item);
                  }}
                  disabled={togglingId === item.id}
                  title={item.is_active ? "비활성화 (RAG 검색에서 제외)" : "활성화 (RAG 검색에 포함)"}
                  className="text-foreground-secondary hover:text-foreground"
                >
                  {item.is_active ? (
                    <Power className="h-4 w-4" />
                  ) : (
                    <PowerOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(item);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => void loadItems({ offset: items.length, append: true })}
                disabled={loadingMore}
              >
                {loadingMore ? "불러오는 중..." : "더 보기"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Upload description dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={closeUploadDialog}
        title="파일 업로드"
        className="md:max-w-md"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-foreground-secondary">
              <span className="font-medium text-foreground">{pendingFile?.name}</span>
              {pendingFile && (
                <span className="ml-2 text-xs">({formatFileSize(pendingFile.size)})</span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              설명 (선택)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="파일에 대한 설명을 입력하세요"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
            <CategoryCombobox
              tableName="admin_files"
              value={uploadCategory}
              onChange={(v) => setUploadCategory(v)}
              options={categories}
              placeholder="카테고리 선택 또는 입력 (선택)"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeUploadDialog}>
              취소
            </Button>
            <Button onClick={handleUpload}>
              업로드
            </Button>
          </div>
        </div>
      </Dialog>

      {/* File detail / body preview dialog */}
      <Dialog
        open={!!detailTarget}
        onClose={closeDetail}
        title={detailTarget?.file_name ?? "파일 상세"}
        className="md:max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap text-xs text-foreground-secondary">
            <Badge variant={detailTarget?.is_active ? "success" : "outline"}>
              {detailTarget?.is_active ? "활성" : "비활성"}
            </Badge>
            {detailTarget?.category && <Badge variant="outline">{detailTarget.category}</Badge>}
            <span>{detailTarget ? formatFileSize(detailTarget.file_size) : ""}</span>
            <span>
              {detailTarget
                ? format(new Date(detailTarget.created_at), "yyyy.MM.dd HH:mm", { locale: ko })
                : ""}
            </span>
            {detailData && (
              <span>청크 {detailData.chunk_count}개</span>
            )}
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : detailData ? (
            <>
              {detailData.chunk_count === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>
                    본문이 추출되지 않았습니다. 이 파일은 AI 검색(RAG)에 반영되지 않은 상태입니다.
                    스캔본 PDF이거나 추출 품질 미달로 보류됐을 수 있습니다. 텍스트(.txt)로 변환해 다시
                    업로드하면 반영됩니다.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    추출된 본문 미리보기
                    {detailData.content_truncated && (
                      <span className="ml-2 text-xs font-normal text-foreground-tertiary">
                        (앞 20,000자까지 표시)
                      </span>
                    )}
                  </label>
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-hover p-3 text-xs text-foreground-secondary whitespace-pre-wrap break-words">
                    {detailData.content || "(내용 없음)"}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  검색 키워드 (쉼표로 구분)
                </label>
                <Input
                  value={keywordsDraft}
                  onChange={(e) => setKeywordsDraft(e.target.value)}
                  placeholder="예: 암웨이, 센트룸, 영양제 등급, 별점"
                />
                <p className="text-xs text-foreground-tertiary mt-1">
                  영문 자료도 여기에 적은 한글 키워드로 챗봇이 찾아올 수 있습니다.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                {detailData.download_url ? (
                  <a
                    href={detailData.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                    원본 다운로드
                  </a>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={closeDetail}>
                    닫기
                  </Button>
                  <Button onClick={handleSaveKeywords} disabled={savingKeywords}>
                    {savingKeywords ? "저장 중..." : "키워드 저장"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-foreground-secondary py-6 text-center">
              내용을 불러오지 못했습니다.
            </p>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="파일 삭제"
        description={`"${deleteTarget?.file_name}" 파일을 삭제하시겠습니까? 스토리지에서도 완전히 삭제되며 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleting}
      />

    </div>
  );
}
