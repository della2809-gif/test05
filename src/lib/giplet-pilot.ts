import type { AdminGiplet } from "@/types/database";

export const PILOT_GIPLET_KEYS = [
  "unified_search",
  "meeting_business",
  "action_calculator",
  "function_tools",
] as const;

export type PilotGipletKey = (typeof PILOT_GIPLET_KEYS)[number];
export const UNIFIED_SEARCH_WELCOME_PROMPT = [
  "찾고 싶은 걸 편하게 말해 주세요 ^^",
  "",
  "사례, 이미지, 영상, 설명자료,",
  "처방전표, 제품정보까지",
  "관련 있는 자료를 골라 보여드릴게요.",
  "",
  "예)",
  "림프종 사례 있어?",
  "고혈압 관련 자료 보여줘",
  "관절 영상 보내줄 거 있어?",
  "더블엑스 평가는 어때?",
].join("\n");

export const UNIFIED_SEARCH_SYSTEM_PROMPT = [
  "당신은 지니아의 통합 자료찾기 도우미입니다.",
  "사용자가 평소 말투로 질문하면 질문의 주제와 원하는 자료 유형을 파악하고, 연결된 DB에서 실제로 확인된 자료만 안내하세요.",
  "",
  "[검색과 결과 구성]",
  "1. 검색 결과는 관련도 순으로 최대 3~5건만 먼저 보여주세요.",
  "2. 사용자가 특정 자료 유형을 지정하지 않았다면 혈통만사, 체험사례, 이미지, 유튜브, 링크·설명자료, 처방전표, 제품정보, 제품평가처럼 서로 다른 유형을 우선 섞어 보여주세요.",
  "3. 관련성이 낮은 유형을 개수 채우기용으로 억지로 넣지 마세요.",
  "4. 같은 사례의 이미지가 여러 장이면 사례 1건으로 묶고, 첫 답변에는 대표 이미지 1장만 보여주세요.",
  "5. DB에 없는 자료·링크·수치·사례는 만들거나 추측하지 마세요.",
  "",
  "[추가 자료 안내]",
  "1. 최초 결과 다음에는 실제로 남아 있는 자료 유형만 안내하세요.",
  "2. 각 유형은 이미 보여준 자료와 중복을 제외한 남은 건수를 표시하세요.",
  "3. 같은 사례의 여러 이미지는 이미지 장수가 아니라 사례 1건으로 계산하세요.",
  "4. 남은 자료가 없는 유형은 제안하지 마세요.",
  "5. 추가 자료가 모두 소진되면 '관련 자료를 모두 보여드렸어요.'라고 안내하세요.",
  "6. 추가 선택 문구는 '어떤 자료를 더 볼까요?'처럼 짧고 친근하게 작성하세요.",
  "",
  "[제품 질문]",
  "제품 설명, 비교, 등록된 평가·별점·메달, 이미지·영상·링크 자료는 확인된 DB 내용으로 안내할 수 있습니다.",
  "제품 DB의 텍스트 정보와 이미지 DB의 같은 제품 이미지는 하나의 제품 카드로 묶어 보여주세요.",
  "견적 질문은 자동견적 기능으로 연결하세요.",
  "질환·증상·복용약과 함께 '무엇을 먹을지' 묻는 질문에는 제품을 바로 추천하거나 치료 효과를 단정하지 말고 건강 안전 확인이 필요한 상담으로 연결하세요.",
  "",
  "[표현과 안전]",
  "친근하고 짧게 쓰고, 스마일 이모지는 사용하지 말며 필요한 경우 ^^를 사용하세요.",
  "휴대폰에서 읽기 쉽도록 한 문단을 짧게 쓰고 문단 사이에 빈 줄을 넣으세요.",
  "일반 검색 결과의 첫머리에 긴 안전 문구를 반복하지 마세요.",
  "체험사례·질환·처방전표의 안전 안내는 해당 상세자료 하단에 짧은 참고 문구로 표시하세요.",
].join("\n");

export const PILOT_GIPLETS: AdminGiplet[] = [
  {
    id: "pilot-unified-search",
    giplet_key: "unified_search",
    name: "통합 자료찾기",
    description: "평소 말투로 이미지·영상·사례·링크 자료 찾기",
    tag: "자료 검색",
    color_scheme: "gray",
    icon: "Search",
    system_prompt: UNIFIED_SEARCH_SYSTEM_PROMPT,
    db_sources: ["stories", "links", "images", "youtube", "products"],
    capability: null,
    initial_prompt: UNIFIED_SEARCH_WELCOME_PROMPT,
    case_key: null,
    is_system: false,
    is_active: true,
    sort_order: 1,
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
  },
  {
    id: "pilot-meeting-business",
    giplet_key: "meeting_business",
    name: "미팅·사업 도우미",
    description: "상황에 맞는 말하기·미팅 흐름·사업 학습 안내",
    tag: "미팅 코치",
    color_scheme: "gray",
    icon: "MessageCircle",
    system_prompt: "",
    db_sources: ["templates", "blocks", "youtube", "links"],
    capability: null,
    initial_prompt: "누구와 어떤 대화를 준비하는지 알려주세요. 예: 초기 사업자인데 뭐부터 공부해?",
    case_key: null,
    is_system: false,
    is_active: true,
    sort_order: 2,
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
  },
  {
    id: "pilot-action-calculator",
    giplet_key: "action_calculator",
    name: "견적·점수·목표",
    description: "제품 견적·수당/CVP·여행 목표 계산",
    tag: "계산·실행",
    color_scheme: "gray",
    icon: "Calculator",
    system_prompt: "",
    db_sources: ["products", "packages", "calculations", "images"],
    capability: null,
    initial_prompt: "무엇을 계산할까요? 제품 견적, 수당·CVP, 여행 목표 중 평소 말투로 질문해주세요.",
    case_key: null,
    is_system: false,
    is_active: true,
    sort_order: 3,
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
  },
  {
    id: "pilot-function-tools",
    giplet_key: "function_tools",
    name: "기능도구",
    description: "섭취방법·SNS·수료증·감사장 등 공유용 결과물 만들기",
    tag: "제작 도구",
    color_scheme: "gray",
    icon: "Sparkles",
    system_prompt: "",
    db_sources: ["products", "images", "templates", "blocks"],
    capability: null,
    initial_prompt: "무엇을 만들까요? 섭취방법 카드, SNS 카드, 수료증, 감사장, 인증서, 초대장, 공지 카드, 체크리스트 중 평소 말투로 알려주세요.",
    case_key: null,
    is_system: false,
    is_active: true,
    sort_order: 4,
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
  },
];

export function isPilotHostname(hostname: string): boolean {
  return hostname === "127.0.0.1"
    || hostname === "localhost"
    || hostname.includes("codex-blood-story-pilot");
}

export function resolveActionCapability(question: string):
  | "health_analysis"
  | "commission_calc"
  | "travel_calc"
  | null {
  const normalized = question.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
  if (/(견적|가격|제품.*얼마|얼마.*제품|패키지)/.test(normalized)) return "health_analysis";
  if (/(여행|제주|여행비|목표비용)/.test(normalized)) return "travel_calc";
  if (/(수당|cvp|좌측|우측|좌우|비즈니스센터|\bbc\b|이번주.*점|몇점)/i.test(normalized)) return "commission_calc";
  return null;
}
