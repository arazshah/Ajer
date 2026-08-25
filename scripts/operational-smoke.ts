import { PrismaClient } from "@prisma/client";
import { calculateAllocation, calculateCommission } from "../lib/commission";

const db = new PrismaClient();
let dealId: string | undefined;
let policyId: string | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const agency = await db.agency.findFirst({
    include: {
      users: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      properties: {
        include: { owner: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      contacts: { orderBy: { createdAt: "asc" } },
    },
  });
  assert(agency, "برای تست عملیاتی ابتدا داده نمونه را seed کنید.");
  const agent = agency.users[0];
  const property = agency.properties[0];
  const applicant = agency.contacts.find(
    (item) => item.id !== property?.ownerId,
  );
  assert(
    agent && property && applicant,
    "کاربر، ملک و متقاضی کافی برای تست وجود ندارد.",
  );

  const marker = `SMOKE-${Date.now()}`;
  const policy = await db.commissionPolicy.create({
    data: {
      agencyId: agency.id,
      name: `تعرفه تست خودکار ${marker}`,
      transactionType: property.transactionType,
      calculationBase: "AGREED_PRICE",
      ownerRateBasisPoints: 500,
      applicantRateBasisPoints: 500,
      taxRateBasisPoints: 1_000,
    },
  });
  policyId = policy.id;

  const baseToman = 10_000_000_000n;
  const result = calculateCommission({ baseToman, policy });
  const deal = await db.deal.create({
    data: {
      agencyId: agency.id,
      propertyId: property.id,
      ownerId: property.ownerId,
      applicantId: applicant.id,
      assignedAgentId: agent.id,
      type: property.transactionType === "PRESALE" ? "PRESALE" : "SALE",
      status: "AGREED",
      agreedPrice: baseToman,
      commissionAmount: result.totalAmountToman,
      notes: marker,
      contract: {
        create: {
          contractNumber: marker,
          contractDate: new Date(),
          registrySystem: "کاتب",
          registrationStatus: "DRAFT",
        },
      },
      statusHistory: {
        create: {
          changedById: agent.id,
          toStatus: "AGREED",
          note: "تست خودکار گردش معامله",
        },
      },
      commission: {
        create: {
          policyId: policy.id,
          calculationBase: "AGREED_PRICE",
          calculationBaseToman: baseToman,
          ownerAmountToman: result.ownerAmountToman,
          applicantAmountToman: result.applicantAmountToman,
          discountToman: result.discountToman,
          taxAmountToman: result.taxAmountToman,
          totalAmountToman: result.totalAmountToman,
          status: "APPROVED",
          approvedById: agent.id,
          approvedAt: new Date(),
          allocations: {
            create: [
              {
                userId: agent.id,
                title: "سهم مشاور تست",
                basisPoints: 5_000,
                amountToman: calculateAllocation(
                  result.distributableAmountToman,
                  5_000,
                ),
                status: "APPROVED",
              },
              {
                title: "سهم دفتر تست",
                basisPoints: 5_000,
                amountToman: calculateAllocation(
                  result.distributableAmountToman,
                  5_000,
                ),
                status: "APPROVED",
              },
            ],
          },
        },
      },
    },
    include: { commission: { include: { allocations: true } }, contract: true },
  });
  dealId = deal.id;
  assert(deal.contract?.contractNumber === marker, "قرارداد ذخیره نشد.");
  assert(deal.commission?.allocations.length === 2, "تقسیم کمیسیون ناقص است.");

  await db.$transaction([
    db.dealReceipt.create({
      data: {
        agencyId: agency.id,
        dealId: deal.id,
        payerContactId: applicant.id,
        receiptNumber: marker,
        type: "COMMISSION",
        status: "CLEARED",
        method: "TRANSFER",
        amountToman: result.totalAmountToman,
        paidAt: new Date(),
      },
    }),
    db.dealCommission.update({
      where: { dealId: deal.id },
      data: {
        receivedAmountToman: result.totalAmountToman,
        status: "RECEIVED",
        allocations: {
          updateMany: {
            where: { status: "APPROVED" },
            data: { status: "PAID", paidAt: new Date() },
          },
        },
      },
    }),
    db.deal.update({ where: { id: deal.id }, data: { status: "COMPLETED" } }),
  ]);

  const completed = await db.deal.findUnique({
    where: { id: deal.id },
    include: { commission: { include: { allocations: true } }, receipts: true },
  });
  assert(completed?.status === "COMPLETED", "معامله تکمیل نشد.");
  assert(completed.commission?.status === "RECEIVED", "کمیسیون وصول نشد.");
  assert(completed.receipts.length === 1, "رسید وصول ثبت نشد.");
  assert(
    completed.commission.allocations.every((item) => item.status === "PAID"),
    "تسویه سهم‌ها کامل نشد.",
  );
  console.log(
    "Operational smoke test passed: deal → contract → commission → receipt → settlement.",
  );
}

main()
  .finally(async () => {
    if (dealId)
      await db.deal.delete({ where: { id: dealId } }).catch(() => undefined);
    if (policyId)
      await db.commissionPolicy
        .delete({ where: { id: policyId } })
        .catch(() => undefined);
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
