const { randomUUID } = require('node:crypto');
const errorHandler = (err, req, res, _next) => {
  const requestId = req.requestId || randomUUID();
  const code = err.code;
  const status = code === 'P2002' ? 409 : code === 'P2025' ? 404 : err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  const error = code === 'P2002' ? 'Registro duplicado.' : code === 'P2025' ? 'Registro no encontrado.' : status === 500 ? 'Error interno del servidor' : status === 413 ? 'Solicitud demasiado grande' : err.type === 'entity.parse.failed' ? 'JSON inválido' : err.message;
  if (status === 500) console.error(JSON.stringify({ requestId, error: err.name || 'Error', code }));
  res.status(status).json({ error, requestId });
};
module.exports = { errorHandler };
