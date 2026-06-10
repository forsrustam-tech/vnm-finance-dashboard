/*
  APP.JS — логика дашборда.
  В обычном режиме данные сохраняются в localStorage.
  Если в config.js включить SUPABASE_CONFIG.ENABLED = true, данные будут храниться в Supabase.
*/

const STORAGE_KEY = 'vnm_finance_v2';
const isSupabaseMode = window.SUPABASE_CONFIG?.ENABLED === true;
let supabaseClient = null;
let S = clone(window.DEFAULT_DATA);
let saveTimer = null;
let userRole = 'owner';

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function $(id) { return document.getElementById(id); }
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₸'; }
function showToast(text = 'Сохранено') {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}
function canEdit() { return ['owner', 'founder'].includes(userRole); }
function getSection(sid) { return S.sections.find(s => s.id === sid); }
function getRow(sid, rid) { return getSection(sid)?.rows.find(r => Number(r.id) === Number(rid)); }
function getPayment(id) { return S.payments.find(p => Number(p.id) === Number(id)); }
function secTotal(sec) { return sec.rows.reduce((sum, row) => sum + (Number(row.fact) || 0), 0); }
function dot(plan, fact) {
  if (fact > 0 && fact >= plan && plan > 0) return 'dot-g';
  if (fact > 0) return 'dot-y';
  return 'dot-gr';
}
function pct(plan, fact) {
  if (!Number(plan) || !Number(fact)) return '—';
  return Math.round((Number(fact) / Number(plan)) * 100) + '%';
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : clone(window.DEFAULT_DATA);
  } catch (e) {
    console.warn('Не получилось загрузить localStorage', e);
    return clone(window.DEFAULT_DATA);
  }
}

function saveLocalState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    showToast();
  }, 350);
}

async function saveState() {
  if (!isSupabaseMode) return saveLocalState();
  showToast('Сохранено в базе');
}

function initMonthSelect() {
  const sel = $('month-sel');
  sel.innerHTML = '';
  const months = Array.from(new Set([...(window.MONTHS || []), S.month]));
  months.forEach(month => {
    const opt = document.createElement('option');
    opt.value = month;
    opt.textContent = month;
    if (month === S.month) opt.selected = true;
    sel.appendChild(opt);
  });
  $('month-badge').textContent = S.month;
}

function updateKPI() {
  const inc = secTotal(S.sections.find(s => s.type === 'income') || { rows: [] });
  const exp = S.sections.filter(s => s.type === 'expense').reduce((sum, sec) => sum + secTotal(sec), 0);
  const prf = inc - exp;
  $('kpi-inc').textContent = fmt(inc);
  $('kpi-exp').textContent = fmt(exp);
  const el = $('kpi-prf');
  el.textContent = fmt(prf);
  el.className = 'kpi-val ' + (prf > 0 ? 'kv-g' : prf < 0 ? 'kv-r' : '');
}

function renderSections() {
  const cont = $('sections');
  cont.innerHTML = '';
  S.sections.forEach(sec => {
    const isOpen = S.open[sec.id] !== false;
    const div = document.createElement('div');
    div.className = 'section';
    div.innerHTML = `
      <div class="sec-hdr" data-toggle="${sec.id}">
        <i class="ti ${sec.icon}" style="font-size:16px;color:#aaa"></i>
        <span class="sec-hdr-title">${escapeHtml(sec.title)}</span>
        <span class="sec-hdr-total">${fmt(secTotal(sec))}</span>
        <i class="ti ti-chevron-down chev ${isOpen ? 'open' : ''}"></i>
      </div>
      ${isOpen ? `
        <div class="sec-body">
          <table class="tbl">
            <thead><tr>
              <th style="width:28px"></th>
              <th>Статья</th>
              <th class="r" style="width:120px">План ₸</th>
              <th class="r" style="width:120px">Факт ₸</th>
              <th class="c" style="width:56px">%</th>
              <th style="width:28px"></th>
            </tr></thead>
            <tbody></tbody>
          </table>
          <button class="addbtn" data-add-row="${sec.id}"><i class="ti ti-plus"></i> добавить строку</button>
        </div>` : ''}`;
    cont.appendChild(div);

    if (isOpen) {
      const tb = div.querySelector('tbody');
      sec.rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'drow';
        tr.innerHTML = `
          <td><span class="dot ${dot(Number(row.plan), Number(row.fact))}"></span></td>
          <td><input class="nin" ${!canEdit() ? 'disabled' : ''} value="${escapeAttr(row.name)}" data-row-name="${sec.id}:${row.id}" /></td>
          <td class="r"><input class="ein" ${!canEdit() ? 'disabled' : ''} type="number" value="${row.plan || ''}" placeholder="0" data-row-val="${sec.id}:${row.id}:plan" /></td>
          <td class="r"><input class="ein" ${!canEdit() ? 'disabled' : ''} type="number" value="${row.fact || ''}" placeholder="0" data-row-val="${sec.id}:${row.id}:fact" /></td>
          <td class="c pct-cell">${pct(row.plan, row.fact)}</td>
          <td><button class="delbtn" ${!canEdit() ? 'disabled' : ''} data-del-row="${sec.id}:${row.id}"><i class="ti ti-x"></i></button></td>`;
        tb.appendChild(tr);
      });
    }
  });
  updateKPI();
}

function renderJournal() {
  const tb = $('jbody');
  tb.innerHTML = '';
  S.payments.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="jin" ${!canEdit() ? 'disabled' : ''} value="${escapeAttr(p.date)}" style="width:82px" data-payment="${p.id}:date" /></td>
      <td><input class="jin" ${!canEdit() ? 'disabled' : ''} value="${escapeAttr(p.to)}" data-payment="${p.id}:to" /></td>
      <td><input class="jin" ${!canEdit() ? 'disabled' : ''} value="${escapeAttr(p.desc)}" data-payment="${p.id}:desc" /></td>
      <td style="text-align:right"><input class="jin" ${!canEdit() ? 'disabled' : ''} type="number" value="${p.amount || ''}" style="text-align:right;width:90px" data-payment="${p.id}:amount" /></td>
      <td style="text-align:center">
        <select class="jsel" ${!canEdit() ? 'disabled' : ''} data-payment="${p.id}:cat">
          ${['Зарплата','Сервис','Дивиденды','Прочее'].map(c => `<option ${p.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
      <td style="text-align:center">
        <select class="jsel" ${!canEdit() ? 'disabled' : ''} data-payment="${p.id}:status">
          <option value="paid" ${p.status === 'paid' ? 'selected' : ''}>✅ Оплачено</option>
          <option value="wait" ${p.status === 'wait' ? 'selected' : ''}>⏳ Ожидает</option>
        </select>
      </td>
      <td><button class="delbtn" ${!canEdit() ? 'disabled' : ''} data-del-payment="${p.id}"><i class="ti ti-x"></i></button></td>`;
    tb.appendChild(tr);
  });
  const total = S.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const sal = S.payments.filter(p => p.cat === 'Зарплата').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const srv = S.payments.filter(p => p.cat === 'Сервис').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  $('j-cnt').textContent = S.payments.length + ' шт.';
  $('j-sum').textContent = fmt(total);
  $('j-sal').textContent = fmt(sal);
  $('j-srv').textContent = fmt(srv);
}

function renderAll() {
  initMonthSelect();
  renderSections();
  renderJournal();
  $('storage-mode-text').textContent = isSupabaseMode
    ? 'Включен Supabase. Данные будут храниться в общей базе, если таблицы и ключи настроены.'
    : 'Сейчас включен локальный режим. Данные сохраняются только в браузере этого устройства.';
}

async function updateRowName(sid, rid, value) {
  const row = getRow(sid, rid);
  if (!row) return;
  row.name = value;
  if (isSupabaseMode) await supabaseUpdateDashboardRow(row);
  await saveState();
}

async function updateRowValue(sid, rid, field, value) {
  const row = getRow(sid, rid);
  if (!row) return;
  row[field] = Number(value) || 0;
  if (isSupabaseMode) await supabaseUpdateDashboardRow(row);
  await saveState();
  renderSections();
}

async function addRow(sid) {
  const sec = getSection(sid);
  if (!sec || !canEdit()) return;
  const row = { id: S.nextId++, name: '', plan: 0, fact: 0 };
  sec.rows.push(row);
  if (isSupabaseMode) {
    const saved = await supabaseInsertDashboardRow(sec, row);
    if (saved?.id) row.id = saved.id;
  }
  await saveState();
  renderSections();
}

async function delRow(sid, rid) {
  if (!canEdit()) return;
  const sec = getSection(sid);
  if (!sec) return;
  if (!confirm('Удалить строку?')) return;
  sec.rows = sec.rows.filter(r => Number(r.id) !== Number(rid));
  if (isSupabaseMode) await supabaseDelete('dashboard_rows', rid);
  await saveState();
  renderSections();
}

async function updatePayment(id, field, value) {
  const p = getPayment(id);
  if (!p) return;
  p[field] = field === 'amount' ? (Number(value) || 0) : value;
  if (isSupabaseMode) await supabaseUpdatePayment(p);
  await saveState();
  renderJournal();
}

async function addPayment() {
  if (!canEdit()) return;
  const today = new Date();
  const d = String(today.getDate()).padStart(2, '0');
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const p = { id: S.nextId++, date: `${d}.${m}.${today.getFullYear()}`, to: '', desc: '', amount: 0, cat: 'Зарплата', status: 'wait' };
  S.payments.push(p);
  if (isSupabaseMode) {
    const saved = await supabaseInsertPayment(p);
    if (saved?.id) p.id = saved.id;
  }
  await saveState();
  renderJournal();
}

async function delPayment(id) {
  if (!canEdit()) return;
  if (!confirm('Удалить выплату?')) return;
  S.payments = S.payments.filter(p => Number(p.id) !== Number(id));
  if (isSupabaseMode) await supabaseDelete('payments', id);
  await saveState();
  renderJournal();
}

async function changeMonth(month) {
  S.month = month;
  $('month-badge').textContent = month;
  if (isSupabaseMode) await loadSupabaseMonth(month);
  await saveState();
  renderAll();
}

function switchTab(tab) {
  ['dash', 'jnl', 'tools'].forEach(t => {
    $(`pg-${t}`).classList.toggle('hidden', t !== tab);
    $(`btn-${t}`).classList.toggle('active', t === tab);
  });
}

async function createNewMonth() {
  const month = prompt('Введите месяц, например: Июль 2026');
  if (!month) return;
  S.month = month.trim();
  S.sections = clone(window.DEFAULT_DATA.sections).map(sec => ({
    ...sec,
    rows: sec.rows.map(r => ({ ...r, fact: 0 }))
  }));
  S.payments = [];
  if (isSupabaseMode) await saveFullMonthToSupabase();
  await saveState();
  renderAll();
}

async function copyCurrentMonth() {
  const month = prompt('Название нового месяца, например: Июль 2026');
  if (!month) return;
  S.month = month.trim();
  S.sections = S.sections.map(sec => ({
    ...sec,
    rows: sec.rows.map(r => ({ ...r, id: S.nextId++, fact: 0 }))
  }));
  S.payments = [];
  if (isSupabaseMode) await saveFullMonthToSupabase();
  await saveState();
  renderAll();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vnm-finance-${S.month}.json`.replaceAll(' ', '-');
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      S = JSON.parse(reader.result);
      await saveState();
      renderAll();
      showToast('Импортировано');
    } catch (e) {
      alert('Не получилось импортировать файл JSON');
    }
  };
  reader.readAsText(file);
}

function resetLocalData() {
  if (isSupabaseMode) return alert('Сброс локальных данных отключен в Supabase-режиме.');
  if (!confirm('Сбросить все локальные данные до шаблона?')) return;
  localStorage.removeItem(STORAGE_KEY);
  S = clone(window.DEFAULT_DATA);
  renderAll();
  showToast('Сброшено');
}

async function initSupabase() {
  supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.URL, window.SUPABASE_CONFIG.ANON_KEY);
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    $('app').classList.add('hidden');
    $('login-screen').classList.remove('hidden');
    return;
  }
  await initAppAfterAuth();
}

async function login() {
  $('login-error').textContent = '';
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    $('login-error').textContent = error.message;
    return;
  }
  await initAppAfterAuth();
}

async function logout() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  location.reload();
}

async function initAppAfterAuth() {
  $('login-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('logout-btn').classList.remove('hidden');
  await loadUserRole();
  await loadSupabaseMonth(S.month);
  renderAll();
}

async function loadUserRole() {
  const { data: userData } = await supabaseClient.auth.getUser();
  const user = userData?.user;
  if (!user) return;
  const { data } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
  userRole = data?.role || 'viewer';
}

async function loadSupabaseMonth(month) {
  const { data: rows, error: rowsError } = await supabaseClient
    .from('dashboard_rows')
    .select('*')
    .eq('month', month)
    .order('sort_order', { ascending: true });
  if (rowsError) { console.error(rowsError); alert('Ошибка загрузки строк дашборда'); return; }

  const { data: payments, error: paymentsError } = await supabaseClient
    .from('payments')
    .select('*')
    .eq('month', month)
    .order('id', { ascending: true });
  if (paymentsError) { console.error(paymentsError); alert('Ошибка загрузки выплат'); return; }

  const template = clone(window.DEFAULT_DATA);
  template.month = month;
  template.sections.forEach(sec => { sec.rows = []; });

  rows.forEach(row => {
    let sec = template.sections.find(s => s.id === row.section_id);
    if (!sec) {
      sec = { id: row.section_id, title: row.section_title, icon: 'ti-folder', type: row.section_type, rows: [] };
      template.sections.push(sec);
    }
    sec.rows.push({ id: row.id, name: row.name, plan: Number(row.plan) || 0, fact: Number(row.fact) || 0 });
  });

  template.payments = payments.map(p => ({
    id: p.id,
    date: p.date || '',
    to: p.recipient || '',
    desc: p.description || '',
    amount: Number(p.amount) || 0,
    cat: p.category || 'Прочее',
    status: p.status || 'wait'
  }));
  S = template;
}

async function supabaseInsertDashboardRow(sec, row) {
  const { data, error } = await supabaseClient.from('dashboard_rows').insert({
    month: S.month,
    section_id: sec.id,
    section_title: sec.title,
    section_type: sec.type,
    name: row.name,
    plan: row.plan,
    fact: row.fact,
    sort_order: sec.rows.length
  }).select().single();
  if (error) { alert('Ошибка добавления строки'); console.error(error); }
  return data;
}

async function supabaseUpdateDashboardRow(row) {
  const { error } = await supabaseClient.from('dashboard_rows').update({
    name: row.name,
    plan: row.plan,
    fact: row.fact,
    updated_at: new Date().toISOString()
  }).eq('id', row.id);
  if (error) { alert('Ошибка сохранения строки'); console.error(error); }
}

async function supabaseInsertPayment(p) {
  const { data, error } = await supabaseClient.from('payments').insert({
    month: S.month,
    date: p.date,
    recipient: p.to,
    description: p.desc,
    amount: p.amount,
    category: p.cat,
    status: p.status
  }).select().single();
  if (error) { alert('Ошибка добавления выплаты'); console.error(error); }
  return data;
}

async function supabaseUpdatePayment(p) {
  const { error } = await supabaseClient.from('payments').update({
    date: p.date,
    recipient: p.to,
    description: p.desc,
    amount: p.amount,
    category: p.cat,
    status: p.status,
    updated_at: new Date().toISOString()
  }).eq('id', p.id);
  if (error) { alert('Ошибка сохранения выплаты'); console.error(error); }
}

async function supabaseDelete(table, id) {
  const { error } = await supabaseClient.from(table).delete().eq('id', id);
  if (error) { alert('Ошибка удаления'); console.error(error); }
}

async function saveFullMonthToSupabase() {
  for (const sec of S.sections) {
    for (let i = 0; i < sec.rows.length; i++) {
      const row = sec.rows[i];
      const saved = await supabaseInsertDashboardRow(sec, { ...row, sort_order: i });
      if (saved?.id) row.id = saved.id;
    }
  }
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}
function escapeAttr(str = '') { return escapeHtml(str); }

function bindEvents() {
  document.body.addEventListener('click', async e => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) return switchTab(tabBtn.dataset.tab);
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) { S.open[toggle.dataset.toggle] = !S.open[toggle.dataset.toggle]; await saveState(); return renderSections(); }
    const add = e.target.closest('[data-add-row]');
    if (add) return addRow(add.dataset.addRow);
    const del = e.target.closest('[data-del-row]');
    if (del) { const [sid, rid] = del.dataset.delRow.split(':'); return delRow(sid, rid); }
    const delP = e.target.closest('[data-del-payment]');
    if (delP) return delPayment(delP.dataset.delPayment);
  });

  document.body.addEventListener('change', async e => {
    if (e.target.matches('[data-row-name]')) { const [sid, rid] = e.target.dataset.rowName.split(':'); return updateRowName(sid, rid, e.target.value); }
    if (e.target.matches('[data-row-val]')) { const [sid, rid, field] = e.target.dataset.rowVal.split(':'); return updateRowValue(sid, rid, field, e.target.value); }
    if (e.target.matches('[data-payment]')) { const [id, field] = e.target.dataset.payment.split(':'); return updatePayment(id, field, e.target.value); }
  });

  $('month-sel').addEventListener('change', e => changeMonth(e.target.value));
  $('add-payment-btn').addEventListener('click', addPayment);
  $('new-month-btn').addEventListener('click', createNewMonth);
  $('copy-month-btn').addEventListener('click', copyCurrentMonth);
  $('export-btn').addEventListener('click', exportJson);
  $('import-file').addEventListener('change', e => e.target.files[0] && importJson(e.target.files[0]));
  $('reset-btn').addEventListener('click', resetLocalData);
  $('login-btn').addEventListener('click', login);
  $('logout-btn').addEventListener('click', logout);
}

async function init() {
  bindEvents();
  if (isSupabaseMode) {
    await initSupabase();
  } else {
    S = loadLocalState();
    renderAll();
  }
}

init();
