import { describe, expect, it } from "vitest";
import { resolveMeetingBusinessRoute } from "./meeting-business-router";

describe("meeting business router", () => {
  it.each([
    ["파트너들 미팅 때 꿈과 목표 설정해야 되는데 뭐부터 해야 돼?", "dream_goal"],
    ["네트워크 하고 있는 사람들한테는 뭐부터 얘기해?", "network_experienced"],
    ["나 초기 사업자인데 뭐부터 공부해?", "beginner_learning"],
    ["엄마가 걱정하는데 뭐라고 말해?", "family_concern"],
    ["보상플랜을 간단하게 설명하려면?", "compensation_explain"],
    ["내가 공부할 수 있는 자료는 뭐가 있어?", "study_material"],
  ])("routes real expression %s", (query, intent) => {
    expect(resolveMeetingBusinessRoute(query).intent).toBe(intent);
  });

  it("returns DB sources and an execution prompt", () => {
    const route = resolveMeetingBusinessRoute("초기 사업자 공부 순서 알려줘");
    expect(route.dbSources.length).toBeGreaterThan(0);
    expect(route.prompt).toContain("이번 주");
  });
});
