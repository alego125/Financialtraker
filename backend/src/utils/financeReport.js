const { decimal, money } = require('./decimal');
const sum = (a, b) => money(decimal(a ?? 0).plus(b ?? 0));
function computeKpis(transactions) {
  const monthly = new Map(), categories = { ARS: new Map(), USD: new Map() };
  const totals = { ARS: { income: decimal(0), expense: decimal(0), reimbursement: decimal(0) }, USD: { income: decimal(0), expense: decimal(0), reimbursement: decimal(0) } };
  for (const tx of transactions) {
    if (tx.transferId) continue;
    const currency = tx.currency || 'ARS';
    if (!totals[currency]) continue;
    const amount = decimal(tx.amount), month = new Date(tx.date).toISOString().slice(0, 7);
    if (!monthly.has(month)) monthly.set(month, { month, income: 0, incomeUSD: 0, expense: 0, expenseUSD: 0, reimbursement: 0, reimbursementUSD: 0 });
    const kind = tx.type === 'EXPENSE' ? 'expense' : tx.isReimbursement ? 'reimbursement' : 'income';
    const suffix = currency === 'USD' ? 'USD' : '';
    totals[currency][kind] = totals[currency][kind].plus(amount);
    const row = monthly.get(month);
    row[kind + suffix] = sum(row[kind + suffix], amount);
    if (kind === 'expense') {
      const name = tx.category?.name || 'Sin categoría';
      if (!categories[currency].has(name)) categories[currency].set(name, { name, value: 0, items: [] });
      const category = categories[currency].get(name);
      category.value = sum(category.value, amount);
      if (tx.comment) category.items.push({ comment: tx.comment, amount: money(amount) });
    }
  }
  const count = Math.max(monthly.size, 1), kpis = {}, charts = {};
  for (const currency of ['ARS', 'USD']) {
    const suffix = currency === 'USD' ? 'USD' : '', total = totals[currency];
    const rows = [...categories[currency].values()].map(c => ({ ...c, amount: c.value,
      items: c.items.sort((a, b) => b.amount - a.amount).slice(0, 5),
      percentage: total.expense.gt(0) ? money(decimal(c.value).div(total.expense).mul(100)) : 0,
    })).sort((a, b) => b.value - a.value);
    Object.assign(kpis, {
      ['totalIncome' + suffix]: money(total.income), ['totalExpense' + suffix]: money(total.expense),
      ['totalReimbursement' + suffix]: money(total.reimbursement),
      ['balance' + suffix]: money(total.income.plus(total.reimbursement).minus(total.expense)),
      ['avgMonthlyIncome' + suffix]: money(total.income.div(count)), ['avgMonthlyExpense' + suffix]: money(total.expense.div(count)),
      ['savingsRate' + suffix]: total.income.gt(0) ? total.income.minus(total.expense).div(total.income).mul(100).toDecimalPlaces(1).toNumber() : 0,
      ['topExpenseCategory' + suffix]: rows.length ? { name: rows[0].name, amount: rows[0].value } : null,
    });
    charts['categoryExpense' + suffix] = rows;
    charts['pie' + suffix] = rows;
  }
  charts.monthly = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m,
    balance: sum(sum(m.income, m.reimbursement), -m.expense), balanceUSD: sum(sum(m.incomeUSD, m.reimbursementUSD), -m.expenseUSD),
  }));
  return { kpis, charts };
}
function combineKpis(left, right) {
  const combined = {};
  for (const suffix of ['', 'USD']) {
    for (const key of ['totalIncome', 'totalExpense', 'totalReimbursement', 'balance']) combined[key + suffix] = sum(left[key + suffix], right[key + suffix]);
    const income = decimal(combined['totalIncome' + suffix]);
    combined['savingsRate' + suffix] = income.gt(0) ? income.minus(combined['totalExpense' + suffix]).div(income).mul(100).toDecimalPlaces(1).toNumber() : 0;
  }
  return combined;
}
function combineMonthly(left, right) {
  const my = new Map(left.map(m => [m.month, m])), partner = new Map(right.map(m => [m.month, m]));
  return [...new Set([...my.keys(), ...partner.keys()])].sort().map(month => ({ month,
    myIncome: my.get(month)?.income || 0, myExpense: my.get(month)?.expense || 0,
    partnerIncome: partner.get(month)?.income || 0, partnerExpense: partner.get(month)?.expense || 0,
    myIncomeUSD: my.get(month)?.incomeUSD || 0, myExpenseUSD: my.get(month)?.expenseUSD || 0,
    partnerIncomeUSD: partner.get(month)?.incomeUSD || 0, partnerExpenseUSD: partner.get(month)?.expenseUSD || 0,
  }));
}
module.exports = { computeKpis, combineKpis, combineMonthly };
