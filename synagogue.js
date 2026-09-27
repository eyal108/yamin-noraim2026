(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!window.supabase || !window.YNGeneric || !window.SynagogueCore) {
    $('gateMessage').textContent = 'לא ניתן לטעון את המערכת. בדקו את החיבור לאינטרנט ורעננו.';
    return;
  }
  const core = window.SynagogueCore;
  const db = YNGeneric.makeRawClient();
  const esc = YNGeneric.esc;
  const names = { home: 'השבת הקרובה', members: 'מאגר מתפללים', prayers: 'תפילות וזמנים', assignments: 'גבאות ותפקידים', events: 'אירועים ואזכרות', finances: 'כספים והתחייבויות' };
  const singular = { members: 'מתפלל', prayers: 'תפילה', assignments: 'תפקיד', events: 'אירוע', finances: 'רשומה' };
  const notes = {
    members: 'פרטי מתפללים אישיים. רשימות המשפחות ובקשות המושבים נמצאות במסך ״בקשות ומשפחות״.',
    prayers: 'זמני התפילות מוזנים ידנית, לפי שעון ישראל.',
    assignments: 'שיבוץ ידני של תפקידים ועליות, עם אפשרות לעיין ברשומות מתאריכים קודמים.',
    events: 'כל רשומה היא אירוע במועד מסוים. ליארצייט יש להזין את המועד האזרחי המתאים לשנה זו.',
    finances: 'מעקב התחייבויות ותרומות בלבד. אין כאן סליקה או הפקת קבלות.'
  };
  const state = { view: 'home', records: {}, tenant: null, store: null, ready: false, busy: false, generation: 0, userId: null, editor: null, filter: '', period: 'upcoming' };
  const dateText = value => value ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : '';
  const money = amount => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount);
  const memberName = id => state.records.members?.find(m => m.id === id)?.full_name || '';
  const link = path => path + (state.tenant ? '?org=' + encodeURIComponent(state.tenant.slug) : '');
  function notice(text, error = false) {
    $('notice').textContent = text;
    $('notice').classList.toggle('error', error);
  }
  function formError(error) {
    let text = error.message || 'הפעולה נכשלה. נסו שוב.';
    if (error.code === '23503') text = 'המתפלל משויך לרשומות אחרות ולא ניתן למחוק אותו. אפשר לשנות את מצבו ל״לא פעיל״.';
    if (error.code === '23505') text = 'ייתכן שהרשומה כבר נשמרה. סגרו את החלון ורעננו את הנתונים לפני ניסיון נוסף.';
    $('formError').textContent = text;
    $('formError').hidden = false;
    $('formError').focus();
  }
  function showGate(text, { login = false, retry = false } = {}) {
    state.ready = false;
    $('app').hidden = true;
    $('sidebar').hidden = true;
    $('refresh').hidden = true;
    $('gate').hidden = false;
    $('gateMessage').textContent = text;
    $('login').hidden = !login;
    $('retry').hidden = !retry;
  }
  function clearSession() {
    state.generation++;
    state.records = {};
    state.tenant = null;
    state.store = null;
    state.userId = null;
    state.editor = null;
    $('editor').close();
    $('view').replaceChildren();
    $('orgName').textContent = 'בית הכנסת';
    $('tenantBar').hidden = true;
    $('logout').hidden = true;
    notice('');
    showGate('יש להתחבר כדי לנהל את בית הכנסת.', { login: true });
  }
  async function initialize() {
    const generation = ++state.generation;
    showGate('טוען את בית הכנסת והנתונים…');
    notice('');
    try {
      const sessionResult = await db.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;
      if (generation !== state.generation) return;
      const session = sessionResult.data.session;
      if (!session?.user?.email) { clearSession(); return; }
      state.userId = session.user.id;
      $('logout').hidden = false;
      const [synagoguesResult, productResult] = await Promise.all([
        db.from('yamim_noraim_synagogues').select('id,slug,name,is_active').order('name'),
        db.from('yamim_noraim_product_admins').select('email').eq('email', session.user.email.toLowerCase()).maybeSingle()
      ]);
      if (generation !== state.generation) return;
      if (synagoguesResult.error) throw synagoguesResult.error;
      if (productResult.error) throw productResult.error;
      const synagogues = (synagoguesResult.data || []).filter(s => s.is_active || productResult.data);
      if (!synagogues.length) { showGate('לחשבון הזה אין הרשאת ניהול של בית כנסת פעיל. אפשר להתנתק ולהתחבר לחשבון אחר.'); return; }
      let stored = '';
      try { stored = localStorage.getItem('yn:synagogue'); } catch { /* Preferences are optional. */ }
      const requested = new URL(location.href).searchParams.get('org');
      state.tenant = core.selectTenant(synagogues, requested, stored);
      $('tenantSelect').innerHTML = '<option value="">בחירת בית כנסת</option>' + synagogues.map(s => `<option value="${esc(s.slug)}">${esc(s.name)}${s.is_active ? '' : ' — לא פעיל'}</option>`).join('');
      $('tenantSelect').value = state.tenant?.slug || '';
      $('tenantBar').hidden = false;
      if (!state.tenant) { showGate(requested ? 'בית הכנסת שבקישור אינו זמין לחשבון הזה. בחרו בית כנסת מהרשימה.' : 'בחרו בית כנסת כדי להמשיך.'); return; }
      const tenant = state.tenant;
      try { localStorage.setItem('yn:synagogue', tenant.id); } catch { /* Preferences are optional. */ }
      const url = new URL(location.href);
      url.searchParams.set('org', tenant.slug);
      history.replaceState(null, '', url);
      state.store = core.createStore(db, tenant.id);
      const records = await state.store.load();
      if (generation !== state.generation) return;
      state.records = records;
      state.ready = true;
      $('orgName').textContent = tenant.name;
      document.querySelectorAll('[data-href]').forEach(a => { a.href = link(a.dataset.href); });
      $('gate').hidden = true;
      $('app').hidden = false;
      $('sidebar').hidden = false;
      $('refresh').hidden = false;
      setView(state.view);
    } catch (error) {
      if (generation !== state.generation) return;
      console.error('Unable to load synagogue workspace', error.code || error.message);
      showGate('לא ניתן לטעון את כל הנתונים. בדקו את החיבור ונסו שוב.', { retry: true });
    }
  }
  function setView(view) {
    if (!state.ready || state.busy || !names[view]) return;
    state.view = view;
    state.filter = '';
    state.period = ['prayers', 'assignments', 'events'].includes(view) ? 'upcoming' : 'all';
    $('title').textContent = names[view];
    $('subtitle').textContent = notes[view] || '';
    $('eyebrow').textContent = view === 'home' ? 'לוח עבודה' : 'ניהול הקהילה';
    $('add').hidden = view === 'home';
    $('add').textContent = 'הוספת ' + (singular[view] || 'רשומה');
    document.querySelectorAll('#sections button').forEach(button => {
      button.classList.toggle('active', button.dataset.view === view);
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (view === 'home') renderHome(); else renderList();
  }
  function renderHome() {
    const board = core.board(state.records);
    $('subtitle').textContent = `יום שישי ${dateText(board.start)} עד מוצאי שבת ${dateText(board.end)} · הזמנים מוזנים ידנית`;
    const panel = (title, rows, render, empty) => `<section class="panel"><h2>${title}</h2>${rows.length ? rows.map(render).join('') : `<div class="empty">${empty}</div>`}</section>`;
    $('view').innerHTML = `
      <div class="overview">
        <div class="metric"><span>מתפללים פעילים</span><strong>${board.activeMembers}</strong></div>
        <div class="metric"><span>תפילות בשבת</span><strong>${board.prayers.length}</strong></div>
        <div class="metric"><span>תפקידים משובצים</span><strong>${board.assigned}</strong><small>${board.unassigned} תפקידים ממתינים לשיבוץ</small></div>
      </div>
      <div class="grid">
        ${panel('תפילות', board.prayers, x => `<div class="item"><div><strong>${esc(x.title)}</strong><small>${dateText(x.service_date)}</small>${x.notes ? `<small>${esc(x.notes)}</small>` : ''}</div><span class="date-pill">${esc(x.service_time?.slice(0, 5) || 'טרם נקבעה שעה')}</span></div>`, 'לא הוזנו תפילות לשבת הקרובה.')}
        ${panel('תפקידים ועליות', board.assignments, x => `<div class="item"><div><strong>${esc(x.duty)}</strong><small>${dateText(x.service_date)}</small></div><span>${esc(memberName(x.member_id) || x.person_name || 'טרם שובץ')}</span></div>`, 'אין תפקידים לשבת הקרובה.')}
        ${panel('אירועים ואזכרות', board.events, x => `<div class="item"><div><strong>${esc(x.title)}</strong><small>${esc(x.kind)}</small></div><span>${dateText(x.event_date)}</span></div>`, 'לא נרשמו אירועים לשבת הקרובה.')}
        <section class="panel"><h2>סידור המקומות</h2><p>רשימות המשפחות, בקשות המושבים ותצורות האולם.</p><div class="quick"><a class="quiet" href="${esc(link('seating.html'))}">מפת הושבה</a><a class="quiet" href="${esc(link('admin.html'))}">בקשות ומשפחות</a></div></section>
      </div>
      <div class="quick"><button data-go="prayers">הוספת תפילה לשבת</button><button data-go="assignments">שיבוץ תפקיד לשבת</button><button data-go="events">הוספת אירוע לשבת</button></div>`;
    $('view').querySelectorAll('[data-go]').forEach(button => { button.onclick = () => { setView(button.dataset.go); openEditor(null, board.end); }; });
  }
  function rowDetails(kind, row) {
    if (kind === 'members') return [row.family_name, row.role, row.phone, row.email, row.status].filter(Boolean).join(' · ');
    if (kind === 'prayers') return [dateText(row.service_date), row.service_time?.slice(0, 5) || 'טרם נקבעה שעה'].join(' · ');
    if (kind === 'assignments') return [dateText(row.service_date), memberName(row.member_id) || row.person_name || 'טרם שובץ'].join(' · ');
    if (kind === 'events') return [dateText(row.event_date), row.kind].join(' · ');
    return [dateText(row.entry_date), memberName(row.member_id), row.status].filter(Boolean).join(' · ');
  }
  function renderRows() {
    const kind = state.view;
    const query = state.filter.trim().toLocaleLowerCase('he-IL');
    const dateKey = kind === 'events' ? 'event_date' : kind === 'finances' ? 'entry_date' : 'service_date';
    let rows = [...state.records[kind]];
    if (state.period !== 'all') rows = rows.filter(row => state.period === 'upcoming' ? row[dateKey] >= core.today() : row[dateKey] < core.today());
    rows.sort((a, b) => kind === 'members' ? a.full_name.localeCompare(b.full_name, 'he') : (state.period === 'past' || kind === 'finances' ? -1 : 1) * a[dateKey].localeCompare(b[dateKey]) || (a.service_time || '99').localeCompare(b.service_time || '99'));
    rows = rows.filter(row => !query || [...core.fields[kind].map(([key]) => row[key]), rowDetails(kind, row)].join(' ').toLocaleLowerCase('he-IL').includes(query));
    $('rowCount').textContent = rows.length;
    $('rows').innerHTML = rows.length ? rows.map(row => {
      const title = row.full_name || row.duty || row.description || row.title;
      return `<div class="row"><strong>${esc(title)}</strong><span>${esc(rowDetails(kind, row))}</span><span>${kind === 'finances' ? money(Number(row.amount)) : ''}</span><button data-edit="${esc(row.id)}" aria-label="עריכת ${esc(title)}">עריכה</button>${row.notes ? `<div class="note">${esc(row.notes)}</div>` : ''}</div>`;
    }).join('') : '<p class="empty empty-list">אין רשומות התואמות לבחירה.</p>';
    $('rows').querySelectorAll('[data-edit]').forEach(button => { button.onclick = () => openEditor(state.records[kind].find(row => row.id === button.dataset.edit)); });
  }
  function renderList() {
    const withDates = ['prayers', 'assignments', 'events'].includes(state.view);
    const totals = state.view === 'finances' ? `<div class="finance-totals"><span>פתוח: <strong>${money(state.records.finances.filter(r => r.status === 'פתוח').reduce((sum, r) => sum + Math.round(Number(r.amount) * 100), 0) / 100)}</strong></span><span>שולם: <strong>${money(state.records.finances.filter(r => r.status === 'שולם').reduce((sum, r) => sum + Math.round(Number(r.amount) * 100), 0) / 100)}</strong></span><small>סיכום כל הרשומות</small></div>` : '';
    $('view').innerHTML = `${totals}<div class="list"><div class="list-head"><h2>${names[state.view]} <span class="badge" id="rowCount"></span></h2><div class="list-controls">${withDates ? '<select id="period" aria-label="תקופת הרשומות"><option value="upcoming">היום ובהמשך</option><option value="past">רשומות קודמות</option><option value="all">כל התאריכים</option></select>' : ''}<input id="search" type="search" aria-label="חיפוש ברשימה" placeholder="חיפוש ברשימה"></div></div><div id="rows"></div></div>`;
    $('search').value = state.filter;
    $('search').oninput = event => { state.filter = event.target.value; renderRows(); };
    if (withDates) { $('period').value = state.period; $('period').onchange = event => { state.period = event.target.value; renderRows(); }; }
    renderRows();
  }
  function openEditor(snapshot = null, defaultDate = core.today()) {
    if (!state.ready || state.busy) return;
    state.editor = { kind: state.view, snapshot, id: snapshot?.id || crypto.randomUUID(), store: state.store, generation: state.generation };
    $('dialogTitle').textContent = (snapshot ? 'עריכת ' : 'הוספת ') + singular[state.view];
    $('formHelp').textContent = notes[state.view];
    $('delete').hidden = !snapshot;
    $('formError').hidden = true;
    $('fields').innerHTML = core.fields[state.view].map(([key, label, type, required]) => {
      const value = snapshot?.[key] ?? (type === 'date' ? defaultDate : type === 'select' ? required[0] : '');
      const attributes = `name="${key}" id="field-${key}" ${required === true ? 'required' : ''}`;
      let input;
      if (type === 'select') input = `<select ${attributes}>${required.map(option => `<option value="${esc(option)}"${option === value ? ' selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
      else if (type === 'member') {
        const members = [...state.records.members].filter(m => m.status === 'פעיל' || m.id === value).sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'));
        input = `<select ${attributes}><option value="">— ללא שיוך —</option>${members.map(m => `<option value="${esc(m.id)}"${m.id === value ? ' selected' : ''}>${esc(m.full_name)}${m.status !== 'פעיל' ? ' — לא פעיל' : ''}</option>`).join('')}</select>`;
      } else if (type === 'textarea') input = `<textarea ${attributes} maxlength="4000">${esc(value)}</textarea>`;
      else input = `<input ${attributes} type="${type}" value="${esc(type === 'time' ? String(value).slice(0, 5) : value)}" ${type === 'number' ? 'step="0.01" min="0.01" max="9999999999.99"' : type === 'date' ? 'min="1900-01-01" max="2199-12-31"' : 'maxlength="250"'}>`;
      return `<label class="${type === 'textarea' ? 'wide' : ''}" for="field-${key}">${label}${required === true ? ' *' : ''}${input}</label>`;
    }).join('');
    $('editor').showModal();
  }
  function setBusy(busy) {
    state.busy = busy;
    $('editForm').querySelectorAll('button,input,select,textarea').forEach(control => { control.disabled = busy; });
    $('save').textContent = busy ? 'שומר…' : 'שמירה';
  }
  async function save(event) {
    event.preventDefault();
    if (state.busy || !state.editor || !state.ready) return;
    const editor = state.editor;
    $('formError').hidden = true;
    try {
      const values = core.validate(editor.kind, Object.fromEntries(new FormData($('editForm'))), state.records.members);
      setBusy(true);
      const saved = await editor.store.save(editor.kind, values, editor.snapshot, editor.id);
      if (editor.generation !== state.generation) return;
      const rows = state.records[editor.kind];
      state.records[editor.kind] = editor.snapshot ? rows.map(row => row.id === saved.id ? saved : row) : [...rows, saved];
      $('editor').close();
      state.editor = null;
      renderList();
      notice('הרשומה נשמרה.');
    } catch (error) { if (editor.generation === state.generation) formError(error); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (state.busy || !state.editor?.snapshot || !state.ready) return;
    const editor = state.editor;
    if (!confirm('למחוק את הרשומה? לא ניתן לבטל מחיקה זו מתוך המערכת.')) return;
    try {
      setBusy(true);
      await editor.store.remove(editor.kind, editor.snapshot);
      if (editor.generation !== state.generation) return;
      state.records[editor.kind] = state.records[editor.kind].filter(row => row.id !== editor.snapshot.id);
      $('editor').close();
      state.editor = null;
      renderList();
      notice('הרשומה נמחקה.');
    } catch (error) { if (editor.generation === state.generation) formError(error); }
    finally { setBusy(false); }
  }
  $('login').onclick = async () => {
    $('login').disabled = true;
    try {
      const redirectTo = new URL('synagogue.html', YNGeneric.SITE);
      const requested = new URL(location.href).searchParams.get('org');
      if (requested) redirectTo.searchParams.set('org', requested);
      const result = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo.href } });
      if (result.error) throw result.error;
    } catch { showGate('ההתחברות לא הצליחה. נסו שוב.', { login: true }); }
    finally { $('login').disabled = false; }
  };
  $('logout').onclick = async () => {
    $('logout').disabled = true;
    try { const result = await db.auth.signOut(); if (result.error) throw result.error; clearSession(); }
    catch { notice('ההתנתקות לא הצליחה. נסו שוב.', true); }
    finally { $('logout').disabled = false; }
  };
  $('tenantSelect').onchange = event => {
    if (!event.target.value || state.busy) return;
    const url = new URL(location.href);
    url.searchParams.set('org', event.target.value);
    location.assign(url.href);
  };
  $('retry').onclick = $('refresh').onclick = () => { if (!state.busy) initialize(); };
  $('sections').onclick = event => { const button = event.target.closest('[data-view]'); if (button) setView(button.dataset.view); };
  $('add').onclick = () => openEditor();
  $('close').onclick = $('cancel').onclick = () => { if (!state.busy) { $('editor').close(); state.editor = null; } };
  $('editor').addEventListener('cancel', event => { if (state.busy) event.preventDefault(); else state.editor = null; });
  $('editForm').onsubmit = save;
  $('delete').onclick = remove;
  db.auth.onAuthStateChange((event, session) => {
    // Do not call auth APIs synchronously from this callback (Supabase lock).
    if (event === 'SIGNED_OUT') clearSession();
    else if (event === 'SIGNED_IN' && session?.user?.id !== state.userId) {
      clearSession();
      setTimeout(initialize, 0);
    }
  });
  initialize();
})();
