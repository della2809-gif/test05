import type { JudgmentResult } from "@/lib/health-analyzer";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProductLine {
  name: string;
  quantity: number;
  unitPrice: number;
  score: number;
  productNumber?: string;
  usanaIqUrl?: string;
}

export interface QuotationTier {
  label: "프리미엄" | "스탠다드" | "베이직";
  products: ProductLine[];
  subtotal: number;       // 정가 합계
  autoshipDiscount: number; // 오토쉽 10% 할인액
  firstCashback: number;  // 신규 첫 캐쉬백
  finalPrice: number;     // 최종 금액
  totalScore: number;
  description: string;
}

export interface QuotationResult {
  premium: QuotationTier;
  standard: QuotationTier;
  basic: QuotationTier;
  resetPackage?: {
    name: string;
    price: number;
    weeks: 1 | 2;
  };
  challengePackage?: {
    name: string;
    price: number;
    discountRate: number;
    benefit: string;
  };
}

// 신규 첫 캐쉬백 공식: (450-200)/2 × 0.2 × 1150 × 0.967
export const FIRST_CASHBACK = Math.round((450 - 200) / 2 * 0.2 * 1150 * 0.967);

// 오토쉽 할인율
const AUTOSHIP_RATE = 0.1;

function calcTier(
  products: ProductLine[],
  label: QuotationTier["label"],
  description: string,
  isNewMember = true
): QuotationTier {
  const subtotal = products.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
  const totalScore = products.reduce((sum, p) => sum + p.score * p.quantity, 0);
  const autoshipDiscount = Math.round(subtotal * AUTOSHIP_RATE);
  const firstCashback = isNewMember ? FIRST_CASHBACK : 0;
  const finalPrice = subtotal - autoshipDiscount;

  return {
    label,
    products,
    subtotal,
    autoshipDiscount,
    firstCashback,
    finalPrice,
    totalScore,
    description,
  };
}

export async function buildQuotation(
  judgment: JudgmentResult,
  supabase: SupabaseClient<any>,
  isNewMember = true
): Promise<QuotationResult> {
  // DB에서 제품 정보 조회
  const allProductNames = [
    ...judgment.baseProducts,
    ...judgment.additionalProducts,
  ];

  const { data: dbProducts } = await supabase
    .from("admin_products")
    .select("name, price, score, product_number, usana_iq_url")
    .in("name", allProductNames);

  const productMap = new Map<string, { price: number; score: number; product_number?: string; usana_iq_url?: string }>(
    (dbProducts ?? []).map((p: any) => [p.name, { price: p.price, score: p.score, product_number: p.product_number, usana_iq_url: p.usana_iq_url }])
  );

  function toLine(name: string, quantity = 1): ProductLine | null {
    const info = productMap.get(name);
    if (!info) return null;
    return {
      name,
      quantity,
      unitPrice: info.price,
      score: info.score,
      productNumber: info.product_number,
      usanaIqUrl: info.usana_iq_url,
    };
  }

  // 기본 ON 구성
  const baseLines = judgment.baseProducts
    .map((name) => toLine(name))
    .filter(Boolean) as ProductLine[];

  // 추가 제품
  const additionalLines = judgment.additionalProducts
    .map((name) => toLine(name))
    .filter(Boolean) as ProductLine[];

  // 베이직: 기본 ON만
  const basicProducts = baseLines;

  // 스탠다드: 기본 ON + 추가 제품 중 상위 2개
  const standardProducts = [...baseLines, ...additionalLines.slice(0, 2)];

  // 프리미엄: 기본 ON + 추가 제품 전체
  const premiumProducts = [...baseLines, ...additionalLines];

  // 리셋 패키지 조회
  let resetPackage: QuotationResult["resetPackage"];
  if (judgment.needsReset) {
    const purpose = judgment.resetWeeks === 2 ? "reset_2w" : "reset_1w";
    const { data: pkg } = await supabase
      .from("admin_packages")
      .select("name, price")
      .eq("purpose", purpose)
      .eq("is_active", true)
      .maybeSingle();

    if (pkg) {
      resetPackage = { name: pkg.name, price: pkg.price, weeks: judgment.resetWeeks };
    }
  }

  // 챌린지 패키지 조회
  let challengePackage: QuotationResult["challengePackage"];
  if (judgment.needsChallenge) {
    const { data: pkg } = await supabase
      .from("admin_packages")
      .select("name, price, discount_rate, benefit")
      .eq("purpose", "challenge_active")
      .eq("is_active", true)
      .maybeSingle();

    if (pkg) {
      challengePackage = {
        name: pkg.name,
        price: pkg.price,
        discountRate: pkg.discount_rate,
        benefit: pkg.benefit ?? "",
      };
    }
  }

  return {
    premium: calcTier(premiumProducts, "프리미엄", "전체 케어 최적 구성 (180~220만원대)", isNewMember),
    standard: calcTier(standardProducts, "스탠다드", "핵심 집중 케어 구성 (140~160만원대)", isNewMember),
    basic: calcTier(basicProducts, "베이직", "기본 ON 구성 (100~120만원대)", isNewMember),
    resetPackage,
    challengePackage,
  };
}

// 주문 리스트 텍스트 생성 (복사용)
export function formatOrderList(tier: QuotationTier): string {
  const lines = tier.products.map(
    (p) => `${p.name}${p.productNumber ? ` (${p.productNumber})` : ""} × ${p.quantity}개  ${(p.unitPrice * p.quantity).toLocaleString()}원`
  );
  return [
    `[${tier.label} 구성]`,
    ...lines,
    `─────────────────`,
    `정가 합계: ${tier.subtotal.toLocaleString()}원`,
    `오토쉽 할인(-10%): -${tier.autoshipDiscount.toLocaleString()}원`,
    `최종 금액: ${tier.finalPrice.toLocaleString()}원`,
    `총 포인트: ${tier.totalScore}점`,
    tier.firstCashback > 0 ? `신규 첫 캐쉬백: ${tier.firstCashback.toLocaleString()}원` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
