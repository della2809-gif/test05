import { describe, it, expect } from "vitest";
import {
  calcCommission,
  parseVisionShopsJson,
  parseShopLinesFromText,
} from "../commission-calculator";

// B-2 수당계산 결정화 — vision/텍스트에서 BC별 좌·우 점수 구조화 추출 + min(좌,우)×20%

describe("parseVisionShopsJson — vision json_object 응답 검증", () => {
  it("정상 shops 배열을 ShopLine으로 정규화한다", () => {
    const shops = parseVisionShopsJson(
      '{"shops":[{"bc":"001","left":406,"right":3063},{"bc":"002","left":5000,"right":0}]}',
    );
    expect(shops).toEqual([
      { id: "001", left: 406, right: 3063 },
      { id: "002", left: 5000, right: 0 },
    ]);
  });

  it("bc 누락 시 순번으로 001, 002… 채번한다", () => {
    const shops = parseVisionShopsJson('{"shops":[{"left":100,"right":200}]}');
    expect(shops).toEqual([{ id: "001", left: 100, right: 200 }]);
  });

  it("JSON 깨짐 → null (되묻기 경로, 지어내기 금지)", () => {
    expect(parseVisionShopsJson("숫자를 읽을 수 없습니다")).toBeNull();
    expect(parseVisionShopsJson("")).toBeNull();
  });

  it("shops 빈 배열/누락 → null", () => {
    expect(parseVisionShopsJson('{"shops":[]}')).toBeNull();
    expect(parseVisionShopsJson("{}")).toBeNull();
  });

  it("숫자 아닌 값·음수 라인은 걸러내고, 전부 무효면 null", () => {
    expect(
      parseVisionShopsJson('{"shops":[{"bc":"001","left":"모름","right":10}]}'),
    ).toBeNull();
    expect(
      parseVisionShopsJson('{"shops":[{"bc":"001","left":-5,"right":10},{"bc":"002","left":1,"right":2}]}'),
    ).toEqual([{ id: "002", left: 1, right: 2 }]);
  });
});

describe("parseShopLinesFromText — 되묻기 후 텍스트 답변 파싱", () => {
  it("'001BC 좌 406 우 3063 / …' 여러 줄을 전부 파싱한다", () => {
    const shops = parseShopLinesFromText(
      "001BC 좌 406 우 3063 / 002BC 좌 5000 우 0 / 003BC 좌 0 우 5000",
    );
    expect(shops).toEqual([
      { id: "001", left: 406, right: 3063 },
      { id: "002", left: 5000, right: 0 },
      { id: "003", left: 0, right: 5000 },
    ]);
  });

  it("'좌406/우3063' 압축 표기 + BC 번호 없으면 순번 채번", () => {
    expect(parseShopLinesFromText("좌406/우3063")).toEqual([
      { id: "001", left: 406, right: 3063 },
    ]);
  });

  it("좌/우 표기가 없으면 빈 배열 (총 CVP 경로로 폴백)", () => {
    expect(parseShopLinesFromText("이번 주 3500CVP야")).toEqual([]);
    expect(parseShopLinesFromText("")).toEqual([]);
  });

  it("천 단위 콤마를 처리한다", () => {
    expect(parseShopLinesFromText("좌 1,406 우 3,063")).toEqual([
      { id: "001", left: 1406, right: 3063 },
    ]);
  });
});

describe("calcCommission — B-2 검증 예시 (BC별 min(좌,우) × 20%)", () => {
  it("좌406/우3063 + 5000/0 + 0/5000 → $81.2", () => {
    const result = calcCommission({
      shops: [
        { id: "001", left: 406, right: 3063 },
        { id: "002", left: 5000, right: 0 },
        { id: "003", left: 0, right: 5000 },
      ],
    });
    // 소실적: 001=406(125점 이상 → 발생), 002·003=0(누적 중)
    expect(result.eligibleMinCvp).toBe(406);
    expect(result.basicCommissionUsd).toBeCloseTo(81.2, 5);
    expect(result.totalCommissionUsd).toBeCloseTo(81.2, 5);
    expect(result.pendingShopIds).toEqual(["002", "003"]);
    expect(result.bcCount).toBe(3);
    expect(result.maintenanceRequiredCvp).toBe(200); // 2BC 이상 = 200점
  });

  it("같은 입력이면 항상 같은 결과 (결정성)", () => {
    const shops = [{ id: "001", left: 406, right: 3063 }];
    const a = calcCommission({ shops });
    const b = calcCommission({ shops });
    const c = calcCommission({ shops });
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.basicCommissionUsd).toBeCloseTo(81.2, 5);
  });
});
