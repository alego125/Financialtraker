-- CreateEnum
CREATE TYPE "InvestmentOperationType" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "InvestmentAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "referencePrice" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "accountId" TEXT,
    "type" "InvestmentOperationType" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "realizedGain" DECIMAL(12,2),
    "gainTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentAsset_userId_name_key" ON "InvestmentAsset"("userId", "name");

-- CreateIndex
CREATE INDEX "InvestmentAsset_userId_idx" ON "InvestmentAsset"("userId");

-- CreateIndex
CREATE INDEX "InvestmentOperation_userId_idx" ON "InvestmentOperation"("userId");

-- CreateIndex
CREATE INDEX "InvestmentOperation_assetId_idx" ON "InvestmentOperation"("assetId");

-- CreateIndex
CREATE INDEX "InvestmentOperation_accountId_idx" ON "InvestmentOperation"("accountId");

-- AddForeignKey
ALTER TABLE "InvestmentAsset" ADD CONSTRAINT "InvestmentAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InvestmentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: convierte las InvestmentPosition legacy en un InvestmentAsset (catálogo,
-- deduplicado por userId+name) + una operación de compra inicial por cada fila legacy
-- (cantidad=1, precio=investedAmount). El accountName de texto libre se resuelve contra
-- Account.name del mismo usuario cuando hay match; si no, la operación queda sin cuenta.
WITH dedup_assets AS (
  SELECT DISTINCT ON (p."userId", p."name")
    p."userId", p."name", p."currency", p."currentValue" AS "referencePrice", p."updatedAt"
  FROM "InvestmentPosition" p
  ORDER BY p."userId", p."name", p."date" DESC
),
inserted_assets AS (
  INSERT INTO "InvestmentAsset" ("id", "userId", "name", "currency", "referencePrice", "createdAt", "updatedAt")
  SELECT md5(random()::text || clock_timestamp()::text || da."userId" || da."name")::uuid,
         da."userId", da."name", da."currency", da."referencePrice", CURRENT_TIMESTAMP, da."updatedAt"
  FROM dedup_assets da
  RETURNING "id" AS "assetId", "userId", "name"
)
INSERT INTO "InvestmentOperation" ("id", "userId", "assetId", "accountId", "type", "quantity", "unitPrice", "date", "notes", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || p."id")::uuid,
  p."userId",
  ia."assetId",
  acc."id",
  'BUY'::"InvestmentOperationType",
  1,
  p."investedAmount",
  p."date",
  p."notes",
  p."createdAt"
FROM "InvestmentPosition" p
JOIN inserted_assets ia ON ia."userId" = p."userId" AND ia."name" = p."name"
LEFT JOIN "Account" acc ON acc."userId" = p."userId" AND acc."name" = p."accountName";
