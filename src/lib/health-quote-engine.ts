// 자동견적 OCR 플로우 — 판정·조합 엔진
// 건강체크 그래프 OCR 결과(A~J 점수/색구간) → 축별 등급 판정 → 등급별 기본 구성 +
// 건강축별 추가 제품(불량>경계, 공통제품 우선, 기본구성 중복 금지) → 프리미엄/스탠다드/베이직 견적.
// 규칙 데이터는 health-quote-rules.ts, 제품 단가 해석은 package-quote-engine의 resolveProduct 재사용.
// LLM은 점수 인식(OCR)까지만 쓰고 조합·수량·금액은 전부 이 결정적 코드로 계산한다.
// (00_decisions/2026-07-07_quotation_health-quote-rules.md)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealthChecklistAnalysis } from "@/app/api/analyze/health-checklist/route";
import { resolveProduct } from "./package-quote-engine";
import { BASIC_RATE, USD_TO_KRW, TAX_RATE } from "./commission-calculator";
import {
  AXIS_NAMES,
  AXIS_PRODUCTS,
  AXIS_ADD_QUANTITY,
  AUTOSHIP_DISCOUNT_RATE,
  DISCOUNT_EXCLUDED_KEYWORDS,
  COMPOSITION_BLOCKS,
  DEFAULT_GRADE_BANDS,
  GRADE_SEVERITY,
  NUTRIMEAL_OPTIONS,
  OPTIONAL_EXTRAS,
  TIER_COMPOSITION_TABLE,
  type AxisKey,
  type CompositionBlockKey,
  type HealthGrade,
  type TierKey,
} from "./health-quote-rules";

export interface AxisJudgment {
  axis: AxisKey;
  name: string;
  score: number | null;
  grade: HealthGrade | null;
  /** 등급 출처 — OCR이 색 구간을 직접 읽었으면 ocr, 점수 구간 폴백이면 score */
  gradeSource: "ocr" | "score" | null;
}

export interface HealthQuoteLine {
  product_name: string;
  quantity: number;
  unitPrice?: number;
  score?: number;
  usanaIqUrl?: string | null;
  /** base = 등급별 기본 구성, axis = 건강축 추가 제품 */
  source: "base" | "axis";
  /** source가 axis일 때 어떤 축 보강인지 (예: "순환") */
  axisNames?: string[];
}

export interface NutrimealQuoteOption {
  key: "일반" | "액티브" | "액티브개별포장";
  label: string;
  product_name: string;
  quantity: number;
  unitPrice?: number;
  score?: number;
  flavors: string[];
}

export interface HealthQuoteTier {
  key: TierKey;
  label: "프리미엄" | "스탠다드" | "베이직";
  /** 구성 블록 표시명 (예: ["리셋해독 2주", "메가영양제 4주"]) */
  blockLabels: string[];
  lines: HealthQuoteLine[];
  /** 리셋 포함 시 뉴트리밀 선택지 (없으면 빈 배열) */
  nutrimealOptions: NutrimealQuoteOption[];
  /** 단가 확인된 라인 기준 합계 (뉴트리밀 제외) */
  subtotalResolved: number;
  /** 단가 확인된 라인 기준 포인트 합계 (뉴트리밀 제외) */
  pointsResolved: number;
  /** 단가 확인 라인 중 오토십 할인·적립 제외 품목(쉐이커/지퍼백/셀라비브) 금액 — 스펙 11장 */
  discountExcludedResolved: number;
  /** 제품 DB에서 단가를 찾지 못한 구성품 (정직 표기) */
  unresolved: string[];
  /** 기본 표시용 합계 — 뉴트리밀은 첫 번째 선택지(일반) 기준 */
  totals: TierTotals;
}

export interface TierTotals {
  subtotal: number;
  totalPoints: number;
  autoshipDiscount: number;
  finalPrice: number;
  /** 예상 첫 수당(원) — 기존 신규 첫 캐쉬백 공식 일반화. 반드시 "예상"으로 표기 */
  estimatedFirstCommissionKrw: number;
}

export interface HealthQuoteResult {
  axes: AxisJudgment[];
  overallGrade: HealthGrade;
  /** 상담용 건강 분석 문장 (진단 아님, 스펙 9~10장 톤) */
  analysisText: string;
  /** 양호/보통의 리셋 = 유지(안티에이징), 경계/불량 = 회복 */
  resetPurpose: "유지" | "회복";
  tiers: {
    premium: HealthQuoteTier;
    standard: HealthQuoteTier;
    basic: HealthQuoteTier;
  };
  /** 추가 선택 (쉐이커/지퍼백) — 할인·적립 제외, 포인트 없음 */
  optionalExtras: string[];
}

// ── 판정 ─────────────────────────────────────────────────────

export function gradeFromScore(score: number): HealthGrade {
  if (score <= DEFAULT_GRADE_BANDS.goodMax) return "양호";
  if (score <= DEFAULT_GRADE_BANDS.normalMax) return "보통";
  if (score <= DEFAULT_GRADE_BANDS.cautionMax) return "경계";
  return "불량";
}

const VALID_GRADES: HealthGrade[] = ["양호", "보통", "경계", "불량"];

export function judgeAxes(
  scores: HealthChecklistAnalysis["scores"],
  ocrGrades?: Partial<Record<AxisKey, string | null>> | null,
): AxisJudgment[] {
  return (Object.keys(AXIS_NAMES) as AxisKey[]).map((axis) => {
    const score = scores?.[axis] ?? null;
    const rawOcr = ocrGrades?.[axis] ?? null;
    const ocrGrade = VALID_GRADES.includes(rawOcr as HealthGrade) ? (rawOcr as HealthGrade) : null;
    if (ocrGrade) {
      return { axis, name: AXIS_NAMES[axis], score, grade: ocrGrade, gradeSource: "ocr" };
    }
    if (score !== null && Number.isFinite(score)) {
      return { axis, name: AXIS_NAMES[axis], score, grade: gradeFromScore(score), gradeSource: "score" };
    }
    return { axis, name: AXIS_NAMES[axis], score: null, grade: null, gradeSource: null };
  });
}

/** 판정 가능한 축이 하나라도 있는지 — 없으면 견적을 만들지 않고 점수를 되묻는다. */
export function hasUsableJudgment(axes: AxisJudgment[]): boolean {
  return axes.some((a) => a.grade !== null);
}

/** 전체 등급 = 판정된 축 중 가장 나쁜 등급 (불량 > 경계 > 보통 > 양호) */
export function overallGrade(axes: AxisJudgment[]): HealthGrade {
  let worst: HealthGrade = "양호";
  for (const a of axes) {
    if (a.grade && GRADE_SEVERITY[a.grade] > GRADE_SEVERITY[worst]) worst = a.grade;
  }
  return worst;
}

// ── 건강축 추가 제품 선정 (스펙 7장) ──────────────────────────

const norm = (s: string) => s.replace(/\s+/g, "");

export interface AxisAddition {
  product_name: string;
  quantity: number;
  axisNames: string[];
}

/**
 * 불량 축 → 경계 축 순으로, 축별 추천 제품 중 "공통 제품 우선"으로 1개(경계) / 2개(불량)를 고른다.
 * - 공통 제품 = 대상 축(경계+불량)들의 추천 리스트에 더 많이 등장하는 제품
 * - 기본 구성(baseProductNames)에 이미 포함된 제품은 추가하지 않음 (중복 금지)
 * - 이미 다른 축에서 추가된 제품도 다시 추가하지 않음 (중복 제거) — 대신 해당 축명을 병기
 */
export function selectAxisAdditions(
  axes: AxisJudgment[],
  baseProductNames: string[],
): AxisAddition[] {
  const baseSet = new Set(baseProductNames.map(norm));
  const flagged = axes
    .filter((a) => a.grade === "불량" || a.grade === "경계")
    .sort(
      (a, b) =>
        GRADE_SEVERITY[b.grade!] - GRADE_SEVERITY[a.grade!] ||
        (b.score ?? 0) - (a.score ?? 0),
    );

  // 공통 제품 카운트 — 대상 축들의 추천 리스트에 등장하는 횟수
  const commonCount = new Map<string, number>();
  for (const a of flagged) {
    for (const p of AXIS_PRODUCTS[a.axis]) {
      const key = norm(p);
      commonCount.set(key, (commonCount.get(key) ?? 0) + 1);
    }
  }

  const additions: AxisAddition[] = [];
  const added = new Map<string, AxisAddition>();

  for (const a of flagged) {
    const qty = AXIS_ADD_QUANTITY[a.grade!];
    if (qty === 0) continue;
    // 공통 등장 횟수 내림차순, 동률이면 기준안 순서 유지 (stable sort)
    const candidates = [...AXIS_PRODUCTS[a.axis]].sort(
      (x, y) => (commonCount.get(norm(y)) ?? 0) - (commonCount.get(norm(x)) ?? 0),
    );
    let picked = false;
    for (const cand of candidates) {
      const key = norm(cand);
      if (baseSet.has(key)) continue; // 기본 구성 포함 → 중복 추가 금지
      const existing = added.get(key);
      if (existing) {
        // 이미 다른 축에서 추가됨 → 수량은 늘리지 않고 축명만 병기 (중복 제거)
        if (!existing.axisNames.includes(a.name)) existing.axisNames.push(a.name);
        picked = true;
        break;
      }
      const line: AxisAddition = { product_name: cand, quantity: qty, axisNames: [a.name] };
      added.set(key, line);
      additions.push(line);
      picked = true;
      break;
    }
    void picked; // 모든 후보가 기본 구성에 이미 포함이면 해당 축은 추가 없음 (정상)
  }

  return additions;
}

// ── 구성 조립 ─────────────────────────────────────────────────

export interface TierPlan {
  key: TierKey;
  label: HealthQuoteTier["label"];
  blockKeys: CompositionBlockKey[];
  blockLabels: string[];
  baseItems: { product_name: string; quantity: number }[];
  additions: AxisAddition[];
  resetWeeks: 0 | 1 | 2;
}

const TIER_LABELS: Record<TierKey, HealthQuoteTier["label"]> = {
  premium: "프리미엄",
  standard: "스탠다드",
  basic: "베이직",
};

/** 등급별 블록을 펼쳐 제품·수량으로 병합한다 (리셋 + 영양제 블록이 겹치면 수량 합산). */
export function buildTierPlan(grade: HealthGrade, tier: TierKey, axes: AxisJudgment[]): TierPlan {
  const blockKeys = TIER_COMPOSITION_TABLE[grade][tier];
  const merged = new Map<string, { product_name: string; quantity: number }>();
  let resetWeeks: 0 | 1 | 2 = 0;
  const blockLabels: string[] = [];

  for (const key of blockKeys) {
    const block = COMPOSITION_BLOCKS[key];
    blockLabels.push(block.label);
    if (block.resetWeeks > resetWeeks) resetWeeks = block.resetWeeks;
    for (const item of block.items) {
      const k = norm(item.product_name);
      const existing = merged.get(k);
      if (existing) existing.quantity += item.quantity;
      else merged.set(k, { ...item });
    }
  }

  const baseItems = Array.from(merged.values());
  // 리셋 포함 시 뉴트리밀도 기본 구성으로 취급 → 축 추가 제품에서 중복 금지 대상
  const baseNamesForDedup = [
    ...baseItems.map((i) => i.product_name),
    ...(resetWeeks > 0 ? NUTRIMEAL_OPTIONS.map((o) => o.product_name) : []),
  ];
  const additions = selectAxisAdditions(axes, baseNamesForDedup);

  return {
    key: tier,
    label: TIER_LABELS[tier],
    blockKeys,
    blockLabels,
    baseItems,
    additions,
    resetWeeks,
  };
}

// ── 금액 계산 ─────────────────────────────────────────────────

/**
 * 예상 첫 수당(원) — 기존 quotation-engine의 신규 첫 캐쉬백 공식을 포인트에 일반화한 것.
 * (P - 200) / 2 × 20% × 환율 × (1 - 세율). 450점이면 기존 FIRST_CASHBACK과 동일한 27,801원.
 * 실제 수당은 조직 구조/주차 실적에 따라 달라지므로 반드시 "예상"으로만 표기한다.
 */
export function estimateFirstCommissionKrw(totalPoints: number): number {
  const usable = Math.max(0, totalPoints - 200);
  return Math.round((usable / 2) * BASIC_RATE * USD_TO_KRW * (1 - TAX_RATE));
}

/**
 * 라인 합계 + 선택된 뉴트리밀로 카드 합계를 계산한다 (카드에서 선택 변경 시 재사용).
 * discountExcluded = 쉐이커/지퍼백/셀라비브 등 할인 제외 품목 금액 (스펙 11장 — 10% 할인 대상에서 뺀다)
 */
export function computeTierTotals(
  subtotalResolved: number,
  pointsResolved: number,
  nutrimeal: { unitPrice?: number; score?: number; quantity: number } | null,
  discountExcluded = 0,
): TierTotals {
  const nmPrice = nutrimeal?.unitPrice !== undefined ? nutrimeal.unitPrice * nutrimeal.quantity : 0;
  const nmPoints = nutrimeal?.score !== undefined ? nutrimeal.score * nutrimeal.quantity : 0;
  const subtotal = subtotalResolved + nmPrice;
  const totalPoints = pointsResolved + nmPoints;
  const autoshipDiscount = Math.round(
    Math.max(0, subtotal - discountExcluded) * AUTOSHIP_DISCOUNT_RATE,
  );
  return {
    subtotal,
    totalPoints,
    autoshipDiscount,
    finalPrice: subtotal - autoshipDiscount,
    estimatedFirstCommissionKrw: estimateFirstCommissionKrw(totalPoints),
  };
}

// ── 건강 분석 문장 (스펙 9~10장) ─────────────────────────────
// 진단/치료처럼 보이면 안 되고, 제품 수량 결정에 관여하지 않는 상담용 말버전.

export function buildAnalysisText(axes: AxisJudgment[], grade: HealthGrade): string {
  const goodNames = axes.filter((a) => a.grade === "양호").map((a) => a.name);
  const normalNames = axes.filter((a) => a.grade === "보통").map((a) => a.name);
  const cautionNames = axes.filter((a) => a.grade === "경계").map((a) => a.name);
  const badNames = axes.filter((a) => a.grade === "불량").map((a) => a.name);
  const signalNames = [...badNames, ...cautionNames];

  const lines: string[] = [];
  const heavy = badNames.length > 0 || cautionNames.length >= 3;

  if (!heavy) {
    lines.push("전체적으로 건강 관리를 잘 해오신 편으로 보입니다.");
    if (goodNames.length > 0) {
      lines.push(`특히 ${goodNames.join(", ")} 쪽은 비교적 균형이 잘 유지되고 있습니다.`);
    }
    if (signalNames.length > 0) {
      lines.push(
        `반면 ${signalNames.join(", ")} 쪽에서는 관리 신호가 조금 보이기 시작하는데, 아직 큰 문제가 있다기보다는 지금부터 조금 더 집중 관리하면 건강한 상태를 오래 유지하는 데 도움이 될 수 있습니다.`,
      );
    } else if (normalNames.length > 0) {
      lines.push(
        `${normalNames.join(", ")} 쪽은 보통 수준으로, 지금처럼 꾸준히 관리해주시면 좋겠습니다.`,
      );
    }
    lines.push(
      "결국 건강은 문제가 생긴 뒤 치료하는 것보다, 몸의 균형이 무너지기 전에 미리 관리하는 것이 중요합니다.",
    );
    if (signalNames.length > 0) {
      lines.push(
        `특히 ${signalNames[0]} 건강축을 중심으로 영양과 생활습관을 함께 관리해주시면 좋을 것 같습니다.`,
      );
    }
  } else {
    lines.push(
      `현재 ${signalNames.join(", ")} 축에서 관리 신호가 비교적 크게 나타나고 있습니다.`,
    );
    lines.push(
      "몸이 보내는 작은 신호들이 쌓이면서 균형이 무너지기 시작한 상태로 볼 수 있기 때문에, 지금부터는 단순히 유지하는 것보다 몸의 균형을 회복하는 관리가 중요해 보입니다.",
    );
    if (signalNames.length > 0) {
      lines.push(
        `특히 ${signalNames[0]} 축을 우선적으로 관리하면서 부족한 영양을 채워주고 생활습관을 함께 관리해 나가시면 좋겠습니다.`,
      );
    }
  }

  // 리셋 목적 설명 (스펙 10장) — 양호/보통 = 유지·안티에이징, 경계/불량 = 회복
  if (grade === "양호" || grade === "보통") {
    lines.push(
      "리셋 프로그램은 지금의 건강한 상태를 더 젊고 활력 있게 유지하기 위한 예방적 관리(안티에이징) 관점으로 활용하실 수 있습니다.",
    );
  } else {
    lines.push(
      "리셋 프로그램은 적신호가 온 건강축을 집중 관리하고, 몸이 스스로 균형을 되찾을 수 있도록 돕는 회복 관리 관점으로 활용하실 수 있습니다.",
    );
  }

  lines.push("그 기준으로 유사나 제품을 활용한다면 아래와 같은 관리 방법을 선택하실 수 있습니다.");
  return lines.join("\n");
}

// ── 메인: OCR 분석 결과 → 견적 ───────────────────────────────

interface ProductRow {
  name: string;
  price: number;
  score: number | null;
  usana_iq_url: string | null;
  aliases: string | null;
}

function toQuoteLines(
  items: { product_name: string; quantity: number }[],
  products: ProductRow[],
  source: HealthQuoteLine["source"],
  axisNamesByProduct?: Map<string, string[]>,
): {
  lines: HealthQuoteLine[];
  unresolved: string[];
  subtotal: number;
  points: number;
  discountExcluded: number;
} {
  const lines: HealthQuoteLine[] = [];
  const unresolved: string[] = [];
  let subtotal = 0;
  let points = 0;
  let discountExcluded = 0;
  for (const item of items) {
    const prod = resolveProduct(item.product_name, products);
    const line: HealthQuoteLine = {
      product_name: item.product_name,
      quantity: item.quantity,
      source,
      ...(axisNamesByProduct?.get(norm(item.product_name))
        ? { axisNames: axisNamesByProduct.get(norm(item.product_name)) }
        : {}),
    };
    if (prod) {
      line.unitPrice = prod.price;
      line.score = prod.score ?? undefined;
      line.usanaIqUrl = prod.usana_iq_url;
      subtotal += prod.price * item.quantity;
      points += (prod.score ?? 0) * item.quantity;
      // 쉐이커/지퍼백/셀라비브는 10% 할인·적립 제외 (스펙 11장)
      if (DISCOUNT_EXCLUDED_KEYWORDS.some((kw) => norm(item.product_name).includes(norm(kw)))) {
        discountExcluded += prod.price * item.quantity;
      }
    } else {
      unresolved.push(item.product_name);
    }
    lines.push(line);
  }
  return { lines, unresolved, subtotal, points, discountExcluded };
}

export async function buildHealthQuote(
  analysis: HealthChecklistAnalysis,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<HealthQuoteResult | null> {
  const axes = judgeAxes(analysis.scores, analysis.grades ?? null);
  if (!hasUsableJudgment(axes)) return null;

  const grade = overallGrade(axes);

  const { data: prodData } = await supabase
    .from("admin_products")
    .select("name, price, score, usana_iq_url, aliases") as { data: ProductRow[] | null };
  const products = prodData ?? [];

  function buildTier(tier: TierKey): HealthQuoteTier {
    const plan = buildTierPlan(grade, tier, axes);

    const base = toQuoteLines(plan.baseItems, products, "base");
    const axisNamesByProduct = new Map(
      plan.additions.map((a) => [norm(a.product_name), a.axisNames]),
    );
    const adds = toQuoteLines(
      plan.additions.map((a) => ({ product_name: a.product_name, quantity: a.quantity })),
      products,
      "axis",
      axisNamesByProduct,
    );

    const nutrimealOptions: NutrimealQuoteOption[] =
      plan.resetWeeks > 0
        ? NUTRIMEAL_OPTIONS.map((o) => {
            const prod = resolveProduct(o.product_name, products);
            return {
              key: o.key,
              label: o.label,
              product_name: o.product_name,
              quantity: o.unitsPerWeek * plan.resetWeeks,
              unitPrice: prod?.price,
              score: prod?.score ?? undefined,
              flavors: o.flavors,
            };
          })
        : [];

    const subtotalResolved = base.subtotal + adds.subtotal;
    const pointsResolved = base.points + adds.points;
    const discountExcludedResolved = base.discountExcluded + adds.discountExcluded;
    const defaultNutrimeal = nutrimealOptions[0] ?? null;

    return {
      key: tier,
      label: plan.label,
      blockLabels: plan.blockLabels,
      lines: [...base.lines, ...adds.lines],
      nutrimealOptions,
      subtotalResolved,
      pointsResolved,
      discountExcludedResolved,
      unresolved: [...base.unresolved, ...adds.unresolved],
      totals: computeTierTotals(subtotalResolved, pointsResolved, defaultNutrimeal, discountExcludedResolved),
    };
  }

  return {
    axes,
    overallGrade: grade,
    analysisText: buildAnalysisText(axes, grade),
    resetPurpose: grade === "양호" || grade === "보통" ? "유지" : "회복",
    tiers: {
      premium: buildTier("premium"),
      standard: buildTier("standard"),
      basic: buildTier("basic"),
    },
    optionalExtras: [...OPTIONAL_EXTRAS],
  };
}
