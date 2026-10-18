const { Prisma } = require('@prisma/client');
// Local constructor: do not change Prisma's global Decimal configuration.
const Decimal = Prisma.Decimal.clone({ precision: 48, rounding: Prisma.Decimal.ROUND_HALF_UP });
const decimal = value => new Decimal(value?.toString() || '0');
const money = value => decimal(value).toDecimalPlaces(2).toNumber();
function inputDecimal(value, scale, integerDigits, positive = false) {
  let parsed;
  try { parsed = decimal(value); } catch { parsed = decimal(NaN); }
  if (value == null || value === '' || !parsed.isFinite() || parsed.isNegative() || (positive && parsed.isZero()) || parsed.decimalPlaces() > scale || parsed.gte(decimal(10).pow(integerDigits))) {
    const error = new Error(`Número inválido: máximo ${scale} decimales`);
    error.status = 400; throw error;
  }
  return parsed.toString();
}
module.exports = { decimal, money, inputDecimal };
