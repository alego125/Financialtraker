const analyzeFinances = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) return res.status(400).json({ error: 'El análisis requiere un texto de hasta 12000 caracteres' });
    const key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL;
    if (!key || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) return res.status(503).json({ error: 'El análisis automático no está configurado' });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1200, temperature: 0.3 } }),
    });
    if (!response.ok) return res.status(502).json({ error: 'El proveedor de análisis no está disponible' });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
    if (!text) return res.status(502).json({ error: 'El proveedor no devolvió un análisis' });
    res.json({ text });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || err instanceof TypeError) return res.status(503).json({ error: 'No se pudo conectar con el proveedor de análisis' });
    next(err);
  }
};
module.exports = { analyzeFinances };
