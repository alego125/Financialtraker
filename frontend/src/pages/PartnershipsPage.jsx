import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatDate } from '../utils/format';
import { Link } from 'react-router-dom';

const Badge = ({ status, isSender }) => {
  if (status==='ACCEPTED') return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono px-2 py-0.5 rounded-full">✓ Vinculado</span>;
  if (status==='REJECTED')  return <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono px-2 py-0.5 rounded-full">✗ Rechazado</span>;
  if (status==='PENDING' && isSender)  return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono px-2 py-0.5 rounded-full">⏳ Enviada</span>;
  if (status==='PENDING' && !isSender) return <span className="bg-violet-500/20 text-violet-400 border border-violet-500/30 text-xs font-mono px-2 py-0.5 rounded-full">📩 Recibida</span>;
  return null;
};

const Card = ({ p, onRespond, onRemove }) => {
  const partner = p.partner;
  if (!partner) return null;
  const borderColor = p.status==='ACCEPTED' ? 'border-emerald-500/20' : p.status==='PENDING' ? 'border-amber-500/20' : 'border-[var(--border)]';
  return (
    <div className={`card p-4 ${borderColor}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-base flex-shrink-0
          ${p.status==='ACCEPTED'?'bg-emerald-500/20 text-emerald-400':p.status==='PENDING'?'bg-amber-500/20 text-amber-400':'bg-surface3 text-[var(--muted)]'}`}>
          {partner.name?.charAt(0).toUpperCase()||'?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-display font-semibold text-[var(--text)] truncate">{partner.name}</div>
          <div className="text-xs text-[var(--subtle)] font-mono truncate">{partner.email}</div>
          {p.updatedAt && p.status==='ACCEPTED' && <div className="text-xs text-[var(--subtle)] mt-0.5">Desde {formatDate(p.updatedAt)}</div>}
        </div>
        <Badge status={p.status} isSender={p.isSender} />
      </div>

      {p.status==='ACCEPTED' && (
        <div className="flex gap-2 flex-wrap mb-3">
          <Link to={`/shared/${partner.id}`} className="btn-secondary text-xs py-1.5 px-3 flex-1 text-center">🤝 Conjunto</Link>
          <Link to={`/partner/${partner.id}`} className="btn-secondary text-xs py-1.5 px-3 flex-1 text-center">👁️ Sus finanzas</Link>
        </div>
      )}
      {p.status==='PENDING' && !p.isSender && (
        <div className="flex gap-2 mb-3">
          <button onClick={()=>onRespond(p.id,'accept')} className="btn-primary py-1.5 px-3 text-xs flex-1">Aceptar</button>
          <button onClick={()=>onRespond(p.id,'reject')} className="btn-danger py-1.5 px-3 text-xs flex-1">Rechazar</button>
        </div>
      )}
      <button onClick={()=>onRemove(p.id)} className="w-full btn-danger py-1.5 text-xs">
        {p.status==='ACCEPTED'?'Desvincular':p.isSender?'Cancelar':'Eliminar'}
      </button>
    </div>
  );
};

export default function PartnershipsPage() {
  const [partnerships, setPartnerships] = useState([]);
  const [email, setEmail]               = useState('');
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  const fetch = async () => {
    try { const { data } = await api.get('/partnerships'); setPartnerships(data); }
    catch(err) { console.error(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true); setError(''); setSuccess('');
    try {
      await api.post('/partnerships', { email: email.trim() });
      setSuccess(`Invitación enviada a ${email}`); setEmail(''); fetch();
    } catch(err) { setError(err.response?.data?.error||'Error al enviar'); }
    finally { setSending(false); }
  };

  const respond = async (id, action) => {
    try { await api.patch(`/partnerships/${id}/respond`, { action }); fetch(); }
    catch(err) { setError(err.response?.data?.error||'Error'); }
  };
  const remove = async (id) => {
    if (!confirm('¿Confirmar?')) return;
    try { await api.delete(`/partnerships/${id}`); fetch(); }
    catch(err) { setError(err.response?.data?.error||'Error'); }
  };

  const active   = partnerships.filter(p => p.status==='ACCEPTED');
  const pending  = partnerships.filter(p => p.status==='PENDING');
  const rejected = partnerships.filter(p => p.status==='REJECTED');
  const received = pending.filter(p => !p.isSender);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Vínculos</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Conectá con otra persona para compartir finanzas</p>
      </div>

      {/* Invite form */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3">Invitar por email</h2>
        {error   && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-3">{error}</div>}
        {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-2.5 text-sm mb-3">{success}</div>}
        <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-3">
          <input type="email" className="input flex-1" placeholder="email@ejemplo.com"
            value={email} onChange={e=>setEmail(e.target.value)} required />
          <button type="submit" disabled={sending} className="btn-primary text-sm py-2 px-5 sm:flex-shrink-0">
            {sending?'Enviando...':'Enviar invitación'}
          </button>
        </form>
      </div>

      {loading ? <div className="text-center py-10 text-[var(--subtle)]">Cargando...</div> : (
        <>
          {received.length > 0 && (
            <div>
              <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3 flex items-center gap-2">
                📩 Invitaciones recibidas
                <span className="bg-violet-500 text-[var(--text)] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{received.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {received.map(p=><Card key={p.id} p={p} onRespond={respond} onRemove={remove}/>)}
              </div>
            </div>
          )}
          {pending.filter(p=>p.isSender).length > 0 && (
            <div>
              <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3">⏳ Pendientes enviadas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pending.filter(p=>p.isSender).map(p=><Card key={p.id} p={p} onRespond={respond} onRemove={remove}/>)}
              </div>
            </div>
          )}
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3">✓ Vínculos activos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active.map(p=><Card key={p.id} p={p} onRespond={respond} onRemove={remove}/>)}
              </div>
            </div>
          )}
          {rejected.length > 0 && (
            <div>
              <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3 opacity-50">Historial</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-50">
                {rejected.map(p=><Card key={p.id} p={p} onRespond={respond} onRemove={remove}/>)}
              </div>
            </div>
          )}
          {partnerships.length === 0 && (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">💑</div>
              <div className="text-[var(--text)] font-display font-bold mb-1">Sin vínculos</div>
              <div className="text-[var(--muted)] text-sm">Invitá a alguien con su email</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}