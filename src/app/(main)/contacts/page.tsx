"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Phone, Calendar, StickyNote, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  member_id: string | null;
  member_status: string | null;
  care_mode: string | null;
  last_contact_date: string | null;
  ao_cycle_date: string | null;
  coupon_remaining: number;
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  신규등록: "success",
  주문대기: "warning",
  섭취중: "default",
  사업관심: "default",
  관망: "outline",
  관리필요: "destructive",
  중단: "outline",
};

const CARE_COLORS: Record<string, string> = {
  집중: "text-red-600 dark:text-red-400",
  정기: "text-orange-500 dark:text-orange-400",
  누적: "text-yellow-600 dark:text-yellow-400",
  자율: "text-emerald-600 dark:text-emerald-400",
  임시중단: "text-foreground-tertiary",
};

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { setPage(1); }, [search, statusFilter]);
  useEffect(() => { load(); }, [search, statusFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));
    const res = await fetch(`/api/contacts?${params}`);
    if (!res.ok) { toast.error("회원을 불러오지 못했습니다."); setLoading(false); return; }
    const { data, total: t } = await res.json();
    setContacts(data ?? []);
    setTotal(t ?? 0);
    setLoading(false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") setSearch(searchInput.trim());
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">회원 관리</h1>
            <p className="text-sm text-foreground-secondary mt-0.5">고객 및 팀원을 관리합니다.</p>
          </div>
          <Button size="sm" onClick={() => router.push("/contacts/new")}>
            <Plus className="h-4 w-4 mr-1" /> 추가
          </Button>
        </div>

        {/* 검색 + 필터 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="이름 또는 연락처 검색"
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">전체 상태</option>
            {["신규등록","주문대기","섭취중","사업관심","관망","관리필요","중단"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : contacts.length === 0 ? (
          <EmptyState icon={Users} title="회원이 없습니다" description="고객을 추가해보세요." />
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/contacts/${c.id}`)}
                className="w-full text-left rounded-xl border border-border bg-surface px-4 py-3 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.member_status && (
                        <Badge variant={STATUS_COLORS[c.member_status] ?? "default"}>
                          {c.member_status}
                        </Badge>
                      )}
                      {c.care_mode && (
                        <span className={`text-xs font-medium ${CARE_COLORS[c.care_mode] ?? ""}`}>
                          {c.care_mode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-foreground-secondary">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{c.phone}
                        </span>
                      )}
                      {c.last_contact_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          마지막 접촉: {format(new Date(c.last_contact_date), "MM/dd", { locale: ko })}
                        </span>
                      )}
                      {c.ao_cycle_date && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          AO: {format(new Date(c.ao_cycle_date), "MM/dd", { locale: ko })}
                        </span>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-xs text-foreground-tertiary flex items-start gap-1 truncate">
                        <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                        {c.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-foreground-tertiary whitespace-nowrap">
                    쿠폰 {c.coupon_remaining}장
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground-secondary">총 {total}명</p>
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs"
              >
                이전
              </Button>
              <span className="text-xs text-foreground-secondary">
                {page} / {Math.ceil(total / PAGE_SIZE)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs"
              >
                다음
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
