CREATE TABLE "FinancialPlan" (
    "userId" TEXT NOT NULL,
    "exchangeRate" DECIMAL(12,4),
    "budgets" JSONB NOT NULL DEFAULT '[]',
    "goals" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "FinancialPlan_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "FinancialPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
