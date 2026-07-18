export type GlobalFunctionIntent = "intake_guide";

export interface GlobalFunctionIntentMatch {
  intent: GlobalFunctionIntent;
  confidence: "explicit" | "implicit";
}

const EXPLICIT_INTAKE_GUIDE = /섭취\s*(방법|안내|시간|스케줄|일정).*(카드|표|안내)?|복용\s*(방법|안내|시간|스케줄).*(카드|표|안내)?/;
const IMPLICIT_INTAKE_GUIDE = /(이\s*사람|이분|엄마|아빠|고객|회원).*(어떻게|언제).*(먹|섭취|복용)|(먹는|섭취|복용)\s*(방법|시간).*(알려|정리|만들)/;

/**
 * 현재 지플릿 종류와 무관하게 실행 가능한 공통 기능 의도를 찾는다.
 * 실제 기능 실행 전에는 공식 DB 재조회와 필수 입력 검증을 별도로 수행해야 한다.
 */
export function resolveGlobalFunctionIntent(query: string): GlobalFunctionIntentMatch | null {
  const normalized = query.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
  if (!normalized) return null;
  if (EXPLICIT_INTAKE_GUIDE.test(normalized)) {
    return { intent: "intake_guide", confidence: "explicit" };
  }
  if (IMPLICIT_INTAKE_GUIDE.test(normalized)) {
    return { intent: "intake_guide", confidence: "implicit" };
  }
  return null;
}
