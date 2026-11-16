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
It owns no tables and has **NOBYPASSRLS**, so policies apply to it in full.

This step is not optional. The default `postgres` user **has BYPASSRLS**: on
that connection every policy in the product is ignored, which `npm run db:check`
reports as a failure rather than a warning.

**a. Give the role a password.** In the dashboard's SQL Editor:

```sql
alter role folyo_app with login password 'pick-a-long-alphanumeric-one';
```

Use letters and digits only. A password containing `@ : / ? # [ ]` has to be
percent-encoded inside a URI, and getting that wrong produces a confusing
`password authentication failed` rather than a parse error.

**b. Put it in `DATABASE_URL`, using the Session pooler.**

```
postgresql://folyo_app.<ref>:THE-PASSWORD@aws-N-<region>.pooler.supabase.com:5432/postgres
```

Take the host from **Settings → Database → Connection string → Session
pooler**, then change the username from `postgres.<ref>` to `folyo_app.<ref>`
and use the password from step (a). **The pooler username carries the project
ref**; on a direct connection it would be plain `folyo_app`.

> Use the pooler, not the direct connection. `db.<ref>.supabase.co` publishes
> **no A record** — it is IPv6-only on the free tier — and was observed
> refusing connections on 5432 even from a host with working IPv6 egress, while
> the project itself was healthy over REST. The pooler resolves to an IPv4
> load balancer and is the supported path for serverless clients anyway.

> **The URI must contain exactly one `@`.** If the password holds one, every
> tool that splits on the first `@` — including a careless script — will
> misread the host. An alphanumeric password avoids the whole class of problem.

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
