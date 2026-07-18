"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { PERSONALITIES } from "@/lib/constants";

const MEMBER_STATUS_OPTIONS = ["신규등록", "주문대기", "섭취중", "사업관심", "관망", "관리필요", "중단"];
const CARE_MODE_OPTIONS = ["집중", "정기", "누적", "자율", "임시중단", "중단"];
const CONTACT_FREQ_OPTIONS = ["매일", "주2회", "주3회", "주1회", "격주", "월1회", "필요시"];
type PersonalityKey = keyof typeof PERSONALITIES;

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function EditContactPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    member_id: "",
    member_status: "섭취중",
    care_mode: "집중",
    contact_frequency: "주1회",
    join_date: "",
    first_order_date: "",
    ao_cycle_date: "",
    coupon_remaining: 2,
    personality: "" as PersonalityKey | "",
    notes: "",
  });

  // 토요일 컷오프 (계산용, DB 미저장)
  const [joinSatAfterCutoff, setJoinSatAfterCutoff] = useState(false);
  const [orderSatAfterCutoff, setOrderSatAfterCutoff] = useState(false);

  const joinDateIsSaturday = form.join_date ? new Date(form.join_date).getDay() === 6 : false;
  const orderDateIsSaturday = form.first_order_date ? new Date(form.first_order_date).getDay() === 6 : false;

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data) { router.replace("/contacts"); return; }
        setForm({
          name: data.name ?? "",
          phone: data.phone ?? "",
          member_id: data.member_id ?? "",
          member_status: data.member_status ?? "섭취중",
          care_mode: data.care_mode ?? "집중",
          contact_frequency: data.contact_frequency ?? "주1회",
          join_date: data.join_date?.slice(0, 10) ?? "",
          first_order_date: data.first_order_date?.slice(0, 10) ?? "",
          ao_cycle_date: data.ao_cycle_date?.slice(0, 10) ?? "",
          coupon_remaining: data.coupon_remaining ?? 0,
          personality: (data.personality ?? "") as PersonalityKey | "",
          notes: data.notes ?? "",
        });
        setLoading(false);
      })
      .catch(() => {
        toast.error("불러오지 못했습니다.");
        router.replace("/contacts");
      });
  }, [id, router]);

  async function handleSave() {
    if (!form.name.trim()) { toast.error("이름을 입력해주세요."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: form.phone || null,
          member_id: form.member_id || null,
          join_date: form.join_date || null,
          first_order_date: form.first_order_date || null,
          ao_cycle_date: form.ao_cycle_date || null,
          personality: form.personality || null,
          notes: form.notes || null,
          // 토요일 컷오프 플래그 (API 계산용, DB 저장 안 됨)
          join_saturday_after_cutoff: joinSatAfterCutoff,
          order_saturday_after_cutoff: orderSatAfterCutoff,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "저장에 실패했습니다.");
        return;
      }

      toast.success("저장됐습니다.");
      router.push(`/contacts/${id}`);
    } catch {
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-surface-hover">
            <ArrowLeft className="h-5 w-5 text-foreground-secondary" />
          </button>
          <h1 className="text-xl font-bold text-foreground">회원 수정</h1>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">이름 *</label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">연락처</label>
            <Input
              type="tel"
              placeholder="01012345678"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">허브 회원번호</label>
            <Input
              placeholder="123456"
              value={form.member_id}
              onChange={(e) => setForm((p) => ({ ...p, member_id: e.target.value }))}
            />
          </div>

          {/* 상태 셀렉트들 */}
          {[
            { label: "회원 상태", field: "member_status", options: MEMBER_STATUS_OPTIONS },
            { label: "케어 모드", field: "care_mode", options: CARE_MODE_OPTIONS },
            { label: "접촉 주기", field: "contact_frequency", options: CONTACT_FREQ_OPTIONS },
          ].map(({ label, field, options }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{label}</label>
              <select
                value={(form as Record<string, string | number>)[field] as string}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                className={selectClass}
              >
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}

          {/* 고객 성향 — 고객 발송 문구 톤에 반영 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">고객 성향</label>
            <select
              value={form.personality}
              onChange={(e) => setForm((p) => ({ ...p, personality: e.target.value as PersonalityKey | "" }))}
              className={selectClass}
            >
              <option value="">미파악 (선택 안 함)</option>
              {(Object.keys(PERSONALITIES) as PersonalityKey[]).map((k) => (
                <option key={k} value={k}>{PERSONALITIES[k]}</option>
              ))}
            </select>
          </div>

          {/* 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">가입일</label>
              <input
                type="date"
                value={form.join_date}
                onChange={(e) => {
                  setForm((p) => ({ ...p, join_date: e.target.value }));
                  // 날짜 바뀌면 컷오프 초기화
                  if (new Date(e.target.value).getDay() !== 6) setJoinSatAfterCutoff(false);
                }}
                className={selectClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">첫 주문일</label>
              <input
                type="date"
                value={form.first_order_date}
                onChange={(e) => {
                  setForm((p) => ({ ...p, first_order_date: e.target.value }));
                  if (new Date(e.target.value).getDay() !== 6) setOrderSatAfterCutoff(false);
                }}
                className={selectClass}
              />
            </div>
          </div>

          {/* 토요일 컷오프 체크박스 — 가입일이 토요일일 때 */}
          {joinDateIsSaturday && (
            <label className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={joinSatAfterCutoff}
                onChange={(e) => setJoinSatAfterCutoff(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                가입일이 토요일 오후 3시 이후인가요? (다음 주 주차 기준)
              </span>
            </label>
          )}

          {/* 토요일 컷오프 체크박스 — 첫 주문일이 토요일일 때 */}
          {orderDateIsSaturday && (
            <label className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={orderSatAfterCutoff}
                onChange={(e) => setOrderSatAfterCutoff(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                첫 주문일이 토요일 오후 3시 이후인가요? (AO 주기 다음 주 시작)
              </span>
            </label>
          )}

          {/* AO 예정일 — 수동 변경 가능, 변경 시 이력 저장됨 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">AO 예정일</label>
            <input
              type="date"
              value={form.ao_cycle_date}
              onChange={(e) => setForm((p) => ({ ...p, ao_cycle_date: e.target.value }))}
              className={selectClass}
            />
            <p className="text-xs text-foreground-tertiary">
              첫 주문일을 변경하면 AO가 자동 재계산됩니다. 직접 수정하면 변경 이력에 기록됩니다.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">쿠폰 잔여</label>
            <Input
              type="number"
              min={0}
              max={10}
              value={form.coupon_remaining}
              onChange={(e) => setForm((p) => ({ ...p, coupon_remaining: Number(e.target.value) }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">메모</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="특이사항, 관심사, 건강 상태 등"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

      </div>

      {/* 하단 고정 저장 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background px-4 py-3 pb-safe md:sticky md:bottom-auto md:border-0 md:bg-transparent md:p-0 md:pb-6">
        <div className="mx-auto max-w-lg flex gap-2">
          <Button variant="secondary" onClick={() => router.back()} className="flex-1">취소</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">저장</Button>
        </div>
      </div>
    </div>
  );
}
