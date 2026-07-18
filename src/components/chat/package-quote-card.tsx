"use client";

import { useState } from "react";
import { Copy, Check, Package } from "lucide-react";
import type { PackageQuoteResult, PackageQuoteCandidate } from "@/lib/package-quote-engine";

interface PackageQuoteCardProps {
  result: PackageQuoteResult;
}

function formatKrw(n: number) {
  return `${n.toLocaleString()}원`;
}

function buildOrderText(c: PackageQuoteCandidate): string {
  return [
    `[패키지 견적] ${c.name}`,
    ...c.components.map((l) =>
      `- ${l.product_name} × ${l.quantity}${l.unitPrice !== undefined ? ` (${formatKrw(l.unitPrice * l.quantity)})` : ""}`
    ),
    `패키지 가격: ${formatKrw(c.price)}`,
    c.score != null ? `점수: ${c.score}점` : "",
  ].filter(Boolean).join("\n");
}

export function PackageQuoteCard({ result }: PackageQuoteCardProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const candidates = result.candidates;
  if (candidates.length === 0) return null;
  const c = candidates[Math.min(activeIdx, candidates.length - 1)];

  function handleCopy() {
    navigator.clipboard.writeText(buildOrderText(c));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden my-2">
      {/* 추천 패키지 탭 */}
      <div className="flex border-b border-border">
        {candidates.map((cand, i) => (
          <button
            key={cand.id}
            onClick={() => setActiveIdx(i)}
            className={`flex-1 min-w-0 py-2.5 px-2 text-xs font-medium transition-colors truncate ${
              activeIdx === i
                ? "bg-background text-foreground border-b-2 border-foreground"
                : "text-foreground-secondary hover:text-foreground"
            }`}
            title={cand.name}
          >
            추천 {i + 1}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Package className="h-4 w-4 text-foreground-secondary mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground break-words">{c.name}</p>
            {c.category && <p className="text-xs text-foreground-tertiary">{c.category}</p>}
          </div>
        </div>

        {/* 구성품 표 */}
        {c.components.length > 0 && (
          <div className="space-y-1.5">
            {c.components.map((l, i) => (
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
        )}

        {/* 합계 */}
        <div className="border-t border-border pt-3 space-y-1.5">
          {c.componentsSubtotal !== null && (
            <div className="flex justify-between text-sm text-foreground-secondary">
              <span>구성품 정가 합계{c.unresolved.length > 0 ? " (확인분)" : ""}</span>
              <span className="tabular-nums">{formatKrw(c.componentsSubtotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-foreground">
            <span>패키지 가격</span>
            <span className="tabular-nums text-blue-600 dark:text-blue-400">{formatKrw(c.price)}</span>
          </div>
          {c.componentsSubtotal !== null && c.unresolved.length === 0 && c.componentsSubtotal > c.price && (
            <div className="flex justify-between text-xs text-foreground-secondary">
              <span>정가 대비 절약</span>
              <span className="tabular-nums text-destructive">-{formatKrw(c.componentsSubtotal - c.price)}</span>
            </div>
          )}
          {c.score != null && (
            <div className="flex justify-between text-xs text-foreground-secondary">
              <span>점수</span>
              <span className="tabular-nums">{c.score}점</span>
            </div>
          )}
        </div>

        {/* 단가 미확인 안내 */}
        {c.unresolved.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            제품 DB에서 단가를 찾지 못한 구성품: {c.unresolved.join(", ")}
          </p>
        )}

        {/* 주문 문구 복사 */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-sm text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "복사됨" : "견적 문구 복사"}
        </button>
      </div>
    </div>
  );
}
