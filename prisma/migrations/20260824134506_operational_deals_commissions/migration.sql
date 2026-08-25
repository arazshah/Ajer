-- CreateEnum
CREATE TYPE "PersonnelType" AS ENUM ('OWNER', 'MANAGER', 'AGENT', 'MARKETER', 'CONTRACT_EXPERT', 'RECEPTIONIST', 'ACCOUNTANT', 'PHOTOGRAPHER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "CommissionCalculationBase" AS ENUM ('AGREED_PRICE', 'DEPOSIT_AMOUNT', 'MONTHLY_RENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'VOID');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "ContractRegistrationStatus" AS ENUM ('NOT_SUBMITTED', 'DRAFT', 'SUBMITTED', 'REGISTERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DealReceiptType" AS ENUM ('COMMISSION', 'DEPOSIT', 'RENT', 'OTHER', 'REFUND');

-- CreateEnum
CREATE TYPE "DealReceiptStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED', 'VOID');

-- CreateEnum
CREATE TYPE "DealPaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER');

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "personnelType" "PersonnelType" NOT NULL DEFAULT 'AGENT',
    "jobTitle" TEXT,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "nationalCode" TEXT,
    "bankName" TEXT,
    "iban" TEXT,
    "fixedSalaryToman" BIGINT,
    "defaultCommissionBasisPoints" INTEGER NOT NULL DEFAULT 5000,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPolicy" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transactionType" "TransactionType",
    "calculationBase" "CommissionCalculationBase" NOT NULL,
    "ownerRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "applicantRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "fixedOwnerAmountToman" BIGINT NOT NULL DEFAULT 0,
    "fixedApplicantAmountToman" BIGINT NOT NULL DEFAULT 0,
    "taxRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "maximumPerSideToman" BIGINT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealContract" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "contractDate" TIMESTAMP(3),
    "registrySystem" TEXT NOT NULL DEFAULT 'کاتب',
    "registryReference" TEXT,
    "registrationStatus" "ContractRegistrationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "signedAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealStatusHistory" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "fromStatus" "DealStatus",
    "toStatus" "DealStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealCommission" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "policyId" TEXT,
    "calculationBase" "CommissionCalculationBase" NOT NULL,
    "calculationBaseToman" BIGINT NOT NULL,
    "ownerAmountToman" BIGINT NOT NULL DEFAULT 0,
    "applicantAmountToman" BIGINT NOT NULL DEFAULT 0,
    "discountToman" BIGINT NOT NULL DEFAULT 0,
    "taxAmountToman" BIGINT NOT NULL DEFAULT 0,
    "totalAmountToman" BIGINT NOT NULL,
    "receivedAmountToman" BIGINT NOT NULL DEFAULT 0,
    "status" "CommissionStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionAllocation" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "basisPoints" INTEGER NOT NULL DEFAULT 0,
    "fixedAmountToman" BIGINT,
    "amountToman" BIGINT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealReceipt" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "payerContactId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "type" "DealReceiptType" NOT NULL DEFAULT 'COMMISSION',
    "status" "DealReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "method" "DealPaymentMethod" NOT NULL,
    "amountToman" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "reference" TEXT,
    "checkNumber" TEXT,
    "bankName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_agencyId_employmentStatus_personnelType_idx" ON "EmployeeProfile"("agencyId", "employmentStatus", "personnelType");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_agencyId_employeeCode_key" ON "EmployeeProfile"("agencyId", "employeeCode");

-- CreateIndex
CREATE INDEX "CommissionPolicy_agencyId_isActive_effectiveFrom_idx" ON "CommissionPolicy"("agencyId", "isActive", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "DealContract_dealId_key" ON "DealContract"("dealId");

-- CreateIndex
CREATE INDEX "DealStatusHistory_dealId_createdAt_idx" ON "DealStatusHistory"("dealId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DealCommission_dealId_key" ON "DealCommission"("dealId");

-- CreateIndex
CREATE INDEX "DealCommission_status_createdAt_idx" ON "DealCommission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionAllocation_commissionId_status_idx" ON "CommissionAllocation"("commissionId", "status");

-- CreateIndex
CREATE INDEX "CommissionAllocation_userId_status_idx" ON "CommissionAllocation"("userId", "status");

-- CreateIndex
CREATE INDEX "DealReceipt_agencyId_status_paidAt_idx" ON "DealReceipt"("agencyId", "status", "paidAt");

-- CreateIndex
CREATE INDEX "DealReceipt_dealId_createdAt_idx" ON "DealReceipt"("dealId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DealReceipt_agencyId_receiptNumber_key" ON "DealReceipt"("agencyId", "receiptNumber");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "CommissionPolicy_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealContract" ADD CONSTRAINT "DealContract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStatusHistory" ADD CONSTRAINT "DealStatusHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStatusHistory" ADD CONSTRAINT "DealStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCommission" ADD CONSTRAINT "DealCommission_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCommission" ADD CONSTRAINT "DealCommission_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CommissionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCommission" ADD CONSTRAINT "DealCommission_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "DealCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceipt" ADD CONSTRAINT "DealReceipt_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceipt" ADD CONSTRAINT "DealReceipt_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceipt" ADD CONSTRAINT "DealReceipt_payerContactId_fkey" FOREIGN KEY ("payerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
