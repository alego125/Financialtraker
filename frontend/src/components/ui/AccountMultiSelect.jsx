import { useState, useRef, useEffect } from 'react';

export default function AccountMultiSelect({ accounts, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = accounts.length > 0 && selected.length === accounts.length;
  const toggleAll = () => onChange(allSelected ? [] : accounts.map(a => a.id));
  const toggleOne = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const label = accounts.length === 0
    ? 'Sin cuentas disponibles'
    : allSelected ? `Todas (${accounts.length})`
    : selected.length === 0 ? 'Todas las cuentas'
    : `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`;

  return (
    <div ref={rootRef} className="relative">
      <button type="button" disabled={accounts.length === 0} onClick={() => setOpen(o => !o)}
        className="input text-xs w-full flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed">
        <span className="truncate">{label}</span>
        <span className="text-[var(--subtle)] ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && accounts.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-surface2 shadow-2xl">
          <button type="button" onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text2)] hover:bg-surface3 border-b border-[var(--border)]">
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
              {allSelected && '✓'}
            </span>
            Seleccionar todas
          </button>
          {accounts.map(a => {
            const isChecked = selected.includes(a.id);
            return (
              <button key={a.id} type="button" onClick={() => toggleOne(a.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text2)] hover:bg-surface3">
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
                  {isChecked && '✓'}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color || '#8A8478' }} />
                <span className="truncate flex-1 text-left">{a.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
