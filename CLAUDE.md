# Folyo — working notes

Career development SaaS serving two segments from **one application**: individuals
building resumes, and institutions (colleges) licensing seats to students.

The authoritative plan is **`docs/PLAN.md`** — architecture, schema, access
control, scoring design, milestones. Read it before any non-trivial change.
Keep it in step with the code; if an implementation detail diverges, fix the
plan in the same change.

## Current state

**M0 complete.** Next.js + TypeScript + Tailwind scaffold, design tokens, base
components, lint/typecheck/test/build all green, CI workflow, import fence.
No auth, no database, no features yet. **M1 (auth) is next.**

## Non-negotiables

1. **A user's resume belongs to that user.** No table holding personal content
   (`resumes`, `resume_uploads`, `cover_letters`, `applications`,
   `job_targets`, `health_reports`, `match_reports`, `ai_requests`) carries an
   org predicate. The only route to another person's resume is a
   `resume_shares` row that the owner created. An institution admin querying
   those tables gets zero rows — by policy, not by UI.
2. **RLS is the boundary; the UI only reflects it.** Hiding something in the
   interface is never the control. Every policy gets a test that asserts
   denial, including a negative control proving the suite would catch a bypass.
3. **The service-role key bypasses RLS.** It lives in exactly one module
   (`src/lib/env.server.ts`, used by `src/lib/db/admin/**`). An ESLint
   `no-restricted-imports` rule and a CI grep enforce this. Do not widen either.
4. **Scores are deterministic.** Neither Resume Health nor Job Match may take a
   number from an LLM. The model only drafts prose for findings the engine
   already produced, and both reports must render fully with AI unavailable.
5. **No personal data reaches an AI provider without active consent**, verified
   inside the adapter — per provider, per purpose, per disclosure version. Use
   synthetic fixtures in development and tests.
6. **Seat allocation is atomic.** Only the row-locked `SECURITY DEFINER`
   database functions may change seat state. Never compute availability in
   application code and then write.
7. **No payment code.** No gateway, no checkout, no billing tables. Entitlement
   grants and plans only.

## Three database access paths (docs/PLAN.md §4)

| Module | Identity | Use |
|---|---|---|
| `src/lib/db/user.ts` | user's JWT, RLS on | essentially all user traffic |
| `src/lib/db/txn.ts` | Drizzle as non-owner role, `SET LOCAL` JWT claims, RLS on | multi-statement server work |
| `src/lib/db/admin/**` | service role, RLS bypassed | only audited platform-admin operations |

Never add a shared "db" helper that blurs these.

## Conventions

- **Design tokens live in `src/app/globals.css`.** No ad-hoc hex values in
  components. The UI is intentionally **light-only** — the product surface is a
  document preview that is always on white.
- Restrained visual language: subtle borders over shadows, one muted blue
  accent, hierarchy from weight and spacing rather than colour. Do not invent a
  new visual style per page.
- Base components in `src/components/ui/`. Extend them rather than restyling
  ad hoc; add a variant if a page needs something new.
- Validate every server action input with Zod. Secrets are read only in
  `src/lib/env.server.ts`.
- Resumes are stored as normalised JSON (`ResumeDocument`, versioned), never
  HTML. Templates, both scoring engines and export all read that one shape.

## Commands

```bash
npm run dev        # dev server
npm run check      # lint + typecheck + unit tests (run before every commit)
npm run build      # production build
npm run test       # unit tests only
```

`npm test` deliberately excludes the database suite (`tests/rls/`), which needs
a real Postgres and runs separately.

## Known environment constraints

- **Docker is not installed**, so `supabase start` cannot run locally. See
  `docs/INFRA.md`. Until it is, migrations can be written but not executed.
- `@typescript-eslint/*` is pinned to 8.72.2 via `overrides`: 8.73.0 is tagged
  latest but its tarball is missing from the npm registry. `minimatch` is
  overridden **only** under `typescript-eslint/typescript-estree` — a global
  override breaks `@eslint/eslintrc`, which needs the v3 CJS build.
