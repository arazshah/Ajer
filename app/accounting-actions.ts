"use server";

import { randomUUID } from "node:crypto";
import type {
  CheckStatus,
  FinanceTransactionType,
  FinancialAccountType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseMoney, toEnglishDigits } from "@/lib/format";
import { requirePermission } from "@/lib/permissions";
import { parseJalaliDate } from "@/lib/jalali";

function value(fd: FormData, key: string, max = 2_000) {
  return String(fd.get(key) || "")
    .trim()
    .slice(0, max);
}

function money(fd: FormData, key: string, fallback: bigint | null = null) {
  try {
    return parseMoney(value(fd, key)) ?? fallback;
  } catch {
    return undefined;
  }
}

function date(fd: FormData, key: string, fallback: Date | null = null) {
  const raw = value(fd, key, 40);
  if (!raw) return fallback;
  return parseJalaliDate(raw) ?? undefined;
}

function transactionNumber(prefix = "FIN") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

async function financeRefs(
  agencyId: string,
  input: {
    sourceAccountId?: string | null;
    destinationAccountId?: string | null;
    categoryId?: string | null;
    contactId?: string | null;
    propertyId?: string | null;
    dealId?: string | null;
    employeeId?: string | null;
  },
) {
  const [source, destination, category, contact, property, deal, employee] =
    await Promise.all([
      input.sourceAccountId
        ? db.financialAccount.findFirst({
            where: {
              id: input.sourceAccountId,
              agencyId,
              isActive: true,
            },
          })
        : null,
      input.destinationAccountId
        ? db.financialAccount.findFirst({
            where: {
              id: input.destinationAccountId,
              agencyId,
              isActive: true,
            },
          })
        : null,
      input.categoryId
        ? db.financeCategory.findFirst({
            where: { id: input.categoryId, agencyId, isActive: true },
          })
        : null,
      input.contactId
        ? db.contact.findFirst({ where: { id: input.contactId, agencyId } })
        : null,
      input.propertyId
        ? db.property.findFirst({ where: { id: input.propertyId, agencyId } })
        : null,
      input.dealId
        ? db.deal.findFirst({ where: { id: input.dealId, agencyId } })
        : null,
      input.employeeId
        ? db.user.findFirst({
            where: { id: input.employeeId, agencyId, isActive: true },
          })
        : null,
    ]);
  const valid =
    (!input.sourceAccountId || source) &&
    (!input.destinationAccountId || destination) &&
    (!input.categoryId || category) &&
    (!input.contactId || contact) &&
    (!input.propertyId || property) &&
    (!input.dealId || deal) &&
    (!input.employeeId || employee);
  return { valid, source, destination, category };
}

export async function createFinancialAccount(fd: FormData) {
  const user = await requirePermission("accounting.manage");
  const type = z
    .enum(["CASH", "BANK", "PETTY_CASH"])
    .safeParse(value(fd, "type"));
  const name = value(fd, "name", 100);
  const code = value(fd, "code", 30).toUpperCase();
  const openingBalanceToman = money(fd, "openingBalanceToman", 0n);
  if (
    !type.success ||
    name.length < 2 ||
    !/^[A-Z0-9_-]{2,30}$/.test(code) ||
    openingBalanceToman === undefined
  )
    redirect("/accounting?error=account");
  await db.financialAccount.create({
    data: {
      agencyId: user.agencyId,
      name,
      code,
      type: type.data as FinancialAccountType,
      openingBalanceToman: openingBalanceToman ?? 0n,
      bankName: value(fd, "bankName", 100) || null,
      accountNumber: value(fd, "accountNumber", 80) || null,
      iban: value(fd, "iban", 34) || null,
    },
  });
  revalidatePath("/accounting");
  redirect("/accounting?created=account");
}

export async function createFinanceCategory(fd: FormData) {
  const user = await requirePermission("accounting.manage");
  const type = z.enum(["INCOME", "EXPENSE"]).safeParse(value(fd, "type"));
  const name = value(fd, "name", 100);
  if (!type.success || name.length < 2) redirect("/accounting?error=category");
  await db.financeCategory.create({
    data: { agencyId: user.agencyId, name, type: type.data },
  });
  revalidatePath("/accounting");
  redirect("/accounting?created=category");
}

export async function createFinanceTransaction(fd: FormData) {
  const user = await requirePermission("accounting.manage");
  const parsedType = z
    .enum([
      "INCOME",
      "EXPENSE",
      "TRANSFER",
      "RECEIVABLE",
      "PAYABLE",
      "PETTY_CASH_ADVANCE",
      "PETTY_CASH_SETTLEMENT",
      "REFUND",
    ])
    .safeParse(value(fd, "type"));
  const amountToman = money(fd, "amountToman");
  const occurredAt = date(fd, "occurredAt", new Date());
  const dueAt = date(fd, "dueAt");
  const description = value(fd, "description", 240);
  if (
    !parsedType.success ||
    amountToman === undefined ||
    amountToman === null ||
    amountToman <= 0n ||
    !occurredAt ||
    occurredAt === undefined ||
    dueAt === undefined ||
    description.length < 3
  )
    redirect("/accounting?error=transaction");
  const type = parsedType.data as FinanceTransactionType;
  const sourceAccountId = value(fd, "sourceAccountId", 80) || null;
  const destinationAccountId = value(fd, "destinationAccountId", 80) || null;
  const categoryId = value(fd, "categoryId", 80) || null;
  const contactId = value(fd, "contactId", 80) || null;
  const propertyId = value(fd, "propertyId", 80) || null;
  const dealId = value(fd, "dealId", 80) || null;
  const employeeId = value(fd, "employeeId", 80) || null;
  const incoming = type === "INCOME";
  const outgoing = type === "EXPENSE" || type === "REFUND";
  const transfer = [
    "TRANSFER",
    "PETTY_CASH_ADVANCE",
    "PETTY_CASH_SETTLEMENT",
  ].includes(type);
  const obligation = type === "RECEIVABLE" || type === "PAYABLE";
  if (
    (incoming && !destinationAccountId) ||
    (outgoing && !sourceAccountId) ||
    (transfer &&
      (!sourceAccountId ||
        !destinationAccountId ||
        sourceAccountId === destinationAccountId)) ||
    (obligation && !dueAt)
  )
    redirect("/accounting?error=accounts");
  const refs = await financeRefs(user.agencyId, {
    sourceAccountId,
    destinationAccountId,
    categoryId,
    contactId,
    propertyId,
    dealId,
    employeeId,
  });
  if (!refs.valid) redirect("/accounting?error=reference");
  if (
    refs.category &&
    ((["INCOME", "RECEIVABLE"].includes(type) &&
      refs.category.type !== "INCOME") ||
      (["EXPENSE", "PAYABLE", "REFUND"].includes(type) &&
        refs.category.type !== "EXPENSE"))
  )
    redirect("/accounting?error=category-type");
  await db.$transaction(async (tx) => {
    const transaction = await tx.financeTransaction.create({
      data: {
        agencyId: user.agencyId,
        transactionNumber: transactionNumber(),
        type,
        amountToman,
        sourceAccountId,
        destinationAccountId,
        categoryId,
        contactId,
        propertyId,
        dealId,
        employeeId,
        createdById: user.id,
        occurredAt,
        dueAt,
        description,
        reference: value(fd, "reference", 100) || null,
        notes: value(fd, "notes") || null,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "FinanceTransaction",
        entityId: transaction.id,
        action: `CREATE_${type}`,
      },
    });
  });
  revalidatePath("/accounting");
  redirect("/accounting?created=transaction");
}

export async function settleFinanceObligation(
  transactionId: string,
  fd: FormData,
) {
  const user = await requirePermission("accounting.manage");
  const obligation = await db.financeTransaction.findFirst({
    where: {
      id: transactionId,
      agencyId: user.agencyId,
      type: { in: ["RECEIVABLE", "PAYABLE"] },
      status: "POSTED",
    },
  });
  if (!obligation) return;
  const accountId = value(fd, "accountId", 80);
  const account = await db.financialAccount.findFirst({
    where: { id: accountId, agencyId: user.agencyId, isActive: true },
  });
  if (!account) redirect("/accounting?error=account");
  const incoming = obligation.type === "RECEIVABLE";
  await db.$transaction(async (tx) => {
    await tx.financeTransaction.create({
      data: {
        agencyId: user.agencyId,
        transactionNumber: transactionNumber(incoming ? "REC" : "PAY"),
        type: incoming ? "RECEIPT" : "PAYMENT",
        amountToman: obligation.amountToman,
        sourceAccountId: incoming ? null : account.id,
        destinationAccountId: incoming ? account.id : null,
        contactId: obligation.contactId,
        propertyId: obligation.propertyId,
        dealId: obligation.dealId,
        employeeId: obligation.employeeId,
        createdById: user.id,
        parentId: obligation.id,
        occurredAt: new Date(),
        settledAt: new Date(),
        description: `تسویه ${obligation.description}`,
        reference: value(fd, "reference", 100) || null,
      },
    });
    await tx.financeTransaction.update({
      where: { id: obligation.id },
      data: { status: "SETTLED", settledAt: new Date() },
    });
  });
  revalidatePath("/accounting");
}

export async function voidFinanceTransaction(transactionId: string) {
  const user = await requirePermission("accounting.manage");
  const transaction = await db.financeTransaction.findFirst({
    where: { id: transactionId, agencyId: user.agencyId },
    include: { check: true, payrollRecord: true, settlements: true },
  });
  if (
    !transaction ||
    transaction.status === "VOID" ||
    transaction.check?.status === "CLEARED" ||
    transaction.payrollRecord?.status === "PAID" ||
    transaction.settlements.length
  )
    return;
  await db.financeTransaction.update({
    where: { id: transaction.id },
    data: { status: "VOID" },
  });
  revalidatePath("/accounting");
}

export async function createCheckRecord(fd: FormData) {
  const user = await requirePermission("accounting.manage");
  const direction = z
    .enum(["RECEIVABLE", "PAYABLE"])
    .safeParse(value(fd, "direction"));
  const amountToman = money(fd, "amountToman");
  const dueAt = date(fd, "dueAt");
  const contactId = value(fd, "contactId", 80) || null;
  const checkNumber = value(fd, "checkNumber", 80);
  const bankName = value(fd, "bankName", 100);
  const issuerName = value(fd, "issuerName", 100);
  if (
    !direction.success ||
    !amountToman ||
    amountToman <= 0n ||
    !dueAt ||
    dueAt === undefined ||
    !checkNumber ||
    !bankName ||
    !issuerName
  )
    redirect("/accounting?tab=checks&error=check");
  if (
    contactId &&
    !(await db.contact.findFirst({
      where: { id: contactId, agencyId: user.agencyId },
    }))
  )
    redirect("/accounting?tab=checks&error=reference");
  await db.$transaction(async (tx) => {
    const transaction = await tx.financeTransaction.create({
      data: {
        agencyId: user.agencyId,
        transactionNumber: transactionNumber("CHK"),
        type: direction.data,
        amountToman,
        contactId,
        createdById: user.id,
        occurredAt: new Date(),
        dueAt,
        description: `${direction.data === "RECEIVABLE" ? "چک دریافتی" : "چک پرداختی"} ${checkNumber}`,
      },
    });
    await tx.checkRecord.create({
      data: {
        agencyId: user.agencyId,
        transactionId: transaction.id,
        contactId,
        direction: direction.data,
        checkNumber,
        sayadId: value(fd, "sayadId", 40) || null,
        bankName,
        branchName: value(fd, "branchName", 100) || null,
        issuerName,
        amountToman,
        issuedAt: date(fd, "issuedAt"),
        dueAt,
        notes: value(fd, "notes") || null,
      },
    });
  });
  revalidatePath("/accounting");
  redirect("/accounting?tab=checks&created=check");
}

export async function updateCheckStatus(
  checkId: string,
  target: "DEPOSITED" | "CLEARED" | "BOUNCED" | "CANCELLED",
  fd: FormData,
) {
  const user = await requirePermission("accounting.manage");
  const check = await db.checkRecord.findFirst({
    where: { id: checkId, agencyId: user.agencyId },
    include: { transaction: true },
  });
  if (!check || ["CLEARED", "CANCELLED"].includes(check.status)) return;
  const accountId = value(fd, "accountId", 80) || null;
  const account = accountId
    ? await db.financialAccount.findFirst({
        where: { id: accountId, agencyId: user.agencyId, isActive: true },
      })
    : null;
  if (target === "CLEARED" && !account)
    redirect("/accounting?tab=checks&error=account");
  await db.$transaction(async (tx) => {
    if (target === "CLEARED") {
      const incoming = check.direction === "RECEIVABLE";
      await tx.financeTransaction.create({
        data: {
          agencyId: user.agencyId,
          transactionNumber: transactionNumber("CHKSET"),
          type: incoming ? "RECEIPT" : "PAYMENT",
          amountToman: check.amountToman,
          sourceAccountId: incoming ? null : account!.id,
          destinationAccountId: incoming ? account!.id : null,
          contactId: check.contactId,
          createdById: user.id,
          parentId: check.transactionId,
          occurredAt: new Date(),
          settledAt: new Date(),
          description: `وصول چک ${check.checkNumber}`,
        },
      });
      await tx.financeTransaction.update({
        where: { id: check.transactionId },
        data: { status: "SETTLED", settledAt: new Date() },
      });
    }
    if (target === "CANCELLED")
      await tx.financeTransaction.update({
        where: { id: check.transactionId },
        data: { status: "VOID" },
      });
    await tx.checkRecord.update({
      where: { id: check.id },
      data: {
        status: target as CheckStatus,
        accountId: account?.id || check.accountId,
        depositedAt: target === "DEPOSITED" ? new Date() : check.depositedAt,
        clearedAt: target === "CLEARED" ? new Date() : null,
      },
    });
  });
  revalidatePath("/accounting");
}

export async function createPayrollRecord(fd: FormData) {
  const user = await requirePermission("accounting.manage");
  const employeeId = value(fd, "employeeId", 80);
  const year = Number(toEnglishDigits(value(fd, "year", 4)));
  const month = Number(toEnglishDigits(value(fd, "month", 2)));
  const [employee, baseSalary, commission, bonus, deduction] =
    await Promise.all([
      db.user.findFirst({
        where: { id: employeeId, agencyId: user.agencyId, isActive: true },
        include: { employeeProfile: true },
      }),
      Promise.resolve(money(fd, "baseSalaryToman", 0n)),
      Promise.resolve(money(fd, "commissionToman", 0n)),
      Promise.resolve(money(fd, "bonusToman", 0n)),
      Promise.resolve(money(fd, "deductionToman", 0n)),
    ]);
  if (
    !employee ||
    !Number.isInteger(year) ||
    year < 1300 ||
    year > 1600 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    [baseSalary, commission, bonus, deduction].some(
      (item) => item === undefined || item === null || item < 0n,
    )
  )
    redirect("/accounting?tab=payroll&error=payroll");
  const netPayableToman = baseSalary! + commission! + bonus! - deduction!;
  if (netPayableToman < 0n) redirect("/accounting?tab=payroll&error=payroll");
  await db.payrollRecord.create({
    data: {
      agencyId: user.agencyId,
      userId: employee.id,
      employeeProfileId: employee.employeeProfile?.id || null,
      year,
      month,
      baseSalaryToman: baseSalary!,
      commissionToman: commission!,
      bonusToman: bonus!,
      deductionToman: deduction!,
      netPayableToman,
      notes: value(fd, "notes") || null,
    },
  });
  revalidatePath("/accounting");
  redirect("/accounting?tab=payroll&created=payroll");
}

export async function approvePayroll(payrollId: string) {
  const user = await requirePermission("accounting.manage");
  const payroll = await db.payrollRecord.findFirst({
    where: { id: payrollId, agencyId: user.agencyId, status: "DRAFT" },
  });
  if (!payroll) return;
  const category = await db.financeCategory.findFirst({
    where: {
      agencyId: user.agencyId,
      name: "حقوق و دستمزد",
      type: "EXPENSE",
    },
  });
  await db.$transaction(async (tx) => {
    const transaction = await tx.financeTransaction.create({
      data: {
        agencyId: user.agencyId,
        transactionNumber: transactionNumber("SAL"),
        type: "SALARY",
        amountToman: payroll.netPayableToman,
        categoryId: category?.id || null,
        employeeId: payroll.userId,
        createdById: user.id,
        occurredAt: new Date(),
        dueAt: new Date(),
        description: `حقوق ${payroll.year}/${payroll.month}`,
      },
    });
    await tx.payrollRecord.update({
      where: { id: payroll.id },
      data: {
        transactionId: transaction.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });
  });
  revalidatePath("/accounting");
}

export async function payPayroll(payrollId: string, fd: FormData) {
  const user = await requirePermission("accounting.manage");
  const payroll = await db.payrollRecord.findFirst({
    where: { id: payrollId, agencyId: user.agencyId, status: "APPROVED" },
  });
  const accountId = value(fd, "accountId", 80);
  const account = await db.financialAccount.findFirst({
    where: { id: accountId, agencyId: user.agencyId, isActive: true },
  });
  if (!payroll || !account || !payroll.transactionId) return;
  await db.$transaction([
    db.financeTransaction.create({
      data: {
        agencyId: user.agencyId,
        transactionNumber: transactionNumber("SALPAY"),
        type: "PAYMENT",
        amountToman: payroll.netPayableToman,
        sourceAccountId: account.id,
        employeeId: payroll.userId,
        createdById: user.id,
        parentId: payroll.transactionId,
        occurredAt: new Date(),
        settledAt: new Date(),
        description: `پرداخت حقوق ${payroll.year}/${payroll.month}`,
      },
    }),
    db.financeTransaction.update({
      where: { id: payroll.transactionId },
      data: { status: "SETTLED", settledAt: new Date() },
    }),
    db.payrollRecord.update({
      where: { id: payroll.id },
      data: { status: "PAID", paidAt: new Date() },
    }),
  ]);
  revalidatePath("/accounting");
}
