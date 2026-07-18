import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnifiedSearchSource } from "./unified-search";

export type RegistrySearchRow = {
  id: string;
  source_table: string;
  source_key: string;
  content_type: string;
  title: string;
  summary: string | null;
  resource_url: string | null;
  thumbnail_url: string | null;
  keywords: string[] | null;
  aliases: string[] | null;
  metadata: Record<string, unknown> | null;
  verification_status: string;
  content_assets: Array<{
    id: string;
    asset_type: string;
    page_index: number;
    public_url: string | null;
    file_name: string;
    availability_status: string;
  }> | null;
  supplement_rating?: SupplementRatingDetail | null;
  product_detail?: ProductDetail | null;
};

export type RegistrySearchResult = RegistrySearchRow & { score: number };
export type RegistrySearchResults = RegistrySearchResult[] & { remainingCounts?: Record<string, number> };

export type SupplementRatingDetail = {
  brand_book: string;
  display_name_ko: string;
  country: string;
  edition: string | null;
  rating_score: number | null;
  rating_display: string | null;
  medal_value: string | null;
  source_page: string | null;
  source_scope: string;
};
export type ProductDetail = {
  id: string;
  product_number: string | null;
  name: string;
  price: number | null;
  score: number | null;
  category: string | null;
  sub_category: string | null;
  target_audience: string | null;
  recommended_situation: string | null;
  caution: string | null;
  usana_iq_url: string | null;
};


export type UnifiedSearchCardPayload = {
  version: 1;
  results: Array<{
    id: string;
    sourceTable: string;
    typeLabel: string;
    title: string;
    summary: string | null;
    resourceUrl: string | null;
    thumbnailUrl: string | null;
    images: string[];
    rating: SupplementRatingDetail | null;
    product: ProductDetail | null;
    footerNotice: string | null;
  }>;
  moreOptions: Array<{
    sourceTable: string;
    typeLabel: string;
    remaining: number;
  }>;
};

export const UNIFIED_SEARCH_PREFIX = "__UNIFIEDSEARCH__:";

const STOPWORDS = new Set([
  "자료", "찾아줘", "보여줘", "보내줘", "알려줘", "어때", "있어", "사람", "좋아진",
  "제품", "영양제", "건강", "정보", "관련", "참고자료", "사례", "케이스", "체험",
  "평가", "별점", "평점", "등급", "비교", "비교해줘", "영상", "유튜브", "동영상",
  "이미지", "사진", "그림", "링크", "사이트", "주소", "처방전", "참고표", "가이드",
]);

const SOURCE_INTENTS = [
  { pattern: /(사례|케이스|체험)/, source: "blood_story_cases", boost: 24 },
  { pattern: /(영양|처방전|참고표|가이드)/, source: "nutrition_prescription_guides", boost: 24 },
  { pattern: /(평가|별점|평점|등급)/, source: "supplement_product_ratings", boost: 24 },
  { pattern: /(영상|유튜브|강의|짧은)/, source: "youtube_transcripts", boost: 24 },
  { pattern: /(링크|사이트|주소|보내줄)/, source: "links", boost: 24 },
  { pattern: /(제품|영양제|섭취|성분|원료|가격|어디에\s*좋|차이|비교)/, source: "admin_products", boost: 24 },
  { pattern: /(제품|영양제|이미지|사진|비교|인증|등재|라인)/, source: "admin_images", boost: 18 },
];

// Preview 단계에서 통합 자료찾기가 조회해도 되는 DB만 명시한다.
// null(전체 허용)로 두면 재분류 전 기존 DB까지 섞여 나오므로 금지한다.
export const UNIFIED_SEARCH_ALLOWED_TABLES = [
  "blood_story_cases",
  "nutrition_prescription_guides",
  "supplement_product_ratings",
  "links",
  "youtube_transcripts",
  "admin_products",
  "admin_images",
] as const;

export function normalizeRegistrySearchText(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .trim();
}

function cleanTerm(term: string): string {
  let cleaned = term.replace(/(은|는|이|가|을|를|에|와|과|도|좀)$/u, "");
  if (cleaned.length > 3 && cleaned.endsWith("하고")) cleaned = cleaned.slice(0, -2);
  if (cleaned.length > 3 && cleaned.endsWith("인")) cleaned = cleaned.slice(0, -1);
  return cleaned;
}

export function extractRegistrySearchTerms(query: string): string[] {
  const terms = [...new Set(
    normalizeRegistrySearchText(query)
      .split(/\s+/)
      .map(cleanTerm)
      .filter((term) => term.length >= 2 && !STOPWORDS.has(term)),
  )];

  // 팀원이 붙여 말하는 질환명도 DB의 분리 키워드와 매칭한다.
  // 예: "아토피알러지" → "아토피", "알러지"
  const joinedTopicExpansions = [
    ["아토피", "알러지"],
    ["아토피", "알레르기"],
  ];
  for (const term of [...terms]) {
    for (const parts of joinedTopicExpansions) {
      if (parts.every((part) => term.includes(part))) terms.push(...parts);
    }
  }
  return [...new Set(terms)];
}

export function scoreRegistrySearchRow(row: RegistrySearchRow, query: string): number {
  const title = normalizeRegistrySearchText(row.title);
  const aliases = normalizeRegistrySearchText((row.aliases ?? []).join(" "));
  const keywords = normalizeRegistrySearchText((row.keywords ?? []).join(" "));
  const summary = normalizeRegistrySearchText(row.summary);
  let topicalScore = 0;
  let matchedTermCount = 0;
  const terms = extractRegistrySearchTerms(query);

  for (const term of terms) {
    let matched = false;
    if (title.includes(term)) { topicalScore += 14; matched = true; }
    if (aliases.includes(term)) { topicalScore += 8; matched = true; }
    if (keywords.includes(term)) { topicalScore += 7; matched = true; }
    if (summary.includes(term)) { topicalScore += 3; matched = true; }
    if (matched) matchedTermCount += 1;
  }

  // 두 단어 이상의 구체적인 질문은 일부 단어만 맞는 자료를 제외한다.
  // 예: "FOS 액티브"에서 "액티브"만 포함한 다른 제품은 검색하지 않는다.
  const requiredTermCount = terms.length <= 2 ? terms.length : Math.ceil(terms.length / 2);
  if (matchedTermCount < requiredTermCount) return 0;
  // 유형 의도 점수만으로 무관한 결과가 살아남지 않게 한다.
  // 단, 사용자가 주제 없이 "영상 보여줘"처럼 유형만 말한 경우에는
  // 해당 유형의 전체 자료 중 상위 결과를 보여줄 수 있다.
  if (terms.length > 0 && topicalScore === 0) return 0;

  let score = topicalScore;

  for (const intent of SOURCE_INTENTS) {
    if (intent.pattern.test(query) && row.source_table === intent.source) score += intent.boost;
  }

  return score;
}

export function resolveRegistrySourceTables(query: string, sources: UnifiedSearchSource[]): string[] | null {
  const normalized = normalizeRegistrySearchText(query);

  // 구체적인 출력 형식을 말하면 해당 DB를 강제한다.
  // "사례 영상"에서 사례는 주제이고 영상이 실제 출력 형식이므로 영상 우선이다.
  if (/(영상|유튜브|동영상|강의 영상|짧은 영상)/.test(normalized)) return ["youtube_transcripts"];
  if (/(링크|사이트|홈페이지|주소)/.test(normalized)) return ["links"];
  if (/(평가|별점|평점|등급)/.test(normalized)) return ["supplement_product_ratings"];
  if (/(비교|차이)/.test(normalized)) return ["admin_products", "supplement_product_ratings", "admin_images"];
  if (/(이미지|사진|그림|카드뉴스|포스터|전단)/.test(normalized)) {
    return ["blood_story_cases", "nutrition_prescription_guides", "admin_products", "admin_images"];
  }
  if (/(제품|영양제|섭취 방법|성분|원료|어디에 좋|제품정보)/.test(normalized)) return ["admin_products"];
  // 처방전 질문은 관련 사례를 함께 보는 기존 실사용 요구를 유지한다.
  if (/(처방전|영양 참고표|영양표)/.test(normalized)) {
    return ["nutrition_prescription_guides", "blood_story_cases"];
  }
  if (/(사례|케이스|체험|후기)/.test(normalized)) return ["blood_story_cases"];

  if (sources.length === 5) return [...UNIFIED_SEARCH_ALLOWED_TABLES];

  const tables = new Set<string>();
  for (const source of sources) {
    if (source === "stories") tables.add("blood_story_cases");
    if (source === "images") {
      tables.add("blood_story_cases");
      tables.add("nutrition_prescription_guides");
      tables.add("admin_images");
    }
    if (source === "links") tables.add("links");
    if (source === "youtube") tables.add("youtube_transcripts");
    if (source === "products") tables.add("admin_products");
    if (source === "products") tables.add("admin_images");
  }
  return [...tables];
}
export async function searchContentRegistry(
  supabase: SupabaseClient,
  query: string,
  sources: UnifiedSearchSource[],
  limit = 3,
): Promise<RegistrySearchResult[]> {
  const sourceTables = resolveRegistrySourceTables(query, sources);
  if (sourceTables?.length === 0) return Object.assign([], { remainingCounts: {} }) as RegistrySearchResults;

  let request = supabase.from("content_registry")
    .select("id, source_table, source_key, content_type, title, summary, resource_url, thumbnail_url, keywords, aliases, metadata, verification_status, content_assets(id, asset_type, page_index, public_url, file_name, availability_status)")
    .eq("verification_status", "verified")
    .eq("availability_status", "active")
    .eq("approval_status", "approved")
    .limit(500);

  if (sourceTables) request = request.in("source_table", sourceTables);
  const { data, error } = await request;
  if (error) {
    console.error("content_registry search failed:", error.message);
    return Object.assign([], { remainingCounts: {} }) as RegistrySearchResults;
  }

  const ranked = ((data ?? []) as RegistrySearchRow[])
    .map((row) => ({
      ...row,
      content_assets: (row.content_assets ?? [])
        .filter((asset) => asset.availability_status === "pending" || asset.availability_status === "active")
        .sort((a, b) => a.page_index - b.page_index),
      score: scoreRegistrySearchRow(row, query),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "ko"));

  const selected: RegistrySearchResult[] = [];
  for (const row of ranked) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.source_table === row.source_table)) selected.push(row);
  }
  for (const row of ranked) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.id === row.id)) selected.push(row);
  }

  const ratingContentIds = selected
    .filter((row) => row.source_table === "supplement_product_ratings")
    .map((row) => row.id);
  if (ratingContentIds.length > 0) {
    const { data: ratingRows, error: ratingError } = await supabase.from("supplement_product_ratings")
      .select("content_id, brand_book, display_name_ko, country, edition, rating_score, rating_display, medal_value, source_page, source_scope")
      .in("content_id", ratingContentIds);
    if (ratingError) {
      console.error("supplement rating detail search failed:", ratingError.message);
    } else {
      const ratingByContentId = new Map<string, SupplementRatingDetail>(
        (ratingRows ?? []).map((row: SupplementRatingDetail & { content_id: string }) => [row.content_id, row]),
      );
      for (const row of selected) row.supplement_rating = ratingByContentId.get(row.id) ?? null;
    }
  }
  const productSourceKeys = selected
    .filter((row) => row.source_table === "admin_products")
    .map((row) => row.source_key);
  if (productSourceKeys.length > 0) {
    const { data: productRows, error: productError } = await supabase.from("admin_products")
      .select("id, product_number, name, price, score, category, sub_category, target_audience, recommended_situation, caution, usana_iq_url")
      .in("id", productSourceKeys);
    if (productError) {
      console.error("product detail search failed:", productError.message);
    } else {
      const productById = new Map<string, ProductDetail>(
        ((productRows ?? []) as ProductDetail[]).map((row) => [row.id, row]),
      );
      for (const row of selected) row.product_detail = productById.get(row.source_key) ?? null;
    }
  }


  const remainingCounts = ranked.reduce<Record<string, number>>((counts, row) => {
    counts[row.source_table] = (counts[row.source_table] ?? 0) + 1;
    return counts;
  }, {});
  for (const row of selected) {
    remainingCounts[row.source_table] = Math.max(0, (remainingCounts[row.source_table] ?? 0) - 1);
  }

  return Object.assign(selected, { remainingCounts }) as RegistrySearchResults;
}

function registryTypeLabel(sourceTable: string): string {
  if (sourceTable === "blood_story_cases") return "혈통만사";
  if (sourceTable === "nutrition_prescription_guides") return "영양 참고표";
  if (sourceTable === "supplement_product_ratings") return "제품 평가";
  if (sourceTable === "youtube_transcripts") return "유튜브";
  if (sourceTable === "links") return "링크·설명자료";
  if (sourceTable === "admin_products") return "제품 정보";
  if (sourceTable === "admin_images") return "제품 이미지·설명자료";
  return "관련 자료";
}

export function formatRegistrySearchResults(results: RegistrySearchResults): string {
  const payload: UnifiedSearchCardPayload = {
    version: 1,
    results: results.map((result) => ({
      id: result.id,
      sourceTable: result.source_table,
      typeLabel: registryTypeLabel(result.source_table),
      title: result.title,
      summary: result.summary,
      resourceUrl: result.resource_url,
      thumbnailUrl: result.thumbnail_url,
      images: (result.content_assets ?? [])
        .map((asset) => asset.public_url)
        .filter((url): url is string => Boolean(url)),
      rating: result.supplement_rating ?? null,
      product: result.product_detail ?? null,
      footerNotice: result.source_table === "blood_story_cases"
        ? "개인의 체험사례이며 치료 효과를 보장하지 않습니다."
        : result.source_table === "nutrition_prescription_guides"
          ? "일반적인 영양 참고자료이며 진단·치료·처방을 대신하지 않습니다."
          : result.source_table === "supplement_product_ratings"
            ? "책 수록 당시의 평가자료이며 현재 제품 평가와 다를 수 있습니다."
            : result.source_table === "admin_products"
              ? "등록된 제품 정보이며 질환의 진단·치료나 개인별 섭취 권고를 대신하지 않습니다."
              : null,
    })),
    moreOptions: Object.entries(results.remainingCounts ?? {})
      .filter(([, remaining]) => remaining > 0)
      .map(([sourceTable, remaining]) => ({
        sourceTable,
        typeLabel: registryTypeLabel(sourceTable),
        remaining,
      }))
      .sort((a, b) => b.remaining - a.remaining || a.typeLabel.localeCompare(b.typeLabel, "ko")),
  };
  return `${UNIFIED_SEARCH_PREFIX}${JSON.stringify(payload)}`;
}
