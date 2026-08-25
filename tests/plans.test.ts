import { describe, expect, it } from "vitest";
import { addMonths, DEFAULT_PLANS } from "@/lib/plans";

describe("subscription plans", () => {
  it("applies the intended long-term discounts to base and AI", () => {
    const annual = DEFAULT_PLANS.find((plan) => plan.code === "ANNUAL")!;
    expect(annual.basePriceToman).toBe(300_000 * 12 * 0.8);
    expect(annual.aiPriceToman).toBe(200_000 * 12 * 0.8);
  });

  it("preserves end-of-month semantics without overflowing", () => {
    expect(addMonths(new Date("2026-01-31T12:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
  });

  it("offers four billing periods", () => {
    expect(DEFAULT_PLANS.map((plan) => plan.months)).toEqual([1, 3, 6, 12]);
  });
});
