import type {
  FinanceTransactionStatus,
  FinanceTransactionType,
  FinancialAccountType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export const DEFAULT_FINANCIAL_ACCOUNTS = [
  { code: "CASH", name: "صندوق دفتر", type: "CASH" as const },
  { code: "BANK", name: "حساب بانکی اصلی", type: "BANK" as const },
  { code: "PETTY", name: "تنخواه دفتر", type: "PETTY_CASH" as const },
];

export const DEFAULT_FINANCE_CATEGORIES = [
  { name: "درآمد کمیسیون", type: "INCOME" as const },
  { name: "سایر درآمدها", type: "INCOME" as const },
  { name: "حقوق و دستمزد", type: "EXPENSE" as const },
  { name: "پورسانت پرسنل", type: "EXPENSE" as const },
  { name: "اجاره و شارژ دفتر", type: "EXPENSE" as const },
  { name: "تبلیغات و بازاریابی", type: "EXPENSE" as const },
  { name: "آب، برق، گاز و اینترنت", type: "EXPENSE" as const },
  { name: "ملزومات و سایر هزینه‌ها", type: "EXPENSE" as const },
];

export async function ensureDefaultAccounting(agencyId: string) {
  await db.$transaction([
    db.financialAccount.createMany({
      data: DEFAULT_FINANCIAL_ACCOUNTS.map((item) => ({ agencyId, ...item })),
      skipDuplicates: true,
    }),
    db.financeCategory.createMany({
      data: DEFAULT_FINANCE_CATEGORIES.map((item) => ({
        agencyId,
        ...item,
        isSystem: true,
      })),
      skipDuplicates: true,
    }),
  ]);
}

type BalanceAccount = {
  id: string;
  type: FinancialAccountType;
  openingBalanceToman: bigint;
};

type BalanceTransaction = {
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  amountToman: bigint;
  status: FinanceTransactionStatus;
};

export function calculateAccountBalances(
  accounts: BalanceAccount[],
  transactions: BalanceTransaction[],
) {
  const balances = new Map(
    accounts.map((account) => [account.id, account.openingBalanceToman]),
  );
  for (const transaction of transactions) {
    if (!transactionIsEffective(transaction.status)) continue;
    if (transaction.sourceAccountId)
      balances.set(
        transaction.sourceAccountId,
        (balances.get(transaction.sourceAccountId) || 0n) -
          transaction.amountToman,
      );
    if (transaction.destinationAccountId)
      balances.set(
        transaction.destinationAccountId,
        (balances.get(transaction.destinationAccountId) || 0n) +
          transaction.amountToman,
      );
  }
  return balances;
}

export function transactionIsEffective(status: FinanceTransactionStatus) {
  return status === "POSTED" || status === "SETTLED";
}

const incomeTypes = new Set<FinanceTransactionType>(["INCOME", "RECEIVABLE"]);
const expenseTypes = new Set<FinanceTransactionType>([
  "EXPENSE",
  "PAYABLE",
  "SALARY",
  "COMMISSION",
  "REFUND",
]);

export function calculateProfitAndLoss(
  transactions: Array<{
    type: FinanceTransactionType;
    status: FinanceTransactionStatus;
    amountToman: bigint;
  }>,
) {
  let income = 0n;
  let expense = 0n;
  for (const transaction of transactions) {
    if (!transactionIsEffective(transaction.status)) continue;
    if (incomeTypes.has(transaction.type)) income += transaction.amountToman;
    if (expenseTypes.has(transaction.type)) expense += transaction.amountToman;
  }
  return { income, expense, profit: income - expense };
}

export function accountRoleForType(type: FinancialAccountType) {
  return type === "CASH" ? "صندوق" : type === "BANK" ? "بانک" : "تنخواه";
}

export function newFinanceTransactionNumber(prefix = "FIN") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
}
