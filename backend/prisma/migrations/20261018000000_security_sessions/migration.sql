ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Transaction_userId_date_idx" ON "Transaction"("userId", "date");
CREATE INDEX IF NOT EXISTS "InvestmentOperation_gainTransactionId_idx" ON "InvestmentOperation"("gainTransactionId");
