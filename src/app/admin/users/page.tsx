"use client";

import { useEffect, useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { Users, Search, CalendarPlus, ChevronDown, ChevronRight } from "lucide-react";

interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  team: string | null;
  role: "user" | "admin";
  status: "free" | "paid";
  payment_date: string | null;
  free_trial_expires_at: string | null;
  referrer_name: string | null;
  referrer_phone: string | null;
  member_type: "usana" | "general" | null;
  direct_mentor_name: string | null;
  direct_mentor_phone: string | null;
  leaders_mentor_name: string | null;
  leaders_mentor_phone: string | null;
  created_at: string;
}

interface TogglePending {
  profile: Profile;
  type: "status" | "role";
}

interface ExtendTrialTarget {
  profileId: string;
  profileName: string | null;
  currentExpiry: string | null;
  inputDays: string;
}

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentDateFilter, setPaymentDateFilter] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState<TogglePending | null>(null);
  const [extendTarget, setExtendTarget] = useState<ExtendTrialTarget | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const res = await fetch("/api/admin/users");
    if (!res.ok) {
      toast.error("사용자 목록을 불러올 수 없습니다.");
      setLoading(false);
      return;
    }
    const { data } = await res.json();
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSearchSubmit() {
    setSearch(searchInput.trim());
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearchSubmit();
  }

  function requestToggleStatus(profile: Profile) {
    setConfirmPending({ profile, type: "status" });
  }

  async function confirmToggle() {
    if (!confirmPending) return;
    const { profile, type } = confirmPending;
    setConfirmPending(null);
    if (type === "status") await doToggleStatus(profile);
  }

  async function doExtendTrial() {
    if (!extendTarget) return;
    const days = parseInt(extendTarget.inputDays, 10);
    if (!days || days <= 0) {
      toast.error("1 이상의 숫자를 입력해주세요.");
      return;
    }

    setExtending(extendTarget.profileId);

    const base =
      extendTarget.currentExpiry && new Date(extendTarget.currentExpiry) > new Date()
        ? new Date(extendTarget.currentExpiry)
        : new Date();
    const newExpiry = addDays(base, days).toISOString();

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: extendTarget.profileId, free_trial_expires_at: newExpiry }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(`무료 기간 연장 실패: ${body.error ?? res.status}`);
    } else {
      await loadProfiles();
      toast.success(`${extendTarget.profileName ?? "사용자"} 님의 무료 기간을 ${days}일 연장했습니다.`);
      setExtendTarget(null);
    }
    setExtending(null);
  }

  async function doToggleStatus(profile: Profile) {
    const newStatus: "free" | "paid" = profile.status === "free" ? "paid" : "free";
    setToggling(profile.id);

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: profile.id, status: newStatus }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(`상태 변경 실패: ${body.error ?? res.status}`);
    } else {
      await loadProfiles();
      toast.success(`${profile.name ?? "사용자"}를 ${newStatus === "paid" ? "Paid" : "Free"}로 변경했습니다.`);
    }
    setToggling(null);
  }

  const filtered = profiles.filter((p) => {
    const matchSearch =
      !search || (p.name ?? "") === search || (p.phone ?? "") === search;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchPaymentDate =
      !paymentDateFilter ||
      (p.payment_date != null && p.payment_date.startsWith(paymentDateFilter));
    return matchSearch && matchStatus && matchPaymentDate;
  });

  const confirmMessage = confirmPending
    ? `정말 ${confirmPending.profile.name ?? "이 사용자"} 님의 상태를 ${
        confirmPending.profile.status === "free" ? "Paid" : "Free"
      }로 변경하시겠습니까?`
    : "";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">사용자 관리</h1>
        <p className="text-sm text-foreground-secondary mt-1">가입한 사용자를 관리합니다.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="이름 또는 연락처 (완전 일치)"
              className="pl-9"
            />
          </div>
          <Button variant="secondary" onClick={handleSearchSubmit} size="sm" className="shrink-0">
            검색
          </Button>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "all", label: "전체 상태" },
            { value: "free", label: "Free" },
            { value: "paid", label: "Paid" },
          ]}
          className="w-full sm:w-36"
        />
        <input
          type="date"
          value={paymentDateFilter}
          onChange={(e) => setPaymentDateFilter(e.target.value)}
          className="w-full sm:w-44 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          title="결제일 필터"
        />
        {paymentDateFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaymentDateFilter("")}
            className="shrink-0 text-foreground-secondary"
          >
            날짜 초기화
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="사용자가 없습니다" description="검색 결과가 없습니다." />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 px-2" />
                <TableHead className="min-w-[160px]">이름 / 이메일</TableHead>
                <TableHead className="min-w-[110px]">연락처</TableHead>
                <TableHead className="min-w-[70px]">상태</TableHead>
                <TableHead className="min-w-[100px]">결제일</TableHead>
                <TableHead className="min-w-[120px]">무료 기간 만료</TableHead>
                <TableHead className="min-w-[160px]">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((profile) => {
                const isExpanded = expandedIds.has(profile.id);
                const hasDetail =
                  profile.team ||
                  profile.referrer_name ||
                  profile.referrer_phone ||
                  profile.member_type ||
                  profile.direct_mentor_name ||
                  profile.leaders_mentor_name;

                return (
                  <Fragment key={profile.id}>
                    <TableRow>
                      {/* Expand toggle */}
                      <td className="py-3 px-2 w-8 md:table-cell hidden">
                        {hasDetail && (
                          <button
                            onClick={() => toggleExpand(profile.id)}
                            className="text-foreground-tertiary hover:text-foreground transition-colors"
                            aria-label={isExpanded ? "접기" : "상세 보기"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </td>

                      {/* 이름 + 이메일 */}
                      <TableCell label="이름/이메일">
                        <div>
                          <div className="font-medium text-foreground">{profile.name ?? "-"}</div>
                          <div className="text-xs text-foreground-tertiary">{profile.email ?? ""}</div>
                        </div>
                      </TableCell>

                      <TableCell label="연락처">{profile.phone ?? "-"}</TableCell>

                      <TableCell label="상태">
                        <Badge variant={profile.status === "paid" ? "success" : "default"}>
                          {profile.status === "paid" ? "Paid" : "Free"}
                        </Badge>
                      </TableCell>

                      <TableCell label="결제일">
                        <span className="text-foreground-secondary text-xs">
                          {profile.payment_date
                            ? format(new Date(profile.payment_date), "yyyy-MM-dd", { locale: ko })
                            : "-"}
                        </span>
                      </TableCell>

                      <TableCell label="무료 기간 만료">
                        {profile.free_trial_expires_at ? (
                          <span className={
                            new Date(profile.free_trial_expires_at) < new Date()
                              ? "text-destructive text-xs font-medium"
                              : "text-foreground-secondary text-xs"
                          }>
                            {format(new Date(profile.free_trial_expires_at), "yyyy-MM-dd", { locale: ko })}
                            {new Date(profile.free_trial_expires_at) < new Date() && " (만료)"}
                          </span>
                        ) : (
                          <span className="text-foreground-tertiary text-xs">무제한</span>
                        )}
                      </TableCell>

                      <TableCell label="액션">
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => requestToggleStatus(profile)}
                            disabled={toggling === profile.id}
                          >
                            {toggling === profile.id
                              ? "..."
                              : profile.status === "free"
                              ? "Paid 전환"
                              : "Free 전환"}
                          </Button>
                          {profile.status === "free" && (
                            extendTarget?.profileId === profile.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={1}
                                  value={extendTarget.inputDays}
                                  onChange={(e) =>
                                    setExtendTarget((t) => t ? { ...t, inputDays: e.target.value } : t)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") doExtendTrial();
                                    if (e.key === "Escape") setExtendTarget(null);
                                  }}
                                  placeholder="일수"
                                  className="w-16 h-8 text-sm px-2"
                                  autoFocus
                                />
                                <span className="text-xs text-foreground-secondary">일</span>
                                <Button size="sm" onClick={doExtendTrial} disabled={extending === profile.id} className="h-8 px-2 text-xs">
                                  {extending === profile.id ? "..." : "저장"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setExtendTarget(null)} className="h-8 px-2 text-xs">
                                  취소
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExtendTarget({
                                  profileId: profile.id,
                                  profileName: profile.name,
                                  currentExpiry: profile.free_trial_expires_at,
                                  inputDays: "",
                                })}
                                disabled={extending === profile.id}
                                className="text-xs"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" />
                                무료 기간 연장
                              </Button>
                            )
                          )}
                          {/* 모바일: 상세 토글 */}
                          {hasDetail && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpand(profile.id)}
                              className="text-xs md:hidden"
                            >
                              {isExpanded ? "상세 접기" : "상세 보기"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* 확장 상세 행 */}
                    {isExpanded && (
                      <tr key={`${profile.id}-detail`} className="border-b border-border bg-surface/50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-2 text-sm">
                            <div>
                              <span className="text-xs text-foreground-tertiary block">팀</span>
                              <span className="text-foreground">{profile.team ?? "-"}</span>
                            </div>
                            <div>
                              <span className="text-xs text-foreground-tertiary block">가입일</span>
                              <span className="text-foreground">
                                {format(new Date(profile.created_at), "yyyy-MM-dd", { locale: ko })}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-foreground-tertiary block">회원유형</span>
                              {profile.member_type ? (
                                <Badge variant={profile.member_type === "usana" ? "default" : "outline"} className="mt-0.5">
                                  {profile.member_type === "usana" ? "유사나" : "일반"}
                                </Badge>
                              ) : <span className="text-foreground">-</span>}
                            </div>
                            <div>
                              <span className="text-xs text-foreground-tertiary block">추천인</span>
                              <span className="text-foreground">{profile.referrer_name ?? "-"}</span>
                              {profile.referrer_phone && (
                                <span className="text-xs text-foreground-secondary block">{profile.referrer_phone}</span>
                              )}
                            </div>
                            <div>
                              <span className="text-xs text-foreground-tertiary block">직속멘토</span>
                              <span className="text-foreground">{profile.direct_mentor_name ?? "-"}</span>
                              {profile.direct_mentor_phone && (
                                <span className="text-xs text-foreground-secondary block">{profile.direct_mentor_phone}</span>
                              )}
                            </div>
                            <div>
                              <span className="text-xs text-foreground-tertiary block">리더스멘토</span>
                              <span className="text-foreground">{profile.leaders_mentor_name ?? "-"}</span>
                              {profile.leaders_mentor_phone && (
                                <span className="text-xs text-foreground-secondary block">{profile.leaders_mentor_phone}</span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-foreground-secondary mt-3">
        총 {filtered.length}명 표시 중 (전체 {profiles.length}명)
      </p>

      <ConfirmDialog
        open={!!confirmPending}
        onClose={() => setConfirmPending(null)}
        onConfirm={confirmToggle}
        title="상태 변경 확인"
        description={confirmMessage}
        confirmText="변경"
      />
    </div>
  );
}
