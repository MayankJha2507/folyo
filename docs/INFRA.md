# Infrastructure and its limits

Honest record of what the free tiers do and do not give us, and what must
change before real institutional data arrives.

## Development database: hosted, not local

Docker is not installed on this machine and the Supabase CLI requires it, so
**development runs against a free hosted Supabase project** (`folyo-dev`)
rather than a local stack. Decided 2026-11-16.

This is acceptable because development uses **synthetic fixtures only** — no
real resume data goes into it. The trade-offs we accept:

- the inactivity pause applies (below), so the project may need waking,
- migrations run against a remote database, so a mistake is not confined to
  one machine,
- `npm test` stays offline; only the database suite needs the connection.

Setup steps are in [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md). If Docker is
installed later, `npx supabase start` gives a local stack with no code change —
only `.env.local` moves.

## Supabase Free — limitations to plan around

| Limit | Consequence |
|---|---|
| Projects pause after ~7 days of inactivity | A dormant development or demo environment stops answering until manually resumed. Unacceptable for anything an institution touches |
| **No automated backups** | A mistake or a corruption is unrecoverable. This alone disqualifies the free tier for real student data |
| 500 MB database | Fine for development; resume JSON and extracted text are small, but `extracted_text` and report JSON grow fastest |
| 1 GB storage | Why uploaded PDFs are **deleted immediately after successful extraction** (decision D2) |
| 50,000 monthly active users | Not a near-term constraint |
| Limited connection count | Serverless functions must use the pooler, not direct connections, for request-path queries |

**Supabase Free is a development environment only.** Before any pilot holding
real student data we need Supabase Pro (or self-hosted Postgres) with:

- point-in-time recovery enabled,
- a **tested restore** — a restore procedure that has never been executed is
  not a backup,
- documented RPO/RTO,
- no inactivity pause.

## Hosting

Vercel **Hobby forbids commercial use**, so it serves only development and
preview deployments. Per decision D1, the public commercial beta moves to
**Vercel Pro**. This is a licence question, not a performance one: a B2B product
licensed to colleges cannot sit on Hobby regardless of how little traffic it has.

## Cost by phase

| Phase | Services | Monthly |
|---|---|---|
| Development (M0–M11) | local Supabase, Vercel Hobby previews, Gemini + Groq free tiers, Resend free (3k emails) | **~$0** |
| Commercial beta | Vercel Pro $20 + Supabase Pro $25 + domain ~$1 + AI within free tiers | **~$46** |
| Growth | add AI spend as volume exceeds free tiers | usage-driven |

PDF extraction adds no service cost — `pdfjs-dist` runs inside our own
function, and there is no OCR service in v1.

## Early warning on AI spend

`ai_requests` records provider, model, token counts and latency per call, and
`usage_events` meters quota consumption. These exist so that crossing a free
tier is a dashboard observation rather than a surprise invoice.
