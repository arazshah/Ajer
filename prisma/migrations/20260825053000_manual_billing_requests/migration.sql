-- CreateEnum
CREATE TYPE "BillingRequestStatus" AS ENUM ('PENDING', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ManualPaymentMethod" AS ENUM ('BANK_TRANSFER', 'CARD_TO_CARD', 'CASH', 'REQUEST_CONTACT', 'OTHER');

-- CreateTable
CREATE TABLE "BillingRequest" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "receiptAssetId" TEXT,
    "subscriptionId" TEXT,
    "reviewedById" TEXT,
    "status" "BillingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "method" "ManualPaymentMethod" NOT NULL,
    "months" INTEGER NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "baseAmountToman" INTEGER NOT NULL,
    "aiAmountToman" INTEGER NOT NULL DEFAULT 0,
    "requestedAmountToman" INTEGER NOT NULL,
    "approvedAmountToman" INTEGER,
    "payerName" TEXT,
    "referenceCode" TEXT,
    "transferDate" TIMESTAMP(3),
    "notes" TEXT,
    "reviewNote" TEXT,
    "approvedStartsAt" TIMESTAMP(3),
    "approvedEndsAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingRequest_receiptAssetId_key" ON "BillingRequest"("receiptAssetId");
CREATE UNIQUE INDEX "BillingRequest_subscriptionId_key" ON "BillingRequest"("subscriptionId");
CREATE INDEX "BillingRequest_agencyId_createdAt_idx" ON "BillingRequest"("agencyId", "createdAt");
CREATE INDEX "BillingRequest_status_createdAt_idx" ON "BillingRequest"("status", "createdAt");
CREATE INDEX "BillingRequest_reviewedById_reviewedAt_idx" ON "BillingRequest"("reviewedById", "reviewedAt");

ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_receiptAssetId_fkey" FOREIGN KEY ("receiptAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
