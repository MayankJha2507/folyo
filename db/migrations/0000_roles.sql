-- 0000_roles.sql — the application role and the helper schema.
--
-- Run this FIRST, once per environment. It creates the role that
-- src/lib/db/txn.ts connects as. The guarantee we need is narrow and absolute:
-- this role must never be able to see past a policy.

-- ---------------------------------------------------------------------------
-- The application role
-- ---------------------------------------------------------------------------
-- Owns nothing, inherits nothing privileged, and critically: NOBYPASSRLS.
-- Table owners implicitly bypass RLS unless FORCE ROW LEVEL SECURITY is set,
-- which is why this role must not own the tables it reads.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'folyo_app') then
    create role folyo_app with login nobypassrls nosuperuser nocreatedb nocreaterole;
  else
    alter role folyo_app with nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
end $$;

-- folyo_app must be able to become `authenticated` (and `anon`) for the
-- SET LOCAL ROLE in withUser(). It gets no direct table grants of its own:
-- all data access happens while it is wearing one of those roles.
grant anon, authenticated to folyo_app;

grant usage on schema public to folyo_app;

-- ---------------------------------------------------------------------------
-- Helper schema
-- ---------------------------------------------------------------------------
-- Policy helper functions live here rather than in `public`, so they are not
-- exposed through PostgREST as callable endpoints.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;
