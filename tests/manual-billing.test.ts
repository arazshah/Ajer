import { describe, expect, it } from "vitest";
import {
  manualSubscriptionAmounts,
  manualSubscriptionWindow,
} from "@/lib/manual-billing";

describe("manual billing approval", () => {
  it("starts immediately for an expired office", () => {
    const now = new Date("2026-08-25T00:00:00.000Z");
    const result = manualSubscriptionWindow(now, null, 30);
    expect(result.startsAt).toEqual(now);
    expect(result.endsAt).toEqual(new Date("2026-09-24T00:00:00.000Z"));
  });

  it("queues renewal after an existing subscription", () => {
    const now = new Date("2026-08-25T00:00:00.000Z");
    const currentEndsAt = new Date("2026-09-01T00:00:00.000Z");
    const result = manualSubscriptionWindow(now, currentEndsAt, 10);
    expect(result.startsAt).toEqual(currentEndsAt);
    expect(result.endsAt).toEqual(new Date("2026-09-11T00:00:00.000Z"));
  });

  it("keeps approved amount allocation consistent", () => {
    expect(manualSubscriptionAmounts(500_000, 200_000, true)).toEqual({
      baseAmountToman: 300_000,
      aiAmountToman: 200_000,
      totalAmountToman: 500_000,
    });
    expect(manualSubscriptionAmounts(300_000, 200_000, false)).toEqual({
      baseAmountToman: 300_000,
      aiAmountToman: 0,
      totalAmountToman: 300_000,
    });
  });
});
