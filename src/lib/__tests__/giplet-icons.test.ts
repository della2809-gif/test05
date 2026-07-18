import { describe, expect, it } from "vitest";
import { getIconByName, isImageIconValue } from "../giplet-icons";

describe("isImageIconValue", () => {
  it("http/https URL은 이미지로 판별한다", () => {
    expect(isImageIconValue("https://example.com/giplet-icons/abc.png")).toBe(true);
    expect(isImageIconValue("http://example.com/x.png")).toBe(true);
    expect(isImageIconValue("  https://example.com/x.png  ")).toBe(true);
  });

  it("Lucide 이름·빈값은 이미지가 아니다", () => {
    expect(isImageIconValue("Stethoscope")).toBe(false);
    expect(isImageIconValue(null)).toBe(false);
    expect(isImageIconValue(undefined)).toBe(false);
    expect(isImageIconValue("")).toBe(false);
    expect(isImageIconValue("javascript:alert(1)")).toBe(false);
  });
});

describe("getIconByName", () => {
  it("등록된 Lucide 이름은 컴포넌트를 반환한다", () => {
    expect(getIconByName("Stethoscope")).not.toBeNull();
  });

  it("URL·미등록 이름·빈값은 null을 반환한다", () => {
    expect(getIconByName("https://example.com/x.png")).toBeNull();
    expect(getIconByName("NotARealIcon")).toBeNull();
    expect(getIconByName(null)).toBeNull();
  });
});
