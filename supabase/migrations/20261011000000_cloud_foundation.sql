-- IRON MIND cloud foundation. Apply once with the Supabase migration system.
-- No local application records are copied by this migration.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_sync_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if auth.uid() is not null then
            new.user_id := auth.uid();
        end if;
        new.created_at := coalesce(new.created_at, pg_catalog.clock_timestamp());
        new.updated_at := coalesce(new.updated_at, new.created_at);
        new.revision := 1;
    else
        if auth.uid() is not null and old.user_id <> auth.uid() then
            raise exception 'Cannot change record ownership';
        end if;
        new.user_id := old.user_id;
        new.created_at := old.created_at;
        new.updated_at := pg_catalog.clock_timestamp();
        new.revision := old.revision + 1;
    end if;
    return new;
end;
$$;

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (user_id, display_name)
    values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''))
    on conflict (user_id) do nothing;
    return new;
end;
$$;

create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0)
);

create table if not exists public.task_subjects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null check (pg_catalog.length(pg_catalog.btrim(name)) > 0),
    priority text not null default 'high',
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    unique (user_id, id)
);
create unique index if not exists task_subjects_user_name_unique
    on public.task_subjects (user_id, pg_catalog.lower(name));

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    subject_id uuid not null,
    legacy_id text,
    topic text not null default '',
    source text not null default '',
    task_date date,
    status text not null default 'Planned' check (status in ('Planned', 'Halfway', 'Completed', 'Missed')),
    remarks text not null default '',
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    unique (user_id, id),
    unique (user_id, legacy_id),
    constraint tasks_subject_owner_fk foreign key (user_id, subject_id)
        references public.task_subjects (user_id, id) on delete restrict
);
create index if not exists tasks_user_subject_date_idx on public.tasks (user_id, subject_id, task_date);
create index if not exists tasks_user_updated_idx on public.tasks (user_id, updated_at, id);

create table if not exists public.project_subjects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null check (pg_catalog.length(pg_catalog.btrim(name)) > 0),
    priority text not null default 'high',
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    unique (user_id, id)
);
create unique index if not exists project_subjects_user_name_unique
    on public.project_subjects (user_id, pg_catalog.lower(name));

create table if not exists public.project_topics (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    subject_id uuid not null,
    parent_id uuid,
    name text not null check (pg_catalog.length(pg_catalog.btrim(name)) > 0),
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    unique (user_id, id),
    unique (user_id, subject_id, id),
    constraint project_topics_subject_owner_fk foreign key (user_id, subject_id)
        references public.project_subjects (user_id, id) on delete restrict,
    constraint project_topics_parent_owner_fk foreign key (user_id, subject_id, parent_id)
        references public.project_topics (user_id, subject_id, id) on delete restrict,
    check (parent_id is null or parent_id <> id)
);
create index if not exists project_topics_tree_idx on public.project_topics (user_id, subject_id, parent_id, sort_order);
create index if not exists project_topics_user_updated_idx on public.project_topics (user_id, updated_at, id);
create unique index if not exists project_topics_sibling_name_unique
    on public.project_topics (user_id, subject_id, coalesce(parent_id::text, ''), pg_catalog.lower(name));

create or replace function private.reject_project_topic_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.parent_id is null then
        return new;
    end if;
    if exists (
        with recursive descendants(id) as (
            select new.id
            union
            select child.id
            from public.project_topics as child
            join descendants as ancestor on child.parent_id = ancestor.id
            where child.user_id = new.user_id
              and child.subject_id = new.subject_id
              and child.id <> new.id
        )
        select 1 from descendants where id = new.parent_id
    ) then
        raise exception 'A topic cannot be moved beneath itself or one of its descendants';
    end if;
    return new;
end;
$$;

create table if not exists public.notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    subject_id uuid not null,
    topic_id uuid,
    title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
    content text not null default '',
    content_format text not null default 'html' check (content_format in ('plain', 'html')),
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    unique (user_id, id),
    constraint notes_subject_owner_fk foreign key (user_id, subject_id)
        references public.project_subjects (user_id, id) on delete restrict,
    constraint notes_topic_owner_fk foreign key (user_id, subject_id, topic_id)
        references public.project_topics (user_id, subject_id, id) on delete restrict
);
create index if not exists notes_user_location_idx on public.notes (user_id, subject_id, topic_id, created_at);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at, id);

create table if not exists public.resource_metadata (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    subject_id uuid not null,
    topic_id uuid,
    display_name text not null check (pg_catalog.length(pg_catalog.btrim(display_name)) > 0),
    original_filename text not null,
    mime_type text not null,
    file_size bigint not null check (file_size >= 0),
    storage_key text,
    sha256 text,
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    unique (user_id, id),
    unique (user_id, storage_key),
    constraint resource_metadata_subject_owner_fk foreign key (user_id, subject_id)
        references public.project_subjects (user_id, id) on delete restrict,
    constraint resource_metadata_topic_owner_fk foreign key (user_id, subject_id, topic_id)
        references public.project_topics (user_id, subject_id, id) on delete restrict
);
create index if not exists resource_metadata_user_location_idx on public.resource_metadata (user_id, subject_id, topic_id, sort_order);
create index if not exists resource_metadata_user_updated_idx on public.resource_metadata (user_id, updated_at, id);

create table if not exists public.user_settings (
    user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
    settings jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(settings) = 'object'),
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0)
);

create table if not exists public.recycle_bin_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    entity_type text not null check (entity_type in ('task', 'task_subject', 'project_subject', 'topic', 'note', 'resource')),
    entity_id uuid not null,
    display_name text not null,
    original_location jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(original_location) = 'object'),
    payload jsonb not null check (pg_catalog.jsonb_typeof(payload) = 'object'),
    deleted_at timestamptz not null default pg_catalog.clock_timestamp(),
    expires_at timestamptz not null default (pg_catalog.clock_timestamp() + interval '30 days'),
    deleted_by uuid default auth.uid() references auth.users(id) on delete set null,
    restored_at timestamptz,
    purged_at timestamptz,
    created_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    unique (user_id, id),
    check (expires_at >= deleted_at),
    check (restored_at is null or purged_at is null),
    check (deleted_by is null or deleted_by = user_id)
);
create index if not exists recycle_bin_user_expiry_idx
    on public.recycle_bin_entries (user_id, expires_at)
    where restored_at is null and purged_at is null;
create index if not exists recycle_bin_user_updated_idx on public.recycle_bin_entries (user_id, updated_at, id);

-- The auth trigger is the only profile creation path; user metadata cannot grant roles.
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute function private.create_profile_for_auth_user();

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function private.set_sync_metadata() from public, anon, authenticated;
revoke all on function private.reject_project_topic_cycle() from public, anon, authenticated;

drop trigger if exists profiles_sync_metadata on public.profiles;
create trigger profiles_sync_metadata before insert or update on public.profiles
    for each row execute function private.set_sync_metadata();
drop trigger if exists task_subjects_sync_metadata on public.task_subjects;
create trigger task_subjects_sync_metadata before insert or update on public.task_subjects
    for each row execute function private.set_sync_metadata();
drop trigger if exists tasks_sync_metadata on public.tasks;
create trigger tasks_sync_metadata before insert or update on public.tasks
    for each row execute function private.set_sync_metadata();
drop trigger if exists project_subjects_sync_metadata on public.project_subjects;
create trigger project_subjects_sync_metadata before insert or update on public.project_subjects
    for each row execute function private.set_sync_metadata();
drop trigger if exists project_topics_sync_metadata on public.project_topics;
create trigger project_topics_sync_metadata before insert or update on public.project_topics
    for each row execute function private.set_sync_metadata();
drop trigger if exists notes_sync_metadata on public.notes;
create trigger notes_sync_metadata before insert or update on public.notes
    for each row execute function private.set_sync_metadata();
drop trigger if exists resource_metadata_sync_metadata on public.resource_metadata;
create trigger resource_metadata_sync_metadata before insert or update on public.resource_metadata
    for each row execute function private.set_sync_metadata();
drop trigger if exists user_settings_sync_metadata on public.user_settings;
create trigger user_settings_sync_metadata before insert or update on public.user_settings
    for each row execute function private.set_sync_metadata();
drop trigger if exists recycle_bin_entries_sync_metadata on public.recycle_bin_entries;
create trigger recycle_bin_entries_sync_metadata before insert or update on public.recycle_bin_entries
    for each row execute function private.set_sync_metadata();
drop trigger if exists project_topics_prevent_cycle on public.project_topics;
create trigger project_topics_prevent_cycle before insert or update of parent_id on public.project_topics
    for each row execute function private.reject_project_topic_cycle();

alter table public.profiles enable row level security;
alter table public.task_subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.project_subjects enable row level security;
alter table public.project_topics enable row level security;
alter table public.notes enable row level security;
alter table public.resource_metadata enable row level security;
alter table public.user_settings enable row level security;
alter table public.recycle_bin_entries enable row level security;

-- New-table default privileges on the hosted postgres role are broader than
-- this API needs. Clear every non-owner grantee first, then add only the
-- authenticated-user operations protected by the owner RLS policies below.
revoke all on public.profiles, public.task_subjects, public.tasks,
    public.project_subjects, public.project_topics, public.notes,
    public.resource_metadata, public.user_settings, public.recycle_bin_entries
    from public, anon, authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.task_subjects, public.tasks,
    public.project_subjects, public.project_topics, public.notes,
    public.resource_metadata, public.user_settings, public.recycle_bin_entries
    to authenticated;
revoke all on schema public from public, anon;
grant usage on schema public to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists task_subjects_owner_all on public.task_subjects;
create policy task_subjects_owner_all on public.task_subjects for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all on public.tasks for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists project_subjects_owner_all on public.project_subjects;
create policy project_subjects_owner_all on public.project_subjects for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists project_topics_owner_all on public.project_topics;
create policy project_topics_owner_all on public.project_topics for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists notes_owner_all on public.notes;
create policy notes_owner_all on public.notes for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists resource_metadata_owner_all on public.resource_metadata;
create policy resource_metadata_owner_all on public.resource_metadata for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists user_settings_owner_all on public.user_settings;
create policy user_settings_owner_all on public.user_settings for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
drop policy if exists recycle_bin_entries_owner_all on public.recycle_bin_entries;
create policy recycle_bin_entries_owner_all on public.recycle_bin_entries for all to authenticated
    using ((select auth.uid()) is not null and user_id = (select auth.uid()))
    with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
