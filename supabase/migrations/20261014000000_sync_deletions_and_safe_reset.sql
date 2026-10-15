-- Durable per-account deletion records and a reset generation prevent stale
-- offline workspaces from recreating records after a confirmed account wipe.

create table if not exists public.sync_tombstones (
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    entity_type text not null check (entity_type in ('task', 'task_subject', 'project_subject', 'project_topic')),
    entity_key text not null check (pg_catalog.length(pg_catalog.btrim(entity_key)) > 0),
    is_deleted boolean not null,
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    primary key (user_id, entity_type, entity_key)
);

create index if not exists sync_tombstones_user_updated_idx
    on public.sync_tombstones (user_id, updated_at, entity_type, entity_key);

create table if not exists public.user_sync_state (
    user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
    reset_generation bigint not null default 0 check (reset_generation >= 0),
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0)
);

alter table public.task_subjects add column if not exists sync_generation bigint not null default 0 check (sync_generation >= 0);
alter table public.tasks add column if not exists sync_generation bigint not null default 0 check (sync_generation >= 0);
alter table public.project_subjects add column if not exists sync_generation bigint not null default 0 check (sync_generation >= 0);
alter table public.project_topics add column if not exists sync_generation bigint not null default 0 check (sync_generation >= 0);
alter table public.user_settings add column if not exists sync_generation bigint not null default 0 check (sync_generation >= 0);
alter table public.sync_tombstones add column if not exists sync_generation bigint not null default 0 check (sync_generation >= 0);

-- A transaction lock serializes each user's sync writes with Delete All Data.
-- A request that began before a reset either commits first and is then wiped,
-- or waits for the reset and fails its generation check afterward.
create or replace function private.require_current_sync_generation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    caller_id uuid := (select auth.uid());
    current_generation bigint;
begin
    if caller_id is null then
        return new;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(caller_id::text, 71014000::bigint)
    );
    select coalesce((
        select state.reset_generation
        from public.user_sync_state as state
        where state.user_id = caller_id
    ), 0) into current_generation;

    if new.sync_generation is distinct from current_generation then
        raise exception 'Stale synchronization generation';
    end if;
    return new;
end;
$$;

revoke all on function private.require_current_sync_generation() from public, anon, authenticated, service_role;

drop trigger if exists task_subjects_require_sync_generation on public.task_subjects;
create trigger task_subjects_require_sync_generation before insert or update on public.task_subjects
    for each row execute function private.require_current_sync_generation();
drop trigger if exists tasks_require_sync_generation on public.tasks;
create trigger tasks_require_sync_generation before insert or update on public.tasks
    for each row execute function private.require_current_sync_generation();
drop trigger if exists project_subjects_require_sync_generation on public.project_subjects;
create trigger project_subjects_require_sync_generation before insert or update on public.project_subjects
    for each row execute function private.require_current_sync_generation();
drop trigger if exists project_topics_require_sync_generation on public.project_topics;
create trigger project_topics_require_sync_generation before insert or update on public.project_topics
    for each row execute function private.require_current_sync_generation();
drop trigger if exists user_settings_require_sync_generation on public.user_settings;
create trigger user_settings_require_sync_generation before insert or update on public.user_settings
    for each row execute function private.require_current_sync_generation();
drop trigger if exists sync_tombstones_require_sync_generation on public.sync_tombstones;
create trigger sync_tombstones_require_sync_generation before insert or update on public.sync_tombstones
    for each row execute function private.require_current_sync_generation();

drop trigger if exists sync_tombstones_sync_metadata on public.sync_tombstones;
create trigger sync_tombstones_sync_metadata before insert or update on public.sync_tombstones
    for each row execute function private.set_sync_metadata();
drop trigger if exists user_sync_state_sync_metadata on public.user_sync_state;
create trigger user_sync_state_sync_metadata before insert or update on public.user_sync_state
    for each row execute function private.set_sync_metadata();

alter table public.sync_tombstones enable row level security;
alter table public.user_sync_state enable row level security;

revoke all on public.sync_tombstones, public.user_sync_state from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.sync_tombstones to authenticated;
grant select on public.user_sync_state to authenticated;
grant usage on schema public to authenticated;

drop policy if exists sync_tombstones_owner_all on public.sync_tombstones;
create policy sync_tombstones_owner_all on public.sync_tombstones for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists user_sync_state_select_own on public.user_sync_state;
create policy user_sync_state_select_own on public.user_sync_state for select to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create or replace function public.delete_my_app_data()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_id uuid := (select auth.uid());
    current_generation bigint;
    next_generation bigint;
    had_app_data boolean;
    topic_rows_removed integer;
begin
    if caller_id is null then
        raise exception 'Authentication is required to delete account data';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(caller_id::text, 71014000::bigint)
    );

    select exists (
        select 1 from public.task_subjects where user_id = caller_id
        union all select 1 from public.tasks where user_id = caller_id
        union all select 1 from public.project_subjects where user_id = caller_id
        union all select 1 from public.project_topics where user_id = caller_id
        union all select 1 from public.notes where user_id = caller_id
        union all select 1 from public.resource_metadata where user_id = caller_id
        union all select 1 from public.user_settings where user_id = caller_id
        union all select 1 from public.recycle_bin_entries where user_id = caller_id
        union all select 1 from public.sync_tombstones where user_id = caller_id
    ) into had_app_data;

    select reset_generation into current_generation
    from public.user_sync_state where user_id = caller_id;

    if not found then
        next_generation := 1;
        insert into public.user_sync_state (user_id, reset_generation)
        values (caller_id, next_generation);
    elsif had_app_data or current_generation = 0 then
        next_generation := current_generation + 1;
        update public.user_sync_state
        set reset_generation = next_generation
        where user_id = caller_id;
    else
        -- A second device may be clearing its stale local copy after the first
        -- device already emptied the account. Keep the generation stable.
        next_generation := current_generation;
    end if;

    delete from public.notes where user_id = caller_id;
    delete from public.resource_metadata where user_id = caller_id;
    delete from public.recycle_bin_entries where user_id = caller_id;
    delete from public.tasks where user_id = caller_id;
    loop
        delete from public.project_topics as topic
        where topic.user_id = caller_id
          and not exists (
              select 1 from public.project_topics as child
              where child.user_id = caller_id and child.parent_id = topic.id
          );
        get diagnostics topic_rows_removed = row_count;
        exit when topic_rows_removed = 0;
    end loop;
    if exists (select 1 from public.project_topics where user_id = caller_id) then
        raise exception 'Project topics contain a cycle or invalid parent chain';
    end if;
    delete from public.project_subjects where user_id = caller_id;
    delete from public.task_subjects where user_id = caller_id;
    delete from public.user_settings where user_id = caller_id;
    delete from public.sync_tombstones where user_id = caller_id;

    return next_generation;
end;
$$;

revoke all on function public.delete_my_app_data() from public, anon, authenticated, service_role;
grant execute on function public.delete_my_app_data() to authenticated;
