import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationResult } from "./quotation-engine";
import { COMMISSION_TRAVEL_DISCLAIMER } from "./constants";
import { searchDocuments, searchDocumentsBySource, searchReferenceDocuments } from "./rag";

interface GenerateAIResponseParams {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  mode?: "self" | "guide";
  gipletType?: string;
  systemPromptOverride?: string;
  dbSourcesOverride?: string[];
  // 자유채팅(general)에서만 켠다. DB 검색 근거가 0건일 때 이전 답변 재출력(문맥 고착)을 막는
  // 지시를 주입할지 여부. 케이스엔진·아카이브 재정리 등 다른 공유 호출은 켜지 않는다. (A1)
  emptySearchFallback?: boolean;
  // 공통 지시 프로필. "staff"(기본)는 직원 상담 보조 4단 포맷, "coaching"은 커스텀 대화형 지플릿용으로
  // 4단 포맷을 빼고 질문형 코칭 규칙을 주입한다. 라우트가 admin_giplets(capability·case_key 없음)를
  // 보고 결정해 전달한다. (클라이언트 7/4 피드백: 코칭 지플릿이 질문을 깊게 못 잇고 정리 모드로 전환)
  promptProfile?: "staff" | "coaching";
}

const MODE_CONTEXT: Record<string, string> = {
  self: "사용자가 입력한 내용은 본인의 개인 기록입니다. 외부 평가나 조언 없이, 사용자 자신의 관점에서 내용을 구조화하는 데만 집중하세요. 입력에 없는 내용을 추가하거나 해석을 확장하지 마세요.",
  guide:
    "사용자가 입력한 내용은 코칭 또는 상담 현장 기록입니다. 담당자(코치/멘토/상담사)가 대화 후 기록을 남기는 관점에서 정리하세요. 주요 이슈, 합의 사항, 다음 액션을 반드시 구분하여 포함하세요.",
};

// 고객(상담 대상) 성향 → '고객 발송 문구'의 톤 정의. 성향의 주체는 직원이 아니라 고객이다.
// 3종 톤은 회의 확정본을 재사용하되 대상을 "고객에게 보낼 문구"로 명시한다.
// (2026-07-03 고객성향 반영: 논리적=기준·근거 중심 / 감성적=공감 포함·과장 금지 / 실용적=행동·체크리스트)
const CUSTOMER_PERSONALITY_CONTEXT: Record<string, string> = {
  logical:
    "논리적 고객 → 발송 문구는 기준·근거·순서를 명확히 하고, 감정 표현보다 사실과 우선순위 중심으로 담백하게 작성",
  emotional:
    "감성적 고객 → 발송 문구는 마음·동기·기대에 공감을 담아 따뜻하게 작성하되, 막연한 위로나 과장된 표현은 금지",
  practical:
    "실용적 고객 → 발송 문구는 바로 실행할 수 있는 행동·문장·체크리스트·다음 단계 중심으로 간결하게 작성",
};

// 고객 성향 한글 라벨 (회원 컨텍스트 주입·되묻기 문구 공용)
const CUSTOMER_PERSONALITY_LABEL: Record<string, string> = {
  logical: "논리적",
  emotional: "감성적",
  practical: "실용적",
};

// 항상 주입되는 고객 성향 활용 규칙(직원 보조 경로). 성향의 주체는 '고객'이며 발송 문구 톤에만 적용한다.
// 모를 때는 기본 톤으로 1차 출력하고 '추가 확인 질문'에서 성향을 되묻는다(1차출력+되묻기 병행). (2026-07-03 고객성향 반영)
const CUSTOMER_PERSONALITY_PROMPT =
  "고객 성향 반영 규칙: 고객 대상 안내/발송 문구('3) 고객 발송 문구' 등)를 작성할 때 다음 순서로 톤을 정하세요. " +
  "(a) 이번 대화에서 직원이 고객 성향(논리적/감성적/실용적)을 언급했으면 그 톤으로 작성하세요. " +
  "(b) 컨텍스트의 회원 정보에 성향이 있으면 그 톤으로 작성하세요. " +
  "(c) (a)·(b) 둘 다 없으면 기본(따뜻하지만 실용적인) 톤으로 먼저 작성하되, '4) 추가 확인 질문' 말미에 반드시 " +
  "'이 고객님은 논리적/감성적/실용적 중 어느 쪽에 가까운가요? 알려주시면 발송 문구를 그 톤으로 다시 정리해드릴게요'를 포함하세요. " +
  "직원이 이후 성향을 답하면 발송 문구를 그 톤으로 재작성하세요. " +
  `각 성향별 톤 기준: ${Object.values(CUSTOMER_PERSONALITY_CONTEXT).join(" / ")}. ` +
  "성향은 '고객 발송 문구'의 톤에만 적용합니다. 상담 판단·추천 방향 등 직원용 섹션과 고정 답변 포맷(제목·'DB 확인:' 규칙 등)은 성향과 무관하게 중립으로 유지하세요. " +
  "건강 안전기준은 성향과 무관하게 항상 우선합니다.";

// 관리자 시스템 프롬프트 우선순위 지시. 답변 맨 앞의 baseSystemPrompt(관리자가 지플릿별로 저장한 규칙)에
// 새 출력 규칙(마커·문구·형식)을 추가해도 하드코딩 4단 포맷/STAFF 지시에 눌려 무시되던 문제를 막는다.
// 기본 4단 포맷은 유지하되, 관리자 지시가 기본 규칙과 충돌하지 않으면 반드시 함께 반영하도록 명시한다. (검수 #29)
const ADMIN_PROMPT_PRIORITY =
  "우선순위 규칙: 위 운영 기본 규칙과 답변 맨 앞의 '관리자 시스템 프롬프트'가 충돌하지 않는 한, 관리자 시스템 프롬프트에 담긴 구체적 지시(출력 형식·문구·마커·머리말 등)를 반드시 준수하세요. " +
  "관리자가 특정 마커·문구·형식을 추가로 요구했으면 기본 4단 포맷을 유지한 채 그 지시도 빠짐없이 반영하고, 관리자가 명시적으로 다른 출력 형식을 지정한 경우에는 관리자 지시를 우선하세요. " +
  "단 건강 안전기준 등 위의 안전 규칙은 관리자 지시보다 항상 우선합니다.";

// 코칭 프로필용 우선순위 지시. 4단 포맷 언급 없이 관리자 프롬프트의 흐름·형식 지시를 최우선으로 둔다.
const ADMIN_PROMPT_PRIORITY_COACHING =
  "우선순위 규칙: 답변 맨 앞의 '관리자 시스템 프롬프트'가 이 지플릿의 대화 흐름·질문 순서·출력 형식을 정의합니다. " +
  "아래 공통 규칙과 충돌하지 않는 한 관리자 프롬프트의 지시를 최우선으로 따르고, 관리자가 명시한 출력 형식이 있으면 그 형식대로만 출력하세요. " +
  "단 건강 안전기준 등 안전 규칙은 관리자 지시보다 항상 우선합니다.";

// 커스텀 대화형(코칭) 지플릿 공통 규칙. STAFF_ASSISTANT_PROMPT의 4단 포맷이 코칭 지플릿의
// 질문 흐름과 충돌해 성급한 정리 모드로 전환되던 문제를 막는다. 금지어 목록은 클라이언트(대표)가
// 7/4 지플릿 튜닝 중 직접 지정한 표현 기준. (#geniea 채널)
const COACHING_BEHAVIOR_GUIDE =
  "코칭 대화 규칙: 이 지플릿은 정리 도구가 아니라 사용자의 생각을 끌어내는 코칭 대화입니다. " +
  "질문은 한 번에 1~2개만 하세요. 질문 3개 이상을 번호로 나열하지 마세요. 대신 사용자의 답을 받아 여러 턴에 걸쳐 깊게 이어가세요. " +
  "사용자가 실행 계획이나 짧은 정보만 던져도 곧바로 정리하지 말고, 그 배경·이유(WHY)·구체 상황을 먼저 되물어 대화를 깊게 만드세요. 이미 답한 내용을 다시 묻는 중복 질문은 금지입니다. " +
  "정리·요약·마무리 출력은 사용자가 요청했거나 관리자 프롬프트가 정한 단계에 도달했을 때만 하세요. 충분한 대화 없이 성급하게 결론·요약으로 건너뛰는 것은 오답입니다. " +
  "'접근', '컨택', '공략', '타깃', '설득', '유도', '영업 대상', '고객 확보' 같은 표현은 쓰지 마세요. 대신 '알려주다', '보여주다', '나누다', '안부를 묻다', '경험을 들려주다'처럼 상대를 존중하는 표현을 쓰세요. " +
  "위의 기록 구조화 지침(모드 규칙)과 이 규칙이 충돌하면, 대화 진행 중에는 이 코칭 규칙과 관리자 프롬프트의 흐름을 우선하세요.";

// 수당 계산(commission)·여행 달성(travel) 지플릿 필수 안전문구. 대표(클라이언트)가 직접 지정한 문구로,
// 계산 결과 유무와 무관하게 해당 지플릿 응답 맨 마지막에 항상 출력한다. (검수 #32/#33)
// 계산이 카드(__COMMISSION__/__TRAVEL__)로 나가는 경로는 각 카드 컴포넌트가 별도로 같은 문구를 렌더한다.
const COMMISSION_TRAVEL_SAFETY_GUIDE =
  `필수 안전문구(수당·여행): 이 지플릿 응답에서는 계산 결과가 있든 없든 답변의 맨 마지막 줄에 항상 다음 문구를 그대로 출력하세요 — "${COMMISSION_TRAVEL_DISCLAIMER}"`;

// C-2/C-3: 이미지·링크 URL 창작 금지 가드. 깨진 placeholder/example.com 링크는 DB가 아니라
// LLM이 URL을 지어내거나 재타이핑 중 변형해서 생김(2026-07-07 진단: admin_blocks·admin_images 전수
// 점검 결과 DB에는 placeholder 0건, image_url 344건 전부 정상). 모든 프로필에 공통 주입한다.
const IMAGE_URL_GUARD =
  "이미지·링크 URL 절대 규칙: 응답에 넣는 모든 이미지 URL과 링크 URL은 이 프롬프트의 검색 결과(참고 데이터)에 적힌 URL을 한 글자도 바꾸지 말고 그대로 복사해서만 사용하세요. " +
  "URL을 새로 생성하거나, 기억·추측으로 재구성하거나, 일부(파일명·경로·도메인·확장자)를 변형하는 것은 절대 금지입니다. example.com, via.placeholder.com 같은 예시·placeholder 주소는 어떤 경우에도 쓰지 마세요. " +
  "검색 결과에 이미지 URL이 없으면 [IMAGE:] 마커를 쓰거나 이미지를 보여주겠다고 말하지 말고, 이미지 언급 자체를 하지 마세요.";

// C-5(승인됨): 자료 조회성 질문에는 4단 상담 포맷을 생략하고 검색된 자료를 바로 출력한다.
// 상담성 질문은 기존 STAFF_ASSISTANT_PROMPT(4단)를 유지한다. (클라이언트 7/6: "원고 보여줘에도
// 1)2)3)4)가 나오는 건 이상함" → 나연님 승인으로 자료 조회 분기 추가)
const STAFF_DATA_LOOKUP_PROMPT =
  "핵심 역할: 당신은 내부 직원용 상담 보조 도구이며, 이번 사용자 입력은 상담 판단 요청이 아니라 자료(원고·스크립트·사례·이미지·링크·영상 등) 조회 요청입니다. " +
  "'1) 상담 판단', '2) 추천 방향', '3) 고객 발송 문구', '4) 추가 확인 질문' 4단 형식을 사용하지 마세요. " +
  "대신 첫 줄에 'DB 확인: 찾은 자료명'(검색 결과가 없으면 'DB 확인: 관련 항목 없음')을 짧게 쓰고, 바로 아래에 검색된 자료 본문·이미지·링크를 그대로 출력하세요. " +
  "자료는 요약하지 말고 검색 결과에 있는 내용을 우선 그대로 보여주세요. 결과가 여러 건이면 번호 목록으로 정리해 사용자가 선택할 수 있게 하세요. " +
  "DB 검색 결과에 있는 것만 제시하고, DB에 없는 자료·URL·내용을 임의로 만들지 마세요.";

// 자료 조회 분기용 우선순위 지시(4단 포맷 문구 없이 관리자 프롬프트 준수만 유지)
const ADMIN_PROMPT_PRIORITY_LOOKUP =
  "우선순위 규칙: 답변 맨 앞의 '관리자 시스템 프롬프트'에 담긴 구체적 지시(출력 형식·문구·마커 등)는 자료 출력과 충돌하지 않는 한 반드시 준수하세요. " +
  "단 건강 안전기준 등 안전 규칙은 관리자 지시보다 항상 우선합니다.";

const STAFF_ASSISTANT_PROMPT =
  "핵심 역할: 당신은 고객이 직접 쓰는 챗봇이 아니라, 내부 직원 약 40명이 고객 상담 중 GPT 대신 사용하는 상담 보조 도구입니다. " +
  "사용자의 입력은 대체로 직원이 고객 상황을 요약해 던지는 상담 요청입니다. 고객에게 직접 말하는 척만 하지 말고, 직원이 바로 판단하고 복붙할 수 있게 도와주세요. " +
  "제품·패키지·가격·링크·스크립트·FAQ가 필요한 질문은 먼저 DB 근거를 확인하고, DB에 있는 것만 확정적으로 말하세요. DB에 없거나 불명확하면 보류/확인필요로 표시하세요. " +
  "DB에서 관련 제품/패키지가 주입된 경우 답변의 상담 판단 첫 줄에 'DB 확인: 제품/패키지명'을 반드시 명시하세요. 관련 패키지가 있으면 패키지명을 먼저 말한 뒤 구성과 가격을 설명하세요. " +
  "반드시 다음 제목을 그대로 사용해 답하세요: '1) 상담 판단', '2) 추천 방향', '3) 고객 발송 문구', '4) 추가 확인 질문'. '1) 상담 판단'의 첫 줄은 항상 'DB 확인: ...'으로 시작하세요. 관련 DB가 없으면 'DB 확인: 관련 항목 없음'이라고 쓰세요. " +
  "기본 출력 구조는 짧게: 1) 상담 판단 2) 추천 방향 3) 고객 발송 문구 4) 추가 확인 질문. " +
  "단순 제품 정보만 묻는 경우에도 직원용으로 'DB 확인 결과'와 '고객에게 이렇게 안내'를 구분하세요. " +
  "회원/고객 등록, 일정 등록, 견적·수당·여행 계산 같은 GENIEA 내장 기능을 요청받으면 '직접 할 수 없다'거나 멘토·스폰서에게 문의하라고 미루지 마세요. " +
  "회원 등록은 GENIEA가 지원하는 기능입니다. 직원이 회원(고객)을 등록하려 하면(예: '새 회원 등록할게, 이름·연락처 ...'), 거절하지 말고 '회원 관리' 지플릿이나 회원 관리 화면에서 이름·연락처로 바로 등록할 수 있다고 안내하고, 부족한 정보(이름·연락처 등)를 확인해 등록을 도우세요. " +
  "압박·설득·공략·먹이기·시작시키기 같은 표현은 고객의 선택을 넓히는 표현으로 바꿔 안내하세요. " +
  "고객 발송 문구에서는 '효과', '개선', '도움이 됩니다', '좋아집니다', '먹게 하다' 같은 보장·압박 표현을 피하고, '선택지', '확인해볼 수 있습니다', '일반 건강관리 차원'처럼 완화하세요. " +
  "답변은 현장 직원이 빠르게 읽도록 간결하게 작성하고, 고객 발송 문구는 그대로 복사할 수 있게 따옴표 블록으로 제공하세요.";

// 지니아 공통 말투·정체성 가이드 (CR-031 긍정·존중 언어 / CR-033 '선택지를 넓혀주는 메이트' 정체성)
const TONE_GUIDE =
  "말투 원칙: 당신은 상대를 압박하는 도구가 아니라 '선택지를 넓혀주는 메이트'입니다. " +
  "사람(고객·팀원)을 대상화하거나 깎아내리지 말고 존중하며 세워주세요. " +
  "'접근·공략·설득·대상·타겟' 같은 대상화·압박 표현 대신 '안내·함께·공감·세워주기·선택을 넓혀주기' 같은 표현을 쓰세요. " +
  "비교·평가·재촉·강요하지 말고, 단정 대신 선택지를 제시하세요. " +
  "상대가 망설이면 1·2·3 우선순위로 최선·차선의 장단점을 알려주고 스스로 고르도록 도우세요. " +
  "모르는 것과 알면서 선택하지 않는 것은 다르며, 당신의 역할은 알려주고 선택을 넓혀주는 것입니다.";

// 빈 검색 폴백. 이번 질문에 대한 DB 검색 근거가 하나도 없을 때, 모델이 대화 히스토리에 남은
// 이전 답변(특히 '처음 사업설명' 같은 스크립트 답변)을 그대로 재출력하는 문맥 고착을 막는다. (A1)
const EMPTY_SEARCH_GUIDE =
  "중요(DB 근거 없음): 이번 질문에 대한 DB 검색 결과가 하나도 없습니다. " +
  "이럴 때 이전 대화에서 했던 답변, 특히 사업설명·스크립트 성격의 답변을 그대로 반복하거나 재출력하지 마세요. 직전 답변을 다시 붙여넣는 것은 오답입니다. " +
  "답변은 반드시 'DB 확인: 관련 항목 없음'으로 시작하세요. " +
  "그 뒤 일반 상식으로 답할 수 있는 질문이면 'DB에 없어 일반적인 지식으로 안내드립니다'라고 밝힌 뒤 답하세요. " +
  "일반 상식으로도 불확실하면 임의로 지어내지 말고, 어떤 자료(제품·패키지·스크립트·FAQ 등)가 있으면 정확히 답할 수 있는지 확인 질문을 하세요.";

// 검색 정확도를 떨어뜨리는 요청·매체·초생성 단어. ilike 검색어로 들어가면 무관한 행을 대거 잡는다.
// (CR-008: "알려줘/추천/자료" 등이 검색어로 쓰여 엉뚱한 결과·못 찾음을 유발)
const SEARCH_STOPWORDS = [
  "알려줘", "보여줘", "찾아줘", "추천", "추천해", "추천해줘", "해줘", "주세요", "부탁",
  "관련", "자료", "정보", "내용", "어떤", "무슨", "대한", "에서", "그리고", "좀",
  "영상", "강의", "유튜브", "링크", "모음", "설명", "정리", "제품", "유사나",
];

// 2자 미만이라 일반 필터에선 탈락하지만 건강 상담에서 핵심 주제어인 1글자 키워드.
// "약 복용 중인데…"의 "약"이 대표 사례로, 이게 빠지면 검색어가 통째로 사라진다. (W1-C 원인 A)
const HEALTH_KEYWORDS_1CHAR = ["약", "간", "장", "눈", "뼈", "피"];

// 한국어 조사(을/를/이/가/에서/으로 등). ilike 검색어에 조사가 붙으면 "헬스팩을"이 "헬스팩"을 못 잡는다. (CR-008)
const JOSA_MULTI = ["이랑", "에서", "으로", "에게", "한테", "부터", "까지", "보다", "처럼", "마다", "조차", "마저", "밖에", "이라고", "라고"];
const JOSA_SINGLE = ["랑", "을", "를", "이", "가", "은", "는", "에", "와", "과", "도", "만", "의", "로", "께"];

// 토큰 끝의 조사를 떼어 어간을 반환. 조사가 없으면 null.
// 단일 조사는 "오메가"(끝글자 '가')처럼 멀쩡한 명사가 깨지지 않도록 토큰이 4자 이상일 때만 분리한다.
function stripJosa(token: string): string | null {
  for (const j of JOSA_MULTI) {
    if (token.endsWith(j) && token.length - j.length >= 2) return token.slice(0, -j.length);
  }
  for (const j of JOSA_SINGLE) {
    if (token.endsWith(j) && token.length >= 4) return token.slice(0, -j.length);
  }
  return null;
}

// 조사를 뗀 어간을 '추가'한다(원본 토큰은 유지 → 기존 매칭 손실 없음). (CR-008)
function expandJosa(terms: string[], stopwords: string[]): string[] {
  const out: string[] = [];
  for (const t of terms) {
    if (!out.includes(t)) out.push(t);
    const stem = stripJosa(t);
    if (stem && stem.length >= 2 && !stopwords.includes(stem) && !out.includes(stem)) out.push(stem);
  }
  return out;
}

// 사용자 메시지에서 검색어 추출 (2자 이상 또는 1글자 건강 키워드, 불용어 제외, 최대 maxTerms개) + 조사 어간 추가
function extractSearchTerms(text: string, maxTerms = 4): string[] {
  const base = text
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((t) => (t.length >= 2 || HEALTH_KEYWORDS_1CHAR.includes(t)) && !SEARCH_STOPWORDS.includes(t))
    .slice(0, maxTerms);
  return expandJosa(base, SEARCH_STOPWORDS);
}

// C-1: 인접 토큰 2어절 구(예: "자동차 정기점검", "청소기 비유")를 검색어에 추가한다.
// usage_context/keywords에 여러 단어짜리 고유 표현이 저장된 경우 단일 토큰 ilike로는 놓친다.
function expandPhraseTerms(text: string, terms: string[], maxPhrases = 3): string[] {
  const tokens = text
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !SEARCH_STOPWORDS.includes(t));
  const out = [...terms];
  let added = 0;
  for (let i = 0; i + 1 < tokens.length && added < maxPhrases; i++) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`;
    if (!out.includes(phrase)) {
      out.push(phrase);
      added++;
    }
  }
  return out;
}

// C-6: "원문/전체/그대로 보여줘" 의도 감지 — 요약 없이 등록 원문 전체를 요구하는 질의.
// "전문"은 "전문가/전문성" 오탐을 피하기 위해 뒤 글자를 제한한다.
function wantsFullContent(text: string): boolean {
  if (/원문|원본|통째로|요약\s*하지\s*마/.test(text)) return true;
  if (/전문(?![가의성직화점])/.test(text) && /보여|출력|알려|보내|줘/.test(text)) return true;
  if (/전체|그대로/.test(text) && /보여|출력|보내|알려/.test(text)) return true;
  return false;
}

// C-5: 자료 조회성 질문 감지 — "보여줘/찾아줘/검색해줘" 류 조회 동사, 또는 원문 요청.
// 상담성 질문("~한 고객에게 어떻게 안내하죠?")은 이 동사를 거의 쓰지 않아 4단 유지가 안전하다.
// "알려줘"는 상담·정보 질문에 두루 쓰여 오탐이 크므로 자료 명사와 결합될 때만 조회로 본다.
const DATA_LOOKUP_VERB = /(보여\s*줘|보여\s*주|찾아\s*줘|찾아\s*주|검색해|꺼내\s*줘|올려\s*줘|띄워\s*줘|보내\s*줘|공유해\s*줘)/;
const DATA_LOOKUP_NOUN = /(원고|원문|스크립트|사례|자료|이미지|사진|카드|문구|멘트|영상|링크|비유|예시|목록|리스트)/;
function isDataLookupQuery(text: string): boolean {
  if (!text) return false;
  if (wantsFullContent(text)) return true;
  if (DATA_LOOKUP_VERB.test(text)) return true;
  if (DATA_LOOKUP_NOUN.test(text) && /(있어\??|있나요|있을까|알려\s*줘|알려\s*주)/.test(text)) return true;
  return false;
}

// C-4: "3번", "1, 2번", "네" 같은 짧은 선택형 후속 발화 판정.
// 이런 입력은 검색어가 추출되지 않아 로더가 전부 스킵되고, 자유채팅에선 EMPTY_SEARCH_GUIDE가
// 직전 답변 재출력을 금지해 "해당 이미지를 제공할 수 없습니다" 류 거절이 나던 회귀의 직접 원인.
function isSelectionFollowUp(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t || t.length > 12) return false;
  if (/^[\d\s.,~\-번]+$/.test(t)) return /\d/.test(t);
  return /^(네|예|응|넵|네네|좋아요?|그래요?|맞아요?|보여줘|그거요?)[.!~ ]*$/.test(t);
}

// 키워드 포함 여부 확인
function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

// 시스템 프롬프트를 빌드하는 내부 함수 (streaming/non-streaming 공유)
async function buildSystemPrompt(params: GenerateAIResponseParams): Promise<string> {
  const { userId, supabase, mode, gipletType, systemPromptOverride, dbSourcesOverride, emptySearchFallback, promptProfile, messages } = params;
  const resolvedMode = mode ?? "self";

  // general(자유 상담)은 모든 DB를 싣는 catch-all이라 토큰 절약용 키워드 게이트를 유지하지만,
  // db_sources를 좁게 지정한 전용 지플릿(예: 제품 정보 검색)은 관리자가 명시적으로 고른 소스이므로
  // 키워드가 없어도 항상 로드한다. (CR-007: "헬스팩 알려줘"처럼 키워드 없는 질의에 제품/링크가 누락되던 회귀 수정)
  const isCatchAll = (gipletType ?? "general") === "general";

  let baseSystemPrompt: string;
  if (systemPromptOverride !== undefined) {
    baseSystemPrompt = systemPromptOverride;
  } else {
    const { data: systemPromptRow } = await supabase
      .from("admin_system_prompts")
      .select("content")
      .eq("giplet_type", gipletType ?? "general")
      .maybeSingle();
    baseSystemPrompt =
      systemPromptRow?.content ??
      "당신은 사용자의 기록을 정리하는 AI 어시스턴트입니다.";
  }

  let dbSources: string[];
  if (dbSourcesOverride !== undefined) {
    dbSources = dbSourcesOverride;
  } else {
    const { GIPLET_DB_MAP } = await import("@/lib/constants");
    dbSources = GIPLET_DB_MAP[(gipletType ?? "general") as keyof typeof GIPLET_DB_MAP]
      ?? GIPLET_DB_MAP["general"];
  }

  const adminDataParts: string[] = [];
  const loaders: Promise<void>[] = [];
  const wrap = (p: PromiseLike<void>): Promise<void> => Promise.resolve(p);

  // 스마트 로딩을 위한 사용자 마지막 메시지 (모든 로더 공유)
  // 파일/이미지 첨부 시 라우트에서 content를 멀티모달 배열([{type:"text"...},{type:"image_url"...}])로
  // 바꿔 넣으므로, 여기서는 텍스트 파트만 뽑아 문자열로 정규화한다. (배열 그대로면 extractSearchTerms의
  // .replace 호출에서 TypeError가 나 첨부 메시지의 AI 응답이 통째로 생성되지 않던 버그) (#19)
  const rawLastContent = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const userLastMessage: string =
    typeof rawLastContent === "string"
      ? rawLastContent
      : Array.isArray(rawLastContent)
        ? (rawLastContent as Array<{ type?: string; text?: string }>)
            .filter((p) => p?.type === "text" && typeof p.text === "string")
            .map((p) => p.text as string)
            .join("\n")
        : "";
  const searchTerms = extractSearchTerms(userLastMessage, 4);

  // 인텐트 감지 키워드
  const MEETING_KW = ["미팅", "시나리오", "방문", "1차", "2차", "3차", "상담 단계", "상담 순서", "진행 순서"];
  const SCRIPT_KW = ["문구", "멘트", "스크립트", "메시지", "카카오", "뭐라고", "어떻게 말", "초대", "답장", "연락", "보낼", "문자"];
  const PRODUCT_KW = ["제품", "영양제", "비타민", "오메가", "유사나", "복용", "성분", "효능", "가격", "구매", "건강기능", "추천"];
  const STORY_KW = ["성공", "스토리", "사례", "체험", "후기", "경험", "비슷한 사람", "효과 있었"];
  const LINK_KW = ["링크", "자료", "영상", "유튜브", "보내줘", "공유", "참고", "레퍼런스"];

  if (dbSources.includes("templates")) {
    loaders.push(wrap((async () => {
      // 1순위: 사용자 메시지 키워드로 제목·카테고리·본문 검색 (CR-008: 제목만 보던 것을 본문/카테고리까지 확대)
      if (searchTerms.length > 0) {
        const orFilter = searchTerms.flatMap((t) => [`title.ilike.%${t}%`, `category.ilike.%${t}%`, `content.ilike.%${t}%`]).join(",");
        const { data: matched } = await supabase.from("admin_templates")
          .select("title, category, content")
          .or(orFilter)
          .limit(8);
        if (matched && matched.length > 0) {
          adminDataParts.push(`[미팅 시나리오·템플릿]\n규칙: 아래 목록에 있는 시나리오·템플릿만 사용하세요. DB에 없는 내용을 임의로 만들지 마세요.\n${matched.map((t) => `- ${t.title}: ${(t.content ?? "").slice(0, 300)}`).join("\n")}`);
          return;
        }
      }
      // 2순위: 미팅 키워드가 있을 때만 최근 항목 일부 로드
      if (!userLastMessage || hasKeyword(userLastMessage, MEETING_KW)) {
        const { data } = await supabase.from("admin_templates")
          .select("title, category, content")
          .limit(5);
        if (data && data.length > 0)
          adminDataParts.push(`[미팅 시나리오·템플릿]\n규칙: 아래 목록에 있는 시나리오·템플릿만 사용하세요. DB에 없는 내용을 임의로 만들지 마세요.\n${data.map((t) => `- ${t.title}: ${(t.content ?? "").slice(0, 300)}`).join("\n")}`);
      }
    })()));
  }
  if (dbSources.includes("blocks")) {
    loaders.push(wrap((async () => {
      type BlockRow = {
        title: string | null;
        category: string | null;
        content: string | null;
        usage_context?: string | null;
        keywords?: string | null;
        tags?: string | null;
        updated_at?: string | null;
      };
      const BLOCK_RULE = "규칙: 사용자가 스크립트, 문구, 멘트, 대화 예시를 요청하면 반드시 아래 DB에서 가장 관련성 높은 항목을 찾아 원문 구조와 취지를 우선 반영하세요. 단, 건강·질병·섭취·비포애프터·수익·직급·개인정보·이미지 관련 안전 기준에 걸리는 표현은 그대로 반복하지 말고 안전하게 완화하세요. DB에 없는 내용을 임의로 만들지 마세요.";
      // C-6: "원문/전체/그대로" 요청이면 1위 블록은 절단 없이(안전 상한 20,000자) 원문 그대로 전달
      const fullTextMode = wantsFullContent(userLastMessage);
      const fullTextRule = fullTextMode
        ? "\n원문 요청 감지: 사용자가 원문/전체 출력을 요청했습니다. 가장 관련성 높은 항목(1번)의 본문을 요약·생략·재구성 없이 그대로 전부 출력하세요. 답변이 길어져도 전체를 출력하고, 필요하면 나눠서 이어 쓰세요. 안전 기준에 걸리는 문장만 최소한으로 완화하고 나머지는 원문 그대로 유지하세요."
        : "";
      // C-6: 400자 일괄 절단이 "긴 원고가 짧게 요약돼 나오는" 직접 원인 → 상위 1~2건은 2,000자로 상향
      const renderBlocks = (rows: BlockRow[]): string =>
        rows.map((b, i) => {
          const limit = fullTextMode && i === 0 ? 20000 : i < 2 ? 2000 : 400;
          const usage = b.usage_context ? ` (사용상황: ${b.usage_context})` : "";
          return `${i + 1}. [${b.category ?? "기타"}] ${b.title}${usage}: ${(b.content ?? "").slice(0, limit)}`;
        }).join("\n");
      // 1순위: 제목·카테고리·본문 + (C-1) 사용상황·키워드·태그 텍스트 검색
      // 정책: 관련도 우선, 최신성은 동점일 때만 tie-break. 넓은 후보 창(500)을 먼저 받아
      // JS 스코어러가 관련도로 재정렬하므로, 최신 재저장된 교육 배치가 정답 블록을 창(구 60개)
      // 밖으로 밀어내던 절단 문제를 없앤다. (W1-C 원인 C)
      const blockSearchTerms = expandPhraseTerms(userLastMessage, extractSearchTerms(userLastMessage, 8));
      if (blockSearchTerms.length > 0) {
        const buildOr = (cols: string[]) =>
          blockSearchTerms.flatMap((t) => cols.map((c) => `${c}.ilike.%${t}%`)).join(",");
        // 확장 컬럼은 마이그레이션 미적용 환경에선 없을 수 있으므로 실패 시 기존 3컬럼으로 폴백 (C-1)
        let matchedRaw: BlockRow[] | null = null;
        const { data: extData, error: extError } = await (supabase as any).from("admin_blocks")
          .select("title, category, content, usage_context, keywords, tags, updated_at")
          .or(buildOr(["title", "category", "content", "usage_context", "keywords", "tags"]))
          .order("updated_at", { ascending: false })
          .limit(500);
        if (!extError && extData) {
          matchedRaw = extData as BlockRow[];
        } else {
          const { data: legacyData } = await supabase.from("admin_blocks")
            .select("title, category, content, updated_at")
            .or(buildOr(["title", "category", "content"]))
            .order("updated_at", { ascending: false })
            .limit(500);
          matchedRaw = legacyData as BlockRow[] | null;
        }
        if (matchedRaw && matchedRaw.length > 0) {
          const queryText = userLastMessage.trim();
          // 랭킹(C-1): 제목 정확 일치 > 키워드·태그 > 사용상황 > 제목 부분 일치 > 카테고리 > 본문
          const scoreBlock = (b: BlockRow) => {
            const title = b.title ?? "";
            const kwText = `${b.keywords ?? ""} ${b.tags ?? ""}`;
            const usage = b.usage_context ?? "";
            const category = b.category ?? "";
            const content = b.content ?? "";
            let score = 0;
            for (const term of blockSearchTerms) {
              if (title === term) score += 30;
              else if (title.includes(term)) score += 5;
              if (kwText.includes(term)) score += 8;
              if (usage.includes(term)) score += 6;
              if (category.includes(term)) score += 2;
              if (content.includes(term)) score += 1;
            }
            if (queryText && title === queryText) score += 30;
            return score;
          };
          const matched = [...matchedRaw]
            .sort((a, b) => {
              const diff = scoreBlock(b) - scoreBlock(a);
              if (diff !== 0) return diff; // 관련도 우선
              return (b.updated_at ?? "").localeCompare(a.updated_at ?? ""); // 동점이면 최신순
            })
            .slice(0, fullTextMode ? 5 : 12);
          adminDataParts.push(`[스크립트 DB — 카카오톡 문구·상담 멘트·고객 응대 스크립트]\n${BLOCK_RULE}${fullTextRule}\n${renderBlocks(matched)}`);
          return;
        }
      }
      // 2순위: 스크립트 키워드 있을 때만 최근 항목 일부 로드
      if (!userLastMessage || hasKeyword(userLastMessage, SCRIPT_KW)) {
        const { data } = await supabase.from("admin_blocks")
          .select("title, category, content")
          .order("updated_at", { ascending: false })
          .limit(8);
        if (data && data.length > 0)
          adminDataParts.push(`[스크립트 DB — 카카오톡 문구·상담 멘트·고객 응대 스크립트]\n${BLOCK_RULE}${fullTextRule}\n${renderBlocks(data as BlockRow[])}`);
      }
    })()));
  }
  if (dbSources.includes("calculations")) {
    loaders.push(wrap(supabase.from("admin_calculations").select("title, content").then(({ data }) => {
      if (data && data.length > 0)
        adminDataParts.push(`[계산/기본값]\n규칙: 아래 수치·기본값만 사용하세요. DB에 없는 수치를 임의로 만들거나 추측하지 마세요.\n${data.map((c) => `- ${c.title}: ${c.content}`).join("\n")}`);
    })));
  }
  if (dbSources.includes("packages")) {
    loaders.push(wrap((async () => {
      type PackageRow = {
        name: string;
        category: string | null;
        price: number;
        score: number;
        benefit: string | null;
        purpose?: string | null;
        discount_rate: number | null;
        tags?: string[] | string | null;
        components?: unknown;
      };
      const { data } = await (supabase as any).from("admin_packages")
        .select("name, category, price, score, benefit, purpose, discount_rate, tags, components")
        .eq("is_active", true)
        .limit(100);
      if (!data || data.length === 0) return;
      const scorePackage = (p: PackageRow) => {
        const name = p.name ?? "";
        const category = p.category ?? "";
        const benefit = p.benefit ?? "";
        const purpose = p.purpose ?? "";
        const tagsText = Array.isArray(p.tags) ? p.tags.join(" ") : String(p.tags ?? "");
        const componentsText = JSON.stringify(p.components ?? "");
        let matchScore = 0;
        const matchedTerms = new Set<string>();
        for (const term of searchTerms) {
          let termMatched = false;
          if (name.includes(term)) { matchScore += 8; termMatched = true; }
          if (tagsText.includes(term)) { matchScore += 5; termMatched = true; }
          if (category.includes(term)) { matchScore += 3; termMatched = true; }
          if (purpose.includes(term)) { matchScore += 3; termMatched = true; }
          if (benefit.includes(term)) { matchScore += 2; termMatched = true; }
          if (componentsText.includes(term)) { matchScore += 2; termMatched = true; }
          if (termMatched) matchedTerms.add(term);
        }
        return { matchScore, matchedTermCount: matchedTerms.size };
      };
      const allPackages = data as PackageRow[];
      const matched = searchTerms.length > 0
        ? allPackages
          .map((p) => ({ ...p, _match: scorePackage(p) }))
          .filter((p) => p._match.matchScore > 0 && (p._match.matchedTermCount >= 2 || p._match.matchScore >= 12))
          .sort((a, b) => b._match.matchScore - a._match.matchScore || (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 15)
        : allPackages.slice(0, 15);
      const rows = matched.length > 0 ? matched : (searchTerms.length === 0 ? allPackages.slice(0, 15) : []);
      if (rows.length > 0) {
        adminDataParts.push(`[패키지 DB — 리셋·챌린지·상담 패키지 구성]\n규칙: 아래 목록이 질문과 매칭된 패키지 후보입니다 (총 ${rows.length}개). 상담직원용 답변에서는 가장 관련 높은 패키지명을 'DB 확인'에 먼저 명시하고, 구성·가격·주의표현을 함께 안내하세요. 각 패키지의 PV(점수)를 가격과 함께 반드시 표기하고, 견적처럼 여러 항목을 합산할 때는 총 PV 합계도 가격 합계와 함께 표기하세요. DB에 없는 패키지·가격·혜택을 임의로 만들지 마세요. 제품/상황 질의와 관련된 상담 패키지 후보가 있으면 리셋·챌린지 패키지보다 우선 검토하세요.\n${rows.map((p) => `- ${p.name}${p.category ? ` (${p.category})` : ""}: ${p.price.toLocaleString()}원 / ${p.score}PV${p.discount_rate ? ` / 할인 ${p.discount_rate}%` : ""}${p.purpose ? ` / 목적: ${p.purpose}` : ""}${p.benefit ? ` / 혜택: ${(p.benefit).slice(0, 180)}` : ""}`).join("\n")}`);
      }
    })()));
  }
  if (dbSources.includes("products")) {
    loaders.push(wrap((async () => {
      // 1순위: 증상·키워드·제품명·별칭 정밀검색.
      // 실제 매칭될 때만 주입하므로 자유채팅(general)에서도 항상 실행한다 (CR-037).
      // "헬스팩 알려줘"처럼 PRODUCT_KW 화이트리스트에 없는 제품명/별칭 질의도 aliases 매칭으로 정확히 응답.
      if (searchTerms.length > 0) {
        const orFilter = searchTerms.flatMap((t) => [
          `name.ilike.%${t}%`,
          `keywords.ilike.%${t}%`,
          `symptoms.ilike.%${t}%`,
          `category.ilike.%${t}%`,
          `tags.ilike.%${t}%`,
          `aliases.ilike.%${t}%`,
        ]).join(",");
        const { data: matchedRaw } = await supabase.from("admin_products")
          .select("name, price, score, description, keywords, symptoms, category, tags, aliases, usana_iq_url")
          .or(orFilter)
          .limit(40);
        if (matchedRaw && matchedRaw.length > 0) {
          const scoreProduct = (p: { name: string | null; aliases?: string | null; tags?: string | null; keywords: string | null; symptoms: string | null; category: string | null; description: string | null }) => {
            const name = p.name ?? "";
            const aliases = p.aliases ?? "";
            const tags = p.tags ?? "";
            const keywords = p.keywords ?? "";
            const symptoms = p.symptoms ?? "";
            const category = p.category ?? "";
            const description = p.description ?? "";
            let score = 0;
            for (const term of searchTerms) {
              if (name.includes(term)) score += 8;
              if (aliases.includes(term)) score += 7;
              if (tags.includes(term)) score += 5;
              if (keywords.includes(term)) score += 4;
              if (category.includes(term)) score += 2;
              if (symptoms.includes(term)) score += 1;
              if (description.includes(term)) score += 1;
            }
            return score;
          };
          const matched = [...matchedRaw]
            .map((p) => ({ ...p, _score: scoreProduct(p) }))
            .filter((p) => p._score > 0)
            .sort((a, b) => b._score - a._score)
            .slice(0, 12);
          if (matched.length > 0) {
            // D-2: 제품 히트 시 admin_images에서 제품명/별칭으로 대표 이미지 1장 매칭.
            // 매칭 규칙(클라이언트 셀프 운영 가능): 이미지 제목에 제품명(또는 별칭)이 포함되면 대표 이미지로 본다.
            const productImages = new Map<string, string>(); // 제품명 → image_url
            try {
              const parseAliases = (raw: string | null | undefined): string[] => {
                if (!raw) return [];
                const t = String(raw).trim();
                if (t.startsWith("[")) {
                  try {
                    const arr = JSON.parse(t);
                    if (Array.isArray(arr)) return arr.map(String);
                  } catch { /* 쉼표 구분으로 폴백 */ }
                }
                return t.split(",").map((s) => s.trim()).filter(Boolean);
              };
              const topProducts = matched.slice(0, 3).map((p) => ({
                name: p.name ?? "",
                candidates: [p.name ?? "", ...parseAliases((p as any).aliases)]
                  .filter((n) => n.length >= 2 && !/[,{}()"\\]/.test(n)),
              })).filter((p) => p.name && p.candidates.length > 0);
              const allTerms = [...new Set(topProducts.flatMap((p) => p.candidates))].slice(0, 9);
              if (allTerms.length > 0) {
                const imgOr = allTerms.map((n) => `title.ilike.%${n}%`).join(",");
                const { data: repImgs } = await supabase
                  .from("admin_images")
                  .select("title, image_url")
                  .eq("is_active", true)
                  .or(imgOr)
                  .limit(12);
                const imgRows = ((repImgs as Array<{ title: string | null; image_url: string | null }> | null) ?? []);
                for (const p of topProducts) {
                  const hit = imgRows.find((i) => i.image_url && p.candidates.some((c) => (i.title ?? "").includes(c)));
                  if (hit?.image_url) productImages.set(p.name, hit.image_url);
                }
              }
            } catch { /* 대표 이미지 매칭 실패 시 제품 정보만 주입 */ }
            const imageRule = productImages.size > 0
              ? " 대표이미지([IMAGE:URL])가 표기된 제품을 안내할 때는 그 [IMAGE:URL]을 한 글자도 바꾸지 말고 그대로 응답에 포함해, 유사나Q 링크와 함께 출력하세요."
              : "";
            adminDataParts.push(`[제품 정보]\n규칙: 아래 목록에 있는 제품만 안내하세요. 상담직원용 답변에서는 관련 제품명을 'DB 확인'에 먼저 명시하고 고객 발송 문구와 추가 확인 질문을 분리하세요. 각 제품의 PV(점수)를 가격과 함께 반드시 표기하고, 견적처럼 여러 제품을 합산할 때는 총 PV 합계도 가격 합계와 함께 표기하세요. DB에 없는 제품·가격·성분을 임의로 만들지 마세요. 유사IQ 링크가 있으면 반드시 응답에 포함하세요. 링크 형식: [유사나 Q에서 제품 상세보기](링크URL)${imageRule}\n${matched.map((p) => {
              const repUrl = productImages.get(p.name ?? "");
              return `- ${p.name} (${p.price}원)${(p as any).score != null ? ` / ${(p as any).score}PV` : ""}: ${(p.description ?? "").slice(0, 150)} / 키워드: ${p.keywords ?? ""}${(p as any).usana_iq_url ? ` / 유사IQ링크: ${(p as any).usana_iq_url}` : ""}${repUrl ? `\n  대표이미지: [IMAGE:${repUrl}]` : ""}`;
            }).join("\n")}`);
            return;
          }
        }
      }
      // 2순위: 최근 제품 일부 폴백. 무관한 제품을 자유채팅에 통째로 덤프하지 않도록
      // 전용 지플릿이거나 제품 키워드가 있을 때만 로드한다 (CR-007 의도 유지).
      if (!isCatchAll || !userLastMessage || hasKeyword(userLastMessage, PRODUCT_KW)) {
        const { data } = await supabase.from("admin_products")
          .select("name, price, score, description, keywords, symptoms, category, usana_iq_url")
          .limit(15);
        if (data && data.length > 0)
          adminDataParts.push(`[제품 정보]\n규칙: 아래 목록에 있는 제품만 안내하세요. 각 제품의 PV(점수)를 가격과 함께 반드시 표기하고, 견적처럼 여러 제품을 합산할 때는 총 PV 합계도 가격 합계와 함께 표기하세요. DB에 없는 제품·가격·성분을 임의로 만들지 마세요. 유사IQ 링크가 있으면 반드시 응답에 포함하세요. 링크 형식: [유사나 Q에서 제품 상세보기](링크URL)\n${data.map((p) => `- ${p.name} (${p.price}원)${(p as any).score != null ? ` / ${(p as any).score}PV` : ""}: ${(p.description ?? "").slice(0, 150)} / 키워드: ${p.keywords ?? ""}${(p as any).usana_iq_url ? ` / 유사IQ링크: ${(p as any).usana_iq_url}` : ""}`).join("\n")}`);
      }
    })()));
  }
  if (dbSources.includes("stories")) {
    // 통합 자료찾기처럼 전용 DB가 지정된 경우에는 별도 "사례" 단어가 없어도 검색한다.
    // 질문과 무관한 최근 8건을 넣지 않고 제목·요약·본문·카테고리·태그를 검색해 점수순으로 주입한다.
    if (!userLastMessage || !isCatchAll || hasKeyword(userLastMessage, STORY_KW)) {
      loaders.push(wrap((async () => {
        type StoryRow = {
          id: string;
          name: string | null;
          summary: string | null;
          full_text: string | null;
          tags: string[] | null;
          category: string | null;
        };
        let rows: StoryRow[] = [];
        if (searchTerms.length > 0) {
          const orFilter = searchTerms.flatMap((term) => [
            `name.ilike.%${term}%`,
            `summary.ilike.%${term}%`,
            `full_text.ilike.%${term}%`,
            `category.ilike.%${term}%`,
          ]).join(",");
          const [textResult, tagResult] = await Promise.all([
            supabase.from("stories")
              .select("id, name, summary, full_text, tags, category")
              .eq("is_active", true)
              .or(orFilter)
              .limit(40),
            supabase.from("stories")
              .select("id, name, summary, full_text, tags, category")
              .eq("is_active", true)
              .overlaps("tags", searchTerms)
              .limit(40),
          ]);
          const byId = new Map<string, StoryRow>();
          for (const row of ([...(textResult.data ?? []), ...(tagResult.data ?? [])] as StoryRow[])) {
            byId.set(row.id, row);
          }
          rows = [...byId.values()]
            .map((row) => {
              let score = 0;
              const name = row.name ?? "";
              const summary = row.summary ?? "";
              const fullText = row.full_text ?? "";
              const category = row.category ?? "";
              const tagsText = (row.tags ?? []).join(" ");
              for (const term of searchTerms) {
                if (name.includes(term)) score += 8;
                if (tagsText.includes(term)) score += 6;
                if (category.includes(term)) score += 3;
                if (summary.includes(term)) score += 2;
                if (fullText.includes(term)) score += 1;
              }
              return { row, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .map(({ row }) => row)
            .slice(0, 8);
        } else if (!isCatchAll) {
          const { data } = await supabase.from("stories")
            .select("id, name, summary, full_text, tags, category")
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(8);
          rows = (data ?? []) as StoryRow[];
        }
        if (rows.length > 0) {
          adminDataParts.push(`[성공 스토리 DB]\n규칙: 아래 사례만 소개하세요. DB에 없는 사람·스토리를 임의로 만들지 마세요. 최대 3건만 출력하세요.\n${rows.map((story) => {
            const summary = (story.summary ?? "").slice(0, 200);
            return `- ${story.name ?? "익명"} (${story.category ?? ""}): ${summary}\n  태그: ${(story.tags ?? []).join(", ")}`;
          }).join("\n")}`);
        }
      })()));
    }
  }
  if (dbSources.includes("links")) {
    // 1순위: 링크 제목·설명·카테고리·태그 검색. 전용 지플릿/프리뷰에서 최근 링크만 로드되어
    // 새 공식자료 링크를 못 찾는 회귀를 막기 위해 질문과 관련된 링크를 먼저 주입한다.
    loaders.push(wrap((async () => {
      if (searchTerms.length > 0) {
        const orFilter = searchTerms.flatMap((t) => [
          `title.ilike.%${t}%`,
          `description.ilike.%${t}%`,
          `category.ilike.%${t}%`,
        ]).join(",");
        const { data: matchedRaw } = await supabase.from("links")
          .select("title, url, description, category, tags")
          .eq("is_active", true)
          .or(orFilter)
          .limit(40);
        const matched = ((matchedRaw ?? []) as Array<{ title: string | null; url: string | null; description: string | null; category: string | null; tags?: string[] | null }>)
          .filter((l) => /^https?:\/\/\S+$/i.test(l.url ?? "") && !/[\[\]]/.test(l.url ?? "") && !(l.url ?? "").includes("***"))
          .map((l) => {
            let score = 0;
            const title = l.title ?? "";
            const category = l.category ?? "";
            const description = l.description ?? "";
            const tagsText = (l.tags ?? []).join(" ");
            for (const term of searchTerms) {
              if (title.includes(term)) score += 6;
              if (category.includes(term)) score += 3;
              if (tagsText.includes(term)) score += 2;
              if (description.includes(term)) score += 1;
            }
            return { ...l, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 12);
        if (matched.length > 0) {
          adminDataParts.push(`[링크 자료 DB]\n규칙: 아래 목록에 있는 링크만 제공하세요. DB에 없는 URL을 임의로 만들거나 추측하지 마세요. URL이 http/https가 아닌 항목은 링크로 제공하지 마세요.\n${matched.map((l) => `- ${l.title} (${l.category ?? ""}): ${l.url}\n  설명: ${(l.description ?? "").slice(0, 100)}`).join("\n")}`);
          return;
        }
      }
      // 2순위: 전용 지플릿은 일부 폴백, general은 링크 키워드가 있을 때만 폴백 로드 (CR-007)
      if (!isCatchAll || !userLastMessage || hasKeyword(userLastMessage, LINK_KW)) {
        const { data } = await supabase.from("links")
          .select("title, url, description, category")
          .eq("is_active", true)
          .ilike("url", "http%")
          .order("updated_at", { ascending: false })
          .limit(8);
        if (data && data.length > 0)
          adminDataParts.push(`[링크 자료 DB]\n규칙: 아래 목록에 있는 링크만 제공하세요. DB에 없는 URL을 임의로 만들거나 추측하지 마세요.\n${data.map((l) => `- ${l.title} (${l.category ?? ""}): ${l.url}\n  설명: ${(l.description ?? "").slice(0, 100)}`).join("\n")}`);
      }
    })()));
  }
  if (dbSources.includes("images")) {
    loaders.push(wrap((async () => {
      // C-4 재작성: ① 렉시컬(제목·설명 ilike) 1순위 — "기트"(2자) 같은 짧은 고유명은 임베딩이
      // 약해 제목 검색이 담당한다(기존엔 임베딩 단독 + length>3 게이트라 2자 질의가 통째로 스킵).
      // ② 임베딩은 렉시컬 3건 미만일 때만 보충하고, 임계값 0.25→0.40 + 상대 갭 컷으로 무관 이미지
      // 혼입을 차단한다(실측: 정답 0.38~0.54 / 무관 0.26~0.34 대역 — 2026-07-07 진단).
      type ImageRow = { title: string | null; description: string | null; image_url: string | null; tags?: string[] | null };
      const MAX_IMAGES = 8;
      const collected: ImageRow[] = [];
      const seenUrls = new Set<string>();
      const add = (img: ImageRow) => {
        if (!img.image_url || seenUrls.has(img.image_url) || collected.length >= MAX_IMAGES) return;
        seenUrls.add(img.image_url);
        collected.push(img);
      };

      // 1순위: 렉시컬 검색 (2자 질의도 동작 — extractSearchTerms는 2자 이상 토큰을 잡는다)
      const imgTerms = extractSearchTerms(userLastMessage, 4).filter((t) => !/[,{}()"\\]/.test(t));
      if (imgTerms.length > 0) {
        const orFilter = imgTerms.flatMap((t) => [`title.ilike.%${t}%`, `description.ilike.%${t}%`]).join(",");
        const { data: lexHits } = await supabase
          .from("admin_images")
          .select("title, description, image_url, tags")
          .eq("is_active", true)
          .or(orFilter)
          .limit(24);
        const scored = (((lexHits as ImageRow[] | null) ?? []))
          .map((i) => {
            const title = i.title ?? "";
            const description = i.description ?? "";
            const tagsText = (i.tags ?? []).join(" ");
            let score = 0;
            for (const term of imgTerms) {
              if (title.includes(term)) score += 6;
              if (tagsText.includes(term)) score += 3;
              if (description.includes(term)) score += 1;
            }
            return { i, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);
        for (const { i } of scored) add(i);
      }

      // 2순위: 렉시컬이 부족할 때만 임베딩 의미 검색으로 보충 (충분히 찾았으면 느슨한 결과로 희석 금지)
      if (collected.length < 3 && userLastMessage && userLastMessage.length > 3) {
        try {
          const { createEmbedding } = await import("./rag");
          const embedding = await createEmbedding(userLastMessage.slice(0, 200));
          const { data: chunks } = await (supabase as any).rpc("match_admin_images_documents", {
            query_embedding: embedding,
            match_threshold: 0.4,
            match_count: 12,
          });
          const chunkRows = (chunks as Array<{ source_id: string; similarity?: number }> | null) ?? [];
          // 상대 갭 컷: top1보다 0.12 이상 낮은 청크는 제외 (질의별 유사도 분포 차이 대응).
          // 단 시리즈 카드 묶음 보호를 위해 최소 3건은 유지한다.
          const top1 = chunkRows[0]?.similarity ?? 0;
          const gapKept = chunkRows.filter((c, idx) => idx < 3 || (c.similarity ?? 0) >= top1 - 0.12);
          const sourceIds: string[] = [];
          for (const c of gapKept) if (!sourceIds.includes(c.source_id)) sourceIds.push(c.source_id);
          if (sourceIds.length > 0) {
            const { data: images } = await supabase
              .from("admin_images")
              .select("id, title, description, image_url, tags")
              .in("id", sourceIds)
              .eq("is_active", true);
            const byId = new Map((((images as (ImageRow & { id: string })[] | null) ?? [])).map((i) => [i.id, i]));
            // 유사도 순서 유지: sourceIds(청크 유사도 순) 순서대로 추가한다.
            for (const id of sourceIds) { const v = byId.get(id); if (v) add(v); }
          }
        } catch { /* 임베딩 실패 시 렉시컬 결과만 사용 */ }
      }

      if (collected.length > 0) {
        // C-4 번호↔URL 매핑 안정화: 주입 목록에 서버가 번호를 박아 두고, 사용자가 "N번"을 고르면
        // 같은 번호의 [IMAGE:URL]을 그대로 재출력하게 한다. (번호 재배열·URL 재타이핑 여지 제거)
        adminDataParts.push(`[이미지 자료 DB — 검색 결과 ${collected.length}건, 번호 고정]\n규칙: 아래 목록에 있는 이미지만 제공하세요. DB에 없는 이미지·URL을 임의로 만들지 마세요. 이미지를 보여줄 때는 아래 목록의 [IMAGE:URL]을 한 글자도 바꾸지 말고 그대로 복사해 응답에 포함하세요. 예: [IMAGE:https://...]\n번호 규칙: 사용자에게 이미지 목록을 제시할 때는 아래 번호를 그대로 사용하고, 각 항목에 해당 [IMAGE:URL]을 함께 출력하세요. 사용자가 'N번', '네' 등으로 선택하면 아래 목록에서 그 번호 항목의 [IMAGE:URL]을 그대로 다시 출력하세요.\n관련성 규칙: 질문과 직접 관련된 이미지만 표시하고, 관련 없어 보이는 이미지는 목록에 있어도 제외하세요. 단 사용자가 특정 시리즈·카드 묶음 전체를 요청했고 같은 시리즈 이미지가 여러 장 있으면 누락하지 말고 순서대로 모두 표시하세요.\n${collected.map((i, idx) => `${idx + 1}. ${i.title}: ${i.description ?? ""}\n   [IMAGE:${i.image_url}]`).join("\n")}`);
      }
      // 렉시컬·의미 검색 모두 0건이면 이미지를 주입하지 않는다.
      // (CR-007: 매칭 0건일 때 최근 이미지 10개를 임의로 싣고 "표시하라"고 지시하던 fallback이
      //  여행/이벤트 등 무관한 "엉뚱한 이미지"를 띄우는 원인이었음)
    })()));
  }
  if (dbSources.includes("youtube")) {
    loaders.push(wrap((async () => {
      type YtVideo = { id: string; title: string; youtube_url: string; summary: string | null; category: string | null };
      const MAX_VIDEOS = 8;
      // id 기준으로 영상 단위 수집 (삽입 순서 유지)
      const collected = new Map<string, YtVideo>();

      // 1순위: 제목 키워드 검색. 제목을 수정하면 즉시 검색에 반영되며,
      // 제목에 정확히 있는 단어("보상플랜" 등)는 자막 임베딩이 0건이어도 반드시 잡힌다. (CR-004)
      // "영상/강의/추천" 같은 요청·매체 단어는 제목에 흔해 노이즈가 되므로 제외하고,
      // 불용어를 먼저 거른 뒤 상위 4개를 검색어로 쓴다(내용어가 밀려나지 않게).
      const YT_STOPWORDS = ["영상", "강의", "유튜브", "추천", "자료", "링크", "관련", "내용", "정보", "보여줘", "알려줘", "찾아줘", "해줘", "모음", "어떤", "무슨", "에서", "대한", "추천해"];
      const titleTerms = expandJosa(
        userLastMessage
          .replace(/[^\w\s가-힣]/g, " ")
          .split(/\s+/)
          .filter((t) => t.length >= 2 && !YT_STOPWORDS.includes(t))
          .slice(0, 4),
        YT_STOPWORDS,
      );
      if (titleTerms.length > 0) {
        const orFilter = titleTerms.map((t) => `title.ilike.%${t}%`).join(",");
        const { data: titleHits } = await supabase
          .from("youtube_transcripts")
          .select("id, title, youtube_url, summary, category")
          .or(orFilter)
          .eq("is_active", true)
          .limit(MAX_VIDEOS);
        for (const v of (titleHits as YtVideo[] | null) ?? []) collected.set(v.id, v);
      }

      // 2순위: 제목 매칭이 부족할 때(3개 미만)만 자막 임베딩 의미 검색으로 보충한다.
      // 청크를 넉넉히 받아 "서로 다른 영상" 단위로 집계한다.
      // (top-5 청크는 청크 많은 1~2개 영상에 쏠려 distinct 영상이 줄어드는 문제 → 영상 단위 dedup)
      // (제목으로 이미 충분히 찾았으면 느슨한 임베딩 결과로 희석하지 않는다)
      if (collected.size < 3 && userLastMessage && userLastMessage.length > 3) {
        try {
          const { createEmbedding } = await import("./rag");
          const embedding = await createEmbedding(userLastMessage.slice(0, 200));
          const { data: chunks } = await (supabase as any).rpc("match_youtube_documents", {
            query_embedding: embedding,
            match_threshold: 0.25,
            match_count: 30,
          });
          const orderedIds: string[] = [];
          const seen = new Set<string>(collected.keys());
          for (const c of (chunks as Array<{ source_id: string }> | null) ?? []) {
            if (!seen.has(c.source_id)) { seen.add(c.source_id); orderedIds.push(c.source_id); }
            if (collected.size + orderedIds.length >= MAX_VIDEOS) break;
          }
          if (orderedIds.length > 0) {
            const { data: vids } = await supabase
              .from("youtube_transcripts")
              .select("id, title, youtube_url, summary, category")
              .in("id", orderedIds)
              .eq("is_active", true);
            const byId = new Map((((vids as YtVideo[] | null) ?? [])).map((v) => [v.id, v]));
            for (const id of orderedIds) { const v = byId.get(id); if (v) collected.set(id, v); } // 유사도 순서 유지
          }
        } catch { /* 임베딩 실패 시 제목 매칭 결과만 사용 */ }
      }

      const videos = [...collected.values()].slice(0, MAX_VIDEOS);
      if (videos.length > 0) {
        adminDataParts.push(`[유튜브 강의 DB]\n규칙: 아래는 질문과 관련해 검색된 강의 목록입니다. 이 중 가장 관련 있는 영상을 추천하세요. DB에 없는 강의·URL을 임의로 만들거나 추측하지 마세요. 유튜브를 제공할 때는 반드시 클릭 가능한 링크 형식 [영상 제목](URL)을 함께 제공하세요.\n${videos.map((y) => `- ${y.title} (${y.category ?? ""}): ${(y.summary ?? "").slice(0, 200)}\n  링크: ${y.youtube_url}`).join("\n")}`);
      }
      // 제목·의미 검색 모두 0건이면 아무것도 주입하지 않는다.
      // (이전엔 최근 10개를 "DB에 존재하는 전부"라고 싣던 fallback이 엉뚱한 추천/존재하는 영상을 "없다"고 답하는 원인이었음)
    })()));
  }

  // 회원(contacts) 매칭 자동 주입 (계층 C): 사용자 메시지에 저장된 회원 이름이 등장하면
  // 그 회원의 성향·상태를 컨텍스트에 싣는다. 성향이 있으면 고객 성향 규칙(b)이 되묻지 않고
  // 바로 그 톤을 적용한다. contacts는 db_sources 로더에 없어(별도 회원관리 테이블) 여기서 직접 매칭한다.
  // 이름 substring 매칭이라 조사·오탈자에 취약할 수 있으나, 매칭될 때만 주입하므로 오탐 부담이 낮다. (2026-07-03 고객성향 계층C)
  if (userLastMessage && userLastMessage.length >= 2) {
    loaders.push(wrap((async () => {
      const { data: contactRows } = await (supabase as any)
        .from("contacts")
        .select("name, personality, member_status, care_mode, notes")
        .eq("user_id", userId)
        .limit(500);
      const contacts = (contactRows as Array<{
        name: string | null; personality: string | null;
        member_status: string | null; care_mode: string | null; notes: string | null;
      }> | null) ?? [];
      const matched = contacts
        .filter((c) => c.name && c.name.length >= 2 && userLastMessage.includes(c.name))
        .slice(0, 5);
      if (matched.length > 0) {
        adminDataParts.push(`[회원 정보 — 대화에서 언급된 저장 회원]\n규칙: 아래는 이 직원이 저장한 회원 정보입니다. 성향이 '미파악'이 아니면 고객 발송 문구를 그 톤으로 작성하고 성향을 되묻지 마세요. 성향이 '미파악'이면 고객 성향 반영 규칙(c)에 따라 기본 톤으로 쓰고 성향을 되물으세요. 성향은 발송 문구 톤에만 적용하고 직원용 섹션·고정 포맷은 중립으로 유지하세요.\n${matched.map((c) => `- ${c.name}: 성향 ${c.personality ? (CUSTOMER_PERSONALITY_LABEL[c.personality] ?? "미파악") : "미파악"}${c.member_status ? `, 상태 ${c.member_status}` : ""}${c.care_mode ? `, 케어 ${c.care_mode}` : ""}${c.notes ? `, 메모 ${c.notes.slice(0, 60)}` : ""}`).join("\n")}`);
      }
    })()));
  }

  // C-4 번호 선택 후속턴: 사용자가 "3번"/"네"처럼 직전 목록에서 고르는 발화를 하면
  // 직전 어시스턴트 답변에 있던 [IMAGE:URL] 목록(표시 순서 그대로)을 이번 턴 컨텍스트에 재주입한다.
  // → 검색 스킵·히스토리 재타이핑(temp 0.7) 대신 서버가 준 URL을 그대로 재출력하게 한다.
  //   adminDataParts에 넣으므로 hasSearchEvidence=true가 되어 EMPTY_SEARCH_GUIDE도 자동으로 빠진다.
  let selectionReinjected = false;
  if (isSelectionFollowUp(userLastMessage)) {
    const lastAssistantRaw = messages.filter((m) => m.role === "assistant").pop()?.content;
    const lastAssistantText = typeof lastAssistantRaw === "string" ? lastAssistantRaw : "";
    const prevUrls: string[] = [];
    const imgRe = /\[IMAGE:(https?:\/\/[^\]\s]+)\]/g;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRe.exec(lastAssistantText)) !== null) {
      if (!prevUrls.includes(imgMatch[1])) prevUrls.push(imgMatch[1]);
    }
    if (prevUrls.length > 0) {
      selectionReinjected = true;
      adminDataParts.push(
        `[직전 턴 이미지 목록 — 번호 선택 응답용]\n규칙: 사용자의 이번 입력은 직전 답변의 목록에서 항목을 선택하는 발화입니다. 아래는 직전 답변에 포함됐던 이미지 URL 목록(표시 순서 그대로)입니다. 선택된 번호에 해당하는 [IMAGE:URL]을 한 글자도 바꾸지 말고 그대로 다시 출력하세요. 이 재출력은 '이전 답변 반복 금지' 규칙의 예외입니다. 아래 목록에 없는 URL을 만들거나 변형하지 마세요. 번호가 목록 범위를 벗어나면 목록을 다시 보여주며 몇 번인지 확인하세요.\n${prevUrls.map((u, i) => `${i + 1}. [IMAGE:${u}]`).join("\n")}`
      );
    }
  }

  await Promise.all(loaders);

  // 로더는 병렬 실행되므로 adminDataParts push 순서가 비결정적일 수 있다.
  // 제품명/별칭 direct match가 있는 일반 제품 질문에서는 제품 DB 근거가 패키지·스크립트보다 먼저 보여야
  // 모델이 일반 GPT식 답변이나 패키지 추천으로 새지 않고 제품DB 기반으로 답한다. (CR-037)
  const contextPriority = (part: string): number => {
    if (part.startsWith("[제품 정보]")) return 10;
    if (part.startsWith("[패키지 DB")) return 20;
    if (part.startsWith("[FAQ")) return 30;
    if (part.startsWith("[스크립트 DB")) return 40;
    return 50;
  };
  const orderedAdminDataParts = [...adminDataParts].sort((a, b) => contextPriority(a) - contextPriority(b));

  const adminDataContext =
    orderedAdminDataParts.length > 0
      ? `\n\n--- 참고 데이터 ---\n${orderedAdminDataParts.join("\n\n")}`
      : "";

  const extraContextParts: string[] = [];

  // 일반 RAG — 레퍼런스 파일(rag:admin_files)·FAQ(rag:faqs)는 아래에서 출처를 콕 집어 별도 처리
  const useRag = dbSources.some((s) => s.startsWith("rag:") && s !== "rag:admin_files" && s !== "rag:faqs") || dbSources.includes("templates");
  if (useRag) {
    if (userLastMessage && userLastMessage.length > 3) {
      const results = await searchDocuments(userLastMessage, supabase);
      if (results.length > 0) {
        extraContextParts.push(
          `[관련 참고 자료 (RAG 검색 결과)]\n${results
            .map((r) => {
              const imageTag = r.image_url ? `\n[IMAGE:${r.image_url}]` : "";
              return `출처: ${r.source_name}\n${r.chunk_text}${imageTag}`;
            })
            .join("\n\n---\n\n")}`
        );
      }
    }
  }

  // FAQ — 하이브리드 검색.
  // 1순위: faqs 테이블 직접 키워드 검색. 한국어 조사("변비랑" vs "변비나")에 강하도록
  //   ilike 대신 2-gram 겹침 점수로 매칭한다("변비랑"·"변비나"는 2-gram "변비"를 공유).
  // 2순위: 부족하면 임베딩 검색으로 보충. (순수 임베딩은 짧은 Q-Q 유사도가 낮아 단독으론 자주 0건)
  if (dbSources.includes("rag:faqs") && userLastMessage && userLastMessage.length > 3) {
    const faqParts: string[] = [];
    const usedQuestions = new Set<string>();

    if (searchTerms.length > 0) {
      const bigrams = (str: string): Set<string> => {
        const s = (str ?? "").replace(/[^\w가-힣]/g, "");
        const g = new Set<string>();
        for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
        return g;
      };
      const queryGrams = new Set<string>();
      for (const t of searchTerms) for (const g of bigrams(t)) queryGrams.add(g);

      if (queryGrams.size > 0) {
        const { data: allFaqs } = await supabase
          .from("faqs")
          .select("question, answer, tags")
          .eq("is_active", true);
        const scored = ((allFaqs as Array<{ question: string; answer: string; tags: string[] | null }> | null) ?? [])
          .map((f) => {
            // 제목·태그 기준 점수화(본문은 길어 잡음이 커서 제외)
            const hayGrams = bigrams(`${f.question} ${(f.tags ?? []).join(" ")}`);
            let score = 0;
            for (const g of queryGrams) if (hayGrams.has(g)) score++;
            return { f, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6);
        for (const { f } of scored) {
          faqParts.push(`Q/A: ${f.question}\n${f.question}\n${f.answer}`);
          usedQuestions.add(f.question);
        }
      }
    }

    // 2순위: 키워드 결과가 부족하면 임베딩으로 보충 (faq 출처만, 0.35)
    if (faqParts.length < 3) {
      const faqResults = await searchDocumentsBySource(userLastMessage, supabase, "faq", { threshold: 0.35, count: 6 });
      for (const r of faqResults) {
        if (usedQuestions.has(r.source_name)) continue;
        faqParts.push(`Q/A: ${r.source_name}\n${r.chunk_text}`);
        usedQuestions.add(r.source_name);
        if (faqParts.length >= 6) break;
      }
    }

    if (faqParts.length > 0) {
      extraContextParts.push(
        `[FAQ — 자주 묻는 질문 DB]\n규칙: 아래 FAQ 내용을 근거로 답하세요. DB에 없는 내용을 임의로 만들지 마세요.\n${faqParts.slice(0, 6).join("\n\n---\n\n")}`
      );
    }
  }

  // 레퍼런스 파일 (관리자 업로드 자료) — 출처를 정확히 필터해 이 자료만 참조
  if (dbSources.includes("rag:admin_files") && userLastMessage && userLastMessage.length > 3) {
    const refResults = await searchReferenceDocuments(userLastMessage, supabase);

    // 렉시컬 보완 경로: 임베딩 유사도는 영문 원서(본문·제목이 영어)를 한글 질문으로 못 찾는다.
    // 파일명/관리자 키워드(admin_files.keywords) ilike 매치 → 해당 파일 청크를 근거로 추가한다.
    // (제품 DB 로더의 aliases 검색 패턴과 동일 구조)
    const refLexicalParts: string[] = [];
    if (searchTerms.length > 0) {
      const refOr = searchTerms
        .flatMap((t) => [`file_name.ilike.%${t}%`, `keywords.ilike.%${t}%`])
        .join(",");
      const { data: keywordFiles } = await (supabase as any)
        .from("admin_files")
        .select("id, file_name")
        .eq("is_active", true)
        .or(refOr)
        .limit(3) as { data: { id: string; file_name: string }[] | null };

      if (keywordFiles && keywordFiles.length > 0) {
        const embeddedNames = new Set(refResults.map((r) => r.source_name));
        for (const kf of keywordFiles) {
          // 임베딩 검색이 이미 같은 파일을 근거로 잡았으면 중복 주입하지 않는다.
          if (embeddedNames.has(kf.file_name)) continue;
          const { data: kfChunks } = await (supabase as any)
            .from("document_chunks")
            .select("chunk_text, metadata")
            .eq("source_type", "admin_files")
            .eq("source_id", kf.id)
            .limit(12) as { data: { chunk_text: string; metadata: { chunk_index?: number } | null }[] | null };
          if (!kfChunks || kfChunks.length === 0) continue;
          // 검색어가 본문에 포함된 청크 우선, 없으면 문서 앞부분 청크
          const matched = kfChunks.filter((c) => searchTerms.some((t) => c.chunk_text.includes(t)));
          const picked = (matched.length > 0 ? matched : kfChunks)
            .sort((a, b) => (a.metadata?.chunk_index ?? 0) - (b.metadata?.chunk_index ?? 0))
            .slice(0, 3);
          refLexicalParts.push(...picked.map((c) => `출처: ${kf.file_name}\n${c.chunk_text}`));
        }
      }
    }

    const refParts = [
      ...refResults.map((r) => `출처: ${r.source_name}\n${r.chunk_text}`),
      ...refLexicalParts,
    ];
    if (refParts.length > 0) {
      extraContextParts.push(
        `[레퍼런스 파일 — 관리자가 업로드한 참고 자료]\n규칙: 아래 업로드된 레퍼런스 파일 내용을 근거로 답하세요. 자료에 없는 내용을 임의로 만들지 마세요.\n${refParts.join("\n\n---\n\n")}`
      );
    }
  }

  const { data: memories } = await supabase
    .from("memories")
    .select("content, tags")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (memories && memories.length > 0) {
    extraContextParts.push(
      `[이 사용자의 저장된 메모리]\n${memories
        .map((m: { content: string }) => `- ${m.content}`)
        .join("\n")}`
    );
  }

  const extraContext =
    extraContextParts.length > 0
      ? `\n\n--- 추가 참고 자료 ---\n${extraContextParts.join("\n\n")}`
      : "";

  // 빈 검색 판정: 이번 질문에 대한 DB 근거(관리자 데이터 + 검색성 추가 컨텍스트)가 하나도 없는 상태.
  // 사용자 메모리는 검색 근거가 아니므로 제외한다. 근거가 전무하면 모델이 히스토리에 남은
  // 이전 답변을 재출력하는 문맥 고착이 생기므로, 이를 막는 지시를 주입한다.
  // 자유채팅(general)과 통합 자료찾기에서 opt-in(emptySearchFallback)했을 때 적용한다.
  // 케이스엔진·아카이브 재정리 등 정리형 공유 호출까지 'DB 확인: 관련 항목 없음'으로 오염되지 않게. (A1)
  const hasSearchEvidence =
    orderedAdminDataParts.length > 0 ||
    extraContextParts.some((p) => !p.startsWith("[이 사용자의 저장된 메모리]"));
  const supportsStrictEmptySearch = isCatchAll || gipletType === "unified_search";
  const emptySearchGuide =
    emptySearchFallback && supportsStrictEmptySearch && !hasSearchEvidence ? `\n${EMPTY_SEARCH_GUIDE}` : "";

  // 수당·여행 지플릿은 계산 결과 유무와 무관하게 필수 안전문구를 항상 붙인다. (검수 #32/#33)
  const resolvedGiplet = gipletType ?? "general";
  const commissionTravelSafety =
    resolvedGiplet === "commission" || resolvedGiplet === "travel"
      ? `\n${COMMISSION_TRAVEL_SAFETY_GUIDE}`
      : "";

  // 코칭 프로필: 4단 포맷(STAFF_ASSISTANT_PROMPT)·성향 되묻기(4단 포맷 전제)를 빼고 코칭 규칙을 넣는다.
  // 말투·모드·DB 컨텍스트는 동일하게 유지한다. URL 창작 금지 가드(C-2/C-3)는 모든 프로필 공통.
  if (promptProfile === "coaching") {
    return `${baseSystemPrompt}\n\n${MODE_CONTEXT[resolvedMode] ?? MODE_CONTEXT.self}\n${COACHING_BEHAVIOR_GUIDE}\n${TONE_GUIDE}\n${IMAGE_URL_GUARD}\n${ADMIN_PROMPT_PRIORITY_COACHING}${commissionTravelSafety}${emptySearchGuide}${adminDataContext}${extraContext}`;
  }

  // C-5(승인됨): 자료 조회성 질문(보여줘/찾아줘/원고/사례… 또는 직전 목록 번호 선택)은 4단 상담 포맷을
  // 생략하고 검색된 자료를 바로 출력한다. 통합 자료찾기는 모든 입력을 자료 조회로 취급한다.
  // 케이스엔진·아카이브 재정리 등 정리형 공유 호출은 기존 포맷을 유지한다.
  if (emptySearchFallback && (gipletType === "unified_search" || isDataLookupQuery(userLastMessage) || selectionReinjected)) {
    return `${baseSystemPrompt}\n\n${MODE_CONTEXT[resolvedMode] ?? MODE_CONTEXT.self}\n${STAFF_DATA_LOOKUP_PROMPT}\n${TONE_GUIDE}\n${IMAGE_URL_GUARD}\n${ADMIN_PROMPT_PRIORITY_LOOKUP}${commissionTravelSafety}${emptySearchGuide}${adminDataContext}${extraContext}`;
  }

  return `${baseSystemPrompt}\n\n${MODE_CONTEXT[resolvedMode] ?? MODE_CONTEXT.self}\n${STAFF_ASSISTANT_PROMPT}\n${TONE_GUIDE}\n${IMAGE_URL_GUARD}\n${CUSTOMER_PERSONALITY_PROMPT}\n${ADMIN_PROMPT_PRIORITY}${commissionTravelSafety}${emptySearchGuide}${adminDataContext}${extraContext}`;
}

export async function generateAIResponse(params: GenerateAIResponseParams): Promise<string> {
  const systemPrompt = await buildSystemPrompt(params);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...params.messages],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      `OpenAI API 요청 실패: ${response.status} ${errorData?.error?.message ?? response.statusText}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 응답을 받지 못했습니다");
  return content;
}

// 스트리밍 버전: 토큰을 하나씩 yield하는 AsyncGenerator
export async function* streamAIResponse(
  params: GenerateAIResponseParams
): AsyncGenerator<string, void, unknown> {
  const systemPrompt = await buildSystemPrompt(params);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...params.messages],
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API 요청 실패: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // 파싱 오류는 무시 (불완전한 청크)
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─────────────────────────────────────────
// Function calling 지원 버전
// ─────────────────────────────────────────

const CONTACT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "register_contact",
      description: "회원/고객을 등록합니다. 이름은 필수이며, 나머지 정보는 대화 중에 수집합니다.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "회원/고객 이름 (필수)" },
          phone: { type: "string", description: "연락처 (예: 01012345678)" },
          join_date: { type: "string", description: "가입일 (YYYY-MM-DD 형식)" },
          first_order_date: { type: "string", description: "첫 주문일 (YYYY-MM-DD 형식)" },
          member_status: {
            type: "string",
            enum: ["신규등록", "활성", "재활성", "휴면"],
            description: "회원 상태 (기본값: 신규등록)",
          },
          care_mode: {
            type: "string",
            enum: ["집중", "정기", "누적", "자율", "중단"],
            description: "케어 모드 (기본값: 집중)",
          },
          personality: {
            type: "string",
            enum: ["logical", "emotional", "practical"],
            description: "고객 성향 (논리적=logical / 감성적=emotional / 실용적=practical). 대화에서 파악됐을 때만 채우고, 모르면 비워두세요.",
          },
          notes: { type: "string", description: "특이사항이나 메모" },
        },
        required: ["name"],
      },
    },
  },
];

export interface ToolCallResult {
  type: "tool_call";
  toolName: string;
  toolArgs: Record<string, unknown>;
  finalContent: string;
}

export interface TextResult {
  type: "text";
  content: string;
}

export async function generateAIResponseWithTools(
  params: GenerateAIResponseParams
): Promise<ToolCallResult | TextResult> {
  const resolvedMode = params.mode ?? "self";

  let baseSystemPrompt: string;
  if (params.systemPromptOverride !== undefined) {
    baseSystemPrompt = params.systemPromptOverride;
  } else {
    const { data: systemPromptRow } = await params.supabase
      .from("admin_system_prompts")
      .select("content")
      .eq("giplet_type", "general")
      .maybeSingle();
    baseSystemPrompt =
      systemPromptRow?.content ??
      "당신은 사용자의 기록을 정리하는 AI 어시스턴트입니다.";
  }

  const systemPrompt = `${baseSystemPrompt}

${MODE_CONTEXT[resolvedMode] ?? MODE_CONTEXT.self}

회원 등록 요청이 오면:
1. 이름이 없으면 먼저 이름을 물어보세요.
2. 이름이 있으면 가입일과 연락처를 물어보세요.
3. 필요한 정보를 다 수집했으면 register_contact 함수를 호출하세요.
4. 이미 메시지에 이름이 포함되어 있으면 바로 추가 정보를 요청하거나 함수를 호출하세요.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...params.messages],
      tools: CONTACT_TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`OpenAI API 요청 실패: ${response.status} ${errorData?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (choice?.finish_reason === "tool_calls" && choice?.message?.tool_calls?.[0]) {
    const toolCall = choice.message.tool_calls[0];
    const toolName = toolCall.function.name;
    const toolArgs = JSON.parse(toolCall.function.arguments ?? "{}");

    const finalResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...params.messages,
          choice.message,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: true, message: `${toolArgs.name}님이 회원으로 등록되었습니다.` }),
          },
        ],
        temperature: 0.7,
      }),
    });

    const finalData = await finalResponse.json();
    const finalContent = finalData.choices?.[0]?.message?.content ?? "회원으로 등록했습니다.";

    return { type: "tool_call", toolName, toolArgs, finalContent };
  }

  const content = choice?.message?.content;
  if (!content) throw new Error("AI 응답을 받지 못했습니다");
  return { type: "text", content };
}

interface GenerateQuotationResponseParams {
  userMessage: string;
  judgment: import("@/lib/health-analyzer").JudgmentResult;
  supabase: SupabaseClient<any>;
}

export async function generateQuotationResponse({
  userMessage: _userMessage,
  judgment,
  supabase,
}: GenerateQuotationResponseParams): Promise<QuotationResult> {
  const { buildQuotation } = await import("@/lib/quotation-engine");
  return buildQuotation(judgment, supabase);
}
