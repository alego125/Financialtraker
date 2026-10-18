const test = require('node:test');
const assert = require('node:assert/strict');
const { replay } = require('../src/utils/investmentMath');
const { inputDecimal } = require('../src/utils/decimal');
test('moving-average replay handles fractions without binary rounding or early quantity rounding', () => {
  const state = replay([
    { type: 'BUY', quantity: '0.1', unitPrice: '0.1' }, { type: 'BUY', quantity: '0.2', unitPrice: '0.2' },
    { type: 'SELL', quantity: '0.1', unitPrice: '0.2' },
  ]);
  assert.equal(state.qty, 0.2); assert.equal(state.invested, 0.03);
  assert.equal(state.steps[2].realizedGain, 0);
});
test('half-cent realized gain rounds half up and a full sale leaves zero cost', () => {
  const state = replay([{ type: 'BUY', quantity: '1', unitPrice: '1' }, { type: 'SELL', quantity: '1', unitPrice: '1.005' }]);
  assert.equal(state.steps[1].realizedGain, 0.01); assert.equal(state.invested, 0); assert.equal(state.qty, 0);
});
test('quantity scale and range are enforced before database rounding', () => {
  for (const value of ['0.0000001', 'Infinity', '1x', '1000000000000', '-1']) assert.throws(() => inputDecimal(value, 6, 12, true));
  assert.equal(inputDecimal('0.000001', 6, 12, true), '0.000001');
});
