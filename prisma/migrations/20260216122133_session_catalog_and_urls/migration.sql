-- AlterTable
ALTER TABLE "SessionTemplate" ADD COLUMN     "h4Url1" TEXT,
ADD COLUMN     "h4Url2" TEXT,
ADD COLUMN     "h4Url3" TEXT,
ADD COLUMN     "serie" TEXT;

-- CreateTable
CREATE TABLE "SessionCatalog" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "sessionDate" TEXT NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryTsUtc" TIMESTAMP(3) NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "slPrice" DOUBLE PRECISION,
    "tpPrice" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "title" TEXT,
    "notesMd" TEXT,
    "reviewJson" JSONB,
    "result" TEXT,
    "sumR" DOUBLE PRECISION,
    "discipline" INTEGER,
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalTag" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionCatalog_symbol_serie_key" ON "SessionCatalog"("symbol", "serie");

-- CreateIndex
CREATE INDEX "Trade_runId_idx" ON "Trade"("runId");

-- CreateIndex
CREATE INDEX "JournalEntry_runId_idx" ON "JournalEntry"("runId");

-- CreateIndex
CREATE INDEX "JournalTag_entryId_idx" ON "JournalTag"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalTag_entryId_tag_key" ON "JournalTag"("entryId", "tag");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SessionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SessionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTag" ADD CONSTRAINT "JournalTag_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
