"use client";

import { useState } from "react";
import { Plane, TrendingUp, Users, Copy, Check, MapPin } from "lucide-react";
import type { TravelResult } from "@/lib/travel-calculator";
import { COMMISSION_TRAVEL_DISCLAIMER } from "@/lib/constants";

interface TravelResultCardProps {
  result: TravelResult;
}

const FEASIBILITY_COLOR = {
  높음: "text-emerald-600 dark:text-emerald-400",
  중간: "text-amber-600 dark:text-amber-400",
  낮음: "text-red-500 dark:text-red-400",
};

const TYPE_COLOR: Record<string, string> = {
  A: "text-blue-600 dark:text-blue-400",
  B: "text-purple-600 dark:text-purple-400",
  C: "text-emerald-600 dark:text-emerald-400",
  D: "text-amber-600 dark:text-amber-400",
};

export function TravelResultCard({ result }: TravelResultCardProps) {
  const [activeScenario, setActiveScenario] = useState(1); // 표준형 기본
  const [copied, setCopied] = useState(false);

  const scenario = result.scenarios[activeScenario];

  function formatKrw(n: number) {
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}천만원`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}백만원`;
    return `${n.toLocaleString()}원`;
  }

  function weeksLabel(w: number | null): string {
    if (!w) return "현재 구조로 어려움";
    if (w <= 4) return `약 ${w}주 내 가능`;
    if (w <= 8) return `약 ${w}주 (2개월)`;
    if (w <= 13) return `약 ${w}주 (3개월)`;
    return `약 ${w}주`;
  }

  function handleCopy() {
    const lines = [
      `[여행 달성 시뮬레이션]`,
      `여행 목표: ${formatKrw(result.travelBudgetKrw)}`,
      ``,
      `현재 직급: ${result.currentRank} (${result.currentCvp} CVP)`,
      `현재 세후 수령액: ${formatKrw(result.currentNetKrw)}/주`,
      result.nextRank ? `다음 직급(${result.nextRank})까지: ${result.cvpToNextRank} CVP` : "",
      ``,
      `필요 주간 CVP: ${result.cvpNeeded} CVP`,
      `현재와의 차이: ${result.cvpGap} CVP`,
      ``,
      `[${scenario.name} 시나리오]`,
      `예상 직급: ${scenario.projectedRank}`,
      `예상 세후: ${formatKrw(scenario.projectedNetKrw)}/주`,
      scenario.weeksToTravel ? `여행 달성 예상: ${weeksLabel(scenario.weeksToTravel)}` : "",
      ``,
      `추천 행동:`,
      ...scenario.actions.map((a) => `• ${a}`),
      ``,
      COMMISSION_TRAVEL_DISCLAIMER,
    ].filter((l) => l !== undefined && l !== null);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden my-2">
      {/* 헤더 */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-foreground-secondary" />
          <p className="text-sm font-medium text-foreground">여행 달성 시뮬레이션</p>
          <span className={`text-xs ml-auto ${TYPE_COLOR[result.primaryType.type]}`}>
            {result.primaryType.label}
          </span>
        </div>

        {/* 여행 목표 역산 */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300">여행 목표 역산</p>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">여행 목표 비용</span>
              <span className="font-medium text-foreground">{formatKrw(result.travelBudgetKrw)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">필요 월 수입</span>
              <span className="font-medium text-foreground">{formatKrw(result.monthlyIncomeNeeded)}</span>
            </div>
            <div className="flex justify-between border-t border-blue-200 dark:border-blue-800 pt-1">
              <span className="text-foreground-secondary">필요 주간 CVP</span>
              <span className="font-bold text-foreground">{result.cvpNeeded} CVP</span>
            </div>
          </div>
        </div>

        {/* 현재 상태 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-background border border-border p-3">
            <p className="text-xs text-foreground-secondary">현재 직급</p>
            <p className="text-base font-bold text-foreground mt-0.5">{result.currentRank}</p>
            <p className="text-xs text-foreground-tertiary">{result.currentCvp} CVP</p>
          </div>
          <div className="rounded-lg bg-background border border-border p-3">
            <p className="text-xs text-foreground-secondary">부족 CVP</p>
            <p className={`text-base font-bold mt-0.5 ${result.cvpGap <= 0 ? "text-emerald-600" : "text-foreground"}`}>
              {result.cvpGap <= 0 ? "달성!" : `${result.cvpGap} CVP`}
            </p>
            <p className="text-xs text-foreground-tertiary">
              {result.cvpGap <= 0 ? "수당 구조 완성" : `목표까지 필요`}
            </p>
          </div>
        </div>

        {/* 유형 안내 */}
        <div className="rounded-lg bg-background border border-border p-2.5">
          <p className={`text-xs font-medium ${TYPE_COLOR[result.primaryType.type]}`}>
            {result.primaryType.type}형: {result.primaryType.label}
          </p>
          <p className="text-xs text-foreground-secondary mt-0.5">{result.primaryType.description}</p>
        </div>
      </div>

      {/* 시나리오 탭 */}
      <div className="border-t border-border">
        <div className="flex border-b border-border">
          {result.scenarios.map((s, i) => (
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

          {/* 수당 3단 표기 */}
          <div className="rounded-lg bg-background border border-border p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-foreground-secondary text-xs">달러 수당</span>
              <span className="font-medium text-foreground">${scenario.projectedUsd.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground-secondary text-xs">한화 환산</span>
              <span className="font-medium text-foreground">{formatKrw(scenario.projectedKrw)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-1.5">
              <span className="text-foreground-secondary text-xs">세후 수령액</span>
              <span className="font-bold text-foreground">{formatKrw(scenario.projectedNetKrw)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-foreground-secondary text-xs">예상 직급</span>
              <p className="font-semibold text-foreground">{scenario.projectedRank}</p>
            </div>
            <div>
              <span className="text-foreground-secondary text-xs">여행 달성 예상</span>
              <p className={`font-semibold ${scenario.weeksToTravel ? FEASIBILITY_COLOR[scenario.feasibility] : "text-foreground-tertiary"}`}>
                {weeksLabel(scenario.weeksToTravel)}
              </p>
            </div>
          </div>

          {/* CVP 분해 (사람 수 변환) */}
          {scenario.cvpBreakdown.length > 0 && (
            <div>
              <p className="text-xs text-foreground-secondary mb-1.5">
                추가 {scenario.weeklyNewCvp} CVP 채우는 방법
              </p>
              <div className="space-y-1">
                {scenario.cvpBreakdown.map((b) => (
                  <div key={b.label} className="flex items-center gap-2 text-xs">
                    <Users className="h-3 w-3 text-foreground-tertiary shrink-0" />
                    <span className="text-foreground">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 추천 행동 */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-foreground-secondary" />
              <p className="text-xs text-foreground-secondary">추천 행동</p>
            </div>
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

      {/* 하단 고정 문장 */}
      <div className="border-t border-border px-4 py-2.5 bg-background">
        <p className="text-xs text-foreground-tertiary">
          여행은 보상이 아니라 팀을 움직이게 만드는 목표입니다.
          수당 만들다 보면 여행 갑니다.
        </p>
      </div>

      {/* 필수 안전문구 (검수 #33) */}
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
