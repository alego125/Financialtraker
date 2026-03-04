const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado.' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado.' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
};

module.exports = { errorHandler };
