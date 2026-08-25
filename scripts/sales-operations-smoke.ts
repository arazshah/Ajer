import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const agency = await db.agency.findFirst({ include: { users: true } });
  const user =
    agency?.users.find((item) => item.role === "ADMIN") || agency?.users[0];
  if (!agency || !user)
    throw new Error("ابتدا bootstrap یا seed را اجرا کنید.");
  const suffix = Date.now().toString().slice(-8);
  const ids: {
    owner?: string;
    applicant?: string;
    property?: string;
    visit?: string;
    offer?: string;
  } = {};
  try {
    const owner = await db.contact.create({
      data: {
        agencyId: agency.id,
        type: "OWNER",
        fullName: "مالک تست عملیات",
        mobile: `091${suffix}`.slice(0, 11),
        assignedAgentId: user.id,
      },
    });
    ids.owner = owner.id;
    const applicant = await db.contact.create({
      data: {
        agencyId: agency.id,
        type: "APPLICANT",
        fullName: "متقاضی تست عملیات",
        mobile: `092${suffix}`.slice(0, 11),
        assignedAgentId: user.id,
      },
    });
    ids.applicant = applicant.id;
    const property = await db.property.create({
      data: {
        agencyId: agency.id,
        assignedAgentId: user.id,
        ownerId: owner.id,
        code: `OPS-${suffix}`,
        title: "ملک تست گرم عملیات فروش",
        description: "داده موقت تست",
        transactionType: "SALE",
        propertyType: "APARTMENT",
        status: "ACTIVE",
        city: agency.city,
        district: "تست",
        neighborhood: "تست",
        address: `نشانی تست ${suffix}`,
        latitude: 35.7,
        longitude: 51.4,
        area: 100,
        fingerprint: randomUUID(),
      },
    });
    ids.property = property.id;
    const scheduledAt = new Date(Date.now() + 48 * 3_600_000);
    const visit = await db.visit.create({
      data: {
        agencyId: agency.id,
        propertyId: property.id,
        applicantId: applicant.id,
        assignedAgentId: user.id,
        scheduledAt,
        status: "COMPLETED",
        checkedInAt: new Date(),
        completedAt: new Date(),
        feedback: "بازخورد تست",
        applicantRating: 5,
        interestLevel: 5,
      },
    });
    ids.visit = visit.id;
    const task = await db.workTask.create({
      data: {
        agencyId: agency.id,
        assignedToId: user.id,
        createdById: user.id,
        contactId: applicant.id,
        propertyId: property.id,
        visitId: visit.id,
        title: "پیگیری تست گرم",
        priority: "HIGH",
        dueAt: new Date(Date.now() + 3_600_000),
      },
    });
    const offer = await db.salesOffer.create({
      data: {
        agencyId: agency.id,
        propertyId: property.id,
        applicantId: applicant.id,
        visitId: visit.id,
        createdById: user.id,
        status: "SUBMITTED",
        round: 1,
        priceToman: 5_000_000_000n,
        submittedAt: new Date(),
      },
    });
    ids.offer = offer.id;
    const deal = await db.$transaction(async (tx) => {
      await tx.salesOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      const created = await tx.deal.create({
        data: {
          agencyId: agency.id,
          propertyId: property.id,
          applicantId: applicant.id,
          ownerId: owner.id,
          assignedAgentId: user.id,
          type: "SALE",
          status: "AGREED",
          agreedPrice: offer.priceToman,
        },
      });
      await tx.dealStatusHistory.create({
        data: {
          dealId: created.id,
          changedById: user.id,
          toStatus: "AGREED",
          note: "پذیرش پیشنهاد تست گرم",
        },
      });
      await tx.property.update({
        where: { id: property.id },
        data: { status: "RESERVED" },
      });
      return created;
    });
    await db.smsDispatch.create({
      data: {
        agencyId: agency.id,
        mobile: applicant.mobile,
        templateKey: "VISIT_REMINDER",
        parametersJson: "[]",
        relatedType: "Visit",
        relatedId: visit.id,
        scheduledFor: scheduledAt,
      },
    });
    const [savedVisit, savedTask, savedOffer, savedDeal, savedProperty] =
      await Promise.all([
        db.visit.findUnique({ where: { id: visit.id } }),
        db.workTask.findUnique({ where: { id: task.id } }),
        db.salesOffer.findUnique({ where: { id: offer.id } }),
        db.deal.findUnique({ where: { id: deal.id } }),
        db.property.findUnique({ where: { id: property.id } }),
      ]);
    if (
      savedVisit?.status !== "COMPLETED" ||
      savedTask?.priority !== "HIGH" ||
      savedOffer?.status !== "ACCEPTED" ||
      savedDeal?.status !== "AGREED" ||
      savedProperty?.status !== "RESERVED"
    )
      throw new Error("جریان عملیات فروش کامل نشد.");
    console.log(
      "Sales operations smoke test passed: visit → feedback → task → offer → accepted deal → reservation → SMS queue.",
    );
  } finally {
    if (ids.property) {
      await db.smsDispatch.deleteMany({
        where: {
          agencyId: agency.id,
          OR: [
            ...(ids.visit
              ? [{ relatedType: "Visit", relatedId: ids.visit }]
              : []),
            ...(ids.offer
              ? [{ relatedType: "SalesOffer", relatedId: ids.offer }]
              : []),
          ],
        },
      });
      await db.deal.deleteMany({ where: { propertyId: ids.property } });
      await db.salesOffer.deleteMany({ where: { propertyId: ids.property } });
      await db.workTask.deleteMany({ where: { propertyId: ids.property } });
      await db.visit.deleteMany({ where: { propertyId: ids.property } });
      await db.property.deleteMany({ where: { id: ids.property } });
    }
    if (ids.applicant)
      await db.contact.deleteMany({ where: { id: ids.applicant } });
    if (ids.owner) await db.contact.deleteMany({ where: { id: ids.owner } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
