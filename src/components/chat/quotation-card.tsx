"use client";

import { useState } from "react";
import type { QuotationResult, QuotationTier } from "@/lib/quotation-engine";
import { OrderList } from "./order-list";
import { IntakeGuide } from "./intake-guide";

interface QuotationCardProps {
  result: QuotationResult;
}

const TIER_LABELS = ["프리미엄", "스탠다드", "베이직"] as const;
const TIER_COLORS = {
  "프리미엄": "text-amber-600 dark:text-amber-400",
  "스탠다드": "text-blue-600 dark:text-blue-400",
  "베이직": "text-emerald-600 dark:text-emerald-400",
};

export function QuotationCard({ result }: QuotationCardProps) {
  const [activeTab, setActiveTab] = useState<"프리미엄" | "스탠다드" | "베이직">("스탠다드");

  const tiers: Record<"프리미엄" | "스탠다드" | "베이직", QuotationTier> = {
    "프리미엄": result.premium,
    "스탠다드": result.standard,
    "베이직": result.basic,
  };

  const tier = tiers[activeTab];

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden my-2">
      {/* 탭 */}
      <div className="flex border-b border-border">
        {TIER_LABELS.map((label) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === label
                ? "bg-background text-foreground border-b-2 border-foreground"
                : "text-foreground-secondary hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 견적 내용 */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-foreground-secondary">{tier.description}</p>

        {/* 제품 목록 */}
        <div className="space-y-1.5">
          {tier.products.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {p.usanaIqUrl ? (
                  <a
                    href={p.usanaIqUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
                {p.productNumber && (
                  <span className="text-foreground-tertiary text-xs ml-1">({p.productNumber})</span>
                )}
                <span className="text-foreground-secondary ml-1">× {p.quantity}</span>
              </span>
              <span className="text-foreground-secondary tabular-nums">
                {(p.unitPrice * p.quantity).toLocaleString()}원
              </span>
            </div>
          ))}
        </div>

        {/* 합계 */}
        <div className="border-t border-border pt-3 space-y-1.5">
          <div className="flex justify-between text-sm text-foreground-secondary">
            <span>정가 합계</span>
            <span className="tabular-nums">{tier.subtotal.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-sm text-foreground-secondary">
            <span>오토쉽 할인 (-10%)</span>
            <span className="tabular-nums text-destructive">-{tier.autoshipDiscount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-foreground">
            <span>최종 금액</span>
            <span className={`tabular-nums ${TIER_COLORS[activeTab]}`}>
              {tier.finalPrice.toLocaleString()}원
            </span>
          </div>
          {tier.firstCashback > 0 && (
            <div className="flex justify-between text-xs text-foreground-secondary">
              <span>신규 첫 캐쉬백 (별도)</span>
              <span className="tabular-nums">+{tier.firstCashback.toLocaleString()}원</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-foreground-secondary">
            <span>총 포인트</span>
            <span className="tabular-nums">{tier.totalScore}점</span>
          </div>
        </div>

        {/* 리셋 패키지 안내 */}
        {result.resetPackage && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              + {result.resetPackage.name} ({result.resetPackage.weeks}주)
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              리셋 기준가 {result.resetPackage.price.toLocaleString()}원 추가
            </p>
          </div>
        )}

        {/* 챌린지 패키지 안내 */}
        {result.challengePackage && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
              추천: {result.challengePackage.name}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              {result.challengePackage.price.toLocaleString()}원 · {result.challengePackage.discountRate}% 할인
            </p>
          </div>
        )}

        {/* 주문 리스트 + 복사 */}
        <OrderList tier={tier} />

        {/* 혜택 안내 */}
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-xs space-y-1">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">신규 혜택 안내</p>
          <p className="text-emerald-700 dark:text-emerald-400">• 무이자 할부 가능</p>
          <p className="text-emerald-700 dark:text-emerald-400">• 첫 캐쉬백 {tier.firstCashback.toLocaleString()}원 (별도 지급)</p>
          <p className="text-emerald-700 dark:text-emerald-400">• 적립금 2장 제공</p>
        </div>

        <IntakeGuide />

        <p className="text-xs text-center text-foreground-tertiary mt-1">
          ✓ 상담 기록이 자동 저장됩니다
        </p>
      </div>
    </div>
  );
}
