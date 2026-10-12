# IRON MIND Supabase foundation

This folder contains the first database migration and a pgTAP ownership test. The migration is not applied to a hosted project by this change. It creates the account-owned schema and does not read or move the app's localStorage or IndexedDB data.

## Local setup

The app remains usable when Supabase is not configured. The browser configuration uses the Project URL and public Publishable key (or the legacy public `anon` key) from **Project Settings → API**. Never put a `service_role`/secret key, database password, or R2 credential in that file or send one in chat.

The Supabase JavaScript client is lazy-loaded from jsDelivr at the exact pinned version `2.117.3`, and only when both public values are present. The integration in this stage uses Auth only; it does not upload or query app records.

The browser chooses the local workspace before loading the app: the existing unprefixed `ironMind…` localStorage keys and `ironMindProjectResources` IndexedDB database remain the device workspace, while a signed-in user uses `im-workspace:v1:<user-id>:` keys and an `ironMindProjectResources:user:<user-id>` database. Sign-out returns to the device workspace; account changes reload the app after closing the prior resource database. Backups, restores, diagnostics, and delete-all are scoped to the active workspace. The account panel can explicitly copy the device workspace only after a data-count preview and confirmation, and only into an empty account workspace; the copy leaves the device source unchanged. Cloud synchronization remains disabled.

In the Supabase dashboard, set the Auth **Site URL** to the app origin used for testing (`http://127.0.0.1:8000`) and allow the corresponding local redirect URL for password recovery. Add the final HTTPS production origin before deployment. Do not enable paid add-ons or change to a paid plan.

To run the SQL locally when Supabase CLI and Docker are available:

```text
supabase start
supabase db reset --local
supabase test db
```

`db reset --local` applies the checked-in migration to the local Supabase development database and resets that local database; do not run a reset against a linked/production project. The tests use transaction-scoped fixture users and roll back their changes. The app's local browser data is not involved.

The RLS suite contains 79 pgTAP assertions. It checks RLS on all nine public tables, cross-user select/update/delete isolation, owner assignment and parent constraints on authenticated inserts, and anonymous select/insert/update/delete denial. `profiles` intentionally permits only select/update for authenticated users; profile creation is performed by the Auth trigger and direct profile deletion is not granted.

## Schema and migration notes

- Every user-owned table has a UUID identity, `user_id`, timestamps, and a monotonically incremented `revision`.
- RLS is enabled on all nine public user-owned tables. Policies are limited to `authenticated`; `user_id` defaults to and is set from `auth.uid()`. Composite foreign keys bind tasks, topics, notes, and resource metadata to parents owned by the same user. A topic trigger prevents cycles in nested topic trees.
- Registration creates a minimal profile through a `SECURITY DEFINER` trigger with an empty search path. Profile fields do not include an administrator role or email-based privileges.
- Note HTML remains text in PostgreSQL. Resource metadata includes a nullable future `storage_key`; file bytes are intentionally not stored here. A later R2 stage must authorize every object operation against the signed-in user and the matching metadata row.
- Recycle Bin payloads are snapshots of removed records, with original location and server timestamps/expiry. `deleted_by` must be null or equal the entry owner. `entity_id` is polymorphic and intentionally has no foreign key because the source row may already be deleted; creation must be performed by trusted app logic that snapshots only an owned record. A later sync stage must make restore and purge atomic with the corresponding record and R2 operations.
- Existing task subjects have no stable ID and tasks reference their subject by name. Task IDs are numeric locally, and task dates are stored as formatted text; import must map IDs to UUIDs and parse each date deliberately. Resolve each task subject name to a newly assigned UUID. If a legacy backup has missing, invalid, or ambiguous dates or subject names, migration must stop for review instead of guessing. Existing Project IDs are strings; a later migration must map any non-UUID legacy IDs and update references consistently.
- Deleting an Auth user cascades relational rows. Before that operation is exposed, a trusted cleanup path must also remove that user's R2 objects; the browser must not delete users or objects directly.

## Hosted application prerequisites

- Apply only to the intended new Supabase project, using a database-owner migration connection (the Supabase CLI's linked migration workflow or the SQL Editor as the project database owner). The migration creates objects in `public` and `private`, attaches a trigger to the managed `auth.users` table, and relies on Supabase's built-in `auth.uid()`, `anon`, and `authenticated` objects.
- Before applying remotely, run the migration and pgTAP suite against a clean local Supabase stack, review the target project reference and migration history, and confirm the target has no conflicting application objects or custom `auth.users` trigger with the same name.
- This migration provisions schema and Auth profile creation only. It does not import local data, configure R2, or enable app-record synchronization. Keep the browser client on the public key; database migrations require a privileged database connection and must never use the browser key.
- Do not use `supabase db reset` on a linked project. Supabase documents `supabase test db` as running pgTAP tests against the local database; the `--linked` option is explicitly remote and is not part of this preparation. See [Supabase database testing](https://supabase.com/docs/reference/cli/supabase-test-db) and [local migration workflow](https://supabase.com/docs/guides/local-development/database-migrations?access-method=postgres&queryGroups=access-method).

## Free plan constraints to account for

Checked against the current public Supabase documentation on October 11, 2026; confirm limits in the dashboard before launch because plans can change:

- Free includes two active projects across organizations where the account is Owner/Admin, 500 MB database per project, 1 GB Supabase Storage, 50,000 monthly active users, 5 GB uncached plus 5 GB cached egress, and 500,000 Edge Function invocations. Exceeding the database quota can make the project read-only.
- Free projects can pause after a low-activity week. A paused project has a one-year restore window.
- Free projects have no downloadable automatic database backups; keep independent off-site backups.
- The built-in Auth email service is for development, sends only to pre-authorized team addresses, and is currently limited to two emails per hour with no delivery SLA. Public registration and recovery require configuring an external SMTP provider; that provider may have its own cost.
- This stage does not configure SMTP, create a hosted project, attach a billing method, or enable any paid feature.

The Auth panel supports registration, sign-in, sign-out, session display, and password reset/update once configured. With no public project values, the panel explains that setup is pending and all existing local app features remain available. Device data stays separate unless a user reviews the counts and explicitly confirms copying it into an empty account workspace. Cloud synchronization remains disabled.
