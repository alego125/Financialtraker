-- AlterTable: add isReimbursement flag to Transaction
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isReimbursement" BOOLEAN NOT NULL DEFAULT false;
