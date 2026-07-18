"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Check, Calendar, Gift } from "lucide-react";
import { calcRegistrationData, calcAoCycleDate, calcMilestones, getUsanaWeekStart, toDateStr } from "@/lib/usana-dates";
import { PERSONALITIES } from "@/lib/constants";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type Step = 1 | 2 | 3 | 4;
type MemberMode = "신규" | "기존";
type OrderChoice = "ordered" | "not_yet" | "next_week" | "later" | null;
type PersonalityKey = keyof typeof PERSONALITIES;

function fmt(dateStr: string) {
  return format(new Date(dateStr), "yyyy년 M월 d일 (E)", { locale: ko });
}

export default function NewContactPage() {
  const router = useRouter();
  const [mode, setMode] = useState<MemberMode>("신규");
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // 폼 데이터
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memberId, setMemberId] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [orderChoice, setOrderChoice] = useState<OrderChoice>(null);
  const [firstOrderDate, setFirstOrderDate] = useState("");
  const [personality, setPersonality] = useState<PersonalityKey | "">("");
  const [notes, setNotes] = useState("");
  const [joinSatAfterCutoff, setJoinSatAfterCutoff] = useState(false);
  const [orderSatAfterCutoff, setOrderSatAfterCutoff] = useState(false);

  const isOrdered = orderChoice === "ordered";

  // 계산된 데이터 미리보기 (saturday 컷오프 포함)
  const regData = joinDate
    ? calcRegistrationData(joinDate, isOrdered && firstOrderDate ? firstOrderDate : undefined, joinSatAfterCutoff, orderSatAfterCutoff)
    : null;

  const weekStart = joinDate ? getUsanaWeekStart(new Date(joinDate), joinSatAfterCutoff) : null;

  const inputClass = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring";

  // 고객 성향 선택 (신규/기존 폼 공용). 고객 발송 문구 톤에 반영되며 미선택 시 '미파악'으로 저장.
  const personalitySelect = (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">고객 성향 (선택)</label>
      <select
        value={personality}
        onChange={(e) => setPersonality(e.target.value as PersonalityKey | "")}
        className={inputClass}
      >
        <option value="">선택 안 함</option>
        {(Object.keys(PERSONALITIES) as PersonalityKey[]).map((k) => (
          <option key={k} value={k}>{PERSONALITIES[k]}</option>
        ))}
      </select>
      <p className="text-xs text-foreground-tertiary">
        고객 발송 문구의 톤에 반영됩니다. 모르면 비워두면 됩니다(상담 중 AI가 되묻습니다).
      </p>
    </div>
  );

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    let payload;
    if (mode === "기존") {
      payload = {
        name: name.trim(),
        phone: phone || null,
        member_id: memberId || null,
        notes: notes || null,
        personality: personality || null,
        member_status: "섭취중",
        care_mode: "집중",
        contact_frequency: "주1회",
        join_date: null,
        first_order_date: null,
        ao_cycle_date: null,
        milestones: null,
        coupon_remaining: 2,
      };
    } else {
      const effectiveFirstOrderDate = isOrdered && firstOrderDate ? firstOrderDate : null;

      const aoFromOrderOnly =
        !regData && effectiveFirstOrderDate
          ? toDateStr(calcAoCycleDate(new Date(effectiveFirstOrderDate), orderSatAfterCutoff))
          : null;

      const memberStatus = regData?.member_status ?? (
        effectiveFirstOrderDate ? "섭취중" :
        orderChoice !== null && orderChoice !== "ordered" ? "주문대기" :
        "신규등록"
      );

      payload = {
        name: name.trim(),
        phone: phone || null,
        member_id: memberId || null,
        notes: notes || null,
        personality: personality || null,
        member_status: memberStatus,
        care_mode: "집중",
        contact_frequency: "주1회",
        join_date: regData?.join_date ?? (joinDate || null),
        first_order_date: (regData as { first_order_date?: string })?.first_order_date ?? (effectiveFirstOrderDate || null),
        ao_cycle_date: regData?.ao_cycle_date ?? aoFromOrderOnly,
        milestones: (regData as { milestones?: unknown })?.milestones ?? null,
        coupon_remaining: 2,
        // saturday 컷오프 플래그 (API에서 계산용, DB에 저장 안 됨)
        join_saturday_after_cutoff: joinSatAfterCutoff,
        order_saturday_after_cutoff: orderSatAfterCutoff,
      };
    }

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "저장에 실패했습니다.");
      setSaving(false);
      return;
    }

    await res.json();
    toast.success(`${name}님이 회원관리에 등록되었습니다. 회원 목록에서 확인하세요.`);
    router.push("/contacts");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => (mode === "기존" || step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}
            className="p-1 rounded-lg hover:bg-surface-hover"
          >
            <ArrowLeft className="h-5 w-5 text-foreground-secondary" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">회원 등록</h1>
            {mode === "신규" && <p className="text-xs text-foreground-secondary">Step {step} / 4</p>}
          </div>
        </div>

        {/* 회원 유형 선택 */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(["신규", "기존"] as MemberMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setStep(1); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-foreground text-background"
                  : "bg-surface text-foreground-secondary hover:bg-surface-hover"
              }`}
            >
              {m === "신규" ? "신규회원" : "기존회원"}
            </button>
          ))}
        </div>

        {/* Step 진행 바 — 신규회원만 */}
        {mode === "신규" && (
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-foreground" : "bg-border"}`}
              />
            ))}
          </div>
        )}

        {/* 기존회원 등록 폼 */}
        {mode === "기존" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">기본 정보를 입력해주세요</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">이름 *</label>
                <Input placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">연락처 *</label>
                <Input
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  type="tel"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">허브 회원번호 *</label>
                <Input placeholder="123456" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">메모 (선택)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="특이사항, 관심사, 건강 상태 등"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              {personalitySelect}
            </div>
            <div className="rounded-xl bg-surface border border-border px-4 py-3">
              <p className="text-xs text-foreground-secondary">
                AO 주기는 등록 후 회원 상세 화면에서 직접 입력할 수 있습니다.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!name.trim()) { toast.error("이름을 입력해주세요."); return; }
                if (!phone.trim()) { toast.error("연락처를 입력해주세요."); return; }
                if (!memberId.trim()) { toast.error("허브 회원번호를 입력해주세요."); return; }
                handleSave();
              }}
              loading={saving}
            >
              등록 완료
            </Button>
          </div>
        )}

        {/* Step 1: 기본 정보 */}
        {mode === "신규" && step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">기본 정보를 입력해주세요</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">이름 *</label>
                <Input placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">연락처 *</label>
                <Input
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  type="tel"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">허브 회원번호 *</label>
                <Input placeholder="123456" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!name.trim()) { toast.error("이름을 입력해주세요."); return; }
                if (!phone.trim()) { toast.error("연락처를 입력해주세요."); return; }
                if (!memberId.trim()) { toast.error("허브 회원번호를 입력해주세요."); return; }
                setStep(2);
              }}
            >
              다음 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: 가입일 */}
        {mode === "신규" && step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">가입일을 입력해주세요 <span className="text-xs text-foreground-tertiary font-normal">(없으면 건너뛰어도 됩니다)</span></p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">가입일 <span className="text-xs text-foreground-tertiary font-normal">(선택)</span></label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* 주차 자동 계산 미리보기 */}
            {weekStart && (
              <div className="rounded-xl bg-surface border border-border p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> USANA 1주차 시작
                </p>
                <p className="text-sm text-foreground">
                  {format(weekStart, "yyyy년 M월 d일 (E) 15:00", { locale: ko })}
                </p>
              </div>
            )}

            {/* 토요일 오후 3시 이후 체크박스 */}
            {joinDate && new Date(joinDate).getDay() === 6 && (
              <label className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={joinSatAfterCutoff}
                  onChange={(e) => setJoinSatAfterCutoff(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  오후 3시 이후에 가입하셨나요? (다음 주 매출로 산정)
                </span>
              </label>
            )}

            <Button className="w-full" onClick={() => setStep(3)}>
              다음 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 3: 첫 주문 여부 — 4가지 선택지 */}
        {mode === "신규" && step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">제품 주문도 함께 하셨나요?</p>

            <div className="grid grid-cols-2 gap-3">
              {([
                { label: "네, 주문했어요", value: "ordered" as OrderChoice },
                { label: "아직 주문 전이에요", value: "not_yet" as OrderChoice },
                { label: "다음 주 예정이에요", value: "next_week" as OrderChoice },
                { label: "나중에 입력할게요", value: "later" as OrderChoice },
              ] as { label: string; value: OrderChoice }[]).map(({ label, value }) => (
                <button
                  key={String(value)}
                  onClick={() => setOrderChoice(value)}
                  className={`rounded-xl border-2 p-4 text-sm font-medium transition-colors text-left ${
                    orderChoice === value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-surface text-foreground hover:border-foreground/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ordered: 첫 주문일 + 자동 계산 */}
            {orderChoice === "ordered" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">첫 주문일</label>
                  <input
                    type="date"
                    value={firstOrderDate}
                    onChange={(e) => setFirstOrderDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {firstOrderDate && new Date(firstOrderDate).getDay() === 6 && (
                  <label className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderSatAfterCutoff}
                      onChange={(e) => setOrderSatAfterCutoff(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      오후 3시 이후에 주문하셨나요? (다음 주 AO 주기 시작)
                    </span>
                  </label>
                )}

                {firstOrderDate &&
                  (() => {
                    const ao = calcAoCycleDate(new Date(firstOrderDate), orderSatAfterCutoff);
                    const ms = joinDate ? calcMilestones(new Date(joinDate), joinSatAfterCutoff) : null;
                    return (
                      <div className="rounded-xl bg-surface border border-border p-3 space-y-2">
                        <p className="text-xs font-medium text-foreground">자동 계산 결과</p>
                        <div className="space-y-1.5 text-xs text-foreground-secondary">
                          <div className="flex justify-between">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> 첫 AO 예정일
                            </span>
                            <span className="font-medium text-foreground">{fmt(toDateStr(ao))}</span>
                          </div>
                          {ms && (
                            <>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Gift className="h-3 w-3" /> 4주차 (쿠폰 1장)
                                </span>
                                <span className="font-medium text-foreground">{fmt(toDateStr(ms.coupon4w))}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Gift className="h-3 w-3" /> 8주차 (쿠폰 2장)
                                </span>
                                <span className="font-medium text-foreground">{fmt(toDateStr(ms.coupon8w))}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>13주 매칭 보너스 마감</span>
                                <span className="font-medium text-foreground">{fmt(toDateStr(ms.week13))}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>17주 최종 마감</span>
                                <span className="font-medium text-foreground">{fmt(toDateStr(ms.week17))}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* next_week: 다음 주 예정 안내 */}
            {orderChoice === "next_week" && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  주문대기 상태로 저장됩니다. 다음 주 주문 후 회원 목록에서 주문일을 업데이트하면 AO가 자동 계산됩니다.
                </p>
              </div>
            )}

            {/* not_yet / later: 주문 안함 안내 */}
            {(orderChoice === "not_yet" || orderChoice === "later") && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  주문대기 상태로 저장됩니다. 주문 후 회원 목록에서 업데이트할 수 있습니다.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">메모 (선택)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="특이사항, 관심사, 건강 상태 등"
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {personalitySelect}

            <Button
              className="w-full"
              onClick={() => {
                if (orderChoice === null) {
                  toast.error("주문 여부를 선택해주세요.");
                  return;
                }
                if (orderChoice === "ordered" && !firstOrderDate) {
                  toast.error("첫 주문일을 입력해주세요.");
                  return;
                }
                setStep(4);
              }}
            >
              다음 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 4: 최종 확인 */}
        {mode === "신규" && step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">등록 정보를 확인해주세요</p>

            <div className="rounded-xl border border-border bg-surface divide-y divide-border">
              {[
                { label: "이름", value: name },
                { label: "연락처", value: phone || "-" },
                { label: "회원번호", value: memberId || "-" },
                { label: "가입일", value: joinDate ? fmt(joinDate) : "-" },
                { label: "상태", value: regData?.member_status ?? (isOrdered && firstOrderDate ? "섭취중" : orderChoice !== null ? "주문대기" : "-") },
                { label: "AO 예정일", value: regData?.ao_cycle_date ? fmt(regData.ao_cycle_date) : "미정" },
                { label: "고객 성향", value: personality ? PERSONALITIES[personality] : "미파악" },
                ...(notes ? [{ label: "메모", value: notes }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start px-4 py-2.5 text-sm">
                  <span className="text-foreground-secondary">{label}</span>
                  <span className="text-foreground font-medium text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                AO 주기, 마일스톤, 쿠폰 일정이 자동으로 설정됩니다.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(3)} className="flex-1">
                수정
              </Button>
              <Button onClick={handleSave} loading={saving} className="flex-1">
                등록 완료
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
