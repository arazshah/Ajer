-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmsDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "VisitStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "VisitStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN "checkedInAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "followUpAt" TIMESTAMP(3),
ADD COLUMN "interestLevel" INTEGER,
ADD COLUMN "ownerFeedback" TEXT;

-- CreateTable
CREATE TABLE "SalesOffer" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "visitId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "round" INTEGER NOT NULL DEFAULT 1,
    "priceToman" BIGINT,
    "depositToman" BIGINT,
    "monthlyRentToman" BIGINT,
    "terms" TEXT,
    "responseNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "contactId" TEXT,
    "propertyId" TEXT,
    "visitId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsDispatch" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "parametersJson" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "SmsDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmsDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesOffer_agencyId_status_createdAt_idx" ON "SalesOffer"("agencyId", "status", "createdAt");
CREATE INDEX "SalesOffer_propertyId_applicantId_round_idx" ON "SalesOffer"("propertyId", "applicantId", "round");
CREATE INDEX "WorkTask_agencyId_status_dueAt_idx" ON "WorkTask"("agencyId", "status", "dueAt");
CREATE INDEX "WorkTask_assignedToId_status_dueAt_idx" ON "WorkTask"("assignedToId", "status", "dueAt");
CREATE INDEX "SmsDispatch_status_scheduledFor_attempts_idx" ON "SmsDispatch"("status", "scheduledFor", "attempts");
CREATE INDEX "SmsDispatch_agencyId_relatedType_relatedId_idx" ON "SmsDispatch"("agencyId", "relatedType", "relatedId");

ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmsDispatch" ADD CONSTRAINT "SmsDispatch_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
