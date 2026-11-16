# Infrastructure and its limits

Honest record of what the free tiers do and do not give us, and what must
change before real institutional data arrives.

## Current blocker: no local Supabase

**Docker is not installed on this machine**, and the Supabase CLI requires it
(`supabase start` runs the stack in containers). Installing Docker needs
administrator rights, so this one needs you.

Options, in order of preference:

1. **Install [OrbStack](https://orbstack.dev) (lighter on macOS, free for
   personal use) or Docker Desktop**, then `npx supabase start`. Fully local,
   zero cost, no data leaves the machine, and migrations/RLS tests run offline.
2. **Use a free hosted Supabase project for development.** Acceptable because
   development uses only synthetic fixtures, but the inactivity pause applies
   and migrations run against a remote database.

Until one is in place: migration SQL and RLS policies can be **written and
reviewed** but not **executed or tested**, so M2 cannot be signed off.

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
