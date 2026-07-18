"use client";

import { useState } from "react";
import type { CommissionResult, Scenario } from "@/lib/commission-calculator";
import { COMMISSION_TRAVEL_DISCLAIMER } from "@/lib/constants";
import { Copy, Check, TrendingUp } from "lucide-react";

interface CommissionResultCardProps {
  result: CommissionResult;
  scenarios: Scenario[];
}

const FEASIBILITY_COLOR = {
  높음: "text-emerald-600 dark:text-emerald-400",
  중간: "text-amber-600 dark:text-amber-400",
  낮음: "text-red-500 dark:text-red-400",
};

export function CommissionResultCard({ result, scenarios }: CommissionResultCardProps) {
  const [activeScenario, setActiveScenario] = useState(0);
  const [copied, setCopied] = useState(false);

  const scenario = scenarios[activeScenario];

  function formatKrw(n: number) {
    return `${n.toLocaleString()}원`;
  }

  function handleCopy() {
    const text = [
      `[수당 계산 결과]`,
      `현재 직급: ${result.currentRank}`,
      `소실적 합계: ${result.totalMinCvp} CVP`,
      result.maintenanceRequiredCvp
        ? `실적유지 조건: ${result.bcCount ?? 1}BC 기준 ${result.maintenanceRequiredCvp}점`
        : "",
      `기본 수당: $${result.basicCommissionUsd.toFixed(0)} (${formatKrw(result.totalCommissionKrw)})`,
      `세후 수령액: ${formatKrw(result.netCommissionKrw)}`,
      result.nextRank ? `다음 직급(${result.nextRank})까지: ${result.cvpToNextRank} CVP` : "",
      ``,
      `[${scenario.name} 시나리오]`,
      `예상 직급: ${scenario.projectedRank}`,
      `예상 세후: ${formatKrw(scenario.projectedNetKrw)}`,
      `추천 행동: ${scenario.actions.join(", ")}`,
      ``,
      COMMISSION_TRAVEL_DISCLAIMER,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden my-2">
      {/* 현재 수당 요약 */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-foreground-secondary" />
          <p className="text-sm font-medium text-foreground">수당 계산 결과</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-background border border-border p-3">
            <p className="text-xs text-foreground-secondary">현재 직급</p>
            <p className="text-base font-bold text-foreground mt-0.5">{result.currentRank}</p>
          </div>
          <div className="rounded-lg bg-background border border-border p-3">
            <p className="text-xs text-foreground-secondary">소실적 합계</p>
            <p className="text-base font-bold text-foreground mt-0.5">{result.totalMinCvp} CVP</p>
          </div>
        </div>

        {/* 수당 3단 표기 */}
        <div className="rounded-lg bg-background border border-border p-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-foreground-secondary">달러 수당</span>
            <span className="font-medium text-foreground">${result.totalCommissionUsd.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-foreground-secondary">한화 환산</span>
            <span className="font-medium text-foreground">{formatKrw(result.totalCommissionKrw)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-1.5">
            <span className="text-foreground-secondary">세후 수령액</span>
            <span className="font-bold text-foreground">{formatKrw(result.netCommissionKrw)}</span>
          </div>
        </div>

        {/* 실적유지 조건 (1BC=100점 / 2BC 이상=200점) */}
        {result.maintenanceRequiredCvp != null && (
          <div className="rounded-lg bg-background border border-border p-2.5">
            <p className="text-xs text-foreground-secondary">
              실적유지 조건: <span className="font-semibold text-foreground">{result.bcCount ?? 1}BC</span> 운영 기준{" "}
              <span className="font-semibold text-foreground">{result.maintenanceRequiredCvp}점</span> 유지 필요
              {result.totalMinCvp < result.maintenanceRequiredCvp && (
                <span className="text-amber-600 dark:text-amber-400"> (현재 부족)</span>
              )}
            </p>
          </div>
        )}

        {/* 다음 직급 */}
        {result.nextRank && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              다음 직급 <span className="font-semibold">{result.nextRank}</span>까지{" "}
              <span className="font-semibold">{result.cvpToNextRank} CVP</span> 남았어요
            </p>
          </div>
        )}
      </div>

      {/* 시나리오 탭 */}
      <div className="border-t border-border">
        <div className="flex border-b border-border">
          {scenarios.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveScenario(i)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeScenario === i
                  ? "bg-background text-foreground border-b-2 border-foreground"
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-foreground-secondary">{scenario.description}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-foreground-secondary text-xs">예상 직급</span>
              <p className="font-semibold text-foreground">{scenario.projectedRank}</p>
            </div>
            <div>
              <span className="text-foreground-secondary text-xs">예상 세후</span>
              <p className="font-semibold text-foreground">{formatKrw(scenario.projectedNetKrw)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-foreground-secondary mb-1">달성 가능성</p>
            <span className={`text-sm font-medium ${FEASIBILITY_COLOR[scenario.feasibility]}`}>
              {scenario.feasibility}
            </span>
          </div>
          <div>
            <p className="text-xs text-foreground-secondary mb-1.5">추천 행동</p>
            <ul className="space-y-1">
              {scenario.actions.map((a, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                  <span className="text-foreground-tertiary mt-0.5">•</span>{a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 필수 안전문구 (검수 #32) */}
      <div className="border-t border-border px-4 py-2.5 bg-background">
        <p className="text-xs text-foreground-tertiary">{COMMISSION_TRAVEL_DISCLAIMER}</p>
      </div>

      {/* 복사 버튼 */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "복사됨" : "결과 복사"}
        </button>
      </div>
    </div>
  );
}
