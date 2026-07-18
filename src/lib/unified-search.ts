export type UnifiedSearchSource = "stories" | "links" | "images" | "youtube" | "products";

export const ALL_UNIFIED_SEARCH_SOURCES: UnifiedSearchSource[] = [
  "stories",
  "links",
  "images",
  "youtube",
  "products",
];

const SOURCE_PATTERNS: Array<{
  source: UnifiedSearchSource;
  pattern: RegExp;
}> = [
  { source: "images", pattern: /이미지|사진|그림|카드뉴스|카드\s*자료|포스터|전단/ },
  { source: "youtube", pattern: /유튜브|동영상|영상|짧은\s*영상|강의\s*영상/ },
  { source: "stories", pattern: /사례|체험|후기|케이스|좋아진|좋아져|비슷한\s*사람|이런\s*(사람|경우)/ },
  { source: "links", pattern: /링크|주소|문서|설명\s*자료|피디에프|\bpdf\b|홈페이지|사이트/i },
  { source: "products", pattern: /제품|영양제|섭취\s*방법|성분|원료|가격|\bpv\b|어디에\s*좋|차이|비교/i },
];

const BROAD_RESOURCE_PATTERN = /자료|보내\s*줄|보내줘|공유|참고할|볼\s*거/;

export type UnifiedSearchTopic = "joint" | "gut" | null;

export type UnifiedSearchRequest =
  | { action: "search"; sources: UnifiedSearchSource[]; topic: UnifiedSearchTopic }
  | {
      action: "redirect" | "reject";
      target: "health_product" | "action_calculator" | "meeting_business" | null;
      message: string;
    };

const FABRICATED_LINK_PATTERN = /(없는|가짜|임의).*(자료|링크|주소).*(만들|생성)|(만들|생성).*(가짜|없는).*(링크|주소)/;
const ACTION_CALCULATOR_PATTERN = /견적|가격\s*계산|퓨처\s*빌더|이번\s*주.*몇\s*점|수당|\bcvp\b/i;
const MEETING_BUSINESS_PATTERN = /네트워크.*(뭐부터|무엇부터|얘기|말)|미팅.*(준비|뭐부터)|사업.*(공부|설명)|보상\s*플랜/;
const BUSINESS_RESOURCE_PATTERN = /(초기\s*사업자|사업).*(공부|교육|배우|가이드|자료|영상)/;
// 질환·증상·복용약을 전제로 제품을 골라 달라는 요청만 안전 상담으로 보낸다.
// 제품명·성분·가격·이미지·등록 정보처럼 DB로 확인 가능한 질문은 자료찾기에서 처리한다.
const HEALTH_RECOMMENDATION_PATTERN = /(뭐|무엇|어떤\s*거|어떤\s*제품).*(먹으면|섭취하면|추천)|(질환|암|심장|고혈압|고지혈증|당뇨|복용약|약\s*먹).*(제품|영양제).*(추천|먹)/;

export function resolveUnifiedSearchTopic(query: string): UnifiedSearchTopic {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (/관절|무릎|연골/.test(normalized)) return "joint";
  if (/장\s*건강|변비|배변|장이?\s*안\s*좋|복부|배가\s*(부풀|붓)/.test(normalized)) return "gut";
  return null;
}

export function resolveUnifiedSearchRequest(query: string): UnifiedSearchRequest {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (FABRICATED_LINK_PATTERN.test(normalized)) {
    return { action: "reject", target: null, message: "확인되지 않은 자료나 링크는 만들 수 없습니다. DB에 있는 자료만 찾아드릴게요." };
  }
  if (ACTION_CALCULATOR_PATTERN.test(normalized)) {
    return { action: "redirect", target: "action_calculator", message: "이 질문은 자료검색이 아니라 견적·점수·목표 계산 범위입니다. `견적·점수·목표`에서 필요한 기준값을 확인한 뒤 계산해주세요." };
  }
  if (MEETING_BUSINESS_PATTERN.test(normalized) && !BUSINESS_RESOURCE_PATTERN.test(normalized)) {
    return { action: "redirect", target: "meeting_business", message: "이 질문은 자료검색보다 미팅·사업 코칭 범위에 가깝습니다. `미팅·사업 도우미`에서 대상과 상황을 확인한 뒤 이어가주세요." };
  }
  if (HEALTH_RECOMMENDATION_PATTERN.test(normalized)) {
    return { action: "redirect", target: "health_product", message: "이 질문은 건강·제품 상담 범위입니다. 통합 자료찾기에서는 제품을 임의 추천하거나 효능을 단정하지 않습니다. 질환·증상·복용약 안전 확인 후 상담 기능에서 이어가주세요." };
  }
  return { action: "search", sources: resolveUnifiedSearchSources(query), topic: resolveUnifiedSearchTopic(query) };
}

/**
 * 사용자가 자료 형식을 분명히 말하면 해당 DB만 검색한다.
 * 단순히 "자료"라고 하거나 형식을 말하지 않으면 제품을 포함한 모든 승인 DB를 함께 검색한다.
 */
export function resolveUnifiedSearchSources(query: string): UnifiedSearchSource[] {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalized) return ALL_UNIFIED_SEARCH_SOURCES;

  const explicit = SOURCE_PATTERNS
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ source }) => source);

  if (BROAD_RESOURCE_PATTERN.test(normalized) && explicit.length === 0) {
    return ALL_UNIFIED_SEARCH_SOURCES;
  }

  return explicit.length > 0
    ? ALL_UNIFIED_SEARCH_SOURCES.filter((source) => explicit.includes(source))
    : ALL_UNIFIED_SEARCH_SOURCES;
}

export function shouldSearchExperienceStories(query: string): boolean {
  return resolveUnifiedSearchSources(query).includes("stories");
}
