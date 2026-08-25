CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'CUSTOMER', 'LOST', 'ARCHIVED');
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TYPE "PropertyMediaType" AS ENUM ('IMAGE', 'VIDEO', 'FLOOR_PLAN', 'VIRTUAL_TOUR');

ALTER TABLE "Contact" ADD COLUMN "address" TEXT,
ADD COLUMN "assignedAgentId" TEXT,
ADD COLUMN "birthDate" TIMESTAMP(3),
ADD COLUMN "city" TEXT,
ADD COLUMN "companyName" TEXT,
ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "leadScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "leadStatus" "LeadStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "occupation" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "province" TEXT;

ALTER TABLE "Property" ADD COLUMN "fingerprint" TEXT;

CREATE TABLE "ContactTag" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#c65d35',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContactTagAssignment" (
  "contactId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "ContactTagAssignment_pkey" PRIMARY KEY ("contactId", "tagId")
);
CREATE TABLE "FileAsset" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContactDocument" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "documentNumber" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "rejectionReason" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PropertyDocument" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "documentNumber" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "rejectionReason" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PropertyMedia" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "mediaType" "PropertyMediaType" NOT NULL DEFAULT 'IMAGE',
  "title" TEXT NOT NULL,
  "alt" TEXT,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactTag_agencyId_name_key" ON "ContactTag"("agencyId", "name");
CREATE INDEX "ContactTag_agencyId_name_idx" ON "ContactTag"("agencyId", "name");
CREATE INDEX "ContactTagAssignment_tagId_idx" ON "ContactTagAssignment"("tagId");
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE INDEX "FileAsset_agencyId_createdAt_idx" ON "FileAsset"("agencyId", "createdAt");
CREATE INDEX "FileAsset_agencyId_sha256_idx" ON "FileAsset"("agencyId", "sha256");
CREATE UNIQUE INDEX "ContactDocument_assetId_key" ON "ContactDocument"("assetId");
CREATE INDEX "ContactDocument_agencyId_status_expiresAt_idx" ON "ContactDocument"("agencyId", "status", "expiresAt");
CREATE INDEX "ContactDocument_contactId_documentType_idx" ON "ContactDocument"("contactId", "documentType");
CREATE UNIQUE INDEX "PropertyDocument_assetId_key" ON "PropertyDocument"("assetId");
CREATE INDEX "PropertyDocument_agencyId_status_expiresAt_idx" ON "PropertyDocument"("agencyId", "status", "expiresAt");
CREATE INDEX "PropertyDocument_propertyId_documentType_idx" ON "PropertyDocument"("propertyId", "documentType");
CREATE UNIQUE INDEX "PropertyMedia_assetId_key" ON "PropertyMedia"("assetId");
CREATE INDEX "PropertyMedia_propertyId_sortOrder_idx" ON "PropertyMedia"("propertyId", "sortOrder");
CREATE INDEX "PropertyMedia_agencyId_mediaType_idx" ON "PropertyMedia"("agencyId", "mediaType");
CREATE INDEX "Contact_agencyId_leadStatus_assignedAgentId_idx" ON "Contact"("agencyId", "leadStatus", "assignedAgentId");
CREATE INDEX "Contact_agencyId_nationalCode_idx" ON "Contact"("agencyId", "nationalCode");
CREATE UNIQUE INDEX "Property_agencyId_fingerprint_key" ON "Property"("agencyId", "fingerprint");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTagAssignment" ADD CONSTRAINT "ContactTagAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTagAssignment" ADD CONSTRAINT "ContactTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ContactTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactDocument" ADD CONSTRAINT "ContactDocument_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactDocument" ADD CONSTRAINT "ContactDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactDocument" ADD CONSTRAINT "ContactDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactDocument" ADD CONSTRAINT "ContactDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
