"use server";

import type {
  OfferStatus,
  Priority,
  TaskStatus,
  VisitStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTime, parseMoney, toEnglishDigits } from "@/lib/format";
import {
  canTransitionOffer,
  canTransitionVisit,
  visitReminderTimes,
} from "@/lib/operations";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { parseJalaliDateTime } from "@/lib/jalali";

function value(fd: FormData, key: string, max = 2_000) {
  return String(fd.get(key) || "")
    .trim()
    .slice(0, max);
}

function dateValue(fd: FormData, key: string) {
  const raw = value(fd, key, 40);
  if (!raw) return null;
  return parseJalaliDateTime(raw) ?? undefined;
}

function optionalMoney(fd: FormData, key: string) {
  try {
    return parseMoney(value(fd, key, 80));
  } catch {
    return undefined;
  }
}

export async function createOperationalVisit(fd: FormData) {
  const user = await requirePermission("visits.manage");
  const canManageAll = await hasPermission(user, "visits.manage_all");
  const propertyId = value(fd, "propertyId", 80);
  const applicantId = value(fd, "applicantId", 80);
  const requestedAgentId = value(fd, "assignedAgentId", 80) || user.id;
  const assignedAgentId = canManageAll ? requestedAgentId : user.id;
  const scheduledAt = dateValue(fd, "scheduledAt");
  if (!scheduledAt || scheduledAt.getTime() < Date.now() - 3_600_000)
    redirect("/visits?error=date");
  const [property, applicant, assignedAgent] = await Promise.all([
    db.property.findFirst({
      where: { id: propertyId, agencyId: user.agencyId },
    }),
    db.contact.findFirst({
      where: { id: applicantId, agencyId: user.agencyId },
    }),
    db.user.findFirst({
      where: { id: assignedAgentId, agencyId: user.agencyId, isActive: true },
    }),
  ]);
  if (!property || !applicant || !assignedAgent)
    redirect("/visits?error=reference");

  const visit = await db.$transaction(async (tx) => {
    const created = await tx.visit.create({
      data: {
        agencyId: user.agencyId,
        propertyId,
        applicantId,
        assignedAgentId,
        scheduledAt,
        notes: value(fd, "notes"),
      },
    });
    await tx.notification.create({
      data: {
        userId: assignedAgentId,
        title: "بازدید جدید",
        message: `${applicant.fullName} برای ${property.code} در ${formatDateTime(scheduledAt)}`,
        link: "/visits",
      },
    });
    if (!applicant.doNotContact) {
      for (const reminder of visitReminderTimes(scheduledAt)) {
        await tx.smsDispatch.create({
          data: {
            agencyId: user.agencyId,
            mobile: applicant.mobile,
            templateKey: "VISIT_REMINDER",
            parametersJson: JSON.stringify([
              { name: "NAME", value: applicant.fullName },
              { name: "DATE", value: formatDateTime(scheduledAt) },
              { name: "PROPERTY", value: property.code },
            ]),
            relatedType: "Visit",
            relatedId: created.id,
            scheduledFor: reminder.at,
          },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "Visit",
        entityId: created.id,
        action: "CREATE_OPERATIONAL_VISIT",
      },
    });
    return created;
  });
  revalidatePath("/visits");
  redirect(`/visits?created=${visit.id}`);
}

export async function updateVisitOutcome(visitId: string, fd: FormData) {
  const user = await requirePermission("visits.manage");
  const canManageAll = await hasPermission(user, "visits.manage_all");
  const visit = await db.visit.findFirst({
    where: {
      id: visitId,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
  });
  if (!visit) return;
  const status = value(fd, "status", 30) as VisitStatus;
  if (!canTransitionVisit(visit.status, status))
    redirect("/visits?error=transition");
  const ratingRaw = toEnglishDigits(value(fd, "applicantRating", 2));
  const interestRaw = toEnglishDigits(value(fd, "interestLevel", 2));
  const applicantRating = ratingRaw ? Number(ratingRaw) : null;
  const interestLevel = interestRaw ? Number(interestRaw) : null;
  if (
    (applicantRating !== null &&
      (!Number.isInteger(applicantRating) ||
        applicantRating < 1 ||
        applicantRating > 5)) ||
    (interestLevel !== null &&
      (!Number.isInteger(interestLevel) ||
        interestLevel < 1 ||
        interestLevel > 5))
  )
    redirect("/visits?error=rating");
  const followUpAt = dateValue(fd, "followUpAt");
  if (followUpAt === undefined) redirect("/visits?error=date");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id: visit.id },
      data: {
        status,
        feedback: value(fd, "feedback") || null,
        ownerFeedback: value(fd, "ownerFeedback") || null,
        applicantRating,
        interestLevel,
        followUpAt,
        checkedInAt:
          status === "IN_PROGRESS" || status === "COMPLETED"
            ? visit.checkedInAt || now
            : visit.checkedInAt,
        completedAt: status === "COMPLETED" ? now : null,
      },
    });
    if (followUpAt) {
      await tx.workTask.create({
        data: {
          agencyId: user.agencyId,
          assignedToId: visit.assignedAgentId,
          createdById: user.id,
          contactId: visit.applicantId,
          propertyId: visit.propertyId,
          visitId: visit.id,
          title: "پیگیری نتیجه بازدید",
          description: value(fd, "feedback") || null,
          priority: interestLevel && interestLevel >= 4 ? "HIGH" : "NORMAL",
          dueAt: followUpAt,
        },
      });
    }
    if (["CANCELLED", "NO_SHOW"].includes(status)) {
      await tx.smsDispatch.updateMany({
        where: { relatedType: "Visit", relatedId: visit.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "Visit",
        entityId: visit.id,
        action: `VISIT_${status}`,
      },
    });
  });
  revalidatePath("/visits");
  revalidatePath("/tasks");
}

export async function createSalesOffer(fd: FormData) {
  const user = await requirePermission("deals.create");
  const propertyId = value(fd, "propertyId", 80);
  const applicantId = value(fd, "applicantId", 80);
  const visitId = value(fd, "visitId", 80) || null;
  const [property, applicant, visit] = await Promise.all([
    db.property.findFirst({
      where: { id: propertyId, agencyId: user.agencyId },
    }),
    db.contact.findFirst({
      where: { id: applicantId, agencyId: user.agencyId },
    }),
    visitId
      ? db.visit.findFirst({ where: { id: visitId, agencyId: user.agencyId } })
      : null,
  ]);
  if (
    !property ||
    !applicant ||
    (visitId &&
      (!visit ||
        visit.propertyId !== propertyId ||
        visit.applicantId !== applicantId))
  )
    redirect("/offers?error=reference");
  const priceToman = optionalMoney(fd, "priceToman");
  const depositToman = optionalMoney(fd, "depositToman");
  const monthlyRentToman = optionalMoney(fd, "monthlyRentToman");
  if (
    priceToman === undefined ||
    depositToman === undefined ||
    monthlyRentToman === undefined ||
    (!priceToman && !depositToman && !monthlyRentToman)
  )
    redirect("/offers?error=amount");
  const expiresAt = dateValue(fd, "expiresAt");
  if (expiresAt === undefined || (expiresAt && expiresAt <= new Date()))
    redirect("/offers?error=date");
  const last = await db.salesOffer.findFirst({
    where: { agencyId: user.agencyId, propertyId, applicantId },
    orderBy: { round: "desc" },
    select: { round: true },
  });
  const offer = await db.salesOffer.create({
    data: {
      agencyId: user.agencyId,
      propertyId,
      applicantId,
      visitId,
      createdById: user.id,
      status: "SUBMITTED",
      round: (last?.round || 0) + 1,
      priceToman,
      depositToman,
      monthlyRentToman,
      terms: value(fd, "terms") || null,
      expiresAt,
      submittedAt: new Date(),
    },
  });
  await db.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      entityType: "SalesOffer",
      entityId: offer.id,
      action: "SUBMIT_OFFER",
    },
  });
  revalidatePath("/offers");
  redirect(`/offers?created=${offer.id}`);
}

export async function updateOfferStatus(
  offerId: string,
  target: "COUNTERED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN",
  fd: FormData,
) {
  const user = await requirePermission("deals.manage");
  const canManageAll = await hasPermission(user, "deals.manage_all");
  const offer = await db.salesOffer.findFirst({
    where: {
      id: offerId,
      agencyId: user.agencyId,
      ...(!canManageAll ? { createdById: user.id } : {}),
    },
    include: { property: true, applicant: true },
  });
  if (!offer || !canTransitionOffer(offer.status, target as OfferStatus))
    return;
  if (offer.expiresAt && offer.expiresAt <= new Date()) {
    await db.salesOffer.update({
      where: { id: offer.id },
      data: { status: "EXPIRED", respondedAt: new Date() },
    });
    revalidatePath("/offers");
    return;
  }
  const responseNote = value(fd, "responseNote") || null;
  await db.$transaction(async (tx) => {
    await tx.salesOffer.update({
      where: { id: offer.id },
      data: { status: target, responseNote, respondedAt: new Date() },
    });
    if (target === "ACCEPTED") {
      const dealType =
        offer.property.transactionType === "SALE"
          ? "SALE"
          : offer.property.transactionType === "PRESALE"
            ? "PRESALE"
            : "RENT";
      const existing = await tx.deal.findFirst({
        where: {
          agencyId: user.agencyId,
          propertyId: offer.propertyId,
          applicantId: offer.applicantId,
          status: { in: ["NEGOTIATION", "AGREED"] },
        },
      });
      const deal = existing
        ? await tx.deal.update({
            where: { id: existing.id },
            data: {
              status: "AGREED",
              agreedPrice: offer.priceToman,
              depositAmount: offer.depositToman,
              monthlyRent: offer.monthlyRentToman,
            },
          })
        : await tx.deal.create({
            data: {
              agencyId: user.agencyId,
              propertyId: offer.propertyId,
              applicantId: offer.applicantId,
              ownerId: offer.property.ownerId,
              assignedAgentId: offer.property.assignedAgentId,
              type: dealType,
              status: "AGREED",
              agreedPrice: offer.priceToman,
              depositAmount: offer.depositToman,
              monthlyRent: offer.monthlyRentToman,
              notes: `ایجادشده از پیشنهاد دور ${offer.round}`,
            },
          });
      await tx.dealStatusHistory.create({
        data: {
          dealId: deal.id,
          changedById: user.id,
          fromStatus: existing?.status || null,
          toStatus: "AGREED",
          note: `پذیرش پیشنهاد دور ${offer.round}`,
        },
      });
      await tx.property.update({
        where: { id: offer.propertyId },
        data: { status: "RESERVED" },
      });
      await tx.contact.update({
        where: { id: offer.applicantId },
        data: { leadStatus: "NEGOTIATING" },
      });
    }
    if (!offer.applicant.doNotContact) {
      await tx.smsDispatch.create({
        data: {
          agencyId: user.agencyId,
          mobile: offer.applicant.mobile,
          templateKey: "OFFER_STATUS",
          parametersJson: JSON.stringify([
            { name: "NAME", value: offer.applicant.fullName },
            { name: "STATUS", value: target },
            { name: "PROPERTY", value: offer.property.code },
          ]),
          relatedType: "SalesOffer",
          relatedId: offer.id,
          scheduledFor: new Date(),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "SalesOffer",
        entityId: offer.id,
        action: `OFFER_${target}`,
      },
    });
  });
  revalidatePath("/offers");
  revalidatePath("/deals");
  revalidatePath(`/properties/${offer.propertyId}`);
}

export async function createWorkTask(fd: FormData) {
  const user = await requirePermission("activities.manage");
  const canManageAll = await hasPermission(user, "activities.manage_all");
  const requestedAssignee = value(fd, "assignedToId", 80) || user.id;
  const assignedToId = canManageAll ? requestedAssignee : user.id;
  const contactId = value(fd, "contactId", 80) || null;
  const propertyId = value(fd, "propertyId", 80) || null;
  const dueAt = dateValue(fd, "dueAt");
  const priority = value(fd, "priority", 20) as Priority;
  const title = value(fd, "title", 160);
  if (
    title.length < 3 ||
    !dueAt ||
    !["LOW", "NORMAL", "HIGH"].includes(priority)
  )
    redirect("/tasks?error=invalid");
  const [assignee, contact, property] = await Promise.all([
    db.user.findFirst({
      where: { id: assignedToId, agencyId: user.agencyId, isActive: true },
    }),
    contactId
      ? db.contact.findFirst({
          where: { id: contactId, agencyId: user.agencyId },
        })
      : null,
    propertyId
      ? db.property.findFirst({
          where: { id: propertyId, agencyId: user.agencyId },
        })
      : null,
  ]);
  if (!assignee || (contactId && !contact) || (propertyId && !property))
    redirect("/tasks?error=reference");
  const task = await db.workTask.create({
    data: {
      agencyId: user.agencyId,
      assignedToId,
      createdById: user.id,
      contactId,
      propertyId,
      title,
      description: value(fd, "description") || null,
      priority,
      dueAt,
    },
  });
  await db.notification.create({
    data: {
      userId: assignedToId,
      title: "وظیفه جدید",
      message: `${task.title} · سررسید ${formatDateTime(dueAt)}`,
      link: "/tasks",
    },
  });
  revalidatePath("/tasks");
  redirect(`/tasks?created=${task.id}`);
}

export async function updateWorkTaskStatus(
  taskId: string,
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
) {
  const user = await requirePermission("activities.manage");
  const canManageAll = await hasPermission(user, "activities.manage_all");
  const task = await db.workTask.findFirst({
    where: {
      id: taskId,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedToId: user.id } : {}),
    },
  });
  if (!task) return;
  await db.workTask.update({
    where: { id: task.id },
    data: {
      status: status as TaskStatus,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
  revalidatePath("/tasks");
}
