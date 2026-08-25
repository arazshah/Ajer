import "server-only";

import { db } from "@/lib/db";
import { safeParameters, smsRetryDelayMinutes } from "@/lib/operations";
import { getPlatformSettings } from "@/lib/platform-settings";
import { sendSmsTemplate } from "@/lib/sms-ir";

export async function processOperationsQueue(now = new Date()) {
  const reminderDeadline = new Date(now.getTime() + 30 * 60_000);
  const staleProcessing = new Date(now.getTime() - 10 * 60_000);
  const [tasks, expiredOffers, dispatches, settings] = await Promise.all([
    db.workTask.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueAt: { lte: reminderDeadline },
        reminderSentAt: null,
      },
      take: 100,
    }),
    db.salesOffer.findMany({
      where: {
        status: { in: ["SUBMITTED", "COUNTERED"] },
        expiresAt: { lte: now },
      },
      select: { id: true },
      take: 100,
    }),
    db.smsDispatch.findMany({
      where: {
        attempts: { lt: 3 },
        OR: [
          {
            status: "PENDING",
            scheduledFor: { lte: now },
            nextAttemptAt: null,
          },
          { status: "PENDING", nextAttemptAt: { lte: now } },
          {
            status: "PROCESSING",
            processingStartedAt: { lte: staleProcessing },
          },
        ],
      },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    }),
    getPlatformSettings(),
  ]);

  if (tasks.length) {
    await db.$transaction(async (tx) => {
      for (const task of tasks) {
        await tx.notification.create({
          data: {
            userId: task.assignedToId,
            title: task.dueAt < now ? "وظیفه عقب‌افتاده" : "یادآوری وظیفه",
            message: task.title,
            link: "/tasks",
          },
        });
        await tx.workTask.update({
          where: { id: task.id },
          data: { reminderSentAt: now },
        });
      }
    });
  }
  if (expiredOffers.length) {
    await db.salesOffer.updateMany({
      where: { id: { in: expiredOffers.map(({ id }) => id) } },
      data: { status: "EXPIRED", respondedAt: now },
    });
  }

  const templateIds: Record<string, number | undefined> = {
    VISIT_REMINDER: Number(settings.sms.visitTemplateId) || undefined,
    OFFER_STATUS: Number(settings.sms.offerTemplateId) || undefined,
  };
  let sent = 0;
  let failed = 0;
  for (const dispatch of dispatches) {
    const claimed = await db.smsDispatch.updateMany({
      where: {
        id: dispatch.id,
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            processingStartedAt: { lte: staleProcessing },
          },
        ],
      },
      data: { status: "PROCESSING", processingStartedAt: now },
    });
    if (!claimed.count) continue;
    try {
      const result = await sendSmsTemplate(
        dispatch.mobile,
        templateIds[dispatch.templateKey],
        safeParameters(dispatch.parametersJson),
        {
          agencyId: dispatch.agencyId,
          entityType: dispatch.relatedType || "SmsDispatch",
          entityId: dispatch.relatedId || dispatch.id,
        },
      );
      const attempts = dispatch.attempts + 1;
      if (result.sent) sent += 1;
      else failed += 1;
      await db.smsDispatch.update({
        where: { id: dispatch.id },
        data: {
          attempts,
          status: result.sent ? "SENT" : attempts >= 3 ? "FAILED" : "PENDING",
          processingStartedAt: null,
          nextAttemptAt:
            result.sent || attempts >= 3
              ? null
              : new Date(
                  now.getTime() + smsRetryDelayMinutes(attempts) * 60_000,
                ),
          providerMessageId: result.sent
            ? result.providerMessageId
            : dispatch.providerMessageId,
          sentAt: result.sent ? now : null,
          lastError: result.sent ? null : result.reason,
        },
      });
    } catch (error) {
      failed += 1;
      const attempts = dispatch.attempts + 1;
      await db.smsDispatch.update({
        where: { id: dispatch.id },
        data: {
          attempts,
          status: attempts >= 3 ? "FAILED" : "PENDING",
          processingStartedAt: null,
          nextAttemptAt:
            attempts >= 3
              ? null
              : new Date(
                  now.getTime() + smsRetryDelayMinutes(attempts) * 60_000,
                ),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "unknown-error",
        },
      });
    }
  }
  return {
    tasksReminded: tasks.length,
    offersExpired: expiredOffers.length,
    smsSent: sent,
    smsFailed: failed,
  };
}
