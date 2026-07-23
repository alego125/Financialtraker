import { useState, useRef, useEffect } from 'react';

export default function CategoryMultiSelect({ categories, selected, onChange, showOwner, partnerName }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = categories.length > 0 && selected.length === categories.length;

  const toggleAll = () => onChange(allSelected ? [] : categories.map(c => c.id));
  const toggleOne = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const label = categories.length === 0
    ? 'Sin categorías disponibles'
    : allSelected
    ? `Todas (${categories.length})`
    : selected.length === 0
    ? 'Todas las categorías'
    : `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={categories.length === 0}
        onClick={() => setOpen(o => !o)}
        className="input text-xs w-full flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">{label}</span>
        <span className="text-[var(--subtle)] ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && categories.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-surface2 shadow-2xl">
          {showOwner && (
            <div className="flex gap-3 px-3 py-2 border-b border-[var(--border)]">
              <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Mías
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>{partnerName || 'Partner'}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text2)] hover:bg-surface3 border-b border-[var(--border)]"
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
              {allSelected && '✓'}
            </span>
            Seleccionar todas
          </button>
          {categories.map(c => {
            const isChecked = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleOne(c.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text2)] hover:bg-surface3"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
                  {isChecked && '✓'}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#8A8478' }} />
                <span className="truncate flex-1 text-left">{c.name}</span>
                {showOwner && (
                  <span className={`text-xs flex-shrink-0 ${c.owner === 'mine' ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {c.owner === 'mine' ? '(yo)' : `(${(partnerName || '').split(' ')[0]})`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
