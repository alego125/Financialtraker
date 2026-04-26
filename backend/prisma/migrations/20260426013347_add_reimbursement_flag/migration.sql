-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('REGULAR', 'INVESTMENT', 'CREDIT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "initialBalanceUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SharedAccount" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "initialBalanceUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'ARS',
ADD COLUMN     "isReimbursement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentType" "PaymentType",
ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "Transfer" (
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
CREATE TABLE "CurrencyExchange" (
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
CREATE TABLE "SharedAccountExchange" (
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
CREATE INDEX "Transfer_initiatorId_idx" ON "Transfer"("initiatorId");

-- CreateIndex
CREATE INDEX "Transfer_date_idx" ON "Transfer"("date");

-- CreateIndex
CREATE INDEX "Transfer_fromAccountId_idx" ON "Transfer"("fromAccountId");

-- CreateIndex
CREATE INDEX "Transfer_toAccountId_idx" ON "Transfer"("toAccountId");

-- CreateIndex
CREATE INDEX "Transfer_fromSharedAccountId_idx" ON "Transfer"("fromSharedAccountId");

-- CreateIndex
CREATE INDEX "Transfer_toSharedAccountId_idx" ON "Transfer"("toSharedAccountId");

-- CreateIndex
CREATE INDEX "CurrencyExchange_accountId_idx" ON "CurrencyExchange"("accountId");

-- CreateIndex
CREATE INDEX "CurrencyExchange_userId_idx" ON "CurrencyExchange"("userId");

-- CreateIndex
CREATE INDEX "CurrencyExchange_date_idx" ON "CurrencyExchange"("date");

-- CreateIndex
CREATE INDEX "SharedAccountExchange_sharedAccountId_idx" ON "SharedAccountExchange"("sharedAccountId");

-- CreateIndex
CREATE INDEX "SharedAccountExchange_userId_idx" ON "SharedAccountExchange"("userId");

-- CreateIndex
CREATE INDEX "SharedAccountExchange_date_idx" ON "SharedAccountExchange"("date");

-- CreateIndex
CREATE INDEX "Transaction_paymentType_idx" ON "Transaction"("paymentType");

-- CreateIndex
CREATE INDEX "Transaction_currency_idx" ON "Transaction"("currency");

-- CreateIndex
CREATE INDEX "Transaction_transferId_idx" ON "Transaction"("transferId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromSharedAccountId_fkey" FOREIGN KEY ("fromSharedAccountId") REFERENCES "SharedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toSharedAccountId_fkey" FOREIGN KEY ("toSharedAccountId") REFERENCES "SharedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedAccountExchange" ADD CONSTRAINT "SharedAccountExchange_sharedAccountId_fkey" FOREIGN KEY ("sharedAccountId") REFERENCES "SharedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedAccountExchange" ADD CONSTRAINT "SharedAccountExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
