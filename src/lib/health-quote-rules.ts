// 자동견적 OCR 플로우 — 규칙 데이터 모듈
// 출처: 00_requirements/0707_자동견적로직_매니저님전달최종.txt (클라이언트 확정 기준안, 2026-07-07)
// 하드코딩 분산을 막기 위해 구성표·제품표·판정 기준을 이 파일 한 곳에 모은다.
// 로직(판정·조합·중복제거)은 health-quote-engine.ts 에 있다.
// (00_decisions/2026-07-07_quotation_health-quote-rules.md)

export type AxisKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";
export type HealthGrade = "양호" | "보통" | "경계" | "불량";
export type TierKey = "premium" | "standard" | "basic";

export const AXIS_NAMES: Record<AxisKey, string> = {
  A: "면역",
  B: "순환",
  C: "소화",
  D: "장관",
  E: "뇌신경",
  F: "호르몬",
  G: "호흡",
  H: "비뇨",
  I: "골격",
  J: "피부·모발",
};

// 나쁨 순서 (불량 > 경계 > 보통 > 양호). 전체 등급 = 축 중 가장 나쁜 등급.
export const GRADE_SEVERITY: Record<HealthGrade, number> = {
  양호: 0,
  보통: 1,
  경계: 2,
  불량: 3,
};

// 점수 → 등급 기본 구간 (체크 개수 기준).
// 건강체크 그래프의 색 구간(양호/보통/경계/불량)을 OCR이 직접 읽으면 그 값을 우선 사용하고,
// 점수만 읽힌 경우 이 구간으로 폴백한다. 구간 경계값은 클라이언트 그래프 원본 기준
// 확인 후 조정 가능하도록 상수로 분리해 둔다. (기획 문서의 예시 스케일: 축별 체크 0~10개)
export const DEFAULT_GRADE_BANDS = {
  /** 이 점수 이하면 양호 */
  goodMax: 2,
  /** 이 점수 이하면 보통 */
  normalMax: 4,
  /** 이 점수 이하면 경계, 초과는 불량 */
  cautionMax: 6,
} as const;

// ── 기본 구성 블록 (스펙 4·5장) ─────────────────────────────
// 제품명은 admin_products의 실제 제품명 기준으로 표기한다 (별칭 해석은 resolveProduct가 담당).
export type CompositionBlockKey =
  | "기본영양제"
  | "메가영양제"
  | "베이직기본"
  | "리셋1주"
  | "리셋2주";

export interface CompositionItem {
  product_name: string;
  quantity: number;
}

export interface CompositionBlock {
  key: CompositionBlockKey;
  /** 카드에 표시할 블록 이름 */
  label: string;
  items: CompositionItem[];
  /** 리셋 블록의 주 수 (뉴트리밀 수량 계산용). 리셋이 아니면 0 */
  resetWeeks: 0 | 1 | 2;
}

export const COMPOSITION_BLOCKS: Record<CompositionBlockKey, CompositionBlock> = {
  기본영양제: {
    key: "기본영양제",
    label: "기본영양제 4주",
    resetWeeks: 0,
    items: [
      { product_name: "헬스팩", quantity: 1 },
      { product_name: "바이오메가", quantity: 1 },
      { product_name: "코퀴논30", quantity: 1 },
      { product_name: "프로후라바놀C300", quantity: 1 },
    ],
  },
  메가영양제: {
    key: "메가영양제",
    label: "메가영양제 4주",
    resetWeeks: 0,
    items: [
      { product_name: "헬스팩", quantity: 1 },
      { product_name: "바이오메가", quantity: 2 },
      { product_name: "코퀴논30", quantity: 2 },
      { product_name: "프로후라바놀C300", quantity: 2 },
    ],
  },
  베이직기본: {
    key: "베이직기본",
    label: "헬스팩 + 바이오메가",
    resetWeeks: 0,
    items: [
      { product_name: "헬스팩", quantity: 1 },
      { product_name: "바이오메가", quantity: 1 },
    ],
  },
  리셋1주: {
    key: "리셋1주",
    label: "리셋해독 1주",
    resetWeeks: 1,
    items: [
      { product_name: "헬스팩", quantity: 1 },
      { product_name: "바이오메가", quantity: 1 },
      { product_name: "코퀴논30", quantity: 1 },
      { product_name: "헤파실 플러스", quantity: 1 },
      { product_name: "알로엔즈 플러스", quantity: 1 },
      { product_name: "프로후라바놀C300", quantity: 1 },
      { product_name: "프로바이오틱", quantity: 1 },
      { product_name: "화이버지 플러스", quantity: 1 },
      // 뉴트리밀(일반 3 또는 액티브 2)은 선택 영역이라 items가 아니라 NUTRIMEAL_OPTIONS로 처리
    ],
  },
  리셋2주: {
    key: "리셋2주",
    label: "리셋해독 2주",
    resetWeeks: 2,
    items: [
      { product_name: "헬스팩", quantity: 1 },
      { product_name: "바이오메가", quantity: 2 },
      { product_name: "코퀴논30", quantity: 2 },
      { product_name: "헤파실 플러스", quantity: 2 },
      { product_name: "알로엔즈 플러스", quantity: 2 },
      { product_name: "프로후라바놀C300", quantity: 2 },
      { product_name: "프로바이오틱", quantity: 2 },
      { product_name: "화이버지 플러스", quantity: 2 },
    ],
  },
};

// 뉴트리밀 선택 (스펙 5·11장) — 리셋 주 수(resetWeeks)에 비례해 수량이 정해진다.
export interface NutrimealOptionRule {
  key: "일반" | "액티브" | "액티브개별포장";
  label: string;
  /** admin_products 제품명 */
  product_name: string;
  /** 리셋 1주당 수량 */
  unitsPerWeek: number;
  flavors: string[];
}

export const NUTRIMEAL_OPTIONS: NutrimealOptionRule[] = [
  {
    key: "일반",
    label: "뉴트리밀 일반",
    product_name: "뉴트리밀 일반",
    unitsPerWeek: 3,
    flavors: ["바닐라", "초코", "딸기", "카푸치노"],
  },
  {
    key: "액티브",
    label: "뉴트리밀 액티브",
    product_name: "뉴트리밀 액티브",
    unitsPerWeek: 2,
    flavors: ["소이바닐라", "소이초코", "웨이초코"],
  },
  {
    key: "액티브개별포장",
    label: "뉴트리밀 액티브 개별포장",
    product_name: "뉴트리밀 액티브 개별포장",
    unitsPerWeek: 2,
    flavors: ["소이바닐라", "소이초코"],
  },
];

// 추가 선택 (스펙 11장) — 10% 할인·적립 제외, 포인트 없음. 제품 DB에 단가가 없으면 정직하게 미표기.
export const OPTIONAL_EXTRAS = ["쉐이커", "지퍼백"] as const;

// ── 건강등급별 견적 카드 구성표 (스펙 3장) ─────────────────────
export const TIER_COMPOSITION_TABLE: Record<
  HealthGrade,
  Record<TierKey, CompositionBlockKey[]>
> = {
  양호: {
    premium: ["리셋1주", "기본영양제"],
    standard: ["기본영양제"],
    basic: ["베이직기본"],
  },
  보통: {
    premium: ["리셋1주", "메가영양제"],
    standard: ["메가영양제"],
    basic: ["베이직기본"],
  },
  경계: {
    premium: ["리셋2주", "메가영양제"],
    standard: ["리셋1주", "메가영양제"],
    basic: ["메가영양제"],
  },
  불량: {
    premium: ["리셋2주", "메가영양제"],
    standard: ["리셋2주", "기본영양제"],
    basic: ["리셋1주", "메가영양제"],
  },
};

// ── 건강축별 추천 제품 (스펙 6장) ──────────────────────────────
// 순서 = 기준안 순서 (공통 제품 동률일 때 앞선 제품 우선).
// 일부 제품(브레인PS, 팔메토, 마린콜라겐 등)은 현재 제품 DB에 없어 단가 미확인으로 표기될 수 있다.
export const AXIS_PRODUCTS: Record<AxisKey, string[]> = {
  A: ["프로후라바놀C300", "부스터 C600", "프로바이오틱", "알로엔즈 플러스", "프로글루카뮨", "폴리C"],
  B: ["바이오메가", "코퀴논30", "프로후라바놀C300", "서큘레이트 플러스", "폴리C"],
  C: ["알로엔즈 플러스", "유기농 곡물 효소", "프로바이오틱", "헤파실 플러스", "폴리C", "메타볼리즘"],
  D: ["프로바이오틱", "화이버지 플러스", "FOS 에포오엑스 액티브", "유기농 곡물 효소", "허브 티 믹스(페퍼민트)", "뉴트리밀 일반"],
  E: ["바이오메가", "마그네칼D", "브레인PS", "E-프라임", "프로후라바놀C300"],
  F: ["이소플라본 플러스", "마그네칼D", "E-프라임", "코어 아미노 드링크", "팔메토", "뉴트리밀 일반"],
  G: ["프로후라바놀C300", "프로글루카뮨", "허브 티 믹스(페퍼민트)", "부스터 C600"],
  H: ["프로후라바놀C300", "프로바이오틱", "프로글루카뮨", "팔메토"],
  I: ["마그네칼D", "글루코사민", "비타민D", "코어 아미노 드링크", "뉴트리밀 일반"],
  J: ["알로엔즈 플러스", "뉴트리밀 일반", "코어 아미노 드링크", "폴리C", "글루코사민", "마린콜라겐", "셀라비브 화장품"],
};

// 상담 목적에 따라 참고하는 보조 축 (스펙 2·6장) — A~J 판정에는 쓰지 않고 상담 참고용.
export const EXTRA_AXIS_PRODUCTS: Record<string, string[]> = {
  눈: ["비전엑스 디에스", "바이오메가", "프로후라바놀C300", "헤파실 플러스", "E-프라임"],
  "활력 증가": ["피지 에너지 드링크", "서큘레이트 플러스"],
  "운동 전후/부기 제거": [
    "액티브 미네랄 드링크 믹스 (수박맛)",
    "부스터 C600",
    "허브 티 믹스(페퍼민트)",
    "화이버지 플러스",
    "FOS 에포오엑스 액티브",
    "코어 아미노 드링크",
    "메타볼리즘",
  ],
};

// ── 건강축별 추가 제품 적용 로직 상수 (스펙 7장) ──────────────
// 양호 = 추가 없음, 보통 = 참고만(추가 없음), 경계 = 1개, 불량 = 2개
export const AXIS_ADD_QUANTITY: Record<HealthGrade, number> = {
  양호: 0,
  보통: 0,
  경계: 1,
  불량: 2,
};

// 오토십 할인율 (스펙 11장 — 쉐이커/지퍼백/셀라비브 화장품은 할인·적립 제외)
export const AUTOSHIP_DISCOUNT_RATE = 0.1;
export const DISCOUNT_EXCLUDED_KEYWORDS = ["쉐이커", "지퍼백", "셀라비브"];
