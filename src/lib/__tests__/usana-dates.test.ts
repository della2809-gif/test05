import { describe, it, expect } from "vitest";
import {
  getUsanaWeekStart,
  calcAoCycleDate,
  calcNextAoDates,
  calcMilestones,
} from "../usana-dates";

describe("getUsanaWeekStart", () => {
  it("토요일 15시 이전 가입 → 이번 토요일 15시", () => {
    // 2026-05-09 (토) 14:30 → 같은 날 15:00
    const join = new Date(2026, 4, 9, 14, 30, 0);
    const result = getUsanaWeekStart(join);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(9);
    expect(result.getDay()).toBe(6); // 토요일
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(0);
  });

  it("토요일 15시 이후 가입 → 다음 토요일 15시", () => {
    // 2026-05-09 (토) 15:30 → 다음 주 토요일 2026-05-16 15:00
    const join = new Date(2026, 4, 9, 15, 30, 0);
    const result = getUsanaWeekStart(join);
    expect(result.getDate()).toBe(16);
    expect(result.getDay()).toBe(6);
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(0);
  });

  it("월요일 가입 → 해당 주 토요일 15시", () => {
    // 2026-05-04 (월) → 직전 토요일 2026-05-02 15:00 (USANA 주 시작일)
    const join = new Date(2026, 4, 4, 10, 0, 0);
    const result = getUsanaWeekStart(join);
    expect(result.getDate()).toBe(2);
    expect(result.getDay()).toBe(6);
    expect(result.getHours()).toBe(15);
  });

  it("토요일 정확히 15시 00분 → 이번 주 토요일 15시", () => {
    // 경계 케이스: 15:00 정각은 '이전' 으로 간주
    const join = new Date(2026, 4, 9, 15, 0, 0);
    const result = getUsanaWeekStart(join);
    expect(result.getDate()).toBe(9);
    expect(result.getHours()).toBe(15);
  });
});

describe("calcAoCycleDate", () => {
  it("특정 날짜 입력 시 5주차 일요일 반환", () => {
    // 첫 주문: 2026-05-04 (월)
    // 1주차 시작: 2026-05-02 (토) 15시 (주문일이 속한 USANA 주 시작)
    // 5주차 시작: 2026-05-02 + 28일 = 2026-05-30 (토)
    // 5주차 일요일: 2026-05-31
    const firstOrder = new Date(2026, 4, 4, 10, 0, 0);
    const ao = calcAoCycleDate(firstOrder);
    expect(ao.getFullYear()).toBe(2026);
    expect(ao.getMonth()).toBe(4); // 5월
    expect(ao.getDate()).toBe(31);
    expect(ao.getDay()).toBe(0); // 일요일
  });

  it("반환값이 항상 일요일(day===0)임을 검증 - 여러 입력", () => {
    const inputs = [
      new Date(2026, 0, 5),
      new Date(2026, 1, 14),
      new Date(2026, 2, 23),
      new Date(2026, 5, 1),
      new Date(2026, 8, 15),
      new Date(2026, 11, 31),
    ];
    for (const d of inputs) {
      const ao = calcAoCycleDate(d);
      expect(ao.getDay()).toBe(0);
    }
  });
});

describe("calcNextAoDates", () => {
  it("count=5 시 5개 배열 반환", () => {
    const firstAo = new Date(2026, 5, 7); // 2026-06-07 (일)
    const result = calcNextAoDates(firstAo, 5);
    expect(result).toHaveLength(5);
  });

  it("각 날짜가 정확히 4주(28일) 간격인지 검증", () => {
    const firstAo = new Date(2026, 5, 7);
    const result = calcNextAoDates(firstAo, 5);

    // 첫 항목은 firstAo + 28일
    const diffFirst = (result[0].getTime() - firstAo.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffFirst)).toBe(28);

    // 이후 각 항목 사이도 28일
    for (let i = 1; i < result.length; i++) {
      const diff = (result[i].getTime() - result[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(diff)).toBe(28);
    }
  });

  it("모두 일요일인지 검증 (firstAo가 일요일이면)", () => {
    const firstAo = new Date(2026, 5, 7); // 일요일
    expect(firstAo.getDay()).toBe(0);
    const result = calcNextAoDates(firstAo, 5);
    for (const d of result) {
      expect(d.getDay()).toBe(0);
    }
  });

  it("count=0 시 빈 배열", () => {
    const firstAo = new Date(2026, 5, 7);
    expect(calcNextAoDates(firstAo, 0)).toEqual([]);
  });
});

describe("calcMilestones", () => {
  it("반환 객체에 coupon4w, coupon8w, week13, week17 키 존재", () => {
    const joinDate = new Date(2026, 4, 4);
    const ms = calcMilestones(joinDate);
    expect(ms).toHaveProperty("coupon4w");
    expect(ms).toHaveProperty("coupon8w");
    expect(ms).toHaveProperty("week13");
    expect(ms).toHaveProperty("week17");
  });

  it("월요일 가입 → weekStart(토요일) 기준 28일 후가 coupon4w", () => {
    // 2026-05-04 (월) 가입 → weekStart = 2026-05-02 (토) 15시
    // coupon4w = 2026-05-02 + 28일 = 2026-05-30
    const joinDate = new Date(2026, 4, 4, 10, 0, 0);
    const weekStartDate = new Date(2026, 4, 2); // 날짜 부분만 (0시 기준 비교)
    const ms = calcMilestones(joinDate);
    const diff = (ms.coupon4w.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diff)).toBe(28);
    // 날짜 검증
    expect(ms.coupon4w.getFullYear()).toBe(2026);
    expect(ms.coupon4w.getMonth()).toBe(4); // 5월
    expect(ms.coupon4w.getDate()).toBe(30);
  });

  it("coupon8w = weekStart + 56일", () => {
    // 2026-05-04 (월) → weekStart = 2026-05-02 (토)
    // coupon8w = 2026-05-02 + 56일 = 2026-06-27
    const joinDate = new Date(2026, 4, 4, 10, 0, 0);
    const weekStartDate = new Date(2026, 4, 2);
    const ms = calcMilestones(joinDate);
    const diff = (ms.coupon8w.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diff)).toBe(56);
  });

  it("week13 = weekStart + 91일", () => {
    // 2026-05-04 (월) → weekStart = 2026-05-02 (토)
    const joinDate = new Date(2026, 4, 4, 10, 0, 0);
    const weekStartDate = new Date(2026, 4, 2);
    const ms = calcMilestones(joinDate);
    const diff = (ms.week13.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diff)).toBe(91);
  });

  it("토요일 15시 이전 가입 → 같은 주 토요일이 weekStart", () => {
    // 2026-05-09 (토) 14:30 가입 → weekStart = 2026-05-09 (토) 15시
    // coupon4w = 2026-05-09 + 28 = 2026-06-06
    const joinDate = new Date(2026, 4, 9, 14, 30, 0);
    const ms = calcMilestones(joinDate);
    expect(ms.coupon4w.getDate()).toBe(6);
    expect(ms.coupon4w.getMonth()).toBe(5); // 6월
  });

  it("토요일 15시 이후 가입(afterCutoff=true) → 다음 주 토요일이 weekStart", () => {
    // afterCutoff=true → weekStart = 2026-05-16 (토) 15시
    // coupon4w = 2026-05-16 + 28 = 2026-06-13
    const joinDate = new Date(2026, 4, 9, 15, 30, 0);
    const ms = calcMilestones(joinDate, true);
    expect(ms.coupon4w.getDate()).toBe(13);
    expect(ms.coupon4w.getMonth()).toBe(5); // 6월
  });
});
