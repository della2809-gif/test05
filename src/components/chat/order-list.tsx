"use client";

import { useState } from "react";
import { Copy, Check, ShoppingCart } from "lucide-react";
import type { QuotationTier } from "@/lib/quotation-engine";

interface OrderListProps {
  tier: QuotationTier;
}

function buildKakaoMessage(tier: QuotationTier): string {
  const lines = tier.products.map(
    (p) =>
      `• ${p.name}${p.productNumber ? ` [${p.productNumber}]` : ""} × ${p.quantity}개`
  );

  return [
    `📦 주문 리스트 (${tier.label})`,
    ``,
    ...lines,
    ``,
    `─────────────────`,
    `정가 합계  ${tier.subtotal.toLocaleString()}원`,
    `오토쉽 할인  -${tier.autoshipDiscount.toLocaleString()}원`,
    `💰 최종 금액  ${tier.finalPrice.toLocaleString()}원`,
    `⭐ 총 포인트  ${tier.totalScore}점`,
    ...(tier.firstCashback > 0
      ? [`🎁 첫 캐쉬백  ${tier.firstCashback.toLocaleString()}원`]
      : []),
  ].join("\n");
}

export function OrderList({ tier }: OrderListProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(buildKakaoMessage(tier));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-subtle">
        <ShoppingCart className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          주문 리스트 — {tier.label}
        </span>
      </div>

      {/* 제품 목록 */}
      <div className="p-4 space-y-2">
        {tier.products.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <span className="text-foreground font-medium">{p.name}</span>
              {p.productNumber && (
                <span className="ml-1.5 text-xs text-foreground-tertiary font-mono">
                  [{p.productNumber}]
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 tabular-nums">
              <span className="text-foreground-secondary">× {p.quantity}개</span>
              <span className="text-foreground w-24 text-right">
                {(p.unitPrice * p.quantity).toLocaleString()}원
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 합계 */}
      <div className="border-t border-border px-4 py-3 space-y-1.5 bg-surface-subtle">
        <div className="flex justify-between text-xs text-foreground-secondary tabular-nums">
          <span>정가 합계</span>
          <span>{tier.subtotal.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between text-xs text-destructive tabular-nums">
          <span>오토쉽 할인 (-10%)</span>
          <span>-{tier.autoshipDiscount.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-foreground tabular-nums pt-1 border-t border-border">
          <span>최종 금액</span>
          <span>{tier.finalPrice.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between text-xs text-foreground-secondary tabular-nums">
          <span>총 포인트</span>
          <span>{tier.totalScore}점</span>
        </div>
        {tier.firstCashback > 0 && (
          <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
            <span>첫 캐쉬백 (별도 지급)</span>
            <span>+{tier.firstCashback.toLocaleString()}원</span>
          </div>
        )}
      </div>

      {/* 복사 버튼 */}
      <div className="p-3 border-t border-border">
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              복사 완료!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              카카오 주문 메시지 복사
            </>
          )}
        </button>
      </div>
    </div>
  );
}
