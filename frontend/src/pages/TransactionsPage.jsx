import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import TransactionTable from '../components/ui/TransactionTable';
import TransactionModal from '../components/ui/TransactionModal';

export default function TransactionsPage() {
  const [transactions, setTxs]      = useState([]);
  const [pagination, setPagination] = useState({ page:1, limit:20, total:0, pages:0 });
  const [sortBy, setSortBy]         = useState('date');
  const [sortOrder, setSortOrder]   = useState('desc');
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal]           = useState({ open:false, tx:null });
  const [loading, setLoading]       = useState(true);

  const fetchTx = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit, sortBy, sortOrder });
      if (search)     params.set('comment', search);
      if (typeFilter) params.set('type', typeFilter);
      const { data } = await api.get(`/transactions?${params}`);
      setTxs(data.data);
      setPagination(p => ({ ...p, ...data.pagination }));
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  }, [sortBy, sortOrder, search, typeFilter, pagination.limit]);

  useEffect(() => { fetchTx(1); }, [sortBy, sortOrder, search, typeFilter]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Transacciones</h1>
          <p className="text-slate-400 text-sm mt-0.5">Historial completo de movimientos</p>
        </div>
        <button onClick={() => setModal({ open:true, tx:null })} className="btn-primary text-sm py-2 px-4">+ Nueva</button>
      </div>

      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <input type="text" className="input flex-1" placeholder="🔍 Buscar por comentario..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input sm:w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="INCOME">Solo Ingresos</option>
          <option value="EXPENSE">Solo Gastos</option>
        </select>
        {(search || typeFilter) && (
          <button className="btn-secondary text-sm" onClick={() => { setSearch(''); setTypeFilter(''); }}>✕ Limpiar</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Cargando...</div>
      ) : (
        <TransactionTable
          data={transactions} pagination={pagination}
          onPageChange={pg => fetchTx(pg)}
          onSort={(f,o) => { setSortBy(f); setSortOrder(o); }}
          sortBy={sortBy} sortOrder={sortOrder}
          onEdit={tx => setModal({ open:true, tx })}
          onDelete={async tx => { if (confirm('¿Eliminar?')) { await api.delete(`/transactions/${tx.id}`); fetchTx(pagination.page); } }}
        />
      )}

      <TransactionModal open={modal.open} transaction={modal.tx}
        onClose={() => setModal({ open:false, tx:null })}
        onSaved={() => fetchTx(1)} />
    </div>
  );
}