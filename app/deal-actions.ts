"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, type Permission } from "@/lib/permissions";
import { calculateAllocation, calculateCommission } from "@/lib/commission";
import { db } from "@/lib/db";
import { parseMoney, toEnglishDigits } from "@/lib/format";
import {
  ensureDefaultAccounting,
  newFinanceTransactionNumber,
} from "@/lib/accounting";
import { parseJalaliDate } from "@/lib/jalali";

async function requireOfficeManager(permission: Permission = "deals.finance") {
  return requirePermission(permission);
}

function value(fd: FormData, key: string) {
  return String(fd.get(key) || "").trim();
}

function money(fd: FormData, key: string, fallback = 0n) {
  try {
    return parseMoney(value(fd, key)) ?? fallback;
  } catch {
    throw new Error("مبلغ واردشده معتبر نیست.");
  }
}

function percentToBasisPoints(raw: string) {
  const parsed = Number(toEnglishDigits(raw).replace("٫", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)
    throw new Error("درصد واردشده معتبر نیست.");
  return Math.round(parsed * 100);
}

export async function createCommissionPolicy(fd: FormData) {
  const user = await requireOfficeManager("commissions.manage");
  const schema = z.object({
    name: z.string().min(3).max(100),
    transactionType: z
      .enum(["SALE", "RENT", "MORTGAGE_RENT", "PRESALE"])
      .nullable(),
    calculationBase: z.enum([
      "AGREED_PRICE",
      "DEPOSIT_AMOUNT",
      "MONTHLY_RENT",
      "MANUAL",
    ]),
  });
  const input = schema.parse({
    name: value(fd, "name"),
    transactionType: value(fd, "transactionType") || null,
    calculationBase: value(fd, "calculationBase"),
  });
  await db.commissionPolicy.create({
    data: {
      agencyId: user.agencyId,
      ...input,
      ownerRateBasisPoints: percentToBasisPoints(value(fd, "ownerRatePercent")),
      applicantRateBasisPoints: percentToBasisPoints(
        value(fd, "applicantRatePercent"),
      ),
      taxRateBasisPoints: percentToBasisPoints(value(fd, "taxRatePercent")),
      fixedOwnerAmountToman: money(fd, "fixedOwnerAmountToman"),
      fixedApplicantAmountToman: money(fd, "fixedApplicantAmountToman"),
      maximumPerSideToman: parseMoney(value(fd, "maximumPerSideToman")),
    },
  });
  revalidatePath("/commissions");
  redirect("/commissions?created=1");
}

export async function toggleCommissionPolicy(id: string) {
  const user = await requireOfficeManager("commissions.manage");
  const policy = await db.commissionPolicy.findFirst({
    where: { id, agencyId: user.agencyId },
  });
  if (!policy) return;
  await db.commissionPolicy.update({
    where: { id },
    data: { isActive: !policy.isActive },
  });
  revalidatePath("/commissions");
}

export async function saveDealCommercialTerms(fd: FormData) {
  const user = await requireOfficeManager();
  const dealId = value(fd, "dealId");
  const deal = await db.deal.findFirst({
    where: { id: dealId, agencyId: user.agencyId },
  });
  if (!deal) return;
  const agreedPrice = parseMoney(value(fd, "agreedPrice"));
  const depositAmount = parseMoney(value(fd, "depositAmount"));
  const monthlyRent = parseMoney(value(fd, "monthlyRent"));
  const registrationStatus = z
    .enum(["NOT_SUBMITTED", "DRAFT", "SUBMITTED", "REGISTERED", "REJECTED"])
    .parse(value(fd, "registrationStatus"));
  const contractDate = value(fd, "contractDate");
  const parsedContractDate = contractDate
    ? parseJalaliDate(contractDate)
    : null;
  if (contractDate && !parsedContractDate)
    redirect(`/deals/${deal.id}?error=contract-date`);
  await db.$transaction([
    db.deal.update({
      where: { id: deal.id },
      data: {
        agreedPrice,
        depositAmount,
        monthlyRent,
        contractNumber: value(fd, "contractNumber") || null,
        contractDate: parsedContractDate,
        notes: value(fd, "notes"),
      },
    }),
    db.dealContract.upsert({
      where: { dealId: deal.id },
      create: {
        dealId: deal.id,
        contractNumber: value(fd, "contractNumber") || null,
        contractDate: parsedContractDate,
        registrySystem: value(fd, "registrySystem") || "کاتب",
        registryReference: value(fd, "registryReference") || null,
        registrationStatus,
        terms: value(fd, "terms") || null,
      },
      update: {
        contractNumber: value(fd, "contractNumber") || null,
        contractDate: parsedContractDate,
        registrySystem: value(fd, "registrySystem") || "کاتب",
        registryReference: value(fd, "registryReference") || null,
        registrationStatus,
        terms: value(fd, "terms") || null,
      },
    }),
    db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "Deal",
        entityId: deal.id,
        action: "UPDATE_COMMERCIAL_TERMS",
      },
    }),
  ]);
  revalidatePath(`/deals/${deal.id}`);
}

export async function recalculateDealCommission(fd: FormData) {
  const user = await requireOfficeManager();
  const dealId = value(fd, "dealId");
  const policyId = value(fd, "policyId");
  const [deal, policy] = await Promise.all([
    db.deal.findFirst({
      where: { id: dealId, agencyId: user.agencyId },
      include: { commission: true },
    }),
    db.commissionPolicy.findFirst({
      where: { id: policyId, agencyId: user.agencyId, isActive: true },
    }),
  ]);
  if (!deal || !policy) return;
  if (deal.commission && deal.commission.status !== "DRAFT") return;
  const baseToman =
    policy.calculationBase === "AGREED_PRICE"
      ? deal.agreedPrice
      : policy.calculationBase === "DEPOSIT_AMOUNT"
        ? deal.depositAmount
        : policy.calculationBase === "MONTHLY_RENT"
          ? deal.monthlyRent
          : parseMoney(value(fd, "manualBaseToman"));
  if (baseToman === null) redirect(`/deals/${deal.id}?error=commission-base`);
  const result = calculateCommission({
    baseToman,
    discountToman: money(fd, "discountToman"),
    policy,
  });
  const persistedResult = {
    ownerAmountToman: result.ownerAmountToman,
    applicantAmountToman: result.applicantAmountToman,
    discountToman: result.discountToman,
    taxAmountToman: result.taxAmountToman,
    totalAmountToman: result.totalAmountToman,
  };
  const profile = await db.employeeProfile.findUnique({
    where: { userId: deal.assignedAgentId },
  });
  const agentBasisPoints = Math.min(
    10_000,
    Math.max(0, profile?.defaultCommissionBasisPoints ?? 5_000),
  );
  await db.$transaction(async (tx) => {
    const commission = await tx.dealCommission.upsert({
      where: { dealId: deal.id },
      create: {
        dealId: deal.id,
        policyId: policy.id,
        calculationBase: policy.calculationBase,
        calculationBaseToman: baseToman,
        ...persistedResult,
      },
      update: {
        policyId: policy.id,
        calculationBase: policy.calculationBase,
        calculationBaseToman: baseToman,
        ...persistedResult,
        status: "DRAFT",
        approvedAt: null,
        approvedById: null,
        calculatedAt: new Date(),
      },
    });
    await tx.commissionAllocation.deleteMany({
      where: { commissionId: commission.id },
    });
    await tx.commissionAllocation.createMany({
      data: [
        {
          commissionId: commission.id,
          userId: deal.assignedAgentId,
          title: "سهم مشاور مسئول معامله",
          basisPoints: agentBasisPoints,
          amountToman: calculateAllocation(
            result.distributableAmountToman,
            agentBasisPoints,
          ),
        },
        {
          commissionId: commission.id,
          title: "سهم دفتر",
          basisPoints: 10_000 - agentBasisPoints,
          amountToman: calculateAllocation(
            result.distributableAmountToman,
            10_000 - agentBasisPoints,
          ),
        },
      ],
    });
    await tx.deal.update({
      where: { id: deal.id },
      data: { commissionAmount: result.totalAmountToman },
    });
  });
  revalidatePath(`/deals/${deal.id}`);
}

export async function saveCommissionSplit(fd: FormData) {
  const user = await requireOfficeManager();
  const dealId = value(fd, "dealId");
  const deal = await db.deal.findFirst({
    where: { id: dealId, agencyId: user.agencyId },
    include: { commission: true },
  });
  if (!deal?.commission || deal.commission.status !== "DRAFT") return;
  const users = await db.user.findMany({
    where: { agencyId: user.agencyId, isActive: true },
  });
  const shares = users
    .map((member) => ({
      member,
      basisPoints: percentToBasisPoints(value(fd, `share_${member.id}`) || "0"),
    }))
    .filter((item) => item.basisPoints > 0);
  const total = shares.reduce((sum, item) => sum + item.basisPoints, 0);
  if (total > 10_000) redirect(`/deals/${deal.id}?error=commission-split`);
  const distributable =
    deal.commission.ownerAmountToman +
    deal.commission.applicantAmountToman -
    deal.commission.discountToman;
  await db.$transaction(async (tx) => {
    await tx.commissionAllocation.deleteMany({
      where: { commissionId: deal.commission!.id },
    });
    if (shares.length)
      await tx.commissionAllocation.createMany({
        data: shares.map(({ member, basisPoints }) => ({
          commissionId: deal.commission!.id,
          userId: member.id,
          title: `سهم ${member.fullName}`,
          basisPoints,
          amountToman: calculateAllocation(distributable, basisPoints),
        })),
      });
    await tx.commissionAllocation.create({
      data: {
        commissionId: deal.commission!.id,
        title: "سهم دفتر",
        basisPoints: 10_000 - total,
        amountToman: calculateAllocation(distributable, 10_000 - total),
      },
    });
  });
  revalidatePath(`/deals/${deal.id}`);
}

export async function approveDealCommission(dealId: string) {
  const user = await requireOfficeManager();
  const deal = await db.deal.findFirst({
    where: { id: dealId, agencyId: user.agencyId },
    include: { commission: true },
  });
  if (!deal?.commission || deal.commission.status !== "DRAFT") return;
  await db.$transaction([
    db.dealCommission.update({
      where: { id: deal.commission.id },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
      },
    }),
    db.commissionAllocation.updateMany({
      where: { commissionId: deal.commission.id, status: "PENDING" },
      data: { status: "APPROVED", approvedAt: new Date() },
    }),
  ]);
  revalidatePath(`/deals/${deal.id}`);
}

export async function addDealReceipt(fd: FormData) {
  const user = await requireOfficeManager();
  const dealId = value(fd, "dealId");
  const deal = await db.deal.findFirst({
    where: { id: dealId, agencyId: user.agencyId },
    include: { commission: true },
  });
  if (!deal) return;
  const amountToman = money(fd, "amountToman");
  if (amountToman <= 0n) return;
  const method = z
    .enum(["CASH", "CARD", "TRANSFER", "CHECK", "OTHER"])
    .parse(value(fd, "method"));
  const type = z
    .enum(["COMMISSION", "DEPOSIT", "RENT", "OTHER", "REFUND"])
    .parse(value(fd, "type"));
  if (
    type === "COMMISSION" &&
    (!deal.commission || deal.commission.status === "DRAFT")
  )
    return;
  const payerContactId = value(fd, "payerContactId") || null;
  if (
    payerContactId &&
    !(await db.contact.findFirst({
      where: { id: payerContactId, agencyId: user.agencyId },
    }))
  )
    return;
  const cleared = fd.get("cleared") === "on";
  await ensureDefaultAccounting(user.agencyId);
  const [account, incomeCategory, expenseCategory] = await Promise.all([
    db.financialAccount.findFirst({
      where: {
        agencyId: user.agencyId,
        code: method === "CASH" ? "CASH" : "BANK",
      },
    }),
    db.financeCategory.findFirst({
      where: {
        agencyId: user.agencyId,
        name: type === "COMMISSION" ? "درآمد کمیسیون" : "سایر درآمدها",
        type: "INCOME",
      },
    }),
    db.financeCategory.findFirst({
      where: {
        agencyId: user.agencyId,
        name: "ملزومات و سایر هزینه‌ها",
        type: "EXPENSE",
      },
    }),
  ]);
  if (cleared && !account) return;
  await db.$transaction(async (tx) => {
    const receipt = await tx.dealReceipt.create({
      data: {
        agencyId: user.agencyId,
        dealId: deal.id,
        payerContactId,
        receiptNumber: `RC-${Date.now().toString(36).toUpperCase()}`,
        type,
        method,
        amountToman,
        status: cleared ? "CLEARED" : "PENDING",
        paidAt: cleared ? new Date() : null,
        reference: value(fd, "reference") || null,
        checkNumber: value(fd, "checkNumber") || null,
        bankName: value(fd, "bankName") || null,
        notes: value(fd, "notes") || null,
      },
    });
    if (cleared) {
      const isRefund = type === "REFUND";
      const isOfficeIncome = type === "COMMISSION" || type === "OTHER";
      await tx.financeTransaction.create({
        data: {
          agencyId: user.agencyId,
          transactionNumber: newFinanceTransactionNumber("DEAL"),
          type: isRefund ? "REFUND" : isOfficeIncome ? "INCOME" : "RECEIPT",
          amountToman,
          sourceAccountId: isRefund ? account!.id : null,
          destinationAccountId: isRefund ? null : account!.id,
          categoryId: isRefund
            ? expenseCategory?.id || null
            : isOfficeIncome
              ? incomeCategory?.id || null
              : null,
          contactId: payerContactId,
          dealId: deal.id,
          dealReceiptId: receipt.id,
          createdById: user.id,
          occurredAt: new Date(),
          description: `${type === "COMMISSION" ? "وصول کمیسیون" : type === "REFUND" ? "بازپرداخت معامله" : "دریافت مرتبط با معامله"} ${deal.contractNumber || deal.id.slice(-6)}`,
          reference: receipt.reference,
        },
      });
    }
  });
  if (deal.commission) {
    const receipts = await db.dealReceipt.aggregate({
      where: {
        dealId: deal.id,
        type: "COMMISSION",
        status: "CLEARED",
      },
      _sum: { amountToman: true },
    });
    const received = receipts._sum.amountToman ?? 0n;
    await db.dealCommission.update({
      where: { id: deal.commission.id },
      data: {
        receivedAmountToman: received,
        status:
          received >= deal.commission.totalAmountToman
            ? "RECEIVED"
            : received > 0n
              ? "PARTIALLY_RECEIVED"
              : deal.commission.status,
      },
    });
  }
  revalidatePath(`/deals/${deal.id}`);
}

export async function markAllocationPaid(allocationId: string) {
  const user = await requireOfficeManager("accounting.manage");
  const allocation = await db.commissionAllocation.findFirst({
    where: {
      id: allocationId,
      commission: { deal: { agencyId: user.agencyId }, status: "RECEIVED" },
    },
    include: { commission: true },
  });
  if (!allocation || allocation.status !== "APPROVED" || !allocation.userId)
    return;
  await ensureDefaultAccounting(user.agencyId);
  const [account, category] = await Promise.all([
    db.financialAccount.findFirst({
      where: { agencyId: user.agencyId, code: "CASH" },
    }),
    db.financeCategory.findFirst({
      where: {
        agencyId: user.agencyId,
        name: "پورسانت پرسنل",
        type: "EXPENSE",
      },
    }),
  ]);
  if (!account) return;
  await db.$transaction([
    db.commissionAllocation.update({
      where: { id: allocation.id },
      data: { status: "PAID", paidAt: new Date() },
    }),
    db.financeTransaction.create({
      data: {
        agencyId: user.agencyId,
        transactionNumber: newFinanceTransactionNumber("COM"),
        type: "COMMISSION",
        amountToman: allocation.amountToman,
        sourceAccountId: account.id,
        categoryId: category?.id || null,
        employeeId: allocation.userId,
        dealId: allocation.commission.dealId,
        commissionAllocationId: allocation.id,
        createdById: user.id,
        occurredAt: new Date(),
        description: allocation.title,
      },
    }),
  ]);
  revalidatePath(`/deals/${allocation.commission.dealId}`);
}
