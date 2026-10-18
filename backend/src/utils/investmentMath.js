const { decimal, money } = require('./decimal');
function replay(ops) {
  let quantity = decimal(0), invested = decimal(0);
  const steps = [];
  for (const op of ops) {
    const q = decimal(op.quantity), price = decimal(op.unitPrice);
    if (op.type === 'BUY') {
      invested = invested.plus(q.mul(price)); quantity = quantity.plus(q);
      steps.push({ op, realizedGain: null });
    } else {
      if (q.gt(quantity)) {
        const error = new Error(`No hay cantidad suficiente para la venta: se necesitan ${q} y hay ${quantity} disponibles.`);
        error.status = 400; throw error;
      }
      const avg = quantity.gt(0) ? invested.div(quantity) : decimal(0);
      const realizedGain = money(price.minus(avg).mul(q));
      invested = invested.minus(avg.mul(q)); quantity = quantity.minus(q);
      if (quantity.isZero()) invested = decimal(0);
      steps.push({ op, realizedGain });
    }
  }
  const avg = quantity.gt(0) ? invested.div(quantity) : decimal(0);
  return { qty: quantity.toNumber(), invested: money(invested), avgCost: avg.toNumber(), quantityDecimal: quantity, investedDecimal: invested, avgCostDecimal: avg, steps };
}
module.exports = { replay };
