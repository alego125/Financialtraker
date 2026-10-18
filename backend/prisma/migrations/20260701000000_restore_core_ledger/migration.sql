-- Restore the core ledger omitted from the recorded migrations. This must sort
-- before InvestmentPosition, which already references Currency.
DO $$ BEGIN CREATE TYPE "PaymentType" AS ENUM ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccountType" AS ENUM ('REGULAR', 'INVESTMENT', 'CREDIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Currency" AS ENUM ('ARS', 'USD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'REGULAR', ADD COLUMN IF NOT EXISTS "initialBalanceUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "SharedAccount" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'REGULAR', ADD COLUMN IF NOT EXISTS "initialBalanceUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'ARS', ADD COLUMN IF NOT EXISTS "paymentType" "PaymentType", ADD COLUMN IF NOT EXISTS "transferId" TEXT;
CREATE INDEX IF NOT EXISTS "Transaction_currency_idx" ON "Transaction"("currency");
CREATE INDEX IF NOT EXISTS "Transaction_paymentType_idx" ON "Transaction"("paymentType");
CREATE INDEX IF NOT EXISTS "Transaction_transferId_idx" ON "Transaction"("transferId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "Transfer" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "date" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatorId" TEXT NOT NULL,
    "fromAccountId" TEXT,
    "fromSharedAccountId" TEXT,
    "toAccountId" TEXT,
    "toSharedAccountId" TEXT,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CurrencyExchange" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "usdAmount" DECIMAL(12,2) NOT NULL,
    "arsAmount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SharedAccountExchange" (
    "id" TEXT NOT NULL,
    "sharedAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "usdAmount" DECIMAL(12,2) NOT NULL,
    "arsAmount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedAccountExchange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transfer_initiatorId_idx" ON "Transfer"("initiatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transfer_date_idx" ON "Transfer"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transfer_fromAccountId_idx" ON "Transfer"("fromAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transfer_toAccountId_idx" ON "Transfer"("toAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transfer_fromSharedAccountId_idx" ON "Transfer"("fromSharedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transfer_toSharedAccountId_idx" ON "Transfer"("toSharedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CurrencyExchange_accountId_idx" ON "CurrencyExchange"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CurrencyExchange_userId_idx" ON "CurrencyExchange"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CurrencyExchange_date_idx" ON "CurrencyExchange"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SharedAccountExchange_sharedAccountId_idx" ON "SharedAccountExchange"("sharedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SharedAccountExchange_userId_idx" ON "SharedAccountExchange"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SharedAccountExchange_date_idx" ON "SharedAccountExchange"("date");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromSharedAccountId_fkey" FOREIGN KEY ("fromSharedAccountId") REFERENCES "SharedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toSharedAccountId_fkey" FOREIGN KEY ("toSharedAccountId") REFERENCES "SharedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SharedAccountExchange" ADD CONSTRAINT "SharedAccountExchange_sharedAccountId_fkey" FOREIGN KEY ("sharedAccountId") REFERENCES "SharedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SharedAccountExchange" ADD CONSTRAINT "SharedAccountExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
