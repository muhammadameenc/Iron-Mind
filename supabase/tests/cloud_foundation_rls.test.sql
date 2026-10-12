begin;
select plan(82);

-- Fixed fixtures are isolated to this rolled-back pgTAP transaction.
insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
    ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@example.test', '', pg_catalog.now(), '{}'::jsonb, '{"name":"Test A"}'::jsonb, pg_catalog.now(), pg_catalog.now()),
    ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@example.test', '', pg_catalog.now(), '{}'::jsonb, '{"name":"Test B"}'::jsonb, pg_catalog.now(), pg_catalog.now())
on conflict (id) do nothing;

insert into public.task_subjects (id, user_id, name) values
    ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'A Tasks'),
    ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'B Tasks');
insert into public.tasks (id, user_id, subject_id, topic) values
    ('11500000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'A Task'),
    ('21500000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'B Task');
insert into public.project_subjects (id, user_id, name) values
    ('12000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'A Project'),
    ('22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'B Project');
insert into public.project_topics (id, user_id, subject_id, name) values
    ('13000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'A Topic'),
    ('23000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'B Topic'),
    ('23000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'B Child Topic');
update public.project_topics set parent_id = '23000000-0000-4000-8000-000000000002'
where id = '23000000-0000-4000-8000-000000000003';
insert into public.notes (id, user_id, subject_id, topic_id, title) values
    ('13500000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'A Note'),
    ('23500000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002', 'B Note');
insert into public.resource_metadata (id, user_id, subject_id, topic_id, display_name, original_filename, mime_type, file_size) values
    ('13700000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'A File', 'a.pdf', 'application/pdf', 1),
    ('23700000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002', 'B File', 'b.pdf', 'application/pdf', 1);
insert into public.user_settings (user_id, settings) values
    ('10000000-0000-4000-8000-000000000001', '{"fixture":"A"}'::jsonb),
    ('20000000-0000-4000-8000-000000000002', '{"fixture":"B"}'::jsonb);
insert into public.recycle_bin_entries (id, user_id, entity_type, entity_id, display_name, payload, deleted_by) values
    ('14000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'task', '15000000-0000-4000-8000-000000000001', 'A Trashed Task', '{"task":{}}', '10000000-0000-4000-8000-000000000001'),
    ('24000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'task', '25000000-0000-4000-8000-000000000002', 'B Trashed Task', '{"task":{}}', '20000000-0000-4000-8000-000000000002');

select is(
    (select pg_catalog.count(*)::integer from pg_catalog.pg_class as c
     join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname in ('profiles', 'task_subjects', 'tasks', 'project_subjects', 'project_topics', 'notes', 'resource_metadata', 'user_settings', 'recycle_bin_entries')
       and c.relrowsecurity),
    9,
    'RLS is enabled on every public user-owned table'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
        cross join (values
            ('profiles'), ('task_subjects'), ('tasks'), ('project_subjects'),
            ('project_topics'), ('notes'), ('resource_metadata'),
            ('user_settings'), ('recycle_bin_entries')
        ) as app_tables(table_name)
        cross join (values ('MAINTAIN'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as privileges(privilege_name)
        where pg_catalog.has_table_privilege(
            roles.role_name,
            'public.' || app_tables.table_name,
            privileges.privilege_name
        )
    ),
    0,
    'anon, authenticated, and service_role lack unintended table privileges'
);
with app_tables(table_name) as (
    values
        ('profiles'), ('task_subjects'), ('tasks'), ('project_subjects'),
        ('project_topics'), ('notes'), ('resource_metadata'),
        ('user_settings'), ('recycle_bin_entries')
),
roles(role_name) as (
    values ('anon'), ('authenticated'), ('service_role')
),
privileges(privilege_name) as (
    values
        ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('MAINTAIN'),
        ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
),
expected(role_name, table_name, privilege_name) as (
    select 'authenticated'::text, 'profiles'::text, profile_privileges.privilege_name
    from (values ('SELECT'::text), ('UPDATE'::text)) as profile_privileges(privilege_name)
    union all
    select 'authenticated'::text, app_tables.table_name, privileges.privilege_name
    from app_tables
    cross join privileges
    where app_tables.table_name <> 'profiles'
      and privileges.privilege_name in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
),
effective(role_name, table_name, privilege_name) as (
    select roles.role_name, app_tables.table_name, privileges.privilege_name
    from roles
    cross join app_tables
    cross join privileges
    where pg_catalog.has_table_privilege(
        roles.role_name,
        'public.' || app_tables.table_name,
        privileges.privilege_name
    )
),
unexpected as (
    select * from effective
    except
    select * from expected
),
missing as (
    select * from expected
    except
    select * from effective
)
select is(
    (select pg_catalog.count(*)::integer from unexpected)
      + (select pg_catalog.count(*)::integer from missing),
    0,
    'effective table grants match the intended role matrix'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_class as c
        join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
        cross join lateral pg_catalog.aclexplode(
            coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
        ) as acl
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname in (
              'profiles', 'task_subjects', 'tasks', 'project_subjects',
              'project_topics', 'notes', 'resource_metadata',
              'user_settings', 'recycle_bin_entries'
          )
          and acl.grantee = 0
          and acl.privilege_type in (
              'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MAINTAIN',
              'TRUNCATE', 'REFERENCES', 'TRIGGER'
          )
    ),
    0,
    'PUBLIC has no table privileges on app tables'
);
select is((select pg_catalog.count(*)::integer from public.profiles where user_id = '10000000-0000-4000-8000-000000000001'), 1, 'auth registration creates one profile');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- User B cannot select, update, or delete User A rows in any table.
select is((select pg_catalog.count(*)::integer from public.profiles where user_id = '10000000-0000-4000-8000-000000000001'), 0, 'B cannot select A profile');
select is((select pg_catalog.count(*)::integer from public.task_subjects where id = '11000000-0000-4000-8000-000000000001'), 0, 'B cannot select A task subject');
select is((select pg_catalog.count(*)::integer from public.tasks where id = '11500000-0000-4000-8000-000000000001'), 0, 'B cannot select A task');
select is((select pg_catalog.count(*)::integer from public.project_subjects where id = '12000000-0000-4000-8000-000000000001'), 0, 'B cannot select A Project subject');
select is((select pg_catalog.count(*)::integer from public.project_topics where id = '13000000-0000-4000-8000-000000000001'), 0, 'B cannot select A topic');
select is((select pg_catalog.count(*)::integer from public.notes where id = '13500000-0000-4000-8000-000000000001'), 0, 'B cannot select A note');
select is((select pg_catalog.count(*)::integer from public.resource_metadata where id = '13700000-0000-4000-8000-000000000001'), 0, 'B cannot select A resource metadata');
select is((select pg_catalog.count(*)::integer from public.user_settings where user_id = '10000000-0000-4000-8000-000000000001'), 0, 'B cannot select A settings');
select is((select pg_catalog.count(*)::integer from public.recycle_bin_entries where id = '14000000-0000-4000-8000-000000000001'), 0, 'B cannot select A Recycle Bin entry');

select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.profiles set display_name = 'Changed by B'
        where user_id = '10000000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated profiles, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A profile'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.task_subjects set name = 'Changed by B'
        where id = '11000000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated task subjects, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A task subject'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.tasks set topic = 'Changed by B'
        where id = '11500000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated tasks, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A task'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.project_subjects set name = 'Changed by B'
        where id = '12000000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated Project subjects, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A Project subject'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.project_topics set name = 'Changed by B'
        where id = '13000000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated topics, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A topic'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.notes set title = 'Changed by B'
        where id = '13500000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated notes, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A note'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.resource_metadata set display_name = 'Changed by B'
        where id = '13700000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated resource metadata rows, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A resource metadata'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.user_settings set settings = '{"changed":true}'
        where user_id = '10000000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated settings rows, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A settings'
);
select lives_ok(
    $sql$
    do $body$
    declare affected_rows integer;
    begin
        update public.recycle_bin_entries set display_name = 'Changed by B'
        where id = '14000000-0000-4000-8000-000000000001';
        get diagnostics affected_rows = row_count;
        if affected_rows <> 0 then
            raise exception 'Expected zero updated Recycle Bin rows, got %', affected_rows;
        end if;
    end;
    $body$;
    $sql$,
    'B cannot update A Recycle Bin entry'
);

select throws_ok($$delete from public.profiles where user_id = '10000000-0000-4000-8000-000000000001'$$, '42501', null, 'profile deletion is not granted to authenticated users');
select results_eq($$with removed as (delete from public.task_subjects where id = '11000000-0000-4000-8000-000000000001' returning id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A task subject');
select results_eq($$with removed as (delete from public.tasks where id = '11500000-0000-4000-8000-000000000001' returning id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A task');
select results_eq($$with removed as (delete from public.project_subjects where id = '12000000-0000-4000-8000-000000000001' returning id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A Project subject');
select results_eq($$with removed as (delete from public.project_topics where id = '13000000-0000-4000-8000-000000000001' returning id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A topic');
select results_eq($$with removed as (delete from public.notes where id = '13500000-0000-4000-8000-000000000001' returning id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A note');
select results_eq($$with removed as (delete from public.resource_metadata where id = '13700000-0000-4000-8000-000000000001' returning id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A resource metadata');
select results_eq($$with removed as (delete from public.user_settings where user_id = '10000000-0000-4000-8000-000000000001' returning user_id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A settings');
select results_eq($$with removed as (delete from public.recycle_bin_entries where id = '14000000-0000-4000-8000-000000000001' returning id) select pg_catalog.count(*)::integer from removed$$, $$select 0::integer$$, 'B cannot delete A Recycle Bin entry');

-- Direct profile writes are reserved for the Auth trigger. Other inserts
-- cannot choose another owner: the trigger assigns the authenticated user.
select throws_ok($$insert into public.profiles (user_id, display_name) values ('20000000-0000-4000-8000-000000000002', 'Forged profile')$$, '42501', null, 'authenticated users cannot insert profiles directly');
select results_eq($$with inserted as (insert into public.task_subjects (id, user_id, name) values ('31000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Inserted as B') returning user_id) select user_id from inserted$$, $$select '20000000-0000-4000-8000-000000000002'::uuid$$, 'task subject insert is assigned to caller');
select throws_ok($$insert into public.tasks (user_id, subject_id, topic) values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Cross-owner task')$$, '23503', null, 'task cannot reference another user task subject');
select results_eq($$with inserted as (insert into public.project_subjects (id, user_id, name) values ('32000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Inserted as B') returning user_id) select user_id from inserted$$, $$select '20000000-0000-4000-8000-000000000002'::uuid$$, 'Project subject insert is assigned to caller');
select throws_ok($$insert into public.project_topics (user_id, subject_id, name) values ('10000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'Cross-owner topic')$$, '23503', null, 'topic cannot reference another user Project');
select throws_ok($$insert into public.project_topics (user_id, subject_id, parent_id, name) values ('10000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000001', 'Cross-owner parent')$$, '23503', null, 'topic cannot reference another user parent topic');
select throws_ok($$insert into public.notes (user_id, subject_id, topic_id, title) values ('10000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'Cross-owner note')$$, '23503', null, 'note cannot reference another user topic');
select throws_ok($$insert into public.notes (user_id, subject_id, topic_id, title) values ('10000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000001', 'Cross-owner topic note')$$, '23503', null, 'note topic must belong to its subject and owner');
select throws_ok($$insert into public.resource_metadata (user_id, subject_id, display_name, original_filename, mime_type, file_size) values ('10000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'Cross-owner file', 'file.pdf', 'application/pdf', 1)$$, '23503', null, 'resource metadata cannot reference another user Project');
select throws_ok($$insert into public.resource_metadata (user_id, subject_id, topic_id, display_name, original_filename, mime_type, file_size) values ('10000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000001', 'Cross-owner topic file', 'file.pdf', 'application/pdf', 1)$$, '23503', null, 'resource topic must belong to its subject and owner');
select results_eq($$with inserted as (insert into public.user_settings (user_id, settings) values ('10000000-0000-4000-8000-000000000001', '{"inserted":true}'::jsonb) on conflict (user_id) do update set settings = excluded.settings returning user_id) select user_id from inserted$$, $$select '20000000-0000-4000-8000-000000000002'::uuid$$, 'settings insert cannot choose another owner');
select results_eq($$with inserted as (insert into public.recycle_bin_entries (id, user_id, entity_type, entity_id, display_name, payload, deleted_by) values ('34000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'task', '35000000-0000-4000-8000-000000000003', 'Inserted as B', '{"task":{}}', '20000000-0000-4000-8000-000000000002') returning user_id) select user_id from inserted$$, $$select '20000000-0000-4000-8000-000000000002'::uuid$$, 'Recycle Bin insert is assigned to caller');
select throws_ok($$insert into public.recycle_bin_entries (id, user_id, entity_type, entity_id, display_name, payload, deleted_by) values ('34100000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'task', '35100000-0000-4000-8000-000000000003', 'Forged actor', '{"task":{}}', '10000000-0000-4000-8000-000000000001')$$, '23514', null, 'Recycle Bin deleted_by must match entry owner');

select throws_ok($$update public.project_topics set parent_id = '23000000-0000-4000-8000-000000000003' where id = '23000000-0000-4000-8000-000000000002'$$, 'P0001', null, 'topic cannot be moved beneath its own descendant');

reset role;
set local role anon;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claims', '', true);
select throws_ok($$select user_id from public.profiles$$, '42501', null, 'anon cannot select profiles');
select throws_ok($$insert into public.profiles (user_id) values ('10000000-0000-4000-8000-000000000001')$$, '42501', null, 'anon cannot insert profiles');
select throws_ok($$update public.profiles set display_name = 'Anonymous'$$, '42501', null, 'anon cannot update profiles');
select throws_ok($$delete from public.profiles$$, '42501', null, 'anon cannot delete profiles');
select throws_ok($$select id from public.task_subjects$$, '42501', null, 'anon cannot select task subjects');
select throws_ok($$insert into public.task_subjects (name) values ('Anonymous subject')$$, '42501', null, 'anon cannot insert task subjects');
select throws_ok($$update public.task_subjects set name = 'Anonymous'$$, '42501', null, 'anon cannot update task subjects');
select throws_ok($$delete from public.task_subjects$$, '42501', null, 'anon cannot delete task subjects');
select throws_ok($$select id from public.tasks$$, '42501', null, 'anon cannot select tasks');
select throws_ok($$insert into public.tasks (subject_id) values ('11000000-0000-4000-8000-000000000001')$$, '42501', null, 'anon cannot insert tasks');
select throws_ok($$update public.tasks set topic = 'Anonymous'$$, '42501', null, 'anon cannot update tasks');
select throws_ok($$delete from public.tasks$$, '42501', null, 'anon cannot delete tasks');
select throws_ok($$select id from public.project_subjects$$, '42501', null, 'anon cannot select Project subjects');
select throws_ok($$insert into public.project_subjects (name) values ('Anonymous Project')$$, '42501', null, 'anon cannot insert Project subjects');
select throws_ok($$update public.project_subjects set name = 'Anonymous'$$, '42501', null, 'anon cannot update Project subjects');
select throws_ok($$delete from public.project_subjects$$, '42501', null, 'anon cannot delete Project subjects');
select throws_ok($$select id from public.project_topics$$, '42501', null, 'anon cannot select topics');
select throws_ok($$insert into public.project_topics (subject_id, name) values ('12000000-0000-4000-8000-000000000001', 'Anonymous topic')$$, '42501', null, 'anon cannot insert topics');
select throws_ok($$update public.project_topics set name = 'Anonymous'$$, '42501', null, 'anon cannot update topics');
select throws_ok($$delete from public.project_topics$$, '42501', null, 'anon cannot delete topics');
select throws_ok($$select id from public.notes$$, '42501', null, 'anon cannot select notes');
select throws_ok($$insert into public.notes (subject_id, title) values ('12000000-0000-4000-8000-000000000001', 'Anonymous note')$$, '42501', null, 'anon cannot insert notes');
select throws_ok($$update public.notes set title = 'Anonymous'$$, '42501', null, 'anon cannot update notes');
select throws_ok($$delete from public.notes$$, '42501', null, 'anon cannot delete notes');
select throws_ok($$select id from public.resource_metadata$$, '42501', null, 'anon cannot select resource metadata');
select throws_ok($$insert into public.resource_metadata (subject_id, display_name, original_filename, mime_type, file_size) values ('12000000-0000-4000-8000-000000000001', 'Anonymous file', 'x.pdf', 'application/pdf', 1)$$, '42501', null, 'anon cannot insert resource metadata');
select throws_ok($$update public.resource_metadata set display_name = 'Anonymous'$$, '42501', null, 'anon cannot update resource metadata');
select throws_ok($$delete from public.resource_metadata$$, '42501', null, 'anon cannot delete resource metadata');
select throws_ok($$select user_id from public.user_settings$$, '42501', null, 'anon cannot select settings');
select throws_ok($$insert into public.user_settings (settings) values ('{}'::jsonb)$$, '42501', null, 'anon cannot insert settings');
select throws_ok($$update public.user_settings set settings = '{}'::jsonb$$, '42501', null, 'anon cannot update settings');
select throws_ok($$delete from public.user_settings$$, '42501', null, 'anon cannot delete settings');
select throws_ok($$select id from public.recycle_bin_entries$$, '42501', null, 'anon cannot select Recycle Bin entries');
select throws_ok($$insert into public.recycle_bin_entries (entity_type, entity_id, display_name, payload) values ('task', '45000000-0000-4000-8000-000000000004', 'Anonymous item', '{"task":{}}')$$, '42501', null, 'anon cannot insert Recycle Bin entries');
select throws_ok($$update public.recycle_bin_entries set display_name = 'Anonymous'$$, '42501', null, 'anon cannot update Recycle Bin entries');
select throws_ok($$delete from public.recycle_bin_entries$$, '42501', null, 'anon cannot delete Recycle Bin entries');

select * from finish();
rollback;
