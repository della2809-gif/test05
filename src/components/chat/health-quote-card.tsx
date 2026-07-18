"use client";

// 자동견적 OCR 플로우 카드 — ① 건강 분석 카드 ② 프리미엄/스탠다드/베이직 견적 카드 (스펙 8~11장)
// 수량·금액은 서버(health-quote-engine)가 결정적으로 계산한 값이며,
// 카드에서는 뉴트리밀 선택 변경 시에만 같은 공식(computeTierTotals)으로 재계산한다.

import { useState } from "react";
import { Copy, Check, HeartPulse } from "lucide-react";
import type { HealthQuoteResult, HealthQuoteTier } from "@/lib/health-quote-engine";
import { computeTierTotals } from "@/lib/health-quote-engine";
import type { HealthGrade } from "@/lib/health-quote-rules";

interface HealthQuoteCardProps {
  result: HealthQuoteResult;
}

const GRADE_STYLES: Record<HealthGrade, string> = {
  양호: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  보통: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  경계: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  불량: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
};

const TIER_KEYS = ["premium", "standard", "basic"] as const;
const TIER_COLORS: Record<string, string> = {
  프리미엄: "text-amber-600 dark:text-amber-400",
  스탠다드: "text-blue-600 dark:text-blue-400",
  베이직: "text-emerald-600 dark:text-emerald-400",
};

function formatKrw(n: number) {
  return `${n.toLocaleString()}원`;
}

function buildOrderText(
  tier: HealthQuoteTier,
  nutrimealIdx: number,
  flavor: string | null,
  extras: string[],
): string {
  const nm = tier.nutrimealOptions[nutrimealIdx];
  const totals = computeTierTotals(
    tier.subtotalResolved,
    tier.pointsResolved,
    nm ?? null,
    tier.discountExcludedResolved ?? 0,
  );
  return [
    `[${tier.label} 구성] ${tier.blockLabels.join(" + ")}`,
    ...tier.lines.map((l) =>
      `- ${l.product_name} × ${l.quantity}${l.unitPrice !== undefined ? ` (${formatKrw(l.unitPrice * l.quantity)})` : " (단가 확인 필요)"}${l.source === "axis" && l.axisNames?.length ? ` — ${l.axisNames.join("·")} 보강` : ""}`
    ),
    ...(nm
      ? [`- ${nm.label}${flavor ? ` (${flavor})` : ""} × ${nm.quantity}${nm.unitPrice !== undefined ? ` (${formatKrw(nm.unitPrice * nm.quantity)})` : ""}`]
      : []),
    ...(extras.length > 0 ? [`- 추가 선택: ${extras.join(", ")} (할인·적립 제외, 포인트 없음, 금액 별도)`] : []),
    `─────────────────`,
    `정가 합계: ${formatKrw(totals.subtotal)}`,
    `오토십 할인(-10%): -${formatKrw(totals.autoshipDiscount)}`,
    `최종 금액: ${formatKrw(totals.finalPrice)}`,
    `총 포인트: ${totals.totalPoints}점`,
    `예상 첫 수당: 약 ${formatKrw(totals.estimatedFirstCommissionKrw)} (예상치)`,
  ].join("\n");
}

export function HealthQuoteCard({ result }: HealthQuoteCardProps) {
  const [activeTier, setActiveTier] = useState<(typeof TIER_KEYS)[number]>("premium");
  const [nutrimealIdx, setNutrimealIdx] = useState(0);
  const [flavor, setFlavor] = useState<string | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const tier = result.tiers[activeTier];
  const nm = tier.nutrimealOptions[Math.min(nutrimealIdx, Math.max(0, tier.nutrimealOptions.length - 1))] ?? null;
  const totals = computeTierTotals(
    tier.subtotalResolved,
    tier.pointsResolved,
    nm,
    tier.discountExcludedResolved ?? 0,
  );

  function toggleExtra(name: string) {
    setExtras((prev) => (prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]));
  }

  function handleCopy() {
    navigator.clipboard.writeText(
      buildOrderText(tier, nutrimealIdx, flavor, extras)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const judged = result.axes.filter((a) => a.grade !== null);

  return (
    <div className="space-y-2">
      {/* ① 건강 분석 카드 */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden my-2">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-foreground-secondary" />
            <p className="text-sm font-semibold text-foreground">건강 분석</p>
          </div>

          {/* 축별 판정 칩 */}
          {judged.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {judged.map((a) => (
                <span
                  key={a.axis}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${GRADE_STYLES[a.grade!]}`}
                >
                  {a.name}
                  <span className="font-medium">{a.grade}</span>
                </span>
              ))}
            </div>
          )}

          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {result.analysisText}
          </p>

          <p className="text-xs text-foreground-tertiary">
            ※ 본 분석은 질병의 진단·치료가 아닌 건강 관리 상담을 위한 참고 자료입니다.
          </p>
        </div>
      </div>

      {/* ② 프리미엄/스탠다드/베이직 견적 카드 */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden my-2">
        <div className="flex border-b border-border">
          {TIER_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => { setActiveTier(key); setNutrimealIdx(0); setFlavor(null); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTier === key
                  ? "bg-background text-foreground border-b-2 border-foreground"
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              {result.tiers[key].label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-foreground-secondary">
            구성: {tier.blockLabels.join(" + ")}
            {tier.lines.some((l) => l.source === "axis") ? " + 건강축 추가 제품" : ""}
          </p>

          {/* 제품 목록 */}
          <div className="space-y-1.5">
            {tier.lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm gap-2">
                <span className="text-foreground min-w-0">
                  {l.usanaIqUrl ? (
                    <a
                      href={l.usanaIqUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {l.product_name}
                    </a>
                  ) : (
                    l.product_name
                  )}
                  <span className="text-foreground-secondary ml-1">× {l.quantity}</span>
                  {l.source === "axis" && l.axisNames && l.axisNames.length > 0 && (
                    <span className="text-xs text-foreground-tertiary ml-1">
                      ({l.axisNames.join("·")} 보강)
                    </span>
                  )}
                </span>
                <span className="text-foreground-secondary tabular-nums flex-shrink-0">
                  {l.unitPrice !== undefined ? (
                    formatKrw(l.unitPrice * l.quantity)
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">단가 미확인</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* 뉴트리밀 선택 (리셋 포함 시) */}
          {tier.nutrimealOptions.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">뉴트리밀 선택</p>
              <div className="flex flex-col gap-1">
                {tier.nutrimealOptions.map((opt, i) => (
                  <label key={opt.key} className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="radio"
                        name={`nutrimeal-${tier.key}`}
                        checked={i === nutrimealIdx}
                        onChange={() => { setNutrimealIdx(i); setFlavor(null); }}
                      />
                      <span className="text-foreground truncate">{opt.label} × {opt.quantity}</span>
                    </span>
                    <span className="text-foreground-secondary tabular-nums text-xs flex-shrink-0">
                      {opt.unitPrice !== undefined ? formatKrw(opt.unitPrice * opt.quantity) : "단가 미확인"}
                    </span>
                  </label>
                ))}
              </div>
              {nm && nm.flavors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {nm.flavors.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFlavor(f === flavor ? null : f)}
                      className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                        flavor === f
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground-secondary hover:text-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 추가 선택 — 쉐이커/지퍼백 (할인·적립 제외, 포인트 없음) */}
          {result.optionalExtras.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
              <p className="text-xs font-medium text-foreground">추가 선택</p>
              {result.optionalExtras.map((name) => (
                <label key={name} className="flex items-center gap-1.5 text-sm cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={extras.includes(name)}
                    onChange={() => toggleExtra(name)}
                  />
                  {name}
                </label>
              ))}
              <p className="text-xs text-foreground-tertiary">
                ※ 쉐이커/지퍼백은 10% 할인·적립 제외, 포인트 없음 (금액 별도 안내)
              </p>
            </div>
          )}

          {/* 합계 */}
          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-foreground-secondary">
              <span>정가 합계{tier.unresolved.length > 0 ? " (단가 확인분)" : ""}</span>
              <span className="tabular-nums">{formatKrw(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-foreground-secondary">
              <span>오토십 할인 (-10%)</span>
              <span className="tabular-nums text-destructive">-{formatKrw(totals.autoshipDiscount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>최종 금액</span>
              <span className={`tabular-nums ${TIER_COLORS[tier.label]}`}>{formatKrw(totals.finalPrice)}</span>
            </div>
            <div className="flex justify-between text-xs text-foreground-secondary">
              <span>총 포인트</span>
              <span className="tabular-nums">{totals.totalPoints}점</span>
            </div>
            <div className="flex justify-between text-xs text-foreground-secondary">
              <span>예상 첫 수당</span>
              <span className="tabular-nums">약 {formatKrw(totals.estimatedFirstCommissionKrw)}</span>
            </div>
            <p className="text-xs text-foreground-tertiary">
              ※ 수당·적립금은 조직 구조와 주차 실적에 따라 달라질 수 있는 <strong>예상치</strong>입니다.
              신규 등록 시 적립금(쿠폰) 혜택은 별도 안내됩니다.
            </p>
          </div>

          {/* 단가 미확인 안내 (정직 표기) */}
          {tier.unresolved.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              제품 DB에서 단가를 찾지 못한 구성품: {tier.unresolved.join(", ")} — 합계에서 제외됨
            </p>
          )}

          {/* 카카오 주문 메시지 복사 */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-sm text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "복사됨" : "카카오 주문 메시지 복사"}
          </button>

          <p className="text-xs text-center text-foreground-tertiary mt-1">
            ✓ 상담 기록이 자동 저장됩니다
          </p>
        </div>
      </div>
    </div>
  );
}
