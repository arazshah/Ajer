import type { OfferStatus, VisitStatus } from "@prisma/client";

const offerTransitions: Record<OfferStatus, readonly OfferStatus[]> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["COUNTERED", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
  COUNTERED: ["COUNTERED", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

const visitTransitions: Record<VisitStatus, readonly VisitStatus[]> = {
  SCHEDULED: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionOffer(from: OfferStatus, to: OfferStatus) {
  return offerTransitions[from].includes(to);
}

export function canTransitionVisit(from: VisitStatus, to: VisitStatus) {
  return visitTransitions[from].includes(to);
}

export function visitReminderTimes(scheduledAt: Date, now = new Date()) {
  return [24, 2]
    .map((hours) => ({
      hours,
      at: new Date(scheduledAt.getTime() - hours * 3_600_000),
    }))
    .filter(({ at }) => at > now);
}

export function safeParameters(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { name: string; value: string } =>
          typeof item?.name === "string" && typeof item?.value === "string",
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function smsRetryDelayMinutes(attempts: number) {
  return [5, 20, 60][Math.max(0, Math.min(2, attempts - 1))];
}
