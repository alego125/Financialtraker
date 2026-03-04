import { useState, useEffect } from 'react';
import api from '../services/api';
import CategoryModal from '../components/ui/CategoryModal';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState({ open:false, cat:null });
  const [deleteError, setDeleteError] = useState('');

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/categories'); setCategories(data); }
    catch(err) { console.error(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async (cat) => {
    setDeleteError('');
    if (!confirm(`¿Eliminar "${cat.name}"?`)) return;
    try { await api.delete(`/categories/${cat.id}`); fetch(); }
    catch(err) { setDeleteError(err.response?.data?.error || 'Error al eliminar'); }
  };

  const income  = categories.filter(c => c.type === 'INCOME');
  const expense = categories.filter(c => c.type === 'EXPENSE');

  const Group = ({ title, items, dot }) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-5 rounded-full ${dot}`} />
        <h2 className="text-sm font-display font-bold text-white">{title}</h2>
        <span className="text-xs font-mono text-slate-500 bg-dark-600 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {items.map(cat => (
          <div key={cat.id} className="card p-3 border-dark-500 hover:border-dark-400 transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: cat.color+'33', border:`1px solid ${cat.color}66`, color: cat.color }}>
                {cat.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-display font-semibold text-slate-200 truncate">{cat.name}</div>
                <div className="text-xs text-slate-500 font-mono">{cat._count?.transactions || 0} tx</div>
              </div>
            </div>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setModal({ open:true, cat })} className="flex-1 py-1 text-xs btn-secondary">Editar</button>
              <button onClick={() => handleDelete(cat)} className="flex-1 py-1 text-xs btn-danger">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Categorías</h1>
          <p className="text-slate-400 text-sm mt-0.5">Organizá tus ingresos y gastos</p>
        </div>
        <button onClick={() => setModal({ open:true, cat:null })} className="btn-primary text-sm py-2 px-4">+ Nueva</button>
      </div>
      {deleteError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{deleteError}</div>}
      {loading ? <div className="text-center py-20 text-slate-500">Cargando...</div> : (
        <>
          <Group title="Ingresos"  items={income}  dot="bg-income" />
          <Group title="Gastos"    items={expense} dot="bg-expense" />
        </>
      )}
      <CategoryModal open={modal.open} category={modal.cat}
        onClose={() => setModal({ open:false, cat:null })} onSaved={fetch} />
    </div>
  );
}