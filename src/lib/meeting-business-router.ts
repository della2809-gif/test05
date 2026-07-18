export type MeetingBusinessIntent =
  | "dream_goal"
  | "network_experienced"
  | "beginner_learning"
  | "family_concern"
  | "compensation_explain"
  | "study_material"
  | "general_meeting";

export interface MeetingBusinessRoute {
  intent: MeetingBusinessIntent;
  dbSources: string[];
  prompt: string;
}

const ROUTES: Record<MeetingBusinessIntent, Omit<MeetingBusinessRoute, "intent">> = {
  dream_goal: {
    dbSources: ["templates", "blocks", "links"],
    prompt: "파트너와 꿈·목표를 정하는 요청입니다. 목표를 강요하지 말고 원하는 삶, 이유, 기간, 이번 주 첫 행동 순서로 질문하세요. 첫 미팅에서 바로 쓸 첫 질문과 기록 항목을 제시하세요.",
  },
  network_experienced: {
    dbSources: ["templates", "blocks", "links"],
    prompt: "네트워크 경험자와의 첫 대화입니다. 기존 경험과 방식을 먼저 인정하고, 과거 회사 비판이나 즉시 전환 권유 없이 현재 원하는 변화와 비교 기준을 묻는 첫 문장을 제시하세요.",
  },
  beginner_learning: {
    dbSources: ["templates", "youtube", "links", "blocks"],
    prompt: "초기 사업자 학습 순서 요청입니다. 한꺼번에 많은 자료를 주지 말고 오늘-이번 주-다음 단계 순서로 최대 3개 학습 항목과 바로 할 행동을 제시하세요.",
  },
  family_concern: {
    dbSources: ["blocks", "templates", "links"],
    prompt: "가족의 걱정이나 반론에 답하는 요청입니다. 설득·압박보다 걱정의 구체적 이유를 먼저 확인하고, 공감 문장-사실 확인-선택권 존중 순서로 복사해 보낼 짧은 문구를 제시하세요.",
  },
  compensation_explain: {
    dbSources: ["templates", "blocks", "links"],
    prompt: "보상플랜을 쉽게 설명하는 요청입니다. 확정 수익처럼 말하지 말고 구조, 발생 조건, 개인별 차이, 확인할 공식 자료 순서로 1분 설명문을 제시하세요. 실제 계산 요청은 견적·점수·목표 기능으로 안내하세요.",
  },
  study_material: {
    dbSources: ["youtube", "links", "templates", "blocks"],
    prompt: "학습자료 추천 요청입니다. 현재 단계와 배우려는 주제가 없으면 그 두 가지만 물어보고, 확인된 DB 자료를 최대 3개만 순서와 활용 목적까지 제시하세요.",
  },
  general_meeting: {
    dbSources: ["templates", "blocks", "youtube", "links"],
    prompt: "대상, 현재 상황, 이번 대화에서 원하는 결과를 먼저 파악하세요. 추가 질문은 한 번에 하나만 하고, 지금 말할 첫 문장과 다음 행동을 짧게 제시하세요.",
  },
};

export function resolveMeetingBusinessRoute(query: string): MeetingBusinessRoute {
  const normalized = query.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
  let intent: MeetingBusinessIntent = "general_meeting";
  if (/(꿈|목표).*(설정|정하|잡|미팅)|(파트너).*(꿈|목표)/.test(normalized)) intent = "dream_goal";
  else if (/(네트워크|타사|다른 회사).*(하고|경험|사람)|경험자/.test(normalized)) intent = "network_experienced";
  else if (/(초기|신규|처음).*(사업|파트너).*(공부|학습|뭐부터)|뭐부터.*(공부|배워)/.test(normalized)) intent = "beginner_learning";
  else if (/(엄마|아빠|부모|남편|아내|가족).*(걱정|반대|의심)|뭐라고.*(말|답)/.test(normalized)) intent = "family_concern";
  else if (/보상\s*플랜.*(설명|간단|쉽게)|수당.*설명/.test(normalized)) intent = "compensation_explain";
  else if (/(공부|학습).*(자료|영상|뭐가|할 수)|자료.*공부/.test(normalized)) intent = "study_material";
  return { intent, ...ROUTES[intent] };
}
