import { describe, expect, it } from "vitest";
import { searchBloodStories } from "./blood-story-pilot";

describe("blood story pilot search", () => {
  it.each([
    ["림프종 사례 있어?", "94"],
    ["심장이 안 좋은 사람 사례 보여줘", "135"],
    ["심장 판막이 안 좋은 사람 사례", "132"],
    ["고지혈증 약 먹고 다이어트가 안 되는 사례", "164"],
    ["계속 배가 부풀어 오르고 아픈 사람 사례", "166"],
    ["크론병 같은 장질환 사례", "197"],
    ["무릎 낭종 사례 보여줘", "250"],
    ["연골이나 관절 관련 사례", "241"],
  ])("ranks %s with expected case %s first", (query, expectedId) => {
    expect(searchBloodStories(query)[0]?.item.id).toBe(expectedId);
  });

  it.each([
    ["관절 관련 사례 있어?", "241"],
    ["무릎 아픈 사람 사례 좀 찾아줘", "250"],
    ["장이 안 좋았던 사람 사례 있어?", "197"],
  ])("실사용 질문 %s에서 관련 사례를 첫 결과로 찾는다", (query, expectedId) => {
    expect(searchBloodStories(query)[0]?.item.id).toBe(expectedId);
  });

  it("변비 사례가 현재 파일럿 DB에 없으면 결과를 만들지 않는다", () => {
    expect(searchBloodStories("변비 관련 케이스 보여줘")).toEqual([]);
  });

  it("returns at most three grouped cases", () => {
    expect(searchBloodStories("심장 관련 사례", 3)).toHaveLength(2);
  });

  it("does not invent a result for an unknown topic", () => {
    expect(searchBloodStories("제주도 여행 자료 보여줘")).toEqual([]);
  });

  it("does not return arbitrary data for a generic request", () => {
    expect(searchBloodStories("사례 좀 보여줘")).toEqual([]);
  });
});
