begin;
select plan(32);

insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
    ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'delete-a@example.test', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
    ('72000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'delete-b@example.test', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now())
on conflict (id) do nothing;

insert into public.task_subjects (id, user_id, name) values
    ('71100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'A subject'),
    ('72100000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', 'B subject');
insert into public.tasks (id, user_id, subject_id, legacy_id, topic) values
    ('71200000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '71100000-0000-4000-8000-000000000001', 'delete-a-task', 'A task'),
    ('72200000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '72100000-0000-4000-8000-000000000002', 'delete-b-task', 'B task');
insert into public.project_subjects (id, user_id, name) values
    ('71300000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'A project'),
    ('72300000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', 'B project');
insert into public.project_topics (id, user_id, subject_id, name) values
    ('71400000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '71300000-0000-4000-8000-000000000001', 'A root'),
    ('72400000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '72300000-0000-4000-8000-000000000002', 'B root'),
    ('72400000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000002', '72300000-0000-4000-8000-000000000002', 'B child');
update public.project_topics set parent_id = '72400000-0000-4000-8000-000000000002'
where id = '72400000-0000-4000-8000-000000000003';
insert into public.notes (id, user_id, subject_id, topic_id, title) values
    ('71500000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '71300000-0000-4000-8000-000000000001', '71400000-0000-4000-8000-000000000001', 'A note');
insert into public.resource_metadata (id, user_id, subject_id, topic_id, display_name, original_filename, mime_type, file_size) values
    ('71600000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '71300000-0000-4000-8000-000000000001', '71400000-0000-4000-8000-000000000001', 'A resource', 'a.pdf', 'application/pdf', 1);
insert into public.user_settings (user_id, settings) values
    ('71000000-0000-4000-8000-000000000001', '{"fixture":"A"}'::jsonb),
    ('72000000-0000-4000-8000-000000000002', '{"fixture":"B"}'::jsonb);
insert into public.recycle_bin_entries (id, user_id, entity_type, entity_id, display_name, payload, deleted_by) values
    ('71700000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'task', '71200000-0000-4000-8000-000000000001', 'A deleted task', '{"task":{}}'::jsonb, '71000000-0000-4000-8000-000000000001');
insert into public.sync_tombstones (user_id, entity_type, entity_key, is_deleted) values
    ('71000000-0000-4000-8000-000000000001', 'task', 'delete-old-a', true),
    ('72000000-0000-4000-8000-000000000002', 'task', 'delete-old-b', true);

select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.sync_tombstones'::regclass), 'sync tombstones have RLS enabled');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.user_sync_state'::regclass), 'sync reset state has RLS enabled');
select ok(not pg_catalog.has_table_privilege('anon', 'public.sync_tombstones', 'SELECT'), 'anon cannot read sync tombstones');
select ok(not pg_catalog.has_table_privilege('anon', 'public.user_sync_state', 'SELECT'), 'anon cannot read sync reset state');
select ok(pg_catalog.has_table_privilege('authenticated', 'public.sync_tombstones', 'SELECT'), 'authenticated can read tombstones subject to RLS');
select ok(pg_catalog.has_table_privilege('authenticated', 'public.user_sync_state', 'SELECT'), 'authenticated can read reset state subject to RLS');
select ok(not pg_catalog.has_table_privilege('service_role', 'public.sync_tombstones', 'SELECT'), 'service_role has no browser-facing tombstone grant');
select ok(not pg_catalog.has_table_privilege('service_role', 'public.user_sync_state', 'SELECT'), 'service_role has no browser-facing reset-state grant');
select ok(not pg_catalog.has_function_privilege('anon', 'public.delete_my_app_data()', 'EXECUTE'), 'anon cannot execute account deletion');
select ok(pg_catalog.has_function_privilege('authenticated', 'public.delete_my_app_data()', 'EXECUTE'), 'authenticated can execute account-scoped deletion');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a where n.nspname='public' and p.proname='delete_my_app_data' and a.grantee=0 and a.privilege_type='EXECUTE'), 0, 'PUBLIC cannot execute account deletion');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select pg_catalog.count(*)::integer from public.sync_tombstones where user_id='71000000-0000-4000-8000-000000000001'), 0, 'B cannot read A tombstones');
select is((select pg_catalog.count(*)::integer from public.user_sync_state where user_id='71000000-0000-4000-8000-000000000001'), 0, 'B cannot read A reset state');
select results_eq($$insert into public.sync_tombstones (user_id, entity_type, entity_key, is_deleted) values ('71000000-0000-4000-8000-000000000001', 'task', 'forged-owner', true) returning user_id$$, $$select '72000000-0000-4000-8000-000000000002'::uuid$$, 'tombstone trigger assigns caller ownership');

select pg_catalog.set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.delete_my_app_data()$$, 'account deletion RPC completes for the authenticated caller');
reset role;

select is((select pg_catalog.count(*)::integer from public.tasks where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller tasks');
select is((select pg_catalog.count(*)::integer from public.task_subjects where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller task subjects');
select is((select pg_catalog.count(*)::integer from public.project_topics where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller Project topics');
select is((select pg_catalog.count(*)::integer from public.project_subjects where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller Project subjects');
select is((select pg_catalog.count(*)::integer from public.notes where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller notes');
select is((select pg_catalog.count(*)::integer from public.resource_metadata where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller resource metadata');
select is((select pg_catalog.count(*)::integer from public.user_settings where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller settings');
select is((select pg_catalog.count(*)::integer from public.recycle_bin_entries where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all removes the caller Recycle Bin');
select is((select pg_catalog.count(*)::integer from public.sync_tombstones where user_id='71000000-0000-4000-8000-000000000001'), 0, 'delete-all clears the caller deletion markers');
select is((select pg_catalog.count(*)::integer from public.tasks where user_id='72000000-0000-4000-8000-000000000002'), 1, 'delete-all preserves another account tasks');
select is((select pg_catalog.count(*)::integer from public.project_topics where user_id='72000000-0000-4000-8000-000000000002'), 2, 'delete-all preserves another account Project hierarchy');
select is((select pg_catalog.count(*)::integer from public.profiles where user_id='71000000-0000-4000-8000-000000000001'), 1, 'delete-all preserves the Auth profile');
select is((select reset_generation::integer from public.user_sync_state where user_id='71000000-0000-4000-8000-000000000001'), 1, 'delete-all advances the account reset generation');
select is((select pg_catalog.count(*)::integer from public.user_sync_state where user_id='72000000-0000-4000-8000-000000000002'), 0, 'delete-all does not create reset state for another account');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.delete_my_app_data(), 1::bigint, 'repeating an empty account wipe keeps the reset generation stable');
select throws_ok(
    $$insert into public.task_subjects (user_id, name, sync_generation) values ('71000000-0000-4000-8000-000000000001', 'Stale offline subject', 0)$$,
    'P0001', 'Stale synchronization generation', 'old offline writes cannot recreate records after Delete All Data'
);
select lives_ok(
    $$insert into public.task_subjects (user_id, name, sync_generation) values ('71000000-0000-4000-8000-000000000001', 'Fresh subject', 1)$$,
    'current-generation writes remain available after an account reset'
);
reset role;

select * from finish();
rollback;
