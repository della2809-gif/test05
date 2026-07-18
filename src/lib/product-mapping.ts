// 제품명 → DB name 정규화 (동의어 매핑)
export const PRODUCT_ALIASES: Record<string, string> = {
  "헬스팩": "헬스팩",
  "바이오메가": "바이오메가",
  "오메가3": "바이오메가",
  "프로후라바놀": "프로후라바놀C300",
  "C300": "프로후라바놀C300",
  "코큐텐": "셀센셜즈(비타에이오,코어미네랄)",
  "헤파실": "헤파실 플러스",
  "알로엔즈": "알로엔즈 플러스",
  "화이버지": "화이버지 플러스",
  "프로바이오틱": "프로바이오틱",
  "이소플라본": "마그네칼D",    // 이소플라본 없으면 호르몬 대용
  "마그네칼D": "마그네칼D",
  "비타민D": "비타민D",
  "글루코사민": "프로코사 글루코사민",
  "프로코사": "프로코사 글루코사민",
  "써큘레이트": "써큘레이트 플러스",
  "프로글루카뮨": "프로글루카뮨",
  "메타볼리즘": "메타볼리즘 플러스",
  "뉴트리밀": "뉴트리밀 더치초콜릿맛",  // 기본값, 실제는 맛 선택
  "화이버": "화이버지 플러스",
  "에프오에스": "에프오에스 액티브",
};

// 자연어 키워드 → 영역 매핑
export const SYMPTOM_AREA_MAP: Record<string, string> = {
  // 면역
  "감기": "A", "알레르기": "A", "피로": "A", "면역": "A",
  // 순환
  "혈액순환": "B", "손발저림": "B", "부종": "B", "붓기": "B", "순환": "B",
  // 소화
  "위장": "C", "소화": "C", "속쓰림": "C", "역류": "C",
  // 장관
  "변비": "D", "설사": "D", "장": "D", "복부팽만": "D",
  // 뇌신경
  "집중력": "E", "기억력": "E", "수면": "E", "불면": "E", "두통": "E",
  // 호르몬
  "생리": "F", "갱년기": "F", "호르몬": "F", "생리불순": "F", "폐경": "F",
  // 호흡
  "비염": "G", "기관지": "G", "호흡": "G", "기침": "G",
  // 비뇨
  "신장": "H", "방광": "H", "빈뇨": "H",
  // 골격
  "관절": "I", "무릎": "I", "허리": "I", "골격": "I", "뼈": "I",
  // 피부모발
  "피부": "J", "탈모": "J", "모발": "J", "건조": "J", "여드름": "J",
};

export function resolveProductName(alias: string): string {
  return PRODUCT_ALIASES[alias] ?? alias;
}

export function detectAreasFromText(text: string): string[] {
  const areas = new Set<string>();
  for (const [keyword, area] of Object.entries(SYMPTOM_AREA_MAP)) {
    if (text.includes(keyword)) areas.add(area);
  }
  return Array.from(areas);
}
