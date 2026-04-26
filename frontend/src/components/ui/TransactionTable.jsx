import { formatCurrency, formatDate } from '../../utils/format';

const PT_LABELS = { EFECTIVO:'💵 Ef.', DEBITO:'💳 Déb.', CREDITO:'💳 Cré.', TRANSFERENCIA:'🏦 Transf.' };

export default function TransactionTable({ data, onSort, sortBy, sortOrder, onEdit, onDelete, readOnly = false }) {
  const handleSort = (field) => {
    if (readOnly) return;
    onSort(field, sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc');
  };
  const SI = ({ field }) => sortBy !== field
    ? <span className="text-[var(--subtle)] ml-0.5">↕</span>
    : <span className="text-accent-light ml-0.5">{sortOrder === 'asc' ? '↑' : '↓'}</span>;

  return (
    <div className="card overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase cursor-pointer whitespace-nowrap" onClick={() => handleSort('date')}>Fecha <SI field="date"/></th>
              <th className="text-left px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase cursor-pointer" onClick={() => handleSort('type')}>Tipo <SI field="type"/></th>
              <th className="text-left px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase">Categoría</th>
              <th className="text-left px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase">Cuenta</th>
              <th className="text-left px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase">Pago</th>
              <th className="text-left px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase">Comentario</th>
              <th className="text-right px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase cursor-pointer" onClick={() => handleSort('amount')}>Monto <SI field="amount"/></th>
              {!readOnly && <th className="text-center px-4 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase">Acc.</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.length === 0 && (
              <tr><td colSpan={readOnly ? 7 : 8} className="text-center py-10 text-[var(--subtle)] text-sm">No hay transacciones</td></tr>
            )}
            {data.map(tx => (
              <tr key={tx.id} className="hover:bg-surface3/50 transition-colors group">
                <td className="px-4 py-3 font-mono text-[var(--muted)] text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                <td className="px-4 py-3">
                  {tx.isReimbursement
                    ? <span className="inline-flex items-center gap-1 text-xs font-display font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">↩ Reembolso</span>
                    : <span className={tx.type === 'INCOME' ? 'badge-income' : 'badge-expense'}>{tx.type === 'INCOME' ? '↑ Ingreso' : '↓ Gasto'}</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {tx.category?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: tx.category.color}}/>}
                    <span className="text-[var(--text2)] text-xs truncate max-w-24">{tx.category?.name || '—'}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {tx.sharedAccount ? (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: tx.sharedAccount.color||'#7c3aed'}}/><span className="text-violet-400 truncate max-w-20">{tx.sharedAccount.name}</span></span>
                  ) : tx.account ? (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: tx.account.color||'#6366f1'}}/><span className="text-[var(--text2)] truncate max-w-20">{tx.account.name}</span></span>
                  ) : <span className="text-[var(--subtle)]">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted)] whitespace-nowrap">{tx.paymentType ? PT_LABELS[tx.paymentType] || tx.paymentType : '—'}</td>
                <td className="px-4 py-3 text-[var(--muted)] text-xs max-w-32 truncate">{tx.comment || '—'}</td>
                <td className={`px-4 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap ${tx.isReimbursement ? 'text-blue-300' : tx.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                  {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                </td>
                {!readOnly && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(tx)} className="w-7 h-7 rounded-lg bg-surface3 hover:bg-accent/20 text-[var(--muted)] hover:text-accent-light flex items-center justify-center text-xs">✏️</button>
                      <button onClick={() => onDelete(tx)} className="w-7 h-7 rounded-lg bg-surface3 hover:bg-rose-500/20 text-[var(--muted)] hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-[var(--border)]">
        {data.length === 0 && <div className="text-center py-10 text-[var(--subtle)] text-sm">No hay transacciones</div>}
        {data.map(tx => (
          <div key={tx.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {tx.isReimbursement
                  ? <span className="inline-flex items-center gap-1 text-xs font-display font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">↩ Reembolso</span>
                  : <span className={tx.type === 'INCOME' ? 'badge-income' : 'badge-expense'}>{tx.type === 'INCOME' ? '↑ Ingreso' : '↓ Gasto'}</span>
                }
                {tx.category && (
                  <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: tx.category.color}}/>
                    {tx.category.name}
                  </span>
                )}
              </div>
              <span className={`font-mono font-bold text-sm whitespace-nowrap ${tx.isReimbursement ? 'text-blue-300' : tx.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-[var(--subtle)] space-y-0.5">
                <div className="font-mono">{formatDate(tx.date)}</div>
                {(tx.account || tx.sharedAccount) && (
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: (tx.account||tx.sharedAccount)?.color}}/>
                    <span>{(tx.account||tx.sharedAccount)?.name}</span>
                    {tx.sharedAccount && <span className="text-violet-400">💑</span>}
                  </div>
                )}
                {tx.paymentType && <div>{PT_LABELS[tx.paymentType]}</div>}
                {tx.comment && <div className="text-[var(--subtle)] truncate max-w-48">{tx.comment}</div>}
              </div>
              {!readOnly && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => onEdit(tx)} className="w-8 h-8 rounded-lg bg-surface3 hover:bg-accent/20 text-[var(--muted)] hover:text-accent-light flex items-center justify-center text-xs">✏️</button>
                  <button onClick={() => onDelete(tx)} className="w-8 h-8 rounded-lg bg-surface3 hover:bg-rose-500/20 text-[var(--muted)] hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
