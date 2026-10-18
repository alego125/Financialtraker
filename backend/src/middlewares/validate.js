const { validationResult } = require('express-validator');
const { decimal } = require('../utils/decimal');
function validationError(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return { errors: errors.array().map(({ msg, path }) => ({ msg, path })) };
  const fields = { amount: [2, 10, false], initialBalance: [2, 10, true], initialBalanceUSD: [2, 10, true], usdAmount: [2, 10, true], rate: [4, 8, false] };
  for (const [key, [scale, digits, signed]] of Object.entries(fields)) if (req.body?.[key] !== undefined) {
    try {
      const raw = String(req.body[key]);
      const value = decimal(raw);
      if (!/^-?\d+(\.\d+)?$/.test(raw) || !value.isFinite() || (!signed && value.lte(0)) || value.decimalPlaces() > scale || value.abs().gte(decimal(10).pow(digits))) throw new Error();
    } catch { return { error: `${key}: número inválido o precisión excedida` }; }
  }
  return null;
}
const validate = (req, res, next) => {
  const error = validationError(req);
  return error ? res.status(400).json(error) : next();
};
module.exports = { validationError, validate };
