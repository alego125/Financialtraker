'use strict';

const paths = {
  home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
  wallet:'M4 5h15v15H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M15 10h6v5h-6z',
  list:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M8 15v6',
  budget:'M4 5h16v14H4z M4 9h16m-12 5h3m2 0h3',
  target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  chart:'M3 3v18h18M8 16v-4m5 4V8m5 8V5',
  settings:'M4 7h16M4 17h16M9 4v6m6 4v6',
  plus:'M12 5v14M5 12h14',
  sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z',
  moon:'M20.8 14A9 9 0 1 1 10 3.2 7 7 0 0 0 20.8 14z',
  up:'M4 17l6-6 4 4 6-8m-5 0h5v5',
  down:'M4 7l6 6 4-4 6 8m-5 0h5v-5',
  swap:'M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4',
  edit:'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4',
  delete:'M4 6h16M9 6V3h6v3m3 0-1 15H7L6 6m4 4v7m4-7v7',
  bank:'M3 9l9-5 9 5M5 10v8m5-8v8m4-8v8m5-8v8M3 20h18'
};
const sections = {
  resumen:['Resumen','Tus finanzas personales en un solo lugar.', 'home', 'Inicio'],
  cuentas:['Cuentas','Saldos y transferencias en ARS y USD.', 'wallet','Cuentas'],
  movimientos:['Movimientos','Consultá y administrá tus ingresos y gastos.', 'list','Movimientos'],
  presupuestos:['Presupuestos','Controlá el gasto mensual de cada categoría.', 'budget','Límites'],
  metas:['Metas de ahorro','Registrá tus aportes y seguí tu progreso.', 'target','Metas'],
  reportes:['Reportes','Compará el flujo de dinero y la evolución de tu patrimonio.', 'chart','Reportes'],
  ajustes:['Ajustes','Configurá la equivalencia entre dólares y pesos.', 'settings','Ajustes']
};
const state = {month:'', metrics:null, accounts:[], transactions:[], transfers:[], goals:[],
  settings:null, charts:[], range:6, renderId:0, controller:null, loading:false};
const $ = selector => document.querySelector(selector);
const view = $('#view');
const editor = $('#editor');
const form = $('#form');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const currency = (amount, code='ARS', digits=2) => new Intl.NumberFormat('es-AR',
  {style:'currency', currency:code, currencyDisplay:code==='USD'?'code':'narrowSymbol', maximumFractionDigits:digits,
    minimumFractionDigits:digits}).format(Number(amount));
const short = amount => new Intl.NumberFormat('es-AR',{notation:'compact',maximumFractionDigits:1}).format(Number(amount));
const percentage = value => new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(value) + '%';
const formattedDate = date => new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date));
const monthLabel = (month, length='short') => new Intl.DateTimeFormat('es-AR',{month:length,timeZone:'UTC'}).format(new Date(month+'-01'));
const tone = name => `var(--${name})`;
const color = name => getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim();
const colors = ['blue','violet','green','gold','cyan','red'];
const accountFor = key => state.accounts.find(account => account.id === Number(key));
const section = () => {
  const key = location.hash.slice(1).split('?')[0];
  return Object.hasOwn(sections,key) ? key : 'resumen';
};
const params = () => new URLSearchParams(location.hash.split('?')[1]);

async function api(path, method='GET', data, signal) {
  const response = await fetch('/api/'+path,{method, signal, cache:'no-store',
    headers:data === undefined ? {} : {'Content-Type':'application/json'},
    body:data === undefined ? undefined : JSON.stringify(data)});
  if (response.status === 204) return;
  const result = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(result.detail)
      ? result.detail.map(item => item.loc.at(-1)+': '+item.msg).join(' · ') : result.detail;
    throw new Error(detail || 'No se pudo completar la operación.');
  }
  return result;
}

let toastTimer;
function toast(message) {
  const area = $('#toast');
  area.textContent = message;
  area.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { area.hidden=true; }, 4500);
}

function stopCharts() {
  state.charts.forEach(chart => chart.destroy());
  state.charts = [];
}

async function load() {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  const id = ++state.renderId;
  state.loading = true;
  stopCharts();
  view.innerHTML = '<div class="skeleton" role="status" aria-label="Cargando datos"></div>';
  const page = section();
  const query = params();
  const [title,subtitle] = sections[page];
  $('#title').textContent = title;
  $('#subtitle').textContent = subtitle;
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.hash.slice(1) === page) item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  });
  try {
    const get = path => api(path,'GET',undefined,controller.signal);
    const month = query.get('mes') || '';
    if (page === 'movimientos') query.delete('mes');
    const [settings,accounts,metrics,transactions,transfers,goals] = await Promise.all([
      get('settings'), get('accounts'), get('metrics?'+new URLSearchParams({month})),
      ['movimientos','resumen'].includes(page) ? get('transactions?'+(page==='movimientos' ? query : '')) : [],
      page==='cuentas' ? get('transfers') : [],
      page==='metas' ? get('goals') : []
    ]);
    if (id !== state.renderId) return;
    Object.assign(state,{settings, accounts, metrics, transactions, transfers, goals, month:metrics.current.month, loading:false});
    $('#railRate').textContent = 'USD 1 = '+currency(settings.rate,'ARS',0);
    draw(page);
  } catch (error) {
    if (id !== state.renderId || error.name === 'AbortError') return;
    state.loading = false;
    view.innerHTML = empty('No se pudieron cargar los datos',
      navigator.onLine ? error.message : 'Volvé a conectarte al servidor para consultar tus datos.', 'Reintentar','retry');
  }
}

const button = (label, action, glyph='plus', style='quiet') =>
  `<button type="button" class="${style}" data-action="${action}">${icon(glyph)}${label}</button>`;
const empty = (title,description,label='',action='') =>
  `<div class="empty"><h3>${escape(title)}</h3><p>${escape(description)}</p>${label?button(label,action):''}</div>`;
const head = (title, description='', action='') =>
  `<header class="panel-head"><div><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div>${action}</header>`;
const chartBox = (id, label, extra='') =>
  `<div class="chart ${extra}"><canvas id="${id}" role="img" aria-label="${label}"></canvas></div>`;
const monthPicker = () =>
  `<label>Mes de análisis<input aria-label="Mes de análisis" id="monthPicker" type="month" value="${state.month}" min="0002-01" max="${state.settings.today.slice(0,7)}"></label>`;
const row = (glyph,name,detail,amount,meta='',klass='') =>
  `<div class="row"><span class="row-icon">${icon(glyph)}</span><div class="row-name"><h3>${escape(name)}</h3><small>${escape(detail)}</small></div><div class="row-value ${klass}"><strong>${escape(amount)}</strong>${meta?`<small>${escape(meta)}</small>`:''}</div></div>`;
const editButtons = (collection,id) =>
  `<button class="icon-button" data-action="edit" data-collection="${collection}" data-id="${id}" aria-label="Editar">${icon('edit')}</button>
   <button class="icon-button" data-action="delete" data-collection="${collection}" data-id="${id}" aria-label="Eliminar">${icon('delete')}</button>`;

function dashboard() {
  const entries = [
    ['balance','Balance total','wallet','blue'],['income','Ingresos del mes','up','green'],
    ['expense','Gastos del mes','down','red'],['savings','Ahorro neto','target','gold']
  ];
  const {current,variation,categories,budgets} = state.metrics;
  const alerts = budgets.filter(budget => Number(budget.spent)/Number(budget.limit)>=.8);
  const recent = state.transactions.slice(0,5);
  const kpis = entries.map(([key,label,glyph,hue]) => {
    const change = variation[key];
    const clazz = change === null || change === 0 ? '' : (key==='expense' ? change<0 : change>0) ? 'good' : 'bad';
    return `<article class="kpi"><div class="kpi-label"><span style="color:${tone(hue)}">${icon(glyph)}</span>${label}</div>
      <strong class="kpi-value" data-count="${current[key]}">${currency(current[key],'ARS',0)}</strong>
      <small class="${clazz}">${change===null?'Sin base de comparación':(change>0?'+':'')+percentage(change)+' vs. mes anterior'}</small>
      <div class="spark"><canvas id="spark-${key}" aria-hidden="true"></canvas></div></article>`;
  }).join('');
  const accountRows = state.accounts.slice(0,4).map(a =>
    row(a.kind==='banco'?'bank':'wallet',a.name,a.kind,currency(a.balance,a.currency),a.currency)).join('');
  const hasEntries = state.accounts.length || state.transactions.length;
  return `<div class="dashbar"><p>Importes consolidados en ARS</p>${monthPicker()}</div>
  <div class="grid kpis">${kpis}</div>
  ${hasEntries?'':`<div class="notice dashbar"><span>Agregá tu primera cuenta para empezar.</span><div class="actions">${button('Crear cuenta','accounts')}${button('Cargar datos de ejemplo','demo','chart')}</div></div>`}
  ${alerts.length?`<div class="notice dashbar">
    <span class="${alerts.some(b=>Number(b.spent)>=Number(b.limit))?'bad':'warn'}">${alerts.length===1?
      '1 presupuesto requiere atención':alerts.length+' presupuestos requieren atención'}</span>
    <a class="quiet" href="#presupuestos?mes=${state.month}">Revisar presupuestos</a></div>`:''}
  <div class="grid dash-grid">
    <section class="panel">${head('Evolución del patrimonio','Saldo consolidado al cierre de cada mes.',
      `<div class="tabs"><button class="tab ${state.range===3?'active':''}" data-action="range" data-range="3" aria-pressed="${state.range===3}">3 meses</button><button class="tab ${state.range===6?'active':''}" data-action="range" data-range="6" aria-pressed="${state.range===6}">6 meses</button></div>`)}
      <strong class="chart-value">${currency(current.balance)}</strong>${chartBox('balance','Línea de evolución del patrimonio')}</section>
    <section class="panel">${head('Gastos por categoría',monthLabel(state.month,'long')+' '+state.month.slice(0,4))}
      ${categories.length?donut():empty('Sin gastos registrados','Los gastos del mes aparecerán acá.')}</section>
    <section class="panel">${head('Últimos movimientos','',`<a class="quiet" href="#movimientos">Ver movimientos</a>`)}
      ${recent.length?recent.map(t=>row(t.kind==='income'?'up':'down',t.note||t.category,
        t.category+' · '+(accountFor(t.account)?.name||''),(t.kind==='expense'?'−':'+')+currency(t.amount,accountFor(t.account)?.currency),
        formattedDate(t.day),t.kind==='income'?'good':'bad')).join(''):empty('Sin movimientos','Registrá tu primer ingreso o gasto.','Agregar movimiento','transactions')}</section>
    <section class="panel">${head('Tus cuentas','Saldos al día de hoy.',`<a class="quiet" href="#cuentas">Ver cuentas</a>`)}
      ${accountRows||empty('Todavía no hay cuentas','Agregá efectivo, banco, tarjeta o inversión.','Crear cuenta','accounts')}</section>
  </div>`;
}

function donut() {
  const items = state.metrics.categories;
  const total = items.reduce((sum,item)=>sum+Number(item.amount),0);
  return `<div class="chart donut"><canvas id="donut" role="img" aria-label="Dona de gastos por categoría"></canvas>
    <div class="donut-center"><small>Total del mes</small><strong>${currency(total,'ARS',0)}</strong></div></div>
    <ul class="legend">${items.map((item,i)=>`<li><span class="swatch" style="--tone:${tone(colors[i%colors.length])}"></span>
      ${escape(item.name)}<strong>${currency(item.amount,'ARS',0)}</strong></li>`).join('')}</ul>`;
}

function accountsView() {
  const cards = state.accounts.map(a=>`<article class="panel">${head(escape(a.name),escape(a.kind)+' · '+a.currency,
    `<div class="actions">${editButtons('accounts',a.id)}</div>`)}<strong class="chart-value">${currency(a.balance,a.currency)}</strong>
    <p>Cuenta abierta el ${formattedDate(a.opened)}</p></article>`).join('');
  const rows = state.transfers.slice().sort((a,b)=>b.day.localeCompare(a.day)||b.id-a.id).map(t=>{
    const from=accountFor(t.source), to=accountFor(t.destination);
    return `<tr><td>${formattedDate(t.day)}</td><td>${escape(from?.name||'Cuenta')}</td><td>${escape(to?.name||'Cuenta')}</td>
      <td>${escape(t.note)}</td><td class="amount">${currency(t.amount,from?.currency)}</td>
      <td class="amount">${currency(t.received,to?.currency)}</td><td>${editButtons('transfers',t.id)}</td></tr>`;
  }).join('');
  return `<div class="dashbar"><div class="actions">${button('Nueva cuenta','accounts','plus','primary')}
    ${button('Transferir','transfers','swap')}</div></div>
    <div class="grid"><div class="grid cards">${cards||''}</div>
    ${cards?'':`<section class="panel">${empty('Sin cuentas','Creá una cuenta para registrar movimientos.','Crear cuenta','accounts')}</section>`}
    <section class="panel">${head('Transferencias','Los traspasos internos se excluyen de ingresos y gastos.')}
    ${rows?table(['Fecha','Origen','Destino','Nota','Enviado','Recibido','Acciones'],rows):empty('Sin transferencias','Las transferencias entre tus cuentas aparecerán acá.')}</section></div>`;
}

const table = (headers,rows) => `<div class="table-wrap" tabindex="0" role="region" aria-label="Tabla de registros"><table>
  <thead><tr>${headers.map(title=>`<th scope="col">${title}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
const option = (value,label,selected) => `<option value="${escape(value)}"${String(value)===String(selected)?' selected':''}>${escape(label)}</option>`;
const categoryOptions = value => [...new Set([...state.settings.categories,...state.metrics.categories.map(item=>item.name),...(value?[value]:[])])]
  .map(category=>option(category,category,value)).join('');
const accountOptions = value => state.accounts.map(a=>option(a.id,a.name+' ('+a.currency+')',value)).join('');

function transactionsView() {
  const filters = params();
  const rows = state.transactions.map(t=>{
    const account = accountFor(t.account);
    return `<tr><td>${formattedDate(t.day)}</td><td>${escape(t.note||t.category)}</td><td>${escape(t.category)}</td>
      <td>${escape(account?.name||'Cuenta')}</td><td class="amount ${t.kind==='income'?'good':'bad'}">${t.kind==='income'?'+':'−'}${currency(t.amount,account?.currency)}</td>
      <td>${editButtons('transactions',t.id)}</td></tr>`;
  }).join('');
  return `<section class="panel">${head('Registro de movimientos','',
    `<a class="quiet" href="/api/transactions/export?${escape(filters.toString())}" download>Exportar CSV</a>`)}
    <form class="filters" id="filters">
      <label>Buscar<input name="q" type="search" placeholder="Nota, categoría o cuenta" value="${escape(filters.get('q'))}"></label>
      <label>Desde<input name="start" type="date" value="${escape(filters.get('start'))}"></label>
      <label>Hasta<input name="end" type="date" value="${escape(filters.get('end'))}"></label>
      <label>Categoría<select name="category"><option value="">Todas</option>${categoryOptions(filters.get('category'))}</select></label>
      <label>Cuenta<select name="account"><option value="">Todas</option>${accountOptions(filters.get('account'))}</select></label>
      <button class="primary">Filtrar</button><a class="quiet" href="#movimientos">Limpiar</a>
    </form>
    ${rows?table(['Fecha','Detalle','Categoría','Cuenta','Importe','Acciones'],rows):empty('Sin movimientos',
      filters.size?'Probá con otros filtros.':'Registrá un ingreso o un gasto.',filters.size?'':'Agregar movimiento','transactions')}</section>`;
}

const progress = (value,hue,label) => `<div class="progress" role="progressbar" aria-label="${escape(label)}" aria-valuenow="${Math.max(0,Math.min(100,value))}"
  aria-valuetext="${percentage(value)}" style="--tone:${tone(hue)}"><span style="width:${Math.max(0,Math.min(100,value))}%"></span></div>`;
const gauge = (value,hue,label) => `<div class="gauge" role="img" aria-label="${escape(label)} ${percentage(value)}"
  style="--tone:${tone(hue)};--pct:${Math.max(0,Math.min(100,value))}%"><strong>${percentage(value)}</strong></div>`;

function budgetsView() {
  const cards = state.metrics.budgets.map(b=>{
    const value = Number(b.spent)/Number(b.limit)*100;
    const hue = value>=100?'red':value>=80?'gold':'green';
    const status = value>100?'Presupuesto superado':value===100?'Límite alcanzado':value>=80?'Cerca del límite':'Dentro del límite';
    return `<article class="panel gauge-card">${head(escape(b.category),'',`<div class="actions">${editButtons('budgets',b.id)}</div>`)}
      ${gauge(value,hue,'Presupuesto utilizado')}<div><strong>${currency(b.spent)}</strong> <small>de ${currency(b.limit)}</small>
      ${progress(value,hue,'Presupuesto utilizado')}</div><small class="${hue==='red'?'bad':hue==='gold'?'warn':'good'}">${status}</small></article>`;
  }).join('');
  return `<div class="dashbar">${monthPicker()}${button('Nuevo presupuesto','budgets','plus','primary')}</div>
    ${cards?`<div class="grid cards">${cards}</div>`:`<section class="panel">${empty('Sin presupuestos para este mes','Definí un límite en ARS para una categoría.','Nuevo presupuesto','budgets')}</section>`}`;
}

function goalsView() {
  const cards = state.goals.map(g=>{
    const value = Number(g.saved)/Number(g.target)*100;
    return `<article class="panel gauge-card">${head(escape(g.name),'Fecha objetivo: '+formattedDate(g.due),
      `<div class="actions">${editButtons('goals',g.id)}</div>`)}
      ${gauge(value,'gold','Meta alcanzada')}<div><strong>${currency(g.saved)}</strong> <small>de ${currency(g.target)}</small>
      ${progress(value,'gold','Meta alcanzada')}</div>${value>=100?'<small class="good">Meta alcanzada</small>':''}</article>`;
  }).join('');
  return `<div class="dashbar">${button('Nueva meta','goals','plus','primary')}</div>
    ${cards?`<div class="grid cards">${cards}</div>`:`<section class="panel">${empty('Todavía no hay metas','Definí un objetivo y registrá lo que ya ahorraste.','Crear meta','goals')}</section>`}`;
}

function reportsView() {
  return `<div class="dashbar"><p>Importes consolidados en ARS</p>${monthPicker()}</div><div class="grid split">
    <section class="panel">${head('Ingresos y gastos','Comparativa de los últimos seis meses.')}${chartBox('flow','Barras agrupadas de ingresos y gastos')}</section>
    <section class="panel">${head('Evolución del patrimonio','Saldos valorizados al tipo de cambio actual.')}${chartBox('balance','Línea de evolución del patrimonio')}</section>
    <section class="panel">${head('Gastos por categoría')}${state.metrics.categories.length?donut():empty('Sin gastos','Elegí otro mes o registrá un gasto.')}</section>
    <section class="panel">${head('Principales categorías de gasto')}${state.metrics.categories.length?chartBox('topCategories','Barras horizontales de gastos por categoría'):empty('Sin gastos','El ranking aparecerá cuando registres gastos.')}</section></div>`;
}

function settingsView() {
  return `<section class="panel">${head('Conversión de USD a ARS','Se aplica a los reportes y a las nuevas transferencias entre monedas.')}
    <form id="rateForm" class="filters"><label>Pesos argentinos por 1 USD
    <input required name="rate" type="number" step=".0001" min=".0001" value="${Number(state.settings.rate)}"></label>
    <button class="primary">Guardar tipo de cambio</button></form>
    <div class="actions"><button type="button" class="quiet" data-action="theme">Cambiar tema</button>
    ${deferredInstall?'<button type="button" class="quiet" data-action="install">Instalar Pulso</button>':''}</div></section>`;
}

function draw(page=section()) {
  stopCharts();
  const views = {resumen:dashboard,cuentas:accountsView,movimientos:transactionsView,presupuestos:budgetsView,
    metas:goalsView,reportes:reportsView,ajustes:settingsView};
  view.innerHTML = views[page]();
  renderCharts();
  const id = state.renderId;
  if (!reduced.matches && page==='resumen') {
    const start = performance.now();
    const counters = [...view.querySelectorAll('[data-count]')];
    function tick(frame) {
      if (id !== state.renderId || !counters[0]?.isConnected) return;
      const fraction = Math.min((frame-start)/440,1);
      counters.forEach(node=>{node.textContent=currency(Number(node.dataset.count)*(1-(1-fraction)**3),'ARS',0);});
      if (fraction<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
}

function renderCharts() {
  if (!window.Chart || !state.metrics) return;
  const series = state.metrics.series;
  const shown = section()==='resumen'?series.slice(-state.range):series;
  const base = {responsive:true, maintainAspectRatio:false, animation:reduced.matches?false:{duration:500},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false,labels:{color:color('muted'),usePointStyle:true,boxWidth:8}},
      tooltip:{backgroundColor:color('surface'),titleColor:color('text'),bodyColor:color('text'),borderColor:color('line'),
        borderWidth:1,padding:11,callbacks:{label:context=>{
          const value = typeof context.raw==='number'?context.raw:Number(context.raw);
          return (context.dataset.label||context.label||'Importe')+': '+currency(value);
        }}}}};
  const ticks = {color:color('muted'),font:{family:'Inter',size:11}};
  const axes = {x:{ticks,grid:{display:false},border:{display:false}},
    y:{ticks:{...ticks,callback:value=>short(value)},grid:{color:color('line')},border:{display:false}}};
  const labels = shown.map(s=>monthLabel(s.month));
  function plot(id,type,data,options={},plugins=[]) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    state.charts.push(new Chart(canvas,{type,data,options:{...base,...options},plugins}));
  }
  function line(key,hue,items,extra={}) {
    return {label:'Patrimonio',data:items.map(s=>Number(s[key])),borderColor:color(hue),
      borderWidth:2,tension:.35,pointRadius:0,pointHoverRadius:5,...extra};
  }
  plot('balance','line',{labels,datasets:[line('balance','blue',shown,{fill:true,
    backgroundColor:context=>{
      const {ctx,chartArea} = context.chart;
      if (!chartArea) return color('wash');
      const gradient = ctx.createLinearGradient(0,chartArea.top,0,chartArea.bottom);
      gradient.addColorStop(0,color('blue')+'55');
      gradient.addColorStop(1,color('transparent'));
      return gradient;
    }})]},{scales:axes});
  plot('flow','bar',{labels,datasets:[{label:'Ingresos',data:shown.map(s=>Number(s.income)),backgroundColor:color('green'),borderRadius:4},
    {label:'Gastos',data:shown.map(s=>Number(s.expense)),backgroundColor:color('red'),borderRadius:4}]},
    {scales:axes,plugins:{...base.plugins,legend:{...base.plugins.legend,display:true,position:'bottom'}}});
  const items = state.metrics.categories;
  plot('donut','doughnut',{labels:items.map(i=>i.name),datasets:[{data:items.map(i=>Number(i.amount)),borderWidth:0,
    backgroundColor:items.map((_,i)=>color(colors[i%colors.length])),hoverOffset:4}]},
    {cutout:'73%',layout:{padding:6},interaction:{mode:'nearest',intersect:true}});
  plot('topCategories','bar',{labels:items.slice(0,6).map(i=>i.name),datasets:[{
    label:'Gasto',data:items.slice(0,6).map(i=>Number(i.amount)),borderRadius:4,backgroundColor:color('violet')
  }]},{indexAxis:'y',scales:{x:{...axes.y,beginAtZero:true},y:axes.x}});
  for (const [key,hue] of [['balance','blue'],['income','green'],['expense','red'],['savings','gold']]) {
    plot('spark-'+key,'line',{labels:series.map(s=>s.month),datasets:[line(key,hue,series)]},{
      events:[],scales:{x:{display:false},y:{display:false}},plugins:{legend:{display:false},tooltip:{enabled:false}}});
  }
}

const names = {accounts:'cuenta',transactions:'movimiento',transfers:'transferencia',budgets:'presupuesto',goals:'meta'};
const field = (label,name,type,value,attributes='',wide=false) =>
  `<label class="${wide?'wide':''}">${label}<input name="${name}" type="${type}" value="${escape(value)}" ${attributes}></label>`;
const selection = (label,name,options) => `<label>${label}<select required name="${name}">${options}</select></label>`;
const amountField = (label,name,value,min='0.01') => field(label,name,'number',value,`required step=".01" min="${min}"`);
let editing;

function openEditor(collection,item={}) {
  if (!state.settings || state.loading) return;
  if (collection==='transactions' && !state.accounts.length) {
    toast('Creá una cuenta para registrar movimientos.');
    return openEditor('accounts');
  }
  if (collection==='transfers' && state.accounts.length<2) {
    toast('Necesitás al menos dos cuentas para transferir.');
    return openEditor('accounts');
  }
  const today = state.settings.today;
  const category = value => `<label>Categoría<input name="category" type="text" required maxlength="60"
    list="categoryChoices" value="${escape(value)}"><datalist id="categoryChoices">${categoryOptions(value)}</datalist></label>`;
  const note = field('Nota','note','text',item.note,'maxlength="300"',true);
  const day = field('Fecha','day','date',item.day||today,'required');
  const amount = amountField('Importe','amount',item.amount);
  const options = (items,value) => items.map(i=>option(i,i,value)).join('');
  const layouts = {
    accounts:()=> field('Nombre','name','text',item.name,'required maxlength="80"',true)
      +selection('Tipo','kind',options(['banco','efectivo','tarjeta','inversión'],item.kind))
      +selection('Moneda','currency',options(['ARS','USD'],item.currency))
      +field('Saldo inicial','opening','number',item.opening??0,'required step=".01"')
      +field('Fecha de apertura','opened','date',item.opened||today,'required'),
    transactions:()=>selection('Tipo','kind',option('expense','Gasto',item.kind)+option('income','Ingreso',item.kind))
      +selection('Cuenta','account',accountOptions(item.account))+amount+day+category(item.category)+note,
    transfers:()=>selection('Cuenta de origen','source',accountOptions(item.source))
      +selection('Cuenta de destino','destination',accountOptions(item.destination??state.accounts[1].id))
      +amount+day+note,
    budgets:()=>category(item.category)+amountField('Límite en ARS','limit',item.limit)
      +field('Mes','month','month',item.month||state.month,'required min="0002-01" max="9999-11"'),
    goals:()=>field('Nombre','name','text',item.name,'required maxlength="80"',true)
      +amountField('Objetivo en ARS','target',item.target)+amountField('Ahorrado en ARS','saved',item.saved??0,'0')
      +field('Fecha objetivo','due','date',item.due||today,'required')
  };
  editing={collection,id:item.id};
  $('#formTitle').textContent = (item.id?'Editar ':({accounts:'Nueva ',transactions:'Nuevo ',transfers:'Nueva ',budgets:'Nuevo ',goals:'Nueva '})[collection])+names[collection];
  $('#fields').innerHTML=layouts[collection]();
  $('#formError').hidden=true;
  editor.showModal();
}

async function perform(buttonNode, action) {
  if (buttonNode.disabled) return;
  buttonNode.disabled=true;
  try {
    await action();
  } catch (error) {
    toast(error.message);
  } finally {
    buttonNode.disabled=false;
  }
}

function setMonth(month) {
  location.hash=section()+'?'+new URLSearchParams({mes:month});
}

function theme() {
  const root=document.documentElement;
  root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
  localStorage.setItem('pulso-theme',root.dataset.theme);
  refreshTheme();
  stopCharts();
  renderCharts();
}

function refreshTheme() {
  const dark=document.documentElement.dataset.theme==='dark';
  $('#theme').innerHTML=icon(dark?'sun':'moon');
  $('#theme').setAttribute('aria-label',dark?'Activar tema claro':'Activar tema oscuro');
  $('meta[name=theme-color]').content=color('bg');
}

let deferredInstall;
async function install() {
  if (!deferredInstall) return;
  await deferredInstall.prompt();
  deferredInstall=null;
  $('#install').hidden=true;
  if (section()==='ajustes' && state.settings) draw();
}

view.addEventListener('click',event=>{
  const node=event.target.closest('button[data-action]');
  if (!node) return;
  const {action,collection,id,range}=node.dataset;
  if (Object.hasOwn(names,action)) openEditor(action);
  if (action==='retry') load();
  if (action==='theme') theme();
  if (action==='install') install();
  if (action==='range') {
    state.range=Number(range);
    draw();
    view.querySelector(`[data-range="${range}"]`)?.focus();
  }
  if (action==='demo') perform(node,async()=>{
    await api('demo','POST');
    toast('Datos de ejemplo cargados.');
    await load();
  });
  if (action==='edit') perform(node,async()=>openEditor(collection,await api(collection+'/'+id)));
  if (action==='delete' && confirm('¿Eliminar este registro?')) perform(node,async()=>{
    await api(collection+'/'+id,'DELETE');
    toast('Registro eliminado.');
    await load();
  });
});

view.addEventListener('change',event=>{
  if (event.target.id==='monthPicker' && event.target.value && event.target.reportValidity()) {
    setMonth(event.target.value);
  }
});

view.addEventListener('submit',event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(event.target));
  if (event.target.id==='filters') {
    if (data.start && data.end && data.start>data.end) return toast('La fecha desde debe ser anterior o igual a la fecha hasta.');
    const filters=new URLSearchParams(Object.entries(data).filter(([,value])=>value.trim()));
    location.hash='movimientos'+(filters.size?'?'+filters:'');
  }
  if (event.target.id==='rateForm') perform(event.submitter,async()=>{
    await api('settings','PUT',data);
    toast('Tipo de cambio actualizado.');
    await load();
  });
});

form.addEventListener('submit',async event=>{
  event.preventDefault();
  const {collection,id}=editing;
  const submit=$('#save');
  const errorNode=$('#formError');
  const data=Object.fromEntries(new FormData(form));
  submit.disabled=true;
  errorNode.hidden=true;
  try {
    await api(collection+(id?'/'+id:''),id?'PUT':'POST',data);
    editor.close();
    toast('Registro guardado.');
    if (collection==='budgets' && section()==='presupuestos' && data.month!==state.month) setMonth(data.month);
    else await load();
  } catch (error) {
    errorNode.textContent=error.message;
    errorNode.hidden=false;
  } finally {
    submit.disabled=false;
  }
});

for (const id of ['close','cancel']) $('#'+id).addEventListener('click',()=>editor.close());
$('#theme').addEventListener('click',theme);
$('#new').innerHTML=icon('plus')+'Nuevo movimiento';
$('#new').addEventListener('click',()=>openEditor('transactions'));
$('#install').addEventListener('click',install);
$('#rateIcon').innerHTML=icon('swap');
$('#nav').innerHTML=Object.entries(sections).map(([key,[title,,glyph,shortLabel]])=>
  `<a class="nav-item" href="#${key}" aria-label="${title}">${icon(glyph)}<span>${shortLabel}</span></a>`).join('');
document.documentElement.dataset.theme=localStorage.getItem('pulso-theme')==='light'?'light':'dark';
refreshTheme();

function connection() { $('#offline').hidden=navigator.onLine; }
window.addEventListener('online',()=>{connection();load();});
window.addEventListener('offline',connection);
window.addEventListener('hashchange',load);
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstall=event;
  $('#install').hidden=false;
  if (section()==='ajustes' && state.settings && !state.loading) draw();
});
window.addEventListener('appinstalled',()=>{deferredInstall=null;$('#install').hidden=true;});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(error=>console.error(error));
connection();
load();
