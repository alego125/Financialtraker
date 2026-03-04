import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from './Modal';

const PRESET_COLORS = [
  '#10b981', '#06b6d4', '#8b5cf6', '#f59e0b',
  '#ef4444', '#f97316', '#ec4899', '#14b8a6',
  '#3b82f6', '#a78bfa', '#f43f5e', '#84cc16',
];

const defaultForm = { name: '', type: 'EXPENSE', color: '#7c3aed' };

export default function CategoryModal({ open, onClose, onSaved, category }) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (category) {
      setForm({ name: category.name, type: category.type, color: category.color });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [category, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nombre requerido');
    setError('');
    setLoading(true);
    try {
      if (category) {
        await api.put(`/categories/${category.id}`, form);
      } else {
        await api.post('/categories', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Editar Categoría' : 'Nueva Categoría'} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input type="text" className="input" placeholder="Ej: Supermercado" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>

        <div>
          <label className="label">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {['INCOME', 'EXPENSE'].map(t => (
              <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t }))}
                className={`py-2.5 rounded-xl text-sm font-display font-semibold border transition-all ${
                  form.type === t
                    ? t === 'INCOME' ? 'bg-income/20 border-income/40 text-income' : 'bg-expense/20 border-expense/40 text-expense'
                    : 'bg-dark-700 border-dark-400 text-slate-400'
                }`}>
                {t === 'INCOME' ? '↑ Ingreso' : '↓ Gasto'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-dark-400" style={{ backgroundColor: form.color }} />
            <input type="color" className="w-full h-9 rounded-lg bg-dark-700 border border-dark-400 cursor-pointer px-1"
              value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : category ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
