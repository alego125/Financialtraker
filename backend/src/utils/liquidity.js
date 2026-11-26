const { decimal, money } = require('./decimal');

const DAY = 86_400_000;
const dayKey = date => date.toISOString().slice(0, 10);
const localDay = (instant = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const value = type => parts.find(part => part.type === type).value;
  return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00Z`);
};
const shift = (date, days) => new Date(date.getTime() + days * DAY);

function liquiditySeries(today, opening, movements) {
  const start = shift(today, -14);
  const end = shift(today, 14);
  const afterEnd = shift(end, 1);
  const todayKey = dayKey(today);
  const current = Object.fromEntries(Object.entries(opening).map(([key, value]) => [key, decimal(value)]));
  const days = new Map();
  const upcoming = { ARS: [], USD: [] };
  for (const movement of movements) {
    if (movement.date < start || movement.date >= afterEnd) continue;
    const key = dayKey(movement.date);
    if (!days.has(key)) days.set(key, { ARS: decimal(0), USD: decimal(0) });
    const totals = days.get(key);
    totals[movement.currency] = totals[movement.currency].plus(movement.amount);
    if (key > todayKey) upcoming[movement.currency].push({
      id: movement.id, day: key, description: movement.description, amount: money(movement.amount),
    });
  }
  const series = { ARS: [], USD: [] };
  for (let offset = -14; offset <= 14; offset++) {
    const day = dayKey(shift(today, offset));
    for (const currency of ['ARS', 'USD']) {
      current[currency] = current[currency].plus(days.get(day)?.[currency] || 0);
      const balance = money(current[currency]);
      series[currency].push({ day, actual: offset <= 0 ? balance : null, projected: offset >= 0 ? balance : null });
    }
  }
  return { today: todayKey, end: dayKey(end), series, upcoming };
}

function positionBreakdown(accounts, balances) {
  const position = Object.fromEntries(['ARS', 'USD'].map(currency => [currency, {
    cash: decimal(0), creditDebt: decimal(0), otherDebt: decimal(0),
  }]));

  for (const account of accounts) {
    const balance = balances.get(account.id);
    for (const [currency, amount] of [['ARS', balance.currentBalance], ['USD', balance.currentBalanceUSD]]) {
      const side = position[currency];
      if (amount < 0) {
        const field = account.accountType === 'CREDIT' ? 'creditDebt' : 'otherDebt';
        side[field] = side[field].minus(amount);
      } else if (account.accountType === 'REGULAR') {
        side.cash = side.cash.plus(amount);
      }
    }
  }

  return Object.fromEntries(Object.entries(position).map(([currency, values]) => [currency, {
    cash: money(values.cash),
    debt: money(values.creditDebt.plus(values.otherDebt)),
    creditDebt: money(values.creditDebt),
    otherDebt: money(values.otherDebt),
  }]));
}

module.exports = { localDay, shift, liquiditySeries, positionBreakdown };
