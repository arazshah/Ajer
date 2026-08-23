import { describe, expect, it } from "vitest";
import {
  formatMoney,
  normalizeMobile,
  parseMoney,
  toEnglishDigits,
  toPersianDigits,
} from "@/lib/format";
import { haversineKm } from "@/lib/geo";
describe("قالب‌بندی", () => {
  it("money roundtrip", () => {
    expect(parseMoney("۲٬۵۰۰٬۰۰۰")).toBe(2500000n);
    expect(formatMoney(2500000n)).toContain("تومان");
  });
  it("digits", () => {
    expect(toEnglishDigits("۱۲۳")).toBe("123");
    expect(toPersianDigits(123)).toBe("۱۲۳");
  });
  it("normalizes Iranian mobiles", () => {
    expect(normalizeMobile("+98 912-345-6789")).toBe("09123456789");
    expect(normalizeMobile("۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
  });
});
describe("distance", () => {
  it("returns zero for same point", () =>
    expect(haversineKm(37.5527, 45.0761, 37.5527, 45.0761)).toBe(0));
  it("calculates short distances", () =>
    expect(haversineKm(37.5527, 45.0761, 37.5627, 45.0761)).toBeCloseTo(
      1.11,
      1,
    ));
});
