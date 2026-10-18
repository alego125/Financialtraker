import { formatDate } from './format.js';
export const formatReportDate = value => formatDate(value).replace(/\d{4}$/, year => year.slice(-2));

export function portfolioInCurrency(board, currency) {
  return board.filter(position => position.currency === currency);
}

export async function loadReportData(api, dateFrom, dateTo) {
  const [analysis, board] = await Promise.all([
    api.get('/analysis', { params: { dateFrom, dateTo } }), api.get('/investments/board'),
  ]);
  return { analysis: analysis.data, investments: board.data.map(position => ({
    name: position.assetName, currency: position.currency, accountName: position.accountName,
    investedAmount: position.invested, currentValue: position.currentValue,
    gain: position.unrealizedGain, gainPct: position.unrealizedGainPct,
    realizedGain: position.realizedGain,
  })) };
}
