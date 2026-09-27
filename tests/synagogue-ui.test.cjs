const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const turn = () => new Promise(resolve => setImmediate(resolve));
async function settle() { for (let i = 0; i < 12; i++) await turn(); }
function fixture(options = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'synagogue.html'), 'utf8'), { url: 'https://example.test/synagogue.html?org=' + (options.org || 'one'), runScripts: 'outside-only' });
  const w = dom.window, d = w.document;
  const session = options.noSession ? null : { user: { id: 'user', email: 'test@example.invalid' } };
  const data = {
    yamim_noraim_synagogues: options.noAccess ? [] : [{ id: 'A', slug: 'one', name: 'בית א', is_active: true }, { id: 'B', slug: 'two', name: 'בית ב', is_active: true }],
    yamim_noraim_product_admins: [],
    synagogue_members: [{ id: 'm1', synagogue_id: 'A', version: 1, full_name: 'ישראל ישראלי', family_name: 'ישראלי', role: 'ישראל', status: 'פעיל' }],
    synagogue_prayers: [], synagogue_assignments: [], synagogue_events: [], synagogue_finances: []
  };
  const control = { readFailure: false, writeFailure: false, writes: 0, callbacks: [], data, pending: null };
  const db = {
    auth: {
      async getSession() { return { data: { session } }; },
      onAuthStateChange(cb) { control.callbacks.push(cb); return {}; },
      async signOut() { control.callbacks.forEach(cb => cb('SIGNED_OUT', null)); return {}; },
      async signInWithOAuth() { return { error: { message: 'network' } }; }
    },
    from(table) {
      const q = { operation: 'read', filters: [], start: 0, end: Infinity, single: false,
        select() { return this; }, eq(k, v) { this.filters.push([k, v]); return this; }, order() { return this; },
        range(s, e) { this.start = s; this.end = e; return this; }, maybeSingle() { this.single = true; return this; },
        insert(values) { this.operation = 'insert'; this.values = values; return this; },
        update(values) { this.operation = 'update'; this.values = values; return this; },
        delete() { this.operation = 'delete'; return this; },
        async then(resolve, reject) {
          try {
            if (this.operation === 'read') {
              if (control.readFailure && table.startsWith('synagogue_')) return resolve({ error: { message: 'read failed' } });
              const rows = data[table].filter(row => this.filters.every(([k, v]) => row[k] === v));
              return resolve({ data: this.single ? rows[0] || null : rows.slice(this.start, this.end + 1), count: rows.length });
            }
            control.writes++;
            if (control.pending) await control.pending;
            if (control.writeFailure) return resolve({ error: { message: 'שמירה נדחתה בבדיקה' } });
            let changed = [];
            if (this.operation === 'insert') { changed = [{ ...this.values, version: 1 }]; data[table].push(...changed); }
            else {
              const matches = data[table].filter(row => this.filters.every(([k, v]) => row[k] === v));
              if (this.operation === 'update') { for (const row of matches) { Object.assign(row, this.values, { version: row.version + 1 }); changed.push({ ...row }); } }
              else { changed = matches; data[table] = data[table].filter(row => !matches.includes(row)); }
            }
            resolve({ data: changed });
          } catch (error) { reject(error); }
        }
      };
      return q;
    }
  };
  w.supabase = {};
  w.YNGeneric = { makeRawClient: () => db, SITE: 'https://example.test/', esc: x => String(x ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.confirm = () => true;
  w.console.error = () => {};
  w.eval(fs.readFileSync(path.join(root, 'synagogue-core.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'synagogue.js'), 'utf8'));
  const click = selector => d.querySelector(selector).click();
  const fill = values => { for (const [key, value] of Object.entries(values)) d.querySelector(`#editForm [name="${key}"]`).value = value; };
  const submit = () => d.getElementById('editForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  return { dom, w, d, control, click, fill, submit };
}

test('unauthenticated users have a visible login gate and no private navigation', async () => {
  const f = fixture({ noSession: true }); await settle();
  assert.equal(f.d.getElementById('login').hidden, false); assert.equal(f.d.getElementById('sidebar').hidden, true);
  f.click('#login'); await settle(); assert.match(f.d.getElementById('gateMessage').textContent, /ההתחברות לא הצליחה/); f.dom.window.close();
});
test('unrecognized org cannot open another tenant; denied users can sign out', async () => {
  const f = fixture({ org: 'missing' }); await settle();
  assert.equal(f.d.getElementById('app').hidden, true); assert.match(f.d.getElementById('gateMessage').textContent, /אינו זמין/);
  f.dom.window.close();
  const g = fixture({ noAccess: true }); await settle(); assert.equal(g.d.getElementById('logout').hidden, false); g.dom.window.close();
});
test('CRUD works for every module with explicit tenant IDs and versioned updates', async () => {
  const f = fixture(); await settle();
  assert.equal(f.d.getElementById('app').hidden, false);
  const samples = {
    members: { full_name: 'בדיקת מתפלל', family_name: 'בדיקה', role: 'לוי', status: 'פעיל' },
    prayers: { service_date: '2026-10-03', title: 'בדיקת תפילה', service_time: '08:15' },
    assignments: { service_date: '2026-10-03', duty: 'בדיקת תפקיד', member_id: 'm1' },
    events: { event_date: '2026-10-03', title: 'בדיקת אירוע', kind: 'קידוש' },
    finances: { entry_date: '2026-10-03', description: 'בדיקת תרומה', member_id: 'm1', amount: '180.50', status: 'פתוח' }
  };
  for (const [kind, values] of Object.entries(samples)) {
    f.click(`[data-view="${kind}"]`); f.click('#add'); f.fill(values); f.submit(); await settle();
    assert.equal(f.d.getElementById('editor').open, false, kind + ': ' + f.d.getElementById('formError').textContent);
    const table = 'synagogue_' + kind;
    const record = f.control.data[table].at(-1);
    assert.equal(record.synagogue_id, 'A'); assert.equal(record.version, 1);
    if (f.d.getElementById('period')) { f.d.getElementById('period').value = 'all'; f.d.getElementById('period').dispatchEvent(new f.w.Event('change')); }
    f.click(`[data-edit="${record.id}"]`); f.fill({ notes: 'עודכן' }); f.submit(); await settle();
    assert.equal(f.control.data[table].at(-1).version, 2);
    f.click(`[data-edit="${record.id}"]`); f.click('#delete'); await settle();
    assert.equal(f.control.data[table].some(x => x.id === record.id), false);
  }
  f.dom.window.close();
});
test('save failures stay visible inside the dialog; retry preserves values', async () => {
  const f = fixture(); await settle(); f.click('[data-view="members"]'); f.click('#add'); f.fill({ full_name: 'בדיקת כשל' });
  f.control.writeFailure = true; f.submit(); await settle();
  assert.equal(f.d.getElementById('editor').open, true); assert.equal(f.d.getElementById('formError').hidden, false);
  assert.equal(f.d.querySelector('[name="full_name"]').value, 'בדיקת כשל');
  f.control.writeFailure = false; f.submit(); await settle(); assert.equal(f.d.getElementById('editor').open, false); f.dom.window.close();
});
test('double submit blocked and shared localStorage cannot change the mutation tenant', async () => {
  const f = fixture(); await settle(); f.click('[data-view="members"]'); f.click('#add'); f.fill({ full_name: 'בדיקה כפולה' });
  let release; f.control.pending = new Promise(resolve => { release = resolve; });
  f.w.localStorage.setItem('yn:synagogue', 'B'); f.submit(); f.submit(); await settle();
  assert.equal(f.control.writes, 1); assert.equal(f.d.getElementById('cancel').disabled, true);
  release(); await settle(); assert.equal(f.control.data.synagogue_members.at(-1).synagogue_id, 'A'); f.dom.window.close();
});
test('load errors show a recoverable gate; signout clears visible private data', async () => {
  const f = fixture(); await settle();
  f.control.readFailure = true; f.click('#refresh'); await settle(); assert.equal(f.d.getElementById('app').hidden, true); assert.equal(f.d.getElementById('retry').hidden, false);
  f.control.readFailure = false; f.click('#retry'); await settle(); assert.equal(f.d.getElementById('app').hidden, false);
  f.control.callbacks.forEach(cb => cb('SIGNED_OUT', null)); await settle(); assert.equal(f.d.getElementById('app').hidden, true); assert.equal(f.d.getElementById('view').textContent, ''); f.dom.window.close();
});
test('rendered names are escaped and search resolves member names for assignments', async () => {
  const f = fixture(); await settle();
  f.click('[data-view="members"]'); f.click('#add'); f.fill({ full_name: '<img src=x onerror=alert(1)>' }); f.submit(); await settle();
  assert.equal(f.d.querySelector('#rows img'), null); assert.match(f.d.getElementById('rows').textContent, /<img/);
  f.click('[data-view="assignments"]'); f.click('#add'); f.fill({ duty: 'שלישי', service_date: '2099-01-01', member_id: 'm1' }); f.submit(); await settle();
  f.d.getElementById('search').value = 'ישראלי'; f.d.getElementById('search').dispatchEvent(new f.w.Event('input')); assert.equal(f.d.getElementById('rowCount').textContent, '1'); f.dom.window.close();
});
