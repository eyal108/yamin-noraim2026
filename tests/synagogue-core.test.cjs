const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../synagogue-core');
const empty = () => ({ members: [], prayers: [], assignments: [], events: [], finances: [] });

test('Shabbat window is Friday/Saturday across week, month and year boundaries', () => {
  for (const day of ['2026-09-27', '2026-10-02', '2026-10-03']) assert.deepEqual(core.shabbatWindow(day), { start: '2026-10-02', end: '2026-10-03' });
  assert.deepEqual(core.shabbatWindow('2026-10-04'), { start: '2026-10-09', end: '2026-10-10' });
  assert.deepEqual(core.shabbatWindow('2027-12-31'), { start: '2027-12-31', end: '2028-01-01' });
});
test('today uses Israel time, including daylight saving boundaries', () => {
  assert.equal(core.today(new Date('2026-09-27T21:30:00Z')), '2026-09-28');
  assert.equal(core.today(new Date('2026-12-31T21:30:00Z')), '2026-12-31');
  assert.equal(core.today(new Date('2026-12-31T22:30:00Z')), '2027-01-01');
});
test('board excludes weekdays and Sunday, sorts times, and counts only filled duties', () => {
  const data = empty();
  data.prayers = [
    { title: 'late', service_date: '2026-10-03', service_time: '18:00' },
    { title: 'Sunday', service_date: '2026-10-04', service_time: '08:00' },
    { title: 'early', service_date: '2026-10-02', service_time: '18:00' },
    { title: 'morning', service_date: '2026-10-03', service_time: '08:00' }
  ];
  data.assignments = [{ service_date: '2026-10-03', member_id: 'a' }, { service_date: '2026-10-03' }, { service_date: '2026-10-03', person_name: 'אורח' }];
  data.members = [{ status: 'פעיל' }, { status: 'לא פעיל' }];
  const result = core.board(data, '2026-10-03');
  assert.deepEqual(result.prayers.map(p => p.title), ['early', 'morning', 'late']);
  assert.equal(result.assigned, 2); assert.equal(result.unassigned, 1); assert.equal(result.activeMembers, 1);
});
test('unknown explicit org cannot silently select another synagogue', () => {
  const list = [{ id: 'a', slug: 'one' }, { id: 'b', slug: 'two' }];
  assert.equal(core.selectTenant(list, 'missing', 'a'), null);
  assert.equal(core.selectTenant(list, '', ''), null);
  assert.equal(core.selectTenant(list, 'two', 'a').id, 'b');
});
test('validation rejects whitespace names, invalid dates, negative/zero/excess precision amounts and ambiguous assignees', () => {
  assert.throws(() => core.validate('members', { full_name: ' \t ', role: 'ישראל', status: 'פעיל' }));
  assert.throws(() => core.validate('prayers', { service_date: '2026-02-30', title: 'מנחה' }));
  for (const amount of ['-1', '0', '1.234', 'NaN', '10000000000']) assert.throws(() => core.validate('finances', { entry_date: '2026-09-27', description: 'תרומה', amount, status: 'פתוח' }));
  assert.throws(() => core.validate('assignments', { service_date: '2026-09-27', duty: 'כהן', member_id: 'a', person_name: 'אורח' }, [{ id: 'a' }]));
  assert.throws(() => core.validate('assignments', { service_date: '2026-09-27', duty: 'כהן', member_id: 'foreign' }, [{ id: 'a' }]));
  assert.equal(core.validate('members', { full_name: ' ישראל ישראלי ', role: 'ישראל', status: 'פעיל' }).full_name, 'ישראל ישראלי');
});
test('paged loading handles server page caps below the requested limit', async () => {
  const rows = Array.from({ length: 1005 }, (_, i) => ({ id: String(i), synagogue_id: 'A' }));
  const calls = [];
  const db = { from(table) {
    let from;
    return { select() { return this; }, eq(key, value) { assert.equal(key, 'synagogue_id'); assert.equal(value, 'A'); return this; }, order() { return this; }, range(start, end) { from = start; calls.push({ table, start, end }); return this; }, then(resolve) { resolve({ data: rows.slice(from, from + 150), count: rows.length, error: null }); } };
  } };
  const loaded = await core.createStore(db, 'A').load();
  assert.equal(loaded.members.length, 1005); assert.equal(calls.filter(c => c.table === 'synagogue_members').length, 7);
});
test('updates keep the captured tenant and use a version condition', async () => {
  const filters = [];
  const db = { from() { return { update() { return this; }, eq(k, v) { filters.push([k, v]); return this; }, select() { return Promise.resolve({ data: [], error: null }); } }; } };
  await assert.rejects(core.createStore(db, 'A').save('members', {}, { id: 'member', version: 3 }), /הרשומה השתנתה/);
  assert.deepEqual(filters, [['synagogue_id', 'A'], ['id', 'member'], ['version', 3]]);
});
