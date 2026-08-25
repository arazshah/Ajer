DROP INDEX "Contact_agencyId_nationalCode_idx";
CREATE UNIQUE INDEX "Contact_agencyId_nationalCode_key" ON "Contact"("agencyId", "nationalCode");
