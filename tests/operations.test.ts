import { describe, expect, it } from "vitest";
import {
  canTransitionOffer,
  canTransitionVisit,
  safeParameters,
  visitReminderTimes,
} from "@/lib/operations";

describe("sales operations", () => {
  it("enforces offer and visit state machines", () => {
    expect(canTransitionOffer("SUBMITTED", "COUNTERED")).toBe(true);
    expect(canTransitionOffer("ACCEPTED", "REJECTED")).toBe(false);
    expect(canTransitionVisit("SCHEDULED", "CONFIRMED")).toBe(true);
    expect(canTransitionVisit("COMPLETED", "IN_PROGRESS")).toBe(false);
  });

  it("only schedules future visit reminders", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    expect(
      visitReminderTimes(new Date("2026-08-26T10:00:00Z"), now),
    ).toHaveLength(2);
    expect(
      visitReminderTimes(new Date("2026-08-24T11:00:00Z"), now),
    ).toHaveLength(0);
  });

  it("parses only valid SMS parameters", () => {
    expect(safeParameters('[{"name":"NAME","value":"آراز"}]')).toEqual([
      { name: "NAME", value: "آراز" },
    ]);
    expect(safeParameters("not-json")).toEqual([]);
  });
});
