// 패키지 견적 엔진 — 텍스트 질의(목적/예산)에서 패키지를 결정적으로 매칭한다.
// LLM 선택 방식 대신 규칙 기반을 쓰는 이유: 결과가 예측 가능하고, 가격·구성품 수치를
// 지어낼 여지가 없으며, 검증이 쉽다. (00_decisions/2026-07-05_quotation_package-quote-engine.md)
// 이미지(건강 체크리스트) 경로의 buildQuotation(quotation-engine.ts)과는 별개 경로다.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface QuoteQuery {
  /** 파싱된 예산(원). 없으면 null */
  budgetKrw: number | null;
  /** max = "이하/이내/까지", around = "대/정도/쯤" 또는 수식어 없음 */
  budgetMode: "max" | "around" | null;
  /** 패키지 name/category/tags와 대조된 목적 키워드 */
  keywords: string[];
}

export interface QuoteComponentLine {
  product_name: string;
  quantity: number;
  unitPrice?: number;
  score?: number;
  usanaIqUrl?: string | null;
}

export interface PackageQuoteCandidate {
  id: string;
  name: string;
  price: number;
  score: number | null;
  discount_rate: number | null;
  category: string | null;
  components: QuoteComponentLine[];
  /** 단가가 확인된 구성품의 합계. 하나도 확인 안 되면 null */
  componentsSubtotal: number | null;
  /** 제품 DB에서 단가를 찾지 못한 구성품 이름 (조용히 누락시키지 않고 카드에 표시) */
  unresolved: string[];
}

export interface PackageQuoteResult {
  query: QuoteQuery;
  candidates: PackageQuoteCandidate[];
}

// 패키지 name/category/tags에 실제로 등장하는 목적 어휘. 견적 의도어(견적/추천/패키지)는
// 매칭 신호가 아니므로 제외한다.
const PURPOSE_KEYWORDS = [
  "리셋", "해독", "다이어트", "영양", "염증", "체중", "체지방",
  "셀라비브", "뷰티", "스킨케어", "피부", "화장품",
  "헬라챌", "챌린지", "스타터", "베이직", "파우더", "웰니", "웰니스",
  "면역", "장건강", "간건강", "항산화",
];

interface PackageRow {
  id: string;
  name: string;
  price: number;
  score: number | null;
  discount_rate: number | null;
  category: string | null;
  tags: string[] | null;
  benefit: string | null;
  components: { product_name?: string; quantity?: number }[] | null;
}

// "50만원", "100만 원 이하", "1백만원", "50만원대" 등에서 예산과 모드를 파싱
export function parseQuoteQuery(text: string): QuoteQuery {
  const normalized = text.replace(/\s+/g, " ");

  let budgetKrw: number | null = null;
  let budgetMode: "max" | "around" | null = null;
  const budgetMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(천만|백만|만)\s*원?/);
  if (budgetMatch) {
    const num = parseFloat(budgetMatch[1]);
    const unit = budgetMatch[2] === "천만" ? 10_000_000 : budgetMatch[2] === "백만" ? 1_000_000 : 10_000;
    budgetKrw = Math.round(num * unit);
    const after = normalized.slice(normalized.indexOf(budgetMatch[0]) + budgetMatch[0].length, normalized.indexOf(budgetMatch[0]) + budgetMatch[0].length + 6);
    budgetMode = /이하|이내|까지|안으로|미만/.test(after) ? "max" : "around";
  }

  const keywords = PURPOSE_KEYWORDS.filter((kw) => normalized.includes(kw));

  return { budgetKrw, budgetMode, keywords };
}

// 견적 질의로 볼 수 있는지 — 예산이나 목적 키워드 중 하나는 있어야 결정적 매칭을 시도한다.
export function isQuoteQuery(query: QuoteQuery): boolean {
  return query.budgetKrw !== null || query.keywords.length > 0;
}

function keywordScore(pkg: PackageRow, keywords: string[]): number {
  let score = 0;
  const tags = (pkg.tags ?? []).join(" ");
  for (const kw of keywords) {
    if (pkg.name.includes(kw)) score += 3;
    if (pkg.category?.includes(kw)) score += 2;
    if (tags.includes(kw)) score += 2;
    if (pkg.benefit?.includes(kw)) score += 1;
  }
  return score;
}

// admin_products.aliases는 JSON 배열 문자열('["별칭1","별칭2"]') 또는 쉼표 구분 텍스트 두 형식이 공존한다.
function parseAliases(raw: string | null): string[] {
  if (!raw) return [];
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      // JSON 파싱 실패 시 쉼표 구분으로 처리
    }
  }
  return t.split(",").map((s) => s.trim()).filter(Boolean);
}

// 제품명 해석: 정확 일치 → 별칭 포함 → 접두 일치 → 포함 일치(가장 짧은 이름 우선)
export function resolveProduct(
  name: string,
  products: { name: string; price: number; score: number | null; usana_iq_url: string | null; aliases: string | null }[],
) {
  const norm = (s: string) => s.replace(/\s+/g, "");
  const target = norm(name);
  const exact = products.find((p) => norm(p.name) === target);
  if (exact) return exact;
  const byAlias = products.find((p) =>
    parseAliases(p.aliases).some((a) => a && norm(a) === target)
  );
  if (byAlias) return byAlias;
  const prefix = products
    .filter((p) => norm(p.name).startsWith(target) || target.startsWith(norm(p.name)))
    .sort((a, b) => a.name.length - b.name.length);
  if (prefix.length > 0) return prefix[0];
  const contains = products
    .filter((p) => norm(p.name).includes(target) || target.includes(norm(p.name)))
    .sort((a, b) => a.name.length - b.name.length);
  return contains[0] ?? null;
}

// ── 카드 vs 텍스트 출력 분기 (B-3: 결정적 기준) ──────────────────────────────
// 합의안: OCR 건강체크표 입력 또는 Package DB의 "정해진 패키지명" 입력 → 카드,
// 제품명·수량 자유 입력 / 혼합 견적 / 바디용품·화장품 포함 → 텍스트.
// (00_decisions/2026-07-07_quotation_card-vs-text-branching.md)

const normName = (s: string) => s.replace(/\s+/g, "").toLowerCase();

// 자유 입력(혼합 견적) 신호 — 패키지명 제거 후 남은 텍스트에 개별 수량 표기가 있으면 텍스트로
const FREEFORM_QUANTITY_RE = /\d+\s*(개|통|병|박스|세트|ea)/i;
// 바디용품·화장품 신호 — 카드 확대는 별도 기준 확정 후 (매칭된 패키지명 자체에 포함된 경우는 예외)
const BODY_COSMETIC_KEYWORDS = [
  "바디", "화장품", "샴푸", "컨디셔너", "로션", "클렌저", "세럼", "토너", "크림",
  "리무버", "스크럽", "마스크", "치약", "핸드워시", "샤워", "앰플", "너리셔",
];

export type QuoteOutputDecision =
  | { mode: "card"; matched: { id: string; name: string }[] }
  | { mode: "text"; reason: "no_exact_package" | "mixed_freeform" | "body_or_cosmetic" };

/**
 * 패키지명 "정확 매칭": 정규화한 사용자 텍스트에 (1) 패키지 전체 이름 또는
 * (2) 이름의 의미 세그먼트("_"·괄호로 분리, 4자 이상, "패키지 N주" 같은 일반어 제외)가
 * 그대로 포함될 때만 매칭으로 본다. 예: "리셋해독 2주 견적" → "패키지 2주_리셋해독 2주 (…)" 매칭.
 */
export function packageNameSegments(name: string): string[] {
  const segments: string[] = [];
  const paren = name.match(/\(([^)]+)\)/g) ?? [];
  const withoutParen = name.replace(/\([^)]*\)/g, " ");
  for (const part of [...withoutParen.split(/[_+]/), ...paren.map((p) => p.slice(1, -1))]) {
    const seg = normName(part);
    if (seg.length < 4) continue;
    if (/^패키지\d*주?$/.test(seg)) continue; // 일반어 세그먼트 제외
    segments.push(seg);
  }
  return segments;
}

export function decidePackageQuoteOutput(
  text: string,
  packages: { id: string; name: string }[],
): QuoteOutputDecision {
  const t = normName(text);
  if (!t) return { mode: "text", reason: "no_exact_package" };

  const matched: { id: string; name: string }[] = [];
  const matchedSegments: string[] = [];
  for (const pkg of packages) {
    const full = normName(pkg.name);
    const segs = packageNameSegments(pkg.name);
    const hit = t.includes(full) ? full : segs.find((s) => t.includes(s));
    if (hit) {
      matched.push(pkg);
      matchedSegments.push(hit === full ? full : hit);
    }
  }
  if (matched.length === 0) return { mode: "text", reason: "no_exact_package" };

  // 매칭된 패키지명(세그먼트) 부분을 제거한 나머지에서 자유 입력/바디용품 신호 검사
  let leftover = t;
  for (const seg of [...new Set(matchedSegments)]) {
    leftover = leftover.split(seg).join(" ");
  }
  if (FREEFORM_QUANTITY_RE.test(leftover)) return { mode: "text", reason: "mixed_freeform" };
  if (BODY_COSMETIC_KEYWORDS.some((kw) => leftover.includes(normName(kw)))) {
    return { mode: "text", reason: "body_or_cosmetic" };
  }
  return { mode: "card", matched };
}

/**
 * B-3 카드 경로 전용: 패키지명 정확 매칭 시에만 견적 카드 데이터를 만든다.
 * 매칭이 없거나 혼합/바디용품 신호가 있으면 null → 호출부는 텍스트(LLM) 응답으로 처리.
 */
export async function matchPackagesExact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  text: string,
  limit = 3,
): Promise<PackageQuoteResult | null> {
  const { data: pkgData } = await supabase
    .from("admin_packages")
    .select("id, name, price, score, discount_rate, category, tags, benefit, components")
    .eq("is_active", true) as { data: PackageRow[] | null };
  const packages = pkgData ?? [];

  const decision = decidePackageQuoteOutput(text, packages);
  if (decision.mode !== "card") return null;

  const matchedIds = new Set(decision.matched.map((m) => m.id));
  const top = packages.filter((p) => matchedIds.has(p.id)).slice(0, limit);
  if (top.length === 0) return null;

  const candidates = await buildCandidates(supabase, top);
  return { query: parseQuoteQuery(text), candidates };
}

// 구성품 단가 결합 — 제품 수가 소량(수십 건)이라 전체 로드 후 이름 해석
async function buildCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  top: PackageRow[],
): Promise<PackageQuoteCandidate[]> {
  const { data: prodData } = await supabase
    .from("admin_products")
    .select("name, price, score, usana_iq_url, aliases") as {
      data: { name: string; price: number; score: number | null; usana_iq_url: string | null; aliases: string | null }[] | null;
    };
  const products = prodData ?? [];

  return top.map((pkg) => {
    const lines: QuoteComponentLine[] = [];
    const unresolved: string[] = [];
    for (const c of pkg.components ?? []) {
      const pname = c.product_name?.trim();
      if (!pname) continue;
      const quantity = c.quantity ?? 1;
      const prod = resolveProduct(pname, products);
      if (prod) {
        lines.push({
          product_name: pname,
          quantity,
          unitPrice: prod.price,
          score: prod.score ?? undefined,
          usanaIqUrl: prod.usana_iq_url,
        });
      } else {
        lines.push({ product_name: pname, quantity });
        unresolved.push(pname);
      }
    }
    const resolvedLines = lines.filter((l) => l.unitPrice !== undefined);
    const componentsSubtotal = resolvedLines.length > 0
      ? resolvedLines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.quantity, 0)
      : null;
    return {
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      score: pkg.score,
      discount_rate: pkg.discount_rate,
      category: pkg.category,
      components: lines,
      componentsSubtotal,
      unresolved,
    };
  });
}

export async function matchPackages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  query: QuoteQuery,
  limit = 3,
): Promise<PackageQuoteResult> {
  const { data: pkgData } = await supabase
    .from("admin_packages")
    .select("id, name, price, score, discount_rate, category, tags, benefit, components")
    .eq("is_active", true) as { data: PackageRow[] | null };
  const packages = pkgData ?? [];

  // 스코어링: 키워드 우선, 예산은 필터/근접 정렬
  let scored = packages.map((p) => ({ pkg: p, kw: keywordScore(p, query.keywords) }));

  if (query.keywords.length > 0) {
    scored = scored.filter((s) => s.kw > 0);
  }
  if (query.budgetKrw !== null) {
    if (query.budgetMode === "max") {
      scored = scored.filter((s) => s.pkg.price <= query.budgetKrw! * 1.05);
    }
    scored.sort((a, b) => b.kw - a.kw || Math.abs(a.pkg.price - query.budgetKrw!) - Math.abs(b.pkg.price - query.budgetKrw!));
  } else {
    scored.sort((a, b) => b.kw - a.kw || a.pkg.price - b.pkg.price);
  }

  const top = scored.slice(0, limit).map((s) => s.pkg);
  if (top.length === 0) return { query, candidates: [] };

  const candidates = await buildCandidates(supabase, top);
  return { query, candidates };
}
