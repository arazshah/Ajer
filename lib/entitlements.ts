import { db } from "@/lib/db";

export async function getAgencyEntitlement(agencyId: string) {
  const now = new Date();
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { status: true, trialEndsAt: true },
  });
  if (!agency || agency.status === "SUSPENDED") {
    return { active: false, aiEnabled: false, source: "none" as const };
  }
  if (agency.trialEndsAt > now) {
    return {
      active: true,
      aiEnabled: true,
      source: "trial" as const,
      endsAt: agency.trialEndsAt,
    };
  }
  const subscription = await db.subscription.findFirst({
    where: {
      agencyId,
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
  });
  return subscription
    ? {
        active: true,
        aiEnabled: subscription.aiEnabled,
        source: "subscription" as const,
        endsAt: subscription.endsAt,
      }
    : { active: false, aiEnabled: false, source: "none" as const };
}
