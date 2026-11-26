import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';

const currentMonth = () => {
  const date = new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
};
const defaultGoal = { name: '', target: '', saved: '0', due: '' };
const message = error => error.response?.data?.error || 'No se pudo guardar el plan.';

function Progress({ label, value, limit, budget }) {
  const percent = Number(value) / Number(limit) * 100;
  const status = budget && percent >= 100 ? 'over' : budget && percent >= 80 ? 'warn' : budget ? 'ok' : 'goal';
  const text = budget ? (percent > 100 ? 'Presupuesto superado' : percent === 100 ? 'Límite alcanzado' : percent >= 80 ? 'Cerca del límite' : 'Dentro del límite') : (percent >= 100 ? 'Meta alcanzada' : '');
  const rounded = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(percent) + '%';
  return <div className={`plan-progress plan-progress-${status}`}>
    <div className="plan-progress-summary"><strong>{formatCurrency(value)}</strong><span>de {formatCurrency(limit)}</span></div>
    <progress max={100} value={Math.min(100, percent)} aria-label={label} aria-valuetext={rounded} />
    <div className="plan-progress-summary"><span>{text}</span><strong>{rounded}</strong></div>
  </div>;
}

export default function PlanningPage() {
  const [month, setMonth] = useState(currentMonth);
  const [plan, setPlan] = useState(null);
  const [categories, setCategories] = useState([]);
  const [history, setHistory] = useState(null);
  const [budgetForm, setBudget] = useState({ categoryId: '', limit: '' });
  const [goalForm, setGoal] = useState(defaultGoal);
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [messageText, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.get('/planning', { signal: controller.signal }), api.get('/categories', { signal: controller.signal })])
      .then(([response, categoryResponse]) => {
        if (controller.signal.aborted) return;
        setPlan(response.data);
        setRate(response.data.exchangeRate ?? '');
        setCategories(categoryResponse.data.filter(category => category.type === 'EXPENSE'));
      }).catch(error => {
        if (!controller.signal.aborted) setError(error.response?.status === 404
          ? 'El servidor todavía está actualizando la planificación.' : 'No se pudo consultar el plan.');
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/dashboard', { params: { month }, signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setHistory({ month, charts: data.charts });
    }).catch(() => {
      if (!controller.signal.aborted) setHistory({ month, error: true });
    });
    return () => controller.abort();
  }, [month, reload]);

  async function save(change, done) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    const { budgets, goals, exchangeRate } = plan;
    const previous = { budgets, goals, exchangeRate };
    try {
      const { data } = await api.put('/planning', { ...previous, ...change, previous });
      setPlan(data);
      setRate(data.exchangeRate ?? '');
      setMessage('Cambios guardados.');
      done?.();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  function submitBudget(event) {
    event.preventDefault();
    const budgets = plan.budgets.filter(item => item.month !== month || item.categoryId !== budgetForm.categoryId);
    save({ budgets: [...budgets, { ...budgetForm, month }] }, () => setBudget({ categoryId: '', limit: '' }));
  }

  function submitGoal(event) {
    event.preventDefault();
    const id = goalForm.id || crypto.randomUUID();
    const goal = { ...goalForm, id };
    const goals = goalForm.id ? plan.goals.map(item => item.id === id ? goal : item) : [...plan.goals, goal];
    save({ goals }, () => setGoal(defaultGoal));
  }

  function remove(text, change) {
    if (confirm(text)) save(change);
  }

  const period = history?.month === month ? history : null;
  const monthBudgets = (plan?.budgets || []).filter(item => item.month === month).map(item => {
    const category = categories.find(entry => entry.id === item.categoryId);
    const name = category?.name || 'Categoría eliminada';
    const find = key => category ? Number(period?.charts?.[key]?.find(row => row.name === name)?.value ?? 0) : 0;
    const usd = find('categoryExpenseUSD');
    return { ...item, category, name, usd, spent: find('categoryExpense') + usd * Number(plan.exchangeRate || 0) };
  });
  const used = monthBudgets.reduce((total, item) => total + item.spent, 0);
  const budgeted = monthBudgets.reduce((total, item) => total + Number(item.limit), 0);
  const overLimit = monthBudgets.filter(item => item.spent > Number(item.limit)).length;
  const missingRate = !plan?.exchangeRate && monthBudgets.some(item => item.usd > 0);


  return <div className="p-4 sm:p-6 lg:p-8 space-y-6">
    <header><h1 className="text-3xl font-bold">Planificación</h1><p className="text-muted text-sm mt-1">Presupuestos, metas y conversión de monedas.</p></header>
    {error && <p className="text-expense" role="alert">{error}</p>}
    {messageText && <p className="text-income" role="status">{messageText}</p>}
    {error && !busy && <button className="btn-secondary" onClick={() => { setError(''); setReload(value => value + 1); }}>Volver a cargar</button>}
    {!plan && !error && <div className="overview-loading" role="status" aria-label="Cargando plan" />}
    {plan && <div className="grid gap-4">
      {period?.charts && budgeted > 0 && <section className="card finance-panel finance-budget-summary">
        <div><h2>{used > budgeted ? 'Exceso del presupuesto mensual' : 'Disponible en el presupuesto mensual'}</h2>
          <strong>{formatCurrency(Math.abs(budgeted - used))}</strong>
          <p>{overLimit > 0 ? `${overLimit} ${overLimit === 1 ? 'categoría supera' : 'categorías superan'} su límite.` : 'Todas las categorías están dentro de su límite.'}</p>
        </div>
        <div><Progress label="Presupuesto mensual" budget value={used} limit={budgeted} />
          {missingRate && <p>Gastos en USD pendientes de conversión.</p>}
        </div>
      </section>}
      <section className="card overview-panel space-y-4">
        <h2 className="font-semibold">Tipo de cambio de referencia</h2>
        <form className="plan-form" onSubmit={event => { event.preventDefault(); save({ exchangeRate: rate || null }); }}>
          <label>ARS por USD <input className="input" type="number" min=".0001" step=".0001" max="99999999.9999" value={rate} onChange={event => setRate(event.target.value)} /></label>
          <button className="btn-primary" disabled={busy}>Guardar cotización</button>
        </form>
        <p className="text-muted text-sm">La cotización convierte el gasto USD de los presupuestos. Las transferencias conservan el tipo de cambio registrado.</p>
      </section>
      <section className="card overview-panel space-y-4">
        <h2 className="font-semibold">Presupuestos por categoría</h2>
        <label className="plan-month">Mes <input className="input" type="month" required value={month} onChange={event => { if (event.target.value) setMonth(event.target.value); }} /></label>
        <form className="plan-form" onSubmit={submitBudget}>
          <label>Categoría <select className="input" required value={budgetForm.categoryId} onChange={event => setBudget({ ...budgetForm, categoryId: event.target.value })}>
            <option value="">Elegí una categoría</option>
            {categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select></label>
          <label>Límite en ARS <input className="input" required type="number" min=".01" step=".01" max="9999999999.99" value={budgetForm.limit} onChange={event => setBudget({ ...budgetForm, limit: event.target.value })} /></label>
          <button className="btn-primary" disabled={busy || !categories.length}>Guardar presupuesto</button>
        </form>
        {!categories.length && <p className="text-muted text-sm">Creá una categoría de gasto para asignarle un presupuesto.</p>}
        {!plan.budgets.some(item => item.month === month) && <p className="text-muted text-sm">Todavía no hay presupuestos para este mes.</p>}
        {monthBudgets.map(item => {
          const { category, name, spent, usd } = item;
          return <article className="plan-item" key={item.categoryId}>
            <header><h3>{name}</h3><div className="flex gap-2">
              {category && <button type="button" className="btn-secondary" disabled={busy} onClick={() => setBudget({ categoryId: item.categoryId, limit: item.limit })}>Editar</button>}
              <button type="button" className="btn-danger" disabled={busy} onClick={() => remove('¿Eliminar este presupuesto?', {
                budgets: plan.budgets.filter(entry => entry !== item),
              })}>Eliminar</button>
            </div></header>
            {period?.charts ? <>
              <Progress label={name} budget value={spent} limit={item.limit} />
              {usd > 0 && !plan.exchangeRate && <p className="text-muted text-sm">Falta la cotización para incluir {formatCurrency(usd, 'USD')}.</p>}
            </> : <p className="text-muted text-sm">{period?.error ? 'No se pudo consultar el gasto del mes.' : 'Cargando gastos…'}</p>}
          </article>;
        })}
      </section>
      <section className="card overview-panel space-y-4">
        <h2 className="font-semibold">Metas de ahorro</h2>
        <form className="plan-form" onSubmit={submitGoal}>
          <label>Nombre <input className="input" required maxLength={80} value={goalForm.name} onChange={event => setGoal({ ...goalForm, name: event.target.value })} /></label>
          <label>Objetivo en ARS <input className="input" required type="number" min=".01" step=".01" max="9999999999.99" value={goalForm.target} onChange={event => setGoal({ ...goalForm, target: event.target.value })} /></label>
          <label>Ahorrado en ARS <input className="input" required type="number" min="0" step=".01" max="9999999999.99" value={goalForm.saved} onChange={event => setGoal({ ...goalForm, saved: event.target.value })} /></label>
          <label>Fecha objetivo <input className="input" required type="date" value={goalForm.due} onChange={event => setGoal({ ...goalForm, due: event.target.value })} /></label>
          <button className="btn-primary" disabled={busy}>{goalForm.id ? 'Actualizar meta' : 'Crear meta'}</button>
          {goalForm.id && <button className="btn-secondary" type="button" onClick={() => setGoal(defaultGoal)}>Cancelar</button>}
        </form>
        {!plan.goals.length && <p className="text-muted text-sm">Todavía no hay metas.</p>}
        {plan.goals.map(item => <article className="plan-item" key={item.id}>
          <header><div><h3>{item.name}</h3><small>{formatDate(item.due)}</small></div><div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setGoal(item)}>Editar</button>
            <button type="button" className="btn-danger" disabled={busy} onClick={() => remove('¿Eliminar esta meta?', {
              goals: plan.goals.filter(entry => entry.id !== item.id),
            })}>Eliminar</button>
          </div></header>
          <Progress label={item.name} value={item.saved} limit={item.target} />
        </article>)}
      </section>
    </div>}
  </div>;
}
