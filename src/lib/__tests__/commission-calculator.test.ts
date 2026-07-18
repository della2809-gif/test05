import { describe, it, expect } from "vitest";
import {
  calcCommission,
  calcFromTotalCvp,
  calc3BCCommission,
  basicCommissionFromMin,
  maintenanceRequirement,
  MIN_ACTIVE_CVP,
  MAINTENANCE_CVP,
  type ShopLine,
} from "../commission-calculator";

describe("125점 최소 임계값 (운영정책 3-10)", () => {
  it("소실적 124점은 기본수당 미발생(0)", () => {
    expect(basicCommissionFromMin(124)).toBe(0);
  });
  it("소실적 125점부터 발생: 125 × 20% = 25", () => {
    expect(basicCommissionFromMin(MIN_ACTIVE_CVP)).toBe(25);
  });

  it("calcCommission: 125 미만 라인은 제외되고 pendingShopIds에 표시", () => {
    const shops: ShopLine[] = [
      { id: "001", left: 200, right: 150 }, // min 150 → 발생
      { id: "002", left: 100, right: 80 }, // min 80 → 미발생
    ];
    const r = calcCommission({ shops });
    expect(r.totalMinCvp).toBe(230);       // 150 + 80 (참고용 전체)
    expect(r.eligibleMinCvp).toBe(150);    // 125+ 라인만
    expect(r.basicCommissionUsd).toBe(30); // 150 × 20%
    expect(r.pendingShopIds).toEqual(["002"]);
  });

  it("calcFromTotalCvp: 124점은 기본수당 0 + 점수 누적 중", () => {
    const r = calcFromTotalCvp(124);
    expect(r.basicCommissionUsd).toBe(0);
    expect(r.pendingShopIds).toEqual(["소실적"]);
  });
  it("calcFromTotalCvp: 300점은 기본수당 60", () => {
    const r = calcFromTotalCvp(300);
    expect(r.basicCommissionUsd).toBe(60);
    expect(r.pendingShopIds).toEqual([]);
  });
});

describe("실적유지 조건 (1BC=100 / 2BC 이상=200)", () => {
  it("maintenanceRequirement: 1BC는 100점, 2BC 이상은 200점", () => {
    expect(maintenanceRequirement(1)).toBe(MAINTENANCE_CVP.single);
    expect(maintenanceRequirement(2)).toBe(MAINTENANCE_CVP.multi);
    expect(maintenanceRequirement(3)).toBe(MAINTENANCE_CVP.multi);
  });

  it("calcFromTotalCvp: bcCount 기본 1BC → 유지 100점", () => {
    const r = calcFromTotalCvp(300);
    expect(r.bcCount).toBe(1);
    expect(r.maintenanceRequiredCvp).toBe(100);
  });

  it("calcFromTotalCvp: 2BC 지정 시 유지 200점", () => {
    const r = calcFromTotalCvp(300, 0, 2);
    expect(r.bcCount).toBe(2);
    expect(r.maintenanceRequiredCvp).toBe(200);
  });

  it("calcCommission: 가게 수에 따라 유지점수 산출", () => {
    const shops: ShopLine[] = [
      { id: "001", left: 200, right: 150 },
      { id: "002", left: 100, right: 80 },
    ];
    const r = calcCommission({ shops });
    expect(r.bcCount).toBe(2);
    expect(r.maintenanceRequiredCvp).toBe(200);
  });
});

describe("3BC 공유/누적 구조 (운영정책 3-10)", () => {
  it("002·003 신규점수가 001 좌/우에 누적된 뒤 001 재계산", () => {
    const shops: ShopLine[] = [
      { id: "001", left: 100, right: 100 },
      { id: "002", left: 200, right: 150, newLeft: 80, newRight: 60 },
      { id: "003", left: 180, right: 170, newLeft: 50, newRight: 40 },
    ];
    const r = calc3BCCommission(shops);
    // comm002 = min(200,150)=150 → 30, comm003 = min(180,170)=170 → 34
    expect(r.breakdown.comm002Usd).toBe(30);
    expect(r.breakdown.comm003Usd).toBe(34);
    // 001 좌 = 100 + (80+60)=240, 001 우 = 100 + (50+40)=190 → min 190 → 38
    expect(r.breakdown.adjusted001Left).toBe(240);
    expect(r.breakdown.adjusted001Right).toBe(190);
    expect(r.breakdown.comm001Usd).toBe(38);
    // 총 기본수당 = 30+34+38 = 102
    expect(r.basicCommissionUsd).toBe(102);
    expect(r.breakdown.missingNewPoints).toBe(false);
  });

  it("신규점수 미입력 시 누적 0 + missingNewPoints=true (값 날조 안 함)", () => {
    const shops: ShopLine[] = [
      { id: "001", left: 130, right: 130 },
      { id: "002", left: 200, right: 150 },
      { id: "003", left: 180, right: 170 },
    ];
    const r = calc3BCCommission(shops);
    expect(r.breakdown.missingNewPoints).toBe(true);
    // 누적 없이 001 = min(130,130)=130 → 26
    expect(r.breakdown.comm001Usd).toBe(26);
  });

  it("001/002/003 중 하나라도 없으면 에러", () => {
    expect(() => calc3BCCommission([{ id: "001", left: 100, right: 100 }])).toThrow();
  });
});
