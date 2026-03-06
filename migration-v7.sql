-- v7 migration: add accountType + initialBalanceUSD to SharedAccount

DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('REGULAR', 'INVESTMENT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SharedAccount new columns
ALTER TABLE "SharedAccount"
  ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "initialBalanceUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Account new columns (in case v6 wasn't run)
ALTER TABLE "Account"
  ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "initialBalanceUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'ARS';

ALTER TABLE "Transfer"
  ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'ARS';

CREATE TABLE IF NOT EXISTS "CurrencyExchange" (
  "id"        TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "date"      TIMESTAMP NOT NULL,
  "usdAmount" DECIMAL(12,2) NOT NULL,
  "arsAmount" DECIMAL(12,2) NOT NULL,
  "rate"      DECIMAL(12,4) NOT NULL,
  "comment"   TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurrencyExchange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurrencyExchange_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE,
  CONSTRAINT "CurrencyExchange_userId_fkey"   FOREIGN KEY ("userId")    REFERENCES "User"("id")    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Transaction_currency_idx"       ON "Transaction"("currency");
CREATE INDEX IF NOT EXISTS "CurrencyExchange_accountId_idx" ON "CurrencyExchange"("accountId");
CREATE INDEX IF NOT EXISTS "CurrencyExchange_userId_idx"    ON "CurrencyExchange"("userId");
CREATE INDEX IF NOT EXISTS "CurrencyExchange_date_idx"      ON "CurrencyExchange"("date");

SELECT 'Migration v7 OK' AS status;
