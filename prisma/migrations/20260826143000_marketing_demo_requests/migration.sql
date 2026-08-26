CREATE TYPE "DemoRequestStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'DEMO_SCHEDULED',
  'TRIAL_STARTED',
  'WON',
  'LOST',
  'ARCHIVED'
);

CREATE TABLE "DemoRequest" (
  "id" TEXT NOT NULL,
  "managerName" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "agencyName" TEXT NOT NULL,
  "cityArea" TEXT NOT NULL,
  "consultantCount" INTEGER NOT NULL,
  "status" "DemoRequestStatus" NOT NULL DEFAULT 'NEW',
  "followUpNote" TEXT,
  "contactedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerTestimonial" (
  "id" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "agencyName" TEXT NOT NULL,
  "city" TEXT,
  "quote" TEXT NOT NULL,
  "result" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerTestimonial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemoRequest_status_createdAt_idx" ON "DemoRequest"("status", "createdAt");
CREATE INDEX "DemoRequest_mobile_createdAt_idx" ON "DemoRequest"("mobile", "createdAt");
CREATE INDEX "CustomerTestimonial_isPublished_sortOrder_idx" ON "CustomerTestimonial"("isPublished", "sortOrder");
