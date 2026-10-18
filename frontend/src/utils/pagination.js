export async function getCompleteResponse(client, url, config = {}) {
  const [base, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('limit', '500');
  params.set('page', '1');
  let response, total, pages;
  const rows = [], ids = new Set();
  for (let page = 1; ; page++) {
    config.signal?.throwIfAborted();
    params.set('page', String(page));
    const result = await client.get(`${base}?${params}`, config);
    config.signal?.throwIfAborted();
    const payload = result.data;
    const expected = Number(payload?.pagination?.total);
    const countPages = Number(payload?.pagination?.pages);
    if (!Array.isArray(payload?.data) || !Number.isSafeInteger(expected) || expected < 0 || !Number.isSafeInteger(countPages) || countPages < 0) {
      throw new Error('No se pudo verificar la exportación completa. Volvé a intentarlo.');
    }
    if (page === 1) { response = result; total = expected; pages = countPages; }
    if (total !== expected || pages !== countPages) throw new Error('Los datos cambiaron durante la exportación. Volvé a intentarlo.');
    for (const row of payload.data) {
      if (!row.id || ids.has(row.id)) throw new Error('La exportación contiene filas duplicadas o incompletas. Volvé a intentarlo.');
      ids.add(row.id); rows.push(row);
    }
    if (rows.length > total || (!payload.data.length && rows.length < total)) throw new Error('La exportación está incompleta. Volvé a intentarlo.');
    if (page >= pages) break;
  }
  if (rows.length !== total) throw new Error('La exportación está incompleta. Volvé a intentarlo.');
  return { ...response, data: { ...response.data, data: rows, pagination: { ...response.data.pagination, total, page: 1, pages: 1 } } };
}
