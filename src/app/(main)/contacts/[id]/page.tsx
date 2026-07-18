"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { ArrowLeft, Phone, Calendar, Gift, ArrowRight, History, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Milestones {
  week13: string;
  week17: string;
  coupon4w: string;
  coupon8w: string;
  // 레거시 스키마 호환용 (옛 키 — 존재할 수 있음)
  week4?: string;
  week8?: string;
}

interface AoChangeLogEntry {
  changed_at: string;
  old_ao: string | null;
  new_ao: string | null;
  note: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  member_id: string | null;
  join_date: string | null;
  first_order_date: string | null;
  member_status: string | null;
  care_mode: string | null;
  contact_frequency: string | null;
  last_contact_date: string | null;
  ao_cycle_date: string | null;
  ao_source: string | null;
  ao_change_log: AoChangeLogEntry[] | null;
  coupon_remaining: number;
  next_action: string | null;
  notes: string | null;
  personality: 'logical' | 'emotional' | 'practical' | null;
  milestones: Milestones | null;
  created_at: string;
}

const PERSONALITY_LABELS: Record<string, string> = {
  logical: "논리적",
  emotional: "감성적",
  practical: "실용적",
};

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  신규등록: "success",
  주문대기: "warning",
  섭취중: "default",
  사업관심: "default",
  관망: "outline",
  관리필요: "destructive",
  중단: "outline",
};

function fmt(d: string) {
  try {
    return format(new Date(d), "yyyy년 M월 d일 (E)", { locale: ko });
  } catch {
    return d;
  }
}

function fmtDateTime(d: string) {
  try {
    return format(new Date(d), "yyyy.MM.dd HH:mm", { locale: ko });
  } catch {
    return d;
  }
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Array<{id: string; created_at: string; quotation: unknown; health_scores: unknown}>>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!contact) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error("삭제 실패");
      }
      toast.success(`${contact.name}님을 삭제했습니다.`);
      router.push("/contacts");
    } catch {
      toast.error("삭제하지 못했습니다. 다시 시도해주세요.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then(({ data }) => {
        setContact(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("불러오지 못했습니다.");
        setLoading(false);
      });

    fetch(`/api/consultations?contact_id=${id}`)
      .then((r) => r.json())
      .then(({ data }) => setConsultations(data || []));
  }, [id]);

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  if (!contact)
    return (
      <div className="flex justify-center py-16 text-foreground-secondary text-sm">
        고객을 찾을 수 없습니다.
      </div>
    );

  const rows: Array<{
    label: string;
    value: string | number | null | undefined;
    icon?: React.ReactNode;
    highlight?: boolean;
  }> = [
    { label: "연락처", value: contact.phone, icon: <Phone className="h-3.5 w-3.5" /> },
    { label: "허브 회원번호", value: contact.member_id },
    {
      label: "가입일",
      value: contact.join_date ? fmt(contact.join_date) : null,
      icon: <Calendar className="h-3.5 w-3.5" />,
    },
    { label: "첫 주문일", value: contact.first_order_date ? fmt(contact.first_order_date) : null },
    {
      label: "AO 예정일",
      value: contact.ao_cycle_date ? fmt(contact.ao_cycle_date) : null,
      highlight: true,
    },
    { label: "케어 모드", value: contact.care_mode },
    { label: "접촉 주기", value: contact.contact_frequency },
    {
      label: "마지막 접촉",
      value: contact.last_contact_date ? fmt(contact.last_contact_date) : null,
    },
    {
      label: "쿠폰 잔여",
      value: `${contact.coupon_remaining}장`,
      icon: <Gift className="h-3.5 w-3.5" />,
    },
    { label: "고객 성향", value: contact.personality ? PERSONALITY_LABELS[contact.personality] : "미파악" },
    { label: "메모", value: contact.notes },
  ].filter((r) => r.value != null && r.value !== "");

  const milestones = contact.milestones;
  const aoChangeLog = contact.ao_change_log ?? [];

  // 마일스톤 행: 옛 스키마(week4/week8) fallback + 키 누락/유효하지 않은 날짜는 숨김.
  // (AO 계산식 재작성 이전 레거시 레코드가 옛 키를 갖고 있어 "Invalid Date"로 깨지던 것 방어)
  const isValidDate = (v?: string) => !!v && !Number.isNaN(new Date(v).getTime());
  const milestoneRows = milestones
    ? [
        { label: "쿠폰 1장 사용 가능 (4주)", date: milestones.coupon4w ?? milestones.week4, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "쿠폰 2장 사용 가능 (8주)", date: milestones.coupon8w ?? milestones.week8, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "매칭 보너스 마감 (13주)", date: milestones.week13, color: "text-amber-600 dark:text-amber-400" },
        { label: "보너스 유예 최종 마감 (17주)", date: milestones.week17, color: "text-red-600 dark:text-red-400" },
      ].filter((m): m is { label: string; date: string; color: string } => isValidDate(m.date))
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-surface-hover">
            <ArrowLeft className="h-5 w-5 text-foreground-secondary" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{contact.name}</h1>
              {contact.member_status && (
                <Badge variant={STATUS_COLORS[contact.member_status] ?? "default"}>
                  {contact.member_status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* 다음 액션 */}
        {contact.next_action && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-medium text-primary">{contact.next_action}</p>
          </div>
        )}

        {/* 기본 정보 */}
        <div className="rounded-xl border border-border bg-surface divide-y divide-border">
          {rows.map(({ label, value, icon, highlight }) => (
            <div key={label} className="flex items-start justify-between px-4 py-2.5 text-sm">
              <span className="text-foreground-secondary flex items-center gap-1.5">
                {icon}
                {label}
                {label === "AO 예정일" && contact.ao_source && (
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                    contact.ao_source === "manual"
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                      : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {contact.ao_source === "manual" ? "수동" : "자동"}
                  </span>
                )}
              </span>
              <span
                className={`text-right max-w-[60%] ${
                  highlight ? "font-semibold text-amber-600 dark:text-amber-400" : "text-foreground"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* AO 변경 이력 */}
        {aoChangeLog.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <History className="h-4 w-4 text-foreground-secondary" />
              AO 변경 이력
            </p>
            <div className="space-y-2">
              {aoChangeLog.map((entry, i) => (
                <div key={i} className="text-xs space-y-0.5 border-l-2 border-amber-300 dark:border-amber-700 pl-2">
                  <p className="text-foreground-secondary">{fmtDateTime(entry.changed_at)}</p>
                  <p className="text-foreground">
                    {entry.old_ao ? fmt(entry.old_ao) : "미정"} → {entry.new_ao ? fmt(entry.new_ao) : "미정"}
                  </p>
                  {entry.note && <p className="text-foreground-tertiary">{entry.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 마일스톤 */}
        {milestoneRows.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">마일스톤 & 보너스 일정</p>
            <div className="space-y-1.5 text-xs">
              {milestoneRows.map(({ label, date, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className={`${color} font-medium`}>{label}</span>
                  <span className="text-foreground font-medium">{fmt(date)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-foreground-tertiary pt-1">
              모든 날짜는 가입일 기준으로 자동 계산됩니다.
            </p>
          </div>
        )}

        {consultations.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">건강상담 기록 ({consultations.length}건)</p>
            <div className="space-y-2">
              {consultations.map((c) => (
                <div key={c.id} className="flex justify-between items-center text-xs text-foreground-secondary">
                  <span>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                  <span className="text-primary text-xs">상담 완료</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button variant="secondary" className="w-full" onClick={() => router.push(`/contacts/${contact.id}/edit`)}>
          수정
        </Button>

        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          회원 삭제
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="회원 삭제"
        description={`${contact.name}님을 정말 삭제하시겠습니까? 연결된 일정도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
      />
    </div>
  );
}
