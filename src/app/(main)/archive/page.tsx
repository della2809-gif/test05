"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Archive as ArchiveIcon } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import {
  ARCHIVE_CATEGORIES,
  CATEGORY_COLORS,
  type ArchiveCategoryKey,
} from "@/lib/constants";
import type { Archive, ArchiveCategory } from "@/types/database";

const ALL_CATEGORIES = "all";

type CategoryFilter = ArchiveCategory | typeof ALL_CATEGORIES;

const CATEGORY_TABS: { value: CategoryFilter; label: string }[] = [
  { value: ALL_CATEGORIES, label: "전체" },
  ...Object.entries(ARCHIVE_CATEGORIES).map(([key, label]) => ({
    value: key as ArchiveCategory,
    label,
  })),
];

export default function ArchivePage() {
  const router = useRouter();
  const [archives, setArchives] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>(ALL_CATEGORIES);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchArchives = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("archives")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (selectedCategory !== ALL_CATEGORIES) {
        query = query.eq("category", selectedCategory);
      }

      if (debouncedSearch) {
        // Search by title/content; also search by attachment file_name
        const { data: attachmentMatches } = await supabase
          .from("archive_attachments")
          .select("archive_id")
          .ilike("file_name", `%${debouncedSearch}%`);

        const attachmentArchiveIds = attachmentMatches
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (attachmentMatches as any[]).map((a) => a.archive_id as string)
          : [];

        if (attachmentArchiveIds.length > 0) {
          // Include archives matching title/content OR attachment file_name
          query = query.or(
            `title.ilike.%${debouncedSearch}%,content.ilike.%${debouncedSearch}%,id.in.(${attachmentArchiveIds.join(",")})`
          );
        } else {
          query = query.or(
            `title.ilike.%${debouncedSearch}%,content.ilike.%${debouncedSearch}%`
          );
        }
      }

      const { data, error } = await query;

      if (error) {
        toast.error("기록을 불러올 수 없습니다");
        return;
      }

      setArchives((data as Archive[]) || []);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory]);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h1 className="text-xl font-semibold text-foreground mb-4">
          아카이브
        </h1>

        {/* Search */}
        <div role="search">
          <Input
            type="search"
            placeholder="제목, 내용으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
            aria-label="아카이브 검색"
          />
        </div>

        {/* Category filter tabs */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedCategory(tab.value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-surface-hover"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : archives.length === 0 ? (
          <EmptyState
            icon={ArchiveIcon}
            title="저장된 기록이 없습니다"
            description={
              debouncedSearch || selectedCategory !== ALL_CATEGORIES
                ? "검색 조건에 맞는 아카이브가 없습니다"
                : "대화에서 아카이브를 저장하면 여기에 표시됩니다"
            }
          />
        ) : (
          <ul className="space-y-3">
            {archives.map((archive) => {
              const colors =
                CATEGORY_COLORS[archive.category as ArchiveCategoryKey];
              return (
                <li key={archive.id}>
                  <button
                    onClick={() => router.push(`/archive/${archive.id}`)}
                    className="w-full text-left rounded-xl border border-border bg-surface p-4 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-medium text-foreground line-clamp-1">
                        {archive.title}
                      </span>
                      <Badge
                        color={{ bg: colors.bg, text: colors.text }}
                        className="shrink-0"
                      >
                        {ARCHIVE_CATEGORIES[archive.category as ArchiveCategoryKey]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {archive.content}
                    </p>
                    <p className="text-xs text-foreground-secondary">
                      {format(new Date(archive.updated_at), "yyyy. M. d. a h:mm", {
                        locale: ko,
                      })}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
