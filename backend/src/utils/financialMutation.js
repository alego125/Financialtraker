// Every balance-dependent read and write must use the same transaction client.
// Buffer HTTP responses: a successful handler is not a successful commit.
const rejected = Symbol('rejected response');
const { validationError } = require('../middlewares/validate');
function financialMutation(root, handler) {
  return async (req, res, next) => {
    const inputError = validationError(req);
    if (inputError) return res.status(400).json(inputError);
    for (let attempt = 0; attempt < 3; attempt++) {
      let status = 200, body, ended = false;
      const buffered = {
        status(code) { status = code; return this; },
        json(value) { body = value; return this; },
        end() { ended = true; return this; },
      };
      try {
        await root.$transaction(async tx => {
          await handler(req, buffered, error => { throw error; }, tx);
          if (status >= 400) throw { [rejected]: true };
        }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 });
        return ended ? res.status(status).end() : res.status(status).json(body);
      } catch (error) {
        if (error[rejected]) return res.status(status).json(body);
        if (error.code === 'P2034' && attempt < 2) continue;
        if (error.code === 'P2034') return res.status(409).json({ error: 'Conflicto con otra operación. Volvé a intentarlo.', code: 'CONCURRENT_OPERATION' });
        return next(error);
      }
    }
  };
}
module.exports = { financialMutation };
