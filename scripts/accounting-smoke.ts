import { PrismaClient } from "@prisma/client";
import {
  calculateAccountBalances,
  calculateProfitAndLoss,
  ensureDefaultAccounting,
  newFinanceTransactionNumber,
} from "../lib/accounting";

const db = new PrismaClient();

async function main() {
  const agency = await db.agency.findFirst({ include: { users: true } });
  const user =
    agency?.users.find((item) => item.role === "ADMIN") || agency?.users[0];
  if (!agency || !user)
    throw new Error("ابتدا bootstrap یا seed را اجرا کنید.");
  await ensureDefaultAccounting(agency.id);
  const marker = `ACC-SMOKE-${Date.now()}`;
  try {
    const [bank, cash, petty, incomeCategory, expenseCategory] =
      await Promise.all([
        db.financialAccount.findUnique({
          where: { agencyId_code: { agencyId: agency.id, code: "BANK" } },
        }),
        db.financialAccount.findUnique({
          where: { agencyId_code: { agencyId: agency.id, code: "CASH" } },
        }),
        db.financialAccount.findUnique({
          where: { agencyId_code: { agencyId: agency.id, code: "PETTY" } },
        }),
        db.financeCategory.findFirst({
          where: { agencyId: agency.id, type: "INCOME" },
        }),
        db.financeCategory.findFirst({
          where: { agencyId: agency.id, type: "EXPENSE" },
        }),
      ]);
    if (!bank || !cash || !petty || !incomeCategory || !expenseCategory)
      throw new Error("حساب یا دسته پایه ایجاد نشده است.");
    const common = {
      agencyId: agency.id,
      createdById: user.id,
      occurredAt: new Date(),
    };
    const income = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "INCOME",
        amountToman: 1_000n,
        destinationAccountId: bank.id,
        categoryId: incomeCategory.id,
        description: `${marker} income`,
      },
    });
    const expense = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "EXPENSE",
        amountToman: 200n,
        sourceAccountId: bank.id,
        categoryId: expenseCategory.id,
        description: `${marker} expense`,
      },
    });
    const transfer = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "PETTY_CASH_ADVANCE",
        amountToman: 300n,
        sourceAccountId: bank.id,
        destinationAccountId: petty.id,
        description: `${marker} petty`,
      },
    });
    const receivable = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "RECEIVABLE",
        amountToman: 500n,
        categoryId: incomeCategory.id,
        dueAt: new Date(),
        description: `${marker} receivable`,
      },
    });
    const receipt = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "RECEIPT",
        amountToman: 500n,
        destinationAccountId: cash.id,
        parentId: receivable.id,
        description: `${marker} receipt`,
      },
    });
    await db.financeTransaction.update({
      where: { id: receivable.id },
      data: { status: "SETTLED", settledAt: new Date() },
    });
    const payable = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "PAYABLE",
        amountToman: 400n,
        categoryId: expenseCategory.id,
        dueAt: new Date(),
        description: `${marker} check payable`,
      },
    });
    const check = await db.checkRecord.create({
      data: {
        agencyId: agency.id,
        transactionId: payable.id,
        accountId: bank.id,
        direction: "PAYABLE",
        status: "CLEARED",
        checkNumber: marker,
        bankName: "بانک تست",
        issuerName: "دفتر تست",
        amountToman: 400n,
        dueAt: new Date(),
        clearedAt: new Date(),
      },
    });
    const checkPayment = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "PAYMENT",
        amountToman: 400n,
        sourceAccountId: bank.id,
        parentId: payable.id,
        description: `${marker} check payment`,
      },
    });
    await db.financeTransaction.update({
      where: { id: payable.id },
      data: { status: "SETTLED", settledAt: new Date() },
    });
    const salary = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "SALARY",
        status: "SETTLED",
        amountToman: 600n,
        categoryId: expenseCategory.id,
        employeeId: user.id,
        description: `${marker} salary`,
      },
    });
    const payroll = await db.payrollRecord.create({
      data: {
        agencyId: agency.id,
        userId: user.id,
        employeeProfileId: (
          await db.employeeProfile.findUnique({ where: { userId: user.id } })
        )?.id,
        transactionId: salary.id,
        year: 1598,
        month: 12,
        baseSalaryToman: 600n,
        netPayableToman: 600n,
        status: "PAID",
        approvedAt: new Date(),
        paidAt: new Date(),
        notes: marker,
      },
    });
    const salaryPayment = await db.financeTransaction.create({
      data: {
        ...common,
        transactionNumber: newFinanceTransactionNumber("SMK"),
        type: "PAYMENT",
        amountToman: 600n,
        sourceAccountId: bank.id,
        parentId: salary.id,
        description: `${marker} salary payment`,
      },
    });
    const created = [
      income,
      expense,
      transfer,
      { ...receivable, status: "SETTLED" as const },
      receipt,
      { ...payable, status: "SETTLED" as const },
      checkPayment,
      { ...salary, status: "SETTLED" as const },
      salaryPayment,
    ];
    const balances = calculateAccountBalances(
      [
        { id: bank.id, type: bank.type, openingBalanceToman: 0n },
        { id: cash.id, type: cash.type, openingBalanceToman: 0n },
        { id: petty.id, type: petty.type, openingBalanceToman: 0n },
      ],
      created,
    );
    const pnl = calculateProfitAndLoss(created);
    if (
      balances.get(bank.id) !== -500n ||
      balances.get(cash.id) !== 500n ||
      balances.get(petty.id) !== 300n ||
      pnl.profit !== 300n ||
      check.status !== "CLEARED" ||
      payroll.status !== "PAID"
    )
      throw new Error("گردش حسابداری با نتیجه مورد انتظار تطبیق ندارد.");
    console.log(
      "Accounting smoke test passed: income → expense → transfer → receivable settlement → check clearing → payroll → P&L.",
    );
  } finally {
    await db.checkRecord.deleteMany({ where: { checkNumber: marker } });
    await db.payrollRecord.deleteMany({ where: { notes: marker } });
    await db.financeTransaction.deleteMany({
      where: { agencyId: agency.id, description: { startsWith: marker } },
    });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
