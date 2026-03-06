-- v7b: SharedAccountExchange table + SharedAccount new columns

-- New columns on SharedAccount (safe to run even if v7 was already run)
ALTER TABLE "SharedAccount"
  ADD COLUMN IF NOT EXISTS "accountType"       "AccountType"  NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "initialBalanceUSD" DECIMAL(12,2)  NOT NULL DEFAULT 0;

-- Exchange table for shared accounts
CREATE TABLE IF NOT EXISTS "SharedAccountExchange" (
  "id"               TEXT         NOT NULL,
  "sharedAccountId"  TEXT         NOT NULL,
  "userId"           TEXT         NOT NULL,
  "date"             TIMESTAMP    NOT NULL,
  "usdAmount"        DECIMAL(12,2) NOT NULL,
  "arsAmount"        DECIMAL(12,2) NOT NULL,
  "rate"             DECIMAL(12,4) NOT NULL,
  "comment"          TEXT,
  "createdAt"        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedAccountExchange_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "SharedAccountExchange_sharedAcc_fkey"  FOREIGN KEY ("sharedAccountId") REFERENCES "SharedAccount"("id") ON DELETE CASCADE,
  CONSTRAINT "SharedAccountExchange_user_fkey"       FOREIGN KEY ("userId")           REFERENCES "User"("id")          ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "SharedAccExchange_accId_idx"  ON "SharedAccountExchange"("sharedAccountId");
CREATE INDEX IF NOT EXISTS "SharedAccExchange_userId_idx" ON "SharedAccountExchange"("userId");
CREATE INDEX IF NOT EXISTS "SharedAccExchange_date_idx"   ON "SharedAccountExchange"("date");

SELECT 'Migration v7b OK' AS status;
