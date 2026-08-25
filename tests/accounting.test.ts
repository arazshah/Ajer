import { describe, expect, it } from "vitest";
import {
  calculateAccountBalances,
  calculateProfitAndLoss,
} from "@/lib/accounting";

describe("accounting", () => {
  it("keeps transfers out of profit while moving cash", () => {
    const accounts = [
      { id: "cash", type: "CASH" as const, openingBalanceToman: 1_000n },
      { id: "bank", type: "BANK" as const, openingBalanceToman: 0n },
    ];
    const balances = calculateAccountBalances(accounts, [
      {
        sourceAccountId: "cash",
        destinationAccountId: "bank",
        amountToman: 400n,
        status: "POSTED",
      },
    ]);
    expect(balances.get("cash")).toBe(600n);
    expect(balances.get("bank")).toBe(400n);
  });

  it("calculates accrual profit without double-counting settlement", () => {
    expect(
      calculateProfitAndLoss([
        { type: "RECEIVABLE", status: "POSTED", amountToman: 900n },
        { type: "RECEIPT", status: "POSTED", amountToman: 900n },
        { type: "PAYABLE", status: "POSTED", amountToman: 300n },
        { type: "PAYMENT", status: "POSTED", amountToman: 300n },
        { type: "TRANSFER", status: "POSTED", amountToman: 100n },
      ]),
    ).toEqual({ income: 900n, expense: 300n, profit: 600n });
  });

  it("ignores draft and void transactions", () => {
    expect(
      calculateProfitAndLoss([
        { type: "INCOME", status: "DRAFT", amountToman: 100n },
        { type: "EXPENSE", status: "VOID", amountToman: 100n },
      ]).profit,
    ).toBe(0n);
  });
});
