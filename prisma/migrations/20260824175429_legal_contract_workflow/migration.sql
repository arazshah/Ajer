-- CreateEnum
CREATE TYPE "ContractVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'FINAL', 'SIGNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractPartyRole" AS ENUM ('SELLER', 'BUYER', 'LANDLORD', 'TENANT', 'OWNER', 'APPLICANT', 'GUARANTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractObligationStatus" AS ENUM ('PENDING', 'COMPLETED', 'WAIVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ContractChecklistStatus" AS ENUM ('PENDING', 'PROVIDED', 'VERIFIED', 'REJECTED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ContractAttachmentKind" AS ENUM ('DRAFT', 'SIGNED_COPY', 'IDENTITY', 'OWNERSHIP', 'PAYMENT', 'OTHER');

-- AlterTable
ALTER TABLE "DealContract" ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryAt" TIMESTAMP(3),
ADD COLUMN     "subject" TEXT;

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ContractVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "changeSummary" TEXT,
    "createdById" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractParty" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contactId" TEXT,
    "role" "ContractPartyRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "fatherName" TEXT,
    "nationalCode" TEXT,
    "identityNumber" TEXT,
    "mobile" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "shareBasisPoints" INTEGER NOT NULL DEFAULT 10000,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractWitness" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fatherName" TEXT,
    "nationalCode" TEXT,
    "identityNumber" TEXT,
    "mobile" TEXT,
    "address" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractWitness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractObligation" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "responsiblePartyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amountToman" BIGINT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "ContractObligationStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractChecklistItem" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ContractChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAttachment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "versionId" TEXT,
    "assetId" TEXT NOT NULL,
    "kind" "ContractAttachmentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractVersion_contractId_status_createdAt_idx" ON "ContractVersion"("contractId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_version_key" ON "ContractVersion"("contractId", "version");

-- CreateIndex
CREATE INDEX "ContractParty_contractId_role_idx" ON "ContractParty"("contractId", "role");

-- CreateIndex
CREATE INDEX "ContractParty_contactId_idx" ON "ContractParty"("contactId");

-- CreateIndex
CREATE INDEX "ContractWitness_contractId_idx" ON "ContractWitness"("contractId");

-- CreateIndex
CREATE INDEX "ContractObligation_contractId_status_dueAt_idx" ON "ContractObligation"("contractId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ContractChecklistItem_contractId_status_required_idx" ON "ContractChecklistItem"("contractId", "status", "required");

-- CreateIndex
CREATE UNIQUE INDEX "ContractChecklistItem_contractId_title_key" ON "ContractChecklistItem"("contractId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "ContractAttachment_assetId_key" ON "ContractAttachment"("assetId");

-- CreateIndex
CREATE INDEX "ContractAttachment_contractId_kind_createdAt_idx" ON "ContractAttachment"("contractId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ContractAttachment_versionId_idx" ON "ContractAttachment"("versionId");

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractWitness" ADD CONSTRAINT "ContractWitness_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractObligation" ADD CONSTRAINT "ContractObligation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractObligation" ADD CONSTRAINT "ContractObligation_responsiblePartyId_fkey" FOREIGN KEY ("responsiblePartyId") REFERENCES "ContractParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractChecklistItem" ADD CONSTRAINT "ContractChecklistItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractChecklistItem" ADD CONSTRAINT "ContractChecklistItem_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAttachment" ADD CONSTRAINT "ContractAttachment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAttachment" ADD CONSTRAINT "ContractAttachment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAttachment" ADD CONSTRAINT "ContractAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
