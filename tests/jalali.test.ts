import { describe, expect, it } from "vitest";
import {
  formatJalaliDateInput,
  formatJalaliDateTimeInput,
  parseJalaliDate,
  parseJalaliDateTime,
} from "@/lib/jalali";

describe("Jalali dates", () => {
  it("round-trips a Persian date", () => {
    const parsed = parseJalaliDate("۱۴۰۵/۰۶/۰۲");
    expect(parsed).not.toBeNull();
    expect(formatJalaliDateInput(parsed!)).toBe("1405/06/02");
  });

  it("round-trips Tehran local time", () => {
    const parsed = parseJalaliDateTime("1405-06-02 14:30");
    expect(parsed).not.toBeNull();
    expect(formatJalaliDateTimeInput(parsed!)).toBe("1405/06/02 14:30");
  });

  it("validates Esfand leap days", () => {
    expect(parseJalaliDate("1403/12/30")).not.toBeNull();
    expect(parseJalaliDate("1404/12/30")).toBeNull();
  });

  it("rejects Gregorian and malformed input", () => {
    expect(parseJalaliDate("2026-08-24")).toBeNull();
    expect(parseJalaliDateTime("1405/06/02")).toBeNull();
  });
});
