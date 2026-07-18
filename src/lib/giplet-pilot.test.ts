import { describe, expect, it } from "vitest";
import { isPilotHostname, PILOT_GIPLETS, PILOT_GIPLET_KEYS, resolveActionCapability, UNIFIED_SEARCH_SYSTEM_PROMPT, UNIFIED_SEARCH_WELCOME_PROMPT } from "./giplet-pilot";

describe("four giplet pilot", () => {
  it("uses the mobile-friendly unified-search welcome copy", () => {
    expect(UNIFIED_SEARCH_WELCOME_PROMPT).toContain("^^");
    expect(UNIFIED_SEARCH_WELCOME_PROMPT).toContain("\n\n");
    expect(UNIFIED_SEARCH_WELCOME_PROMPT).not.toMatch(/[😊👋]/u);
    expect(PILOT_GIPLETS[0].initial_prompt).toBe(UNIFIED_SEARCH_WELCOME_PROMPT);
  });

  it("keeps the unified-search behavior rules scoped to one giplet", () => {
    expect(UNIFIED_SEARCH_SYSTEM_PROMPT).toContain("최대 3~5건");
    expect(UNIFIED_SEARCH_SYSTEM_PROMPT).toContain("남은 건수");
    expect(UNIFIED_SEARCH_SYSTEM_PROMPT).toContain("대표 이미지 1장");
    expect(UNIFIED_SEARCH_SYSTEM_PROMPT).toContain("상세자료 하단");
    expect(PILOT_GIPLETS[0].system_prompt).toBe(UNIFIED_SEARCH_SYSTEM_PROMPT);
    expect(PILOT_GIPLETS.slice(1).every((g) => g.system_prompt === "")).toBe(true);
  });

  it("includes the function tools giplet as the fourth entry", () => {
    expect(PILOT_GIPLET_KEYS).toHaveLength(4);
    expect(PILOT_GIPLETS).toHaveLength(4);
    expect(PILOT_GIPLETS[3]).toMatchObject({
      giplet_key: "function_tools",
      name: "기능도구",
      sort_order: 4,
      is_active: true,
    });
  });

  it("shows only on the local or branch preview hostname", () => {
    expect(isPilotHostname("127.0.0.1")).toBe(true);
    expect(isPilotHostname("geniea-v2-git-codex-blood-story-pilot-genieas-projects.vercel.app")).toBe(true);
    expect(isPilotHostname("geniea-v2.vercel.app")).toBe(false);
  });

  it.each([
    ["이거랑 이거 하면 견적이 얼마야?", "health_analysis"],
    ["현재 1200 CVP인데 수당 계산해줘", "commission_calc"],
    ["제주도 여행 가려면 몇 점 필요해?", "travel_calc"],
    ["보상플랜을 설명하려면?", null],
  ])("routes %s to %s", (question, capability) => {
    expect(resolveActionCapability(question)).toBe(capability);
  });
});
