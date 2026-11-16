# Folyo

Career development platform serving individuals and institutions from one
application: resume building, deterministic resume health and job match
analysis, AI-assisted writing, and institutional seat management.

## Status

**M0 — foundation.** Scaffold, design system, tooling and CI are in place. No
auth, database or features yet; M1 (authentication) is next. See
[`docs/PLAN.md`](docs/PLAN.md) for the full plan and milestones.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in once Supabase is available
npm run dev
```

Nothing in M0 requires environment variables; the placeholder page renders
without them.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run check` | Lint, typecheck and unit tests — run before committing |
| `npm run build` | Production build |
| `npm run test` | Unit tests (excludes the database suite) |

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — architecture, schema, access control, scoring design, milestones
- [`docs/VERSIONS.md`](docs/VERSIONS.md) — selected versions and why anything is pinned
- [`docs/INFRA.md`](docs/INFRA.md) — free-tier limits and what must change before production
- [`CLAUDE.md`](CLAUDE.md) — working conventions and non-negotiables
