-- CreateTable
CREATE TABLE "ImprovementTool" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "analyzableType" TEXT NOT NULL,
    "analyzableId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementTool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImprovementTool_organizationId_idx" ON "ImprovementTool"("organizationId");

-- CreateIndex
CREATE INDEX "ImprovementTool_analyzableType_analyzableId_idx" ON "ImprovementTool"("analyzableType", "analyzableId");

-- CreateIndex
CREATE INDEX "ImprovementTool_createdById_idx" ON "ImprovementTool"("createdById");

-- AddForeignKey
ALTER TABLE "ImprovementTool" ADD CONSTRAINT "ImprovementTool_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementTool" ADD CONSTRAINT "ImprovementTool_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
