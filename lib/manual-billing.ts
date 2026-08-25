export function manualSubscriptionWindow(
  now: Date,
  currentEndsAt: Date | null | undefined,
  durationDays: number,
) {
  if (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 3650)
    throw new Error("Invalid manual subscription duration.");
  const startsAt = currentEndsAt && currentEndsAt > now ? currentEndsAt : now;
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationDays * 86_400_000),
  };
}

export function manualSubscriptionAmounts(
  approvedAmountToman: number,
  requestedAiAmountToman: number,
  aiEnabled: boolean,
) {
  if (!Number.isSafeInteger(approvedAmountToman) || approvedAmountToman < 0)
    throw new Error("Invalid approved amount.");
  const aiAmountToman = aiEnabled
    ? Math.min(Math.max(0, requestedAiAmountToman), approvedAmountToman)
    : 0;
  return {
    baseAmountToman: approvedAmountToman - aiAmountToman,
    aiAmountToman,
    totalAmountToman: approvedAmountToman,
  };
}
