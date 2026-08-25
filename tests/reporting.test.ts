import { describe, expect, it } from "vitest";
import {
  buildSalesFunnel,
  buildSixMonthTrend,
  conversionRate,
  rankPerformance,
} from "@/lib/reporting";

describe("operational reports", () => {
  it("uses actual records instead of demo constants", () => {
    const now = new Date("2026-08-24T12:00:00Z");
    const result = buildSixMonthTrend(
      [{ createdAt: now }, { createdAt: now }],
      [{ createdAt: now }],
      now,
    );
    expect(result.at(-1)).toMatchObject({ فایل: 2, معامله: 1 });
    expect(result).toHaveLength(6);
  });

  it("calculates a deterministic sales funnel", () => {
    expect(
      buildSalesFunnel([
        { key: "lead", label: "سرنخ", value: 20 },
        { key: "visit", label: "بازدید", value: 10 },
        { key: "deal", label: "معامله", value: 3 },
      ]),
    ).toMatchObject([
      { fromPrevious: 100, fromStart: 100 },
      { fromPrevious: 50, fromStart: 50 },
      { fromPrevious: 30, fromStart: 15 },
    ]);
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(1, 0)).toBe(0);
  });

  it("ranks staff by completed deals and then visits", () => {
    expect(
      rankPerformance([
        { name: "الف", completedDeals: 1, visits: 4 },
        { name: "ب", completedDeals: 2, visits: 1 },
        { name: "پ", completedDeals: 1, visits: 7 },
      ]).map((item) => item.name),
    ).toEqual(["ب", "پ", "الف"]);
  });
});
