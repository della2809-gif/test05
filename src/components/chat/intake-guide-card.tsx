"use client";

import type { IntakeGuidePayload } from "@/lib/intake-guide-engine";

const PROGRAM_LABEL = { general: "일반 섭취", reset: "리셋 프로그램", diet: "체중관리 프로그램", custom: "맞춤 프로그램" } as const;

export function IntakeGuideCard({ result }: { result: IntakeGuidePayload }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-surface overflow-hidden my-2">
      <div className="bg-emerald-700 px-4 py-3 text-white">
        <p className="text-xs opacity-80">{result.personLabel} 섭취 안내</p>
        <p className="font-semibold">{PROGRAM_LABEL[result.programType]} · {result.doseMode === "enhanced" ? "배량·집중" : "정량"}</p>
      </div>
      <div className="p-4 space-y-4">
        {result.items.map((item) => (
          <section key={item.productId} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-foreground">{item.productName}</h3>
              <span className="text-xs rounded-full bg-emerald-50 text-emerald-800 px-2 py-1 shrink-0">검증·승인됨</span>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-sm">
              <span className="text-foreground-secondary">섭취량</span><span>{item.doseText}</span>
              <span className="text-foreground-secondary">시간</span><span>{item.timeLabels.join(" · ")}</span>
              {item.mealRelation && <><span className="text-foreground-secondary">식사 기준</span><span>{item.mealRelation}</span></>}
            </div>
            {item.instructions.length > 0 && <ul className="text-xs text-foreground-secondary list-disc pl-5">{item.instructions.map((x) => <li key={x}>{x}</li>)}</ul>}
            {item.requiredNotices.length > 0 && <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-900">{item.requiredNotices.join(" · ")}</div>}
            {item.cautions.length > 0 && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">주의: {item.cautions.join(" · ")}</div>}
            <p className="text-[11px] text-foreground-tertiary">출처: {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{item.sourceLabel}</a> : item.sourceLabel} · {item.sourceVersion}</p>
          </section>
        ))}
        <p className="text-xs text-foreground-secondary">{result.safetyNotice}</p>
      </div>
    </div>
  );
}
