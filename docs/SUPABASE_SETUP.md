# Supabase setup (hosted development project)

We chose a **hosted free Supabase project** for development instead of a local
stack, because Docker is not installed on this machine (`docs/INFRA.md`).

Development uses **synthetic fixtures only** — no real resume data goes into
this project. Its limits (inactivity pause, no backups) are recorded in
`docs/INFRA.md`, and it is **not** a production environment.

These steps need your account, so they are yours to run. Nothing here should be
pasted into chat — the values go straight into `.env.local`, which is
gitignored.

## 1. Create the project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **New project** → name `folyo-dev`, a region close to you, and let it
   generate a database password. **Save that password in your password
   manager** — it appears once and the connection string needs it.
3. Wait for provisioning (~2 minutes).

## 2. Fill in `.env.local`

```bash
cp .env.example .env.local
```

From **Project Settings → API**:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` / secret key — **server-only, bypasses RLS** |

From **Project Settings → Database → Connection string → URI**, take the
**Session pooler** string and put it in `DATABASE_URL`, replacing
`[YOUR-PASSWORD]` with the password from step 1.

> Use the pooler, not the direct connection: serverless functions open many
> short-lived connections and the free tier's direct connection limit is low.

## 3. Run the migrations

In the dashboard, open **SQL Editor** and run these in order, each in its own
query:

1. `db/migrations/0000_roles.sql`
2. `db/migrations/0001_profiles.sql`

Tell me when that is done and I will verify from here.

## 4. Point `DATABASE_URL` at the application role

`0000_roles.sql` creates `folyo_app`, the role `src/lib/db/txn.ts` connects as.
It owns no tables and has **NOBYPASSRLS**, so policies apply to it in full —
this is what stops a privileged connection quietly doing user work
(`docs/PLAN.md` §4).

Give it a password and use it in `DATABASE_URL` instead of `postgres`:

```sql
alter role folyo_app with password 'generate-a-strong-one';
```

Then in `DATABASE_URL`, replace the `postgres.<ref>` username with
`folyo_app.<ref>` and use that password.

> If the pooler rejects the custom role, keep the `postgres` user **for now**
> and say so — the identity tests in M2 assert the connected role is
> non-privileged and will fail loudly, which is the point. We would then switch
> to the direct connection string for the transaction path.

## 5. Verify

```bash
npm run db:check
```

This asserts the connection works, the helper schema exists, and — the part
that matters — that the role we connect as is **not** a superuser and does
**not** have BYPASSRLS.

## Email during development

Supabase's built-in SMTP is rate-limited to a few messages an hour, which is
fine for development. Magic links and verification emails also appear in
**Authentication → Logs**, and the **Inbucket**-style preview is not available
on hosted projects, so use a real address you can read. Resend (decision D7)
is wired up later for production volume.
