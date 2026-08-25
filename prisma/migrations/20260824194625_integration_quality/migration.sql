-- AlterEnum
ALTER TYPE "SmsDispatchStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "SmsDispatch" ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "processingStartedAt" TIMESTAMP(3),
ADD COLUMN     "providerMessageId" TEXT;

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "latencyMs" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "entityType" TEXT,
    "entityId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationEvent_provider_success_createdAt_idx" ON "IntegrationEvent"("provider", "success", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_agencyId_createdAt_idx" ON "IntegrationEvent"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_entityType_entityId_idx" ON "IntegrationEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SmsDispatch_status_nextAttemptAt_processingStartedAt_idx" ON "SmsDispatch"("status", "nextAttemptAt", "processingStartedAt");

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
