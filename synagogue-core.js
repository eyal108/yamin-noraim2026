/* Shared domain rules and tenant-scoped persistence. Also loadable by Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SynagogueCore = api;
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';
  const tables = Object.freeze({
    members: 'synagogue_members', prayers: 'synagogue_prayers',
    assignments: 'synagogue_assignments', events: 'synagogue_events', finances: 'synagogue_finances'
  });
  const fields = {
    members: [
      ['full_name', 'שם מלא', 'text', true], ['family_name', 'שם משפחה', 'text'],
      ['phone', 'טלפון', 'tel'], ['email', 'דוא״ל', 'email'],
      ['role', 'ייחוס לעלייה לתורה', 'select', ['ישראל', 'כהן', 'לוי']],
      ['status', 'מצב', 'select', ['פעיל', 'לא פעיל']], ['notes', 'הערות', 'textarea']
    ],
    prayers: [
      ['service_date', 'תאריך אזרחי', 'date', true], ['title', 'תפילה', 'text', true],
      ['service_time', 'שעה', 'time'], ['notes', 'הערות', 'textarea']
    ],
    assignments: [
      ['service_date', 'תאריך אזרחי', 'date', true], ['duty', 'תפקיד או עלייה', 'text', true],
      ['member_id', 'מתפלל מהמאגר', 'member'], ['person_name', 'שם אורח (כשלא נבחר מתפלל)', 'text'],
      ['notes', 'הערות', 'textarea']
    ],
    events: [
      ['event_date', 'תאריך אזרחי של האירוע', 'date', true], ['title', 'שם האירוע / שם הנפטר', 'text', true],
      ['kind', 'סוג', 'select', ['אירוע', 'יארצייט', 'קידוש', 'שיעור']], ['notes', 'הערות', 'textarea']
    ],
    finances: [
      ['entry_date', 'תאריך אזרחי', 'date', true], ['description', 'תיאור ההתחייבות או התרומה', 'text', true],
      ['member_id', 'מתפלל', 'member'], ['amount', 'סכום בש״ח', 'number', true],
      ['status', 'מצב', 'select', ['פתוח', 'שולם']], ['notes', 'הערות', 'textarea']
    ]
  };
  function today(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31') return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }
  function addDays(value, days) {
    const date = new Date(value + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  // A Shabbat board covers Friday and Saturday (including Saturday night).
  // Keep the current Saturday selected until civil midnight in Israel.
  function shabbatWindow(day = today()) {
    const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
    const saturday = addDays(day, (6 - weekday + 7) % 7);
    return { start: addDays(saturday, -1), end: saturday };
  }
  function board(records, day = today()) {
    const window = shabbatWindow(day);
    const within = date => date >= window.start && date <= window.end;
    const byDate = (a, b) => (a.service_date || a.event_date).localeCompare(b.service_date || b.event_date) || (a.service_time || '99').localeCompare(b.service_time || '99');
    const prayers = records.prayers.filter(r => within(r.service_date)).sort(byDate);
    const assignments = records.assignments.filter(r => within(r.service_date)).sort(byDate);
    return {
      ...window, prayers, assignments,
      events: records.events.filter(r => within(r.event_date)).sort(byDate),
      assigned: assignments.filter(r => r.member_id || r.person_name?.trim()).length,
      unassigned: assignments.filter(r => !r.member_id && !r.person_name?.trim()).length,
      activeMembers: records.members.filter(r => r.status === 'פעיל').length
    };
  }
  function selectTenant(synagogues, requested, stored) {
    if (requested) return synagogues.find(s => s.slug === requested || s.id === requested) || null;
    return synagogues.find(s => s.id === stored) || (synagogues.length === 1 ? synagogues[0] : null);
  }
  function validate(kind, input, members = []) {
    if (!fields[kind]) throw new Error('סוג רשומה לא מוכר.');
    const values = {};
    for (const [key, label, type, required] of fields[kind]) {
      const text = String(input[key] ?? '').trim();
      if (required === true && !text) throw new Error(`יש למלא ${label}.`);
      if (text.length > (type === 'textarea' ? 4000 : 250)) throw new Error(`הערך בשדה ${label} ארוך מדי.`);
      if (type === 'select' && !required.includes(text)) throw new Error(`יש לבחור ערך תקין בשדה ${label}.`);
      if (type === 'date' && !validDate(text)) throw new Error('יש לבחור תאריך תקין בשנים 1900–2199.');
      if (type === 'time' && text && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error('יש לבחור שעה תקינה.');
      if (type === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error('כתובת הדוא״ל אינה תקינה.');
      if (type === 'member' && text && !members.some(m => m.id === text)) throw new Error('המתפלל אינו נמצא במאגר של בית הכנסת הזה.');
      values[key] = text || null;
      if (type === 'number') {
        if (!/^\d+(\.\d{1,2})?$/.test(text) || Number(text) <= 0 || Number(text) > 9999999999.99) throw new Error('יש להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה.');
        values[key] = Number(text);
      }
    }
    if (kind === 'assignments' && values.member_id && values.person_name) throw new Error('יש לבחור מתפלל או להזין שם אורח, ולא את שניהם.');
    return values;
  }
  // Capture a tenant ID, never consult shared localStorage during a request.
  function createStore(db, tenantId) {
    if (!tenantId) throw new Error('לא נבחר בית כנסת.');
    async function loadKind(kind) {
      const rows = [];
      let expected = null;
      while (true) {
        // Explicit version selection fails closed if the schema was not installed.
        const response = await db.from(tables[kind]).select('*,version', { count: 'exact' })
          .eq('synagogue_id', tenantId).order('id').range(rows.length, rows.length + 499);
        if (response.error) throw response.error;
        if (!Array.isArray(response.data)) throw new Error('לא התקבלה רשימה תקינה.');
        if (expected !== null && response.count !== expected) throw new Error('הנתונים השתנו בזמן הטעינה. יש לרענן.');
        expected = response.count;
        const page = response.data;
        if (!page.length) {
          if (expected !== null && rows.length < expected) throw new Error('טעינת הנתונים לא הושלמה. יש לרענן.');
          break;
        }
        if (page.some(r => r.synagogue_id !== tenantId)) throw new Error('התקבלו נתונים של בית כנסת אחר.');
        rows.push(...page);
        if (expected !== null && rows.length >= expected) break;
      }
      if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('הנתונים השתנו בזמן הטעינה. יש לרענן.');
      return rows;
    }
    return {
      async load() { return Object.fromEntries(await Promise.all(Object.keys(tables).map(async k => [k, await loadKind(k)]))); },
      async save(kind, values, snapshot, id) {
        if (!tables[kind]) throw new Error('סוג רשומה לא מוכר.');
        const response = snapshot
          ? await db.from(tables[kind]).update(values).eq('synagogue_id', tenantId).eq('id', snapshot.id).eq('version', snapshot.version).select('*')
          : await db.from(tables[kind]).insert({ ...values, id, synagogue_id: tenantId }).select('*');
        if (response.error) throw response.error;
        if (response.data?.length !== 1) throw new Error('הרשומה השתנתה או שאין הרשאה לשמור אותה. סגרו את החלון, רעננו ונסו שוב.');
        return response.data[0];
      },
      async remove(kind, snapshot) {
        if (!tables[kind]) throw new Error('סוג רשומה לא מוכר.');
        const response = await db.from(tables[kind]).delete().eq('synagogue_id', tenantId).eq('id', snapshot.id).eq('version', snapshot.version).select('id');
        if (response.error) throw response.error;
        if (response.data?.length !== 1) throw new Error('הרשומה השתנתה או שאין הרשאה למחוק אותה. יש לרענן.');
      }
    };
  }
  return { tables, fields, today, validDate, addDays, shabbatWindow, board, selectTenant, validate, createStore };
});
