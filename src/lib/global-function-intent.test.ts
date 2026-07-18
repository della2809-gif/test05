import { describe, expect, it } from "vitest";
import { resolveGlobalFunctionIntent } from "./global-function-intent";

describe("지플릿 공통 기능 의도 감지", () => {
  it.each([
    "이 사람 섭취방법 안내해줘",
    "이분 섭취 안내 카드로 만들어줘",
    "헬스팩 복용방법 정리해줘",
    "엄마가 언제 먹어야 하는지 알려줘",
    "먹는 방법을 카드로 만들어줘",
  ])("어느 채팅에서도 섭취방법 기능을 감지한다: %s", (query) => {
    expect(resolveGlobalFunctionIntent(query)).toMatchObject({ intent: "intake_guide" });
  });

  it.each([
    "관절 관련 사례 찾아줘",
    "이번 주 몇 점 필요해?",
    "엄마에게 뭐라고 말하지?",
  ])("다른 의도를 섭취방법으로 오인하지 않는다: %s", (query) => {
    expect(resolveGlobalFunctionIntent(query)).toBeNull();
  });
});
