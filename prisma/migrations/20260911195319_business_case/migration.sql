-- CreateTable
CREATE TABLE "BusinessCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "capex" DOUBLE PRECISION NOT NULL,
    "opexMonthly" DOUBLE PRECISION NOT NULL,
    "benefitMonthly" DOUBLE PRECISION NOT NULL,
    "horizonMonths" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "gestorApprovedById" TEXT,
    "gestorApprovedAt" TIMESTAMP(3),
    "gestorComment" TEXT,
    "adminApprovedById" TEXT,
    "adminApprovedAt" TIMESTAMP(3),
    "adminComment" TEXT,
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "generatedListId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessCaseId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL,
    "actualAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCase_generatedListId_key" ON "BusinessCase"("generatedListId");

-- CreateIndex
CREATE INDEX "BusinessCase_organizationId_idx" ON "BusinessCase"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessCase_ideaId_idx" ON "BusinessCase"("ideaId");

-- CreateIndex
CREATE INDEX "BenefitRecord_organizationId_idx" ON "BenefitRecord"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BenefitRecord_businessCaseId_period_key" ON "BenefitRecord"("businessCaseId", "period");

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_gestorApprovedById_fkey" FOREIGN KEY ("gestorApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_adminApprovedById_fkey" FOREIGN KEY ("adminApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_generatedListId_fkey" FOREIGN KEY ("generatedListId") REFERENCES "List"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitRecord" ADD CONSTRAINT "BenefitRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitRecord" ADD CONSTRAINT "BenefitRecord_businessCaseId_fkey" FOREIGN KEY ("businessCaseId") REFERENCES "BusinessCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitRecord" ADD CONSTRAINT "BenefitRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
