-- DropForeignKey
ALTER TABLE "Idea" DROP CONSTRAINT "Idea_authorId_fkey";

-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "gutGravity" INTEGER,
ADD COLUMN     "gutScore" INTEGER,
ADD COLUMN     "gutTrend" INTEGER,
ADD COLUMN     "gutUrgency" INTEGER,
ADD COLUMN     "submitterEmail" TEXT,
ADD COLUMN     "submitterName" TEXT,
ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable (publicToken: adicionada opcional, populada e só então
-- tornada NOT NULL — a coluna já existe com 1 linha em dev, o
-- default do Prisma Client não roda em ALTER TABLE puro)
ALTER TABLE "IdeaBoard" ADD COLUMN     "publicCaptureEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicToken" TEXT;

UPDATE "IdeaBoard" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;

ALTER TABLE "IdeaBoard" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBoard_publicToken_key" ON "IdeaBoard"("publicToken");

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
