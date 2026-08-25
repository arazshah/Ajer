CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'PETTY_CASH');
CREATE TYPE "FinanceCategoryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'RECEIVABLE', 'PAYABLE', 'RECEIPT', 'PAYMENT', 'SALARY', 'COMMISSION', 'PETTY_CASH_ADVANCE', 'PETTY_CASH_SETTLEMENT', 'REFUND');
CREATE TYPE "FinanceTransactionStatus" AS ENUM ('DRAFT', 'POSTED', 'SETTLED', 'VOID');
CREATE TYPE "CheckDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');
CREATE TYPE "CheckStatus" AS ENUM ('REGISTERED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'VOID');

CREATE TABLE "FinancialAccount" (
  "id" TEXT NOT NULL, "agencyId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "name" TEXT NOT NULL, "type" "FinancialAccountType" NOT NULL,
  "bankName" TEXT, "accountNumber" TEXT, "iban" TEXT,
  "openingBalanceToman" BIGINT NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinanceCategory" (
  "id" TEXT NOT NULL, "agencyId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "type" "FinanceCategoryType" NOT NULL, "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinanceTransaction" (
  "id" TEXT NOT NULL, "agencyId" TEXT NOT NULL, "transactionNumber" TEXT NOT NULL,
  "type" "FinanceTransactionType" NOT NULL, "status" "FinanceTransactionStatus" NOT NULL DEFAULT 'POSTED',
  "amountToman" BIGINT NOT NULL, "sourceAccountId" TEXT, "destinationAccountId" TEXT,
  "categoryId" TEXT, "contactId" TEXT, "propertyId" TEXT, "dealId" TEXT,
  "employeeId" TEXT, "createdById" TEXT NOT NULL, "parentId" TEXT,
  "dealReceiptId" TEXT, "commissionAllocationId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL, "dueAt" TIMESTAMP(3), "settledAt" TIMESTAMP(3),
  "description" TEXT NOT NULL, "reference" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CheckRecord" (
  "id" TEXT NOT NULL, "agencyId" TEXT NOT NULL, "transactionId" TEXT NOT NULL,
  "accountId" TEXT, "contactId" TEXT, "direction" "CheckDirection" NOT NULL,
  "status" "CheckStatus" NOT NULL DEFAULT 'REGISTERED', "checkNumber" TEXT NOT NULL,
  "sayadId" TEXT, "bankName" TEXT NOT NULL, "branchName" TEXT, "issuerName" TEXT NOT NULL,
  "amountToman" BIGINT NOT NULL, "issuedAt" TIMESTAMP(3), "dueAt" TIMESTAMP(3) NOT NULL,
  "depositedAt" TIMESTAMP(3), "clearedAt" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PayrollRecord" (
  "id" TEXT NOT NULL, "agencyId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "employeeProfileId" TEXT, "transactionId" TEXT, "year" INTEGER NOT NULL, "month" INTEGER NOT NULL,
  "baseSalaryToman" BIGINT NOT NULL DEFAULT 0, "commissionToman" BIGINT NOT NULL DEFAULT 0,
  "bonusToman" BIGINT NOT NULL DEFAULT 0, "deductionToman" BIGINT NOT NULL DEFAULT 0,
  "netPayableToman" BIGINT NOT NULL, "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAccount_agencyId_code_key" ON "FinancialAccount"("agencyId", "code");
CREATE INDEX "FinancialAccount_agencyId_type_isActive_idx" ON "FinancialAccount"("agencyId", "type", "isActive");
CREATE UNIQUE INDEX "FinanceCategory_agencyId_name_type_key" ON "FinanceCategory"("agencyId", "name", "type");
CREATE INDEX "FinanceCategory_agencyId_type_isActive_idx" ON "FinanceCategory"("agencyId", "type", "isActive");
CREATE UNIQUE INDEX "FinanceTransaction_dealReceiptId_key" ON "FinanceTransaction"("dealReceiptId");
CREATE UNIQUE INDEX "FinanceTransaction_commissionAllocationId_key" ON "FinanceTransaction"("commissionAllocationId");
CREATE UNIQUE INDEX "FinanceTransaction_agencyId_transactionNumber_key" ON "FinanceTransaction"("agencyId", "transactionNumber");
CREATE INDEX "FinanceTransaction_agencyId_status_occurredAt_idx" ON "FinanceTransaction"("agencyId", "status", "occurredAt");
CREATE INDEX "FinanceTransaction_agencyId_type_dueAt_idx" ON "FinanceTransaction"("agencyId", "type", "dueAt");
CREATE INDEX "FinanceTransaction_sourceAccountId_occurredAt_idx" ON "FinanceTransaction"("sourceAccountId", "occurredAt");
CREATE INDEX "FinanceTransaction_destinationAccountId_occurredAt_idx" ON "FinanceTransaction"("destinationAccountId", "occurredAt");
CREATE UNIQUE INDEX "CheckRecord_transactionId_key" ON "CheckRecord"("transactionId");
CREATE UNIQUE INDEX "CheckRecord_agencyId_checkNumber_key" ON "CheckRecord"("agencyId", "checkNumber");
CREATE INDEX "CheckRecord_agencyId_direction_status_dueAt_idx" ON "CheckRecord"("agencyId", "direction", "status", "dueAt");
CREATE UNIQUE INDEX "PayrollRecord_transactionId_key" ON "PayrollRecord"("transactionId");
CREATE UNIQUE INDEX "PayrollRecord_agencyId_userId_year_month_key" ON "PayrollRecord"("agencyId", "userId", "year", "month");
CREATE INDEX "PayrollRecord_agencyId_status_year_month_idx" ON "PayrollRecord"("agencyId", "status", "year", "month");

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinanceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_dealReceiptId_fkey" FOREIGN KEY ("dealReceiptId") REFERENCES "DealReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_commissionAllocationId_fkey" FOREIGN KEY ("commissionAllocationId") REFERENCES "CommissionAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckRecord" ADD CONSTRAINT "CheckRecord_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckRecord" ADD CONSTRAINT "CheckRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinanceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckRecord" ADD CONSTRAINT "CheckRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckRecord" ADD CONSTRAINT "CheckRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinanceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
