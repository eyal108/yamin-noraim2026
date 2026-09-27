-- Run inside the same transaction as synagogue-management.sql, replacing its COMMIT.
-- Every fixture, permission change, trigger and schema change is rolled back.
-- Synthetic test identities only; no real member rows are read or changed.
insert into public.yamim_noraim_synagogues (id,slug,name,is_active) values
 ('a0000000-0000-4000-8000-000000000001','review-test-a','Review test A',true),
 ('b0000000-0000-4000-8000-000000000001','review-test-b','Review test B',true);
insert into public.yamim_noraim_synagogue_admins (synagogue_id,email) values
 ('a0000000-0000-4000-8000-000000000001','synagogue-review-a@example.invalid');
insert into public.synagogue_members (id,synagogue_id,full_name) values
 ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Review A'),
 ('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','Review B');
insert into public.synagogue_prayers(synagogue_id,service_date,title) values ('b0000000-0000-4000-8000-000000000001','2026-10-03','Foreign prayer');
insert into public.synagogue_assignments(synagogue_id,service_date,duty) values ('b0000000-0000-4000-8000-000000000001','2026-10-03','Foreign duty');
insert into public.synagogue_events(synagogue_id,event_date,title) values ('b0000000-0000-4000-8000-000000000001','2026-10-03','Foreign event');
insert into public.synagogue_finances(synagogue_id,entry_date,description,amount) values ('b0000000-0000-4000-8000-000000000001','2026-10-03','Foreign donation',18);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000099","email":"synagogue-review-a@example.invalid","role":"authenticated"}',true);
set local role authenticated;
do $$ declare n integer; t text; begin
  select count(*) into n from public.synagogue_members where id='a0000000-0000-4000-8000-000000000002';
  if n <> 1 then raise exception 'FAIL own tenant select'; end if;
  select count(*) into n from public.synagogue_members where synagogue_id='b0000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'FAIL cross tenant select'; end if;
  begin
    insert into public.synagogue_members(synagogue_id,full_name) values ('b0000000-0000-4000-8000-000000000001','Forbidden');
    raise exception 'FAIL cross tenant insert';
  exception when insufficient_privilege then null; end;
  update public.synagogue_members set full_name='Forbidden' where id='b0000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL cross tenant update'; end if;
  delete from public.synagogue_members where id='b0000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL cross tenant delete'; end if;
  begin
    update public.synagogue_members set synagogue_id='b0000000-0000-4000-8000-000000000001' where id='a0000000-0000-4000-8000-000000000002';
    raise exception 'FAIL tenant mutation';
  exception when check_violation or insufficient_privilege then null; end;
  begin
    insert into public.synagogue_assignments(synagogue_id,service_date,duty,member_id) values ('a0000000-0000-4000-8000-000000000001','2026-10-03','Forbidden member','b0000000-0000-4000-8000-000000000002');
    raise exception 'FAIL cross tenant member reference';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.synagogue_finances(synagogue_id,entry_date,description,amount) values ('a0000000-0000-4000-8000-000000000001','2026-10-03','Invalid',-5);
    raise exception 'FAIL negative amount';
  exception when check_violation then null; end;
  begin
    insert into public.synagogue_members(synagogue_id,full_name) values ('a0000000-0000-4000-8000-000000000001','   ');
    raise exception 'FAIL blank name';
  exception when check_violation then null; end;
  insert into public.synagogue_finances(synagogue_id,entry_date,description,amount,member_id)
    values ('a0000000-0000-4000-8000-000000000001','2026-10-03','Test donation',180,'a0000000-0000-4000-8000-000000000002');
  begin
    delete from public.synagogue_members where id='a0000000-0000-4000-8000-000000000002';
    raise exception 'FAIL referenced member delete';
  exception when foreign_key_violation then null; end;
  update public.synagogue_members set full_name='Updated A' where id='a0000000-0000-4000-8000-000000000002' and version=1;
  get diagnostics n = row_count; if n <> 1 then raise exception 'FAIL own update'; end if;
  select version into n from public.synagogue_members where id='a0000000-0000-4000-8000-000000000002';
  if n <> 2 then raise exception 'FAIL version trigger'; end if;
  update public.synagogue_members set full_name='Stale write' where id='a0000000-0000-4000-8000-000000000002' and version=1;
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL stale write'; end if;
  insert into public.synagogue_prayers(synagogue_id,service_date,title) values ('a0000000-0000-4000-8000-000000000001','2026-10-03','Test prayer');
  insert into public.synagogue_assignments(synagogue_id,service_date,duty) values ('a0000000-0000-4000-8000-000000000001','2026-10-03','Test duty');
  insert into public.synagogue_events(synagogue_id,event_date,title) values ('a0000000-0000-4000-8000-000000000001','2026-10-03','Test event');
  foreach t in array array['synagogue_members','synagogue_prayers','synagogue_assignments','synagogue_events','synagogue_finances'] loop
    if has_table_privilege('anon','public.'||t,'SELECT') then raise exception 'FAIL anon grant %', t; end if;
    if has_table_privilege('authenticated','public.'||t,'TRUNCATE') then raise exception 'FAIL truncate grant %', t; end if;
    execute format('select count(*) from public.%I where synagogue_id = %L',t,'a0000000-0000-4000-8000-000000000001') into n;
    if n = 0 then raise exception 'FAIL CRUD fixture %',t; end if;
    execute format('select count(*) from public.%I where synagogue_id = %L',t,'b0000000-0000-4000-8000-000000000001') into n;
    if n <> 0 then raise exception 'FAIL foreign fixture %',t; end if;
    execute format('update public.%I set notes = %L where synagogue_id = %L', t, 'Forbidden', 'b0000000-0000-4000-8000-000000000001');
    get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL foreign update %',t; end if;
    execute format('delete from public.%I where synagogue_id = %L', t, 'b0000000-0000-4000-8000-000000000001');
    get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL foreign delete %',t; end if;
    execute format('update public.%I set notes = %L where synagogue_id = %L', t, 'Own update', 'a0000000-0000-4000-8000-000000000001');
    get diagnostics n = row_count; if n = 0 then raise exception 'FAIL own update %',t; end if;
  end loop;
end $$;
reset role;
update public.yamim_noraim_synagogues set is_active=false where id='a0000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare n integer; begin
  select count(*) into n from public.synagogue_members where synagogue_id='a0000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'FAIL inactive tenant visible'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000099","email":"unknown@example.invalid","role":"authenticated"}',true);
set local role authenticated;
do $$ declare n integer; begin
  select count(*) into n from public.synagogue_members where id='b0000000-0000-4000-8000-000000000002';
  if n <> 0 then raise exception 'FAIL non admin visible'; end if;
end $$;
reset role;
rollback;
select 'PASS: tenant isolation, references, validation, CRUD, versioning, grants, inactive and unauthorized access; all changes rolled back' as result;
