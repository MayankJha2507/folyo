# Folyo — Technical Implementation Plan (revision 2, for review)

Status: **proposal, nothing implemented.** No project initialised, no application code written.

Repo state (2026-11-16): `/Users/mayankjha/Desktop/Folyo` contains only `docs/`. Not a git repo. Local toolchain: Node 25.9, npm 11.12, Python 3.13. Not present: `git` history, `gh`, `pnpm`, Supabase CLI.

## What changed in revision 2

| # | Your instruction | Effect on the plan |
|---|---|---|
| 1 | Split ATS into two scores | Two independent engines, two rubrics, two report tables (§5) |
| 2 | PDF upload analysis is in v1 | New extraction pipeline, storage, quality gating, milestone M6 (§6) |
| 3 | Clarify Supabase/Drizzle boundary | Three explicit access paths, RLS preserved *through* Drizzle, import fencing, identity tests (§4) |
| 4 | Stronger AI consent | `profiles.ai_consent_at` removed; dedicated versioned consent ledger enforced in the adapter (§8) |
| 5 | Atomic seat allocation | Seat lifecycle defined; all transitions through row-locked `SECURITY DEFINER` functions + trigger backstop + concurrency tests (§9) |
| 6 | Lightweight payment readiness | `subscriptions` table **removed**; no billing subsystem ships unused (§10) |
| 7 | Deployment realism | Hobby for development only; commercially-licensed host before public beta; Supabase Free limits documented (§12, §13) |
| 8 | Institution administration | Staff/admin permissions separated; multi-org membership in the model; explicit visibility matrix (§3) |
| 9 | Authentication | Email/password, magic link, reset, email verification. Google OAuth deferred (§11, M1) |
| 10 | No version pinning | Versions resolved at implementation time and recorded; today's stable noted below (§2) |

---

## 1. Revised architecture

One Next.js application, one database, one auth system, tenant-aware at the data layer. An institution is a container that **grants entitlements** to accounts; it never owns accounts or their content.

```
Browser (RSC shell + client resume editor)
   │
   ├─ Next.js App Router  ─────────────────────────────────────────────┐
   │   route groups:  (marketing) (auth) (app) (institution) (admin)   │
   │                                                                   │
   │   server actions / route handlers — the only place secrets exist   │
   │     ├─ ats/health/      deterministic Resume Health engine         │
   │     ├─ ats/match/       deterministic Job Match engine             │
   │     ├─ ingest/          PDF upload → extract → quality gate → parse│
   │     ├─ ai/              provider-agnostic adapter + consent guard  │
   │     ├─ entitlements/    plan + seat resolution, quota metering     │
   │     ├─ seats/           calls atomic DB functions only             │
   │     └─ render/          resume HTML → PDF                          │
   └───────────────────────────────────────────────────────────────────┘
          │                        │                         │
   user-scoped client       Drizzle (RLS-enforced)     service-role
   (JWT, RLS)               migrations + controlled    (fenced, audited,
   ~all user traffic        server transactions         admin-only)
          └──────────────── Supabase: Postgres · Auth · Storage ───────┘
```

Unchanged principles: security is enforced in Postgres and proved by tests; the UI only reflects it. Resumes are stored as normalised JSON so the editor, both scoring engines, templates and export all read one canonical shape.

---

## 2. Technology choices

Versions are **resolved at implementation time** and recorded in `docs/VERSIONS.md` plus the lockfile. For reference, latest stable as of 2026-11-16: Next.js **16.4.6**, React **19.3.1**, Tailwind **4.3.5**, Zod **4.6.7**, `@supabase/supabase-js` **2.119.0**, Drizzle ORM **0.45.4**, `pdfjs-dist` **6.5.438**, Vitest **5.1.0**. M0 pins whatever is current and stable then; no plan text depends on a specific major.

| Choice | Reason | Trade-off |
|---|---|---|
| Next.js App Router + TypeScript | One deploy target for UI, server logic and the print route; server actions keep keys server-side | Caching semantics are easy to get wrong — all authed routes marked dynamic explicitly |
| Tailwind + shadcn/ui | Copied-in source, so the restrained design system stays ours to constrain | Needs a fixed token set and a reviewed component inventory |
| Supabase (Postgres, Auth, Storage) | RLS is precisely the primitive this product's privacy rule needs | Free tier pauses when idle and has no backups (§13 R7) |
| Drizzle (migrations + typed server txns) | Plain readable SQL migrations; keeps policies visible; connects as an RLS-enforced role (§4) | Less GUI tooling than Prisma |
| `pdfjs-dist` for text extraction | Pure JS, no native binaries, no per-page service cost, gives per-glyph position data we need for column/heading detection | Image-only PDFs need OCR, which v1 refuses explicitly rather than guessing (§6) |
| Zod | One schema for forms, server action input and AI structured output | — |
| Vitest + Playwright | Fast unit tests where correctness matters; three E2E paths | — |
| Gemini + Groq behind an adapter | Two free tiers, complementary strengths | Free-tier data terms → consent ledger (§8) |

---

## 3. Roles, permissions and institution administration

| Capability | individual | student | org_staff | org_admin | platform_admin |
|---|---|---|---|---|---|
| Own resumes, uploads, letters, applications | ✓ | ✓ | ✓ (own) | ✓ (own) | ✓ (own) |
| AI features within quota | ✓ | ✓ | ✓ | ✓ | ✓ |
| View org roster (name, email, invitation + membership + licence status) | — | — | ✓ | ✓ | ✓ |
| Send / resend / revoke invitations | — | — | ✓ | ✓ | ✓ |
| Revoke a member's seat | — | — | — | ✓ | ✓ |
| Change seat allocation, licence window, org settings | — | — | — | — | ✓ |
| Create an institution | — | — | — | — | ✓ |
| Assign plans / entitlement grants | — | — | — | — | ✓ |
| Read any student's resume, cover letter, application or AI history | **never** | **never** | **never** | **never** | **never** (no UI, no admin path) |

- **Staff and admin are genuinely separate**: staff manage invitations and read aggregates; only admins change who holds a seat; only platform admins change how many seats exist or create an institution.
- **Multiple institutional memberships are supported in the model** from day one: `org_members` is unique on `(org_id, user_id)`, a user may hold rows in several orgs, and entitlements union across all active seats. The pilot may use one org per student; the schema does not assume it.
- Role is never trusted from the JWT. `org_members` and `platform_admins` are the source of truth, read through `SECURITY DEFINER` helpers (`app.is_org_admin(org)`, `app.is_org_staff(org)`, `app.is_platform_admin()`) so policies cannot recurse.
- Institution analytics derive **only** from `usage_events` and `org_members`, through aggregate views with a minimum cohort size (suppress cells below a threshold — see open decision D4) so counts cannot identify one student's activity.

---

## 4. Supabase / Drizzle architecture — and how RLS is not bypassed

Three access paths, each in its own module, with no shared "db" helper that could blur them:

**(a) `lib/db/user.ts` — user-scoped, RLS enforced. Carries essentially all user traffic.**
`@supabase/ssr` server client built from the request cookies, so every statement runs as `authenticated` with the user's JWT and `auth.uid()` is the real user. Every user-facing read and write goes here.

**(b) `lib/db/txn.ts` — Drizzle, RLS still enforced.** For multi-statement server-side work that needs a real transaction (seat operations, report writes, schema-versioned document migration). The critical details:

- Drizzle connects as a dedicated role `folyo_app` which is **`NOLOGIN`-adjacent in capability**: not the owner of any table, no `BYPASSRLS`, no superuser. RLS therefore applies to it exactly as to any user.
- Every transaction opens by establishing identity, so policies evaluate against the real caller:
  ```sql
  BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims = '{"sub":"<verified uid>","role":"authenticated"}';
    -- statements
  COMMIT;
  ```
  The uid comes from a server-verified Supabase session, never from client input. `SET LOCAL` means it cannot leak past the transaction or across pooled connections.
- The helper's only public API is `withUser(session, fn)`. There is no exported raw connection, so "forgetting" to set identity is not reachable from call sites.

**(c) `lib/db/admin.ts` — service-role, fenced and audited.** The only module holding the service key. Every exported function takes an `AdminContext` built from a verified `platform_admin` session, and writes an `audit_log` row as part of the same transaction as the change. Enforcement that this stays narrow:

- ESLint `no-restricted-imports` forbids importing it from anywhere except `lib/db/admin/**` and its own tests; CI fails on violation.
- A grep-based CI check asserts `SUPABASE_SERVICE_ROLE_KEY` appears in exactly one file.
- `lib/env.server.ts` throws if evaluated in a client bundle; the service key is read only there.
- Migrations run from the CLI, not from application runtime — the migration entrypoint is excluded from the build.

**Automated proof (not inspection).** `tests/rls/` runs against a real database with real Supabase Auth users and asserts:

1. **Identity assertions** — inside each access path, `SELECT auth.uid(), current_user` returns the expected user and a non-privileged role. This catches the specific failure you named: a privileged connection quietly doing user work.
2. **Denial matrix** — for every content table, each of {other individual, same-org peer, org_staff, org_admin, other-org admin} is asserted to get zero rows on `SELECT` and an error on `INSERT/UPDATE/DELETE`.
3. **Negative control** — a test deliberately runs a cross-user read via the admin path and asserts it *succeeds*, proving the suite would catch a bypass rather than passing vacuously.
4. **Post-revocation** — a revoked student still reads their own resumes; their former org still cannot.

CI blocks merge on any failure in this suite.

---

## 5. Revised ATS architecture — two independent analyses

Two engines, two rubrics, two report tables, two explanations. Neither uses an LLM to produce a number. Both accept either a native Folyo resume or a parsed PDF upload, since both resolve to the same canonical document shape.

### 5a. Resume Health Score — no job description required

Answers "is this a well-built, parseable, credible resume?"

| Dimension | Weight | Deterministic signals |
|---|---|---|
| Completeness | 20 | required basics present; parseable email/phone; location; at least one experience and one education entry; no empty declared sections |
| Structure & section hygiene | 15 | recognisable canonical section headings; sensible ordering; no duplicated or orphaned sections; consistent entry shape |
| Content quality | 25 | action-verb openers; quantification (`\d+%`, counts, currency); bullet length band; no first person; no repeated bullet openers; no responsibility-list-without-outcome pattern |
| Dates & continuity | 10 | parseable ranges; chronological consistency; overlap anomalies; gaps **reported, never silently penalised** |
| Readability & density | 15 | words per bullet; bullets per role; estimated page count; section balance; passive-voice ratio |
| Parsing compatibility | 15 | multi-column layout, tables, text in images, non-standard bullet glyphs, unusual characters, header/footer contact placement, font-embedding problems |

Native resumes score full marks on parsing compatibility by construction (we control the renderer). For uploads, this dimension is measured from the extraction metadata (§6) and is often the most valuable finding.

### 5b. Job Match Score — job description required

Answers "how well does this resume match *this* job?"

| Dimension | Weight | Deterministic signals |
|---|---|---|
| Hard skill coverage | 35 | JD-extracted skills matched against resume, weighted by JD frequency and JD section (requirement > responsibility > nice-to-have) |
| Role / title alignment | 15 | target title vs held titles, through a title-family map (`sde`↔`software engineer`) |
| Experience & seniority fit | 15 | required years vs computed years in matched domain; level words (junior/senior/lead) vs evidence |
| Qualifications | 10 | degree level/field, certifications, licences named in the JD |
| Responsibility overlap | 15 | verb+object pair overlap between JD duties and resume bullets |
| Match placement | 10 | where matches occur — title/skills section matches count more than a passing mention in a summary |

Output distinguishes, explicitly and per item:

- **Present** — skill, the JD weight, and the *evidence*: which resume node matched and by what route (exact, synonym, inflection).
- **Missing** — skill, JD weight, where it is demanded, and whether it is a stated requirement or a preference.
- **Weak** — present but only in a low-weight location, or mentioned without supporting experience.

No fabrication: a missing skill is reported as missing. The AI layer may draft *how to phrase* a skill the user confirms they have; it never invents coverage.

### Shared mechanics

- **JD keyword extraction**: normalise → tokenise → remove stopwords and JD boilerplate → n-grams (1–3) → lemmatise → map through a committed skill/synonym dictionary (`js`→`javascript`, `k8s`→`kubernetes`) → rank by frequency × section weight. The dictionary is a reviewable JSON file.
- **Independent versioned rubrics**: `health_rubric_version` and `match_rubric_version` stored on each report, so a weighting change never silently rewrites history and scores stay comparable over time.
- Both engines are pure functions over `(ResumeDocument[, ParsedJobDescription])` — no I/O, no network, fully unit testable, and testable on fixtures with asserted score bands. This is the part users judge us on, so it gets the densest test coverage.
- The LLM is strictly additive: given findings the engine already produced, it drafts rewrite prose. With AI unavailable or consent withheld, both reports render completely.

---

## 6. Uploaded PDF analysis (in v1)

A first-class ingestion path, not an afterthought. Four stages, each able to fail loudly.

```
upload → extract → quality gate → structural parse → ResumeDocument (partial, confidence-tagged)
                                                           └→ Resume Health + Job Match
```

**1. Upload.** Client-side type and size check (PDF, ≤ 10 MB, ≤ 10 pages), then a signed upload to a **private** Supabase Storage bucket under `uploads/{user_id}/{upload_id}.pdf`. No public URLs. Storage policies scope every object to its owner, mirroring the table policies.

**2. Extraction.** `pdfjs-dist` in a Node runtime handler produces, per page, text items with position, font and size. We keep the geometry, not just a text blob — it is what makes column and heading detection possible.

**3. Extraction-quality gate.** Before any analysis, we classify the document and record the measurements:

| Outcome | Detection | What the user sees |
|---|---|---|
| `ok` | adequate characters per page, sane word-shape distribution, fonts mapped | proceeds to parsing |
| `image_only` | pages with ~zero text items but image XObjects present | "This PDF contains scanned images, not selectable text. ATS systems cannot read it either — which is itself a serious finding." Offers: export a text PDF from the source document, paste the text, or build a native Folyo resume. **No silent OCR, no guessed content.** |
| `partial_text` | some pages extract, others do not | analysis proceeds on what extracted, with an explicit banner naming the unreadable pages and excluding them from completeness scoring |
| `garbled` | high non-dictionary token ratio, broken CID/ToUnicode mapping | "Text extracts but is scrambled — a font-encoding problem that also breaks ATS parsers." Reported as a parsing-compatibility failure |
| `encrypted` / `password` | pdf.js throws password/permission error | clear, specific message; no retry loop |
| `corrupt` | parse failure | clear message, support reference, original retained per retention policy |
| `too_large` / `too_many_pages` | pre-check | rejected before upload completes |

Quality metrics are persisted on the upload row, so a Health report can cite them as evidence rather than asserting them.

**4. Structural parse.** Heuristic, deterministic, no LLM: cluster text items by font size and weight to find headings; match headings against a section-synonym dictionary (`Work Experience`/`Professional Experience`/`Employment`); detect multi-column layouts by clustering x-positions and warn, since naive ATS parsers interleave columns; group lines into entries; extract dates, titles, organisations and bullets with labelled regexes. Every produced field carries a confidence; low-confidence fields are surfaced for user correction rather than presented as fact. An "import to a native resume" action converts the parse into an editable Folyo resume, with the user confirming uncertain fields — which also gives us a correction signal to improve the parser.

**Retention.** The source PDF is not needed after extraction. Default: delete the stored object once parsing succeeds, keeping the extracted text and parse (open decision D2). This protects privacy and keeps us inside the 1 GB free storage quota.

OCR for image-only PDFs is explicitly **out of v1**; v1 fails clearly instead of inventing content.

---

## 7. Revised data model

```
auth.users (Supabase Auth)
  └─1:1─ profiles (id, full_name, avatar_url, locale, created_at)        ← no consent column

organisations  id, name, slug, domain, status, seats_total,
               licence_starts_at, licence_ends_at, created_by, created_at
  ├─1:N─ org_members      (org_id, user_id, role[admin|staff|student],
  │                        seat_state[active|revoked], joined_at, revoked_at)
  │                        UNIQUE(org_id, user_id)   ← multi-org by design
  └─1:N─ org_invitations  (org_id, email, role, token_hash, status[pending|accepted|revoked|expired],
                           reserves_seat bool, expires_at, accepted_at, accepted_user_id,
                           invited_by, created_at)
                           UNIQUE(org_id, lower(email)) WHERE status='pending'

platform_admins (user_id, granted_by, granted_at)

profiles
  ├─1:N─ resumes            (id, owner_id, title, template_id, document jsonb,
  │                          schema_version, source[native|imported], is_archived, updated_at)
  │        ├─1:N─ resume_versions (resume_id, document jsonb, label, created_at)
  │        └─1:N─ resume_shares   (resume_id, audience[link|org], org_id?, token_hash,
  │                                scope[view|view_download], expires_at, revoked_at)
  ├─1:N─ resume_uploads     (id, owner_id, storage_path?, filename, bytes, page_count,
  │                          extraction_status, extraction_quality jsonb,
  │                          extracted_text, parsed jsonb, parser_version,
  │                          imported_resume_id?, created_at, purged_at)
  ├─1:N─ job_targets        (id, owner_id, company, role_title, jd_text, jd_url, parsed jsonb)
  ├─1:N─ applications       (id, owner_id, job_target_id?, resume_id?, company, role_title,
  │                          status[saved|applied|interview|offer|rejected], applied_at, notes)
  ├─1:N─ cover_letters      (id, owner_id, resume_id?, job_target_id?, body, generated_by jsonb)
  ├─1:N─ health_reports     (id, owner_id, resume_id?, upload_id?, health_rubric_version,
  │                          score, breakdown jsonb, findings jsonb, created_at)
  │                          CHECK (num_nonnulls(resume_id, upload_id) = 1)
  ├─1:N─ match_reports      (id, owner_id, resume_id?, upload_id?, job_target_id,
  │                          match_rubric_version, score, breakdown jsonb,
  │                          present jsonb, missing jsonb, weak jsonb, created_at)
  │                          CHECK (num_nonnulls(resume_id, upload_id) = 1)
  ├─1:N─ ai_consent_records (id, user_id, provider, purpose, disclosure_version,
  │                          granted_at, revoked_at, granted_ip, granted_user_agent)
  ├─1:N─ ai_requests        (id, user_id, task, provider, model, data_class,
  │                          consent_record_id?, input_tokens, output_tokens, latency_ms,
  │                          status, created_at)
  └─1:N─ usage_events       (id, user_id, org_id?, kind, units, meta jsonb, occurred_at)

plans             (code, name, features jsonb, quotas jsonb, is_public)
entitlement_grants (id, subject_type[user|org], subject_id, plan_code,
                    source[manual|institution|trial], status, starts_at, ends_at, granted_by)
audit_log         (id, actor_id, action, target_type, target_id, meta jsonb, at)
```

Removed from revision 1: `subscriptions` (§10), `profiles.ai_consent_at` (§8), `entitlement_grants.external_ref`.

### The privacy rule as policy

- `resumes`, `resume_uploads`, `cover_letters`, `applications`, `job_targets`, `health_reports`, `match_reports`, `ai_requests`: a single predicate, `owner_id = auth.uid()`. **No table that holds personal content carries an org predicate.** An institution admin querying them as themselves gets zero rows — by policy, not by UI.
- The only route to another person's resume is a `resume_shares` row the student created, with audience, scope and expiry, revocable at any time, read through a function that checks it is unexpired and unrevoked.
- Revoking a member sets `org_members.seat_state='revoked'` and ends the institutional grant. Nothing cascades to content — the FK direction (`org_members → profiles`) makes that structural, and a test asserts it.
- Storage policies scope upload objects to their owner, so a private bucket cannot be read across users even with a path guess.

---

## 8. Revised AI consent model

`profiles.ai_consent_at` is gone. Consent is a **ledger of specific, versioned permissions**:

`ai_consent_records(user_id, provider, purpose, disclosure_version, granted_at, revoked_at, granted_ip, granted_user_agent)` with a unique partial index on `(user_id, provider, purpose, disclosure_version) WHERE revoked_at IS NULL`.

- `provider` — `gemini` | `groq`, named individually. Consenting to one is not consenting to the other; adding a provider requires fresh consent.
- `purpose` — `resume_rewrite`, `summary_draft`, `cover_letter`, `match_suggestions`. Scoped, not blanket.
- `disclosure_version` — the exact disclosure text the user saw, kept in version control. Publishing a new version invalidates consent against older versions and re-prompts. The user can always see what they agreed to.
- Revocation is `revoked_at`, never a delete, so the record of what was permitted and when survives.

**Enforcement sits in the adapter, not the UI.** Every registered task declares a `dataClass`:

```ts
type DataClass = 'personal' | 'non_personal' | 'synthetic';
// before any outbound call:
if (task.dataClass === 'personal') {
  const consent = await requireActiveConsent({ userId, provider, purpose: task.purpose,
                                               minDisclosureVersion: CURRENT });
  // throws ConsentRequiredError — typed, so the UI renders the consent prompt
}
```

No consent, no call; a UI mistake cannot produce an outbound request. Each call records `ai_requests.consent_record_id`, so every transmission of personal data is attributable to the exact consent that authorised it — the thing you want if an institution ever asks.

Development and CI use synthetic resumes from `fixtures/`, and a `SyntheticOnlyProvider` in CI refuses any input not drawn from fixtures, so no real resume can reach a provider from a test run.

### AI adapter (unchanged in shape)

```ts
interface AIProvider {
  readonly id: 'gemini' | 'groq';
  generate<T>(req: { task: TaskId; input: unknown; schema: ZodType<T>;
                     maxTokens?: number; signal?: AbortSignal }): Promise<AIResult<T>>;
}
```

Task-centric call sites (`ai.run('resume.bullet.rewrite', input)`); registry maps task → ordered provider/model candidates, so switching provider is a config edit. Zod-validated structured output with one repair retry. Fallback chain with a circuit breaker: Groq for latency-sensitive inline rewrites, Gemini for long-context JD work. Prompts are versioned files with golden-file tests. Keys server-only via `lib/env.server.ts`.

---

## 9. Atomic institutional seat allocation

**Seat accounting.** A seat is consumed by either an active membership *or* a live reservation:

```
used(org) = count(org_members where seat_state='active')
          + count(org_invitations where status='pending' and reserves_seat and expires_at > now())
invariant: used(org) <= organisations.seats_total
```

Expired invitations stop counting by predicate, so correctness never depends on a cleanup job (a cron only tidies rows and sets `status='expired'` for display).

**Lifecycle.**

| Transition | Seat effect |
|---|---|
| Admin/staff invites | reserve one seat (invitation `pending`, `reserves_seat=true`) |
| Student accepts | reservation → active membership; **net delta zero** |
| Invitation expires | reservation released automatically |
| Invitation revoked | reservation released |
| Admin revokes member | `seat_state='revoked'`, institutional grant ended; account and all content untouched |
| Platform admin lowers `seats_total` | allowed only down to current `used`, else a clear error |

**Enforcement is in the database.** Every transition is a `plpgsql SECURITY DEFINER` function, and all of them begin by taking the same row lock, which serialises every seat operation on that organisation:

```sql
create function app.reserve_seat(p_org uuid, p_email text, p_role text)
returns org_invitations language plpgsql security definer as $$
declare v_total int; v_used int; v_inv org_invitations;
begin
  if not app.is_org_staff(p_org) then raise exception 'forbidden' using errcode='42501'; end if;

  select seats_total into v_total from organisations where id = p_org for update;  -- serialises
  select app.seats_used(p_org) into v_used;
  if v_used >= v_total then raise exception 'seat_limit_reached' using errcode='P0001'; end if;

  insert into org_invitations (...) returning * into v_inv;
  return v_inv;
end $$;
```

`app.accept_invitation(token_hash)`, `app.revoke_invitation(id)`, `app.revoke_member(org, user)` and `app.set_seats_total(org, n)` take the same lock and re-check the invariant. Server actions **only call these functions** — no application code computes seat availability and then writes. Frontend validation exists purely for a better message.

**Backstop and proof.**

- A constraint trigger on `org_members` and `org_invitations` re-asserts the invariant on insert/update, so even a future direct SQL path cannot overshoot.
- A concurrency test fires N parallel `reserve_seat` calls at an org with one free seat and asserts **exactly one** succeeds and the rest get `seat_limit_reached`.
- A test asserts a revoked member retains every resume, upload, letter and application, and that their former org still reads nothing.
- A reconciliation test asserts `used <= seats_total` across randomised lifecycle sequences.

---

## 10. Entitlements — lightweight payment readiness

Ships in v1: `plans`, `entitlement_grants`, feature access checks, usage metering, manual institutional licence management. **No `subscriptions` table, no provider columns, no checkout, no gateway.**

```
resolveEntitlements(userId) ->
   personal  = active grants where subject = user
   seats     = active grants where subject = org, for each org with seat_state='active'
   effective = union of features, max() of quotas, most generous wins
```

- A plan is data (`plans.features`, `plans.quotas`), not code. Gating reads `has(feature)` / `remaining(quota)`; there is no `if (plan === 'pro')` anywhere.
- v1 grant sources: `manual` (platform admin), `institution` (accepting a seat), `trial`. Multi-org seats union naturally.
- Quotas meter on `usage_events` over a rolling monthly window — auditable and attributable to a user or an org.
- **Extension point when payment arrives**: add billing tables, add a `billing` value to the grant-source enum, and have the provider webhook write a grant. `resolveEntitlements`, RLS, roles and every feature check stay as they are. That forward compatibility costs nothing today, which is why no billing table ships unused.

---

## 11. Authentication

Email/password, magic link, password reset, email verification — all via Supabase Auth. Unverified accounts may sign in but are blocked from AI features and sharing until verified. Google OAuth is deferred to a later iteration; nothing in the model assumes a single identity provider, so adding it is additive.

---

## 12. Deployment and infrastructure

- **Development**: entirely local — local Supabase via CLI (Docker), local Next.js dev server, synthetic fixtures. Vercel Hobby is used for preview deployments of non-commercial development only.
- **Before public commercial beta**: Vercel Pro (~$20/mo) or a host whose terms permit commercial use. Vercel Hobby is **not** assumed capable of hosting a commercial Folyo deployment. Needs your choice (D1).
- **Supabase Free is a development environment only.** Documented limitations, to be written into `docs/INFRA.md`: projects pause after ~7 days of inactivity; no automated backups on the free tier; limited connections; 500 MB database and 1 GB storage. Real institutional data requires Supabase Pro (or self-hosted Postgres) with point-in-time recovery, a tested restore procedure, and a documented RPO/RTO before any pilot that holds real student data.

| Phase | Services | Monthly |
|---|---|---|
| Development (M0–M11) | local Supabase, Vercel Hobby previews, Gemini + Groq free tiers, Resend free (3k emails) | **~$0** |
| Commercial beta | Vercel Pro $20 + Supabase Pro $25 (backups, no idle pause) + domain ~$1 + AI within free tiers | **~$46** |
| Growth | add AI spend as volume exceeds free tiers; metering in `ai_requests` and `usage_events` is the early-warning signal | usage-driven |

PDF extraction adds no service cost (`pdfjs-dist` runs in our own function). Deleting source PDFs after extraction keeps storage near zero.

---

## 13. Revised risks

| | Risk | Mitigation |
|---|---|---|
| R1 | **RLS error leaks student content to an institution.** The worst outcome for this product. | No org predicate on any content table; policies as reviewed SQL; adversarial denial matrix + negative control in CI (§4) |
| R2 | **Accidental RLS bypass through a privileged connection.** | Drizzle runs as a non-owner role without `BYPASSRLS` and sets `SET LOCAL ROLE`/JWT claims per transaction; service key confined to one lint-fenced, audited module; identity-assertion tests prove which role executed (§4) |
| R3 | **PDF extraction quality** — garbage in, meaningless score out. | Explicit quality gate with six classified outcomes before analysis; image-only and garbled documents refused with a specific explanation; confidence-tagged fields and user correction; no OCR guessing (§6) |
| R4 | **Two scores confusing users** or looking redundant. | Separate rubrics, separate explanations, separate entry points: Health needs no JD, Match requires one; each dimension shown with its own evidence |
| R5 | **Score credibility.** | Deterministic, versioned, fully explainable; every point traceable to a named signal shown in the UI; no LLM in either number |
| R6 | **Seat over-allocation under concurrency.** | Row-locked `SECURITY DEFINER` functions as the only write path, constraint-trigger backstop, parallel-invite test (§9) |
| R7 | **Supabase Free pause + no backups.** | Development only, limits documented in `docs/INFRA.md`; Pro with tested restore before any pilot holding real data (§12) |
| R8 | **Hosting terms** for a commercial B2B product. | Hobby for development previews only; commercial host chosen before public beta (D1) |
| R9 | **Free-tier AI data-use terms** vs real student resumes. | Versioned per-provider, per-purpose consent enforced inside the adapter; every transmission linked to its consent record; synthetic-only provider in CI (§8) |
| R10 | **PDF export fidelity / serverless Chromium weight.** | Print route (same renderer as preview) as the primary zero-cost path; server Chromium phase 2 behind a flag with print as permanent fallback |
| R11 | **Editor autosave loss / conflicts.** | Debounced autosave, `updated_at` conflict check, version snapshots on significant change |
| R12 | **Scope.** v1 now also carries PDF ingestion. | Milestones ordered so the product is usable from M5; ingestion lands as its own milestone (M6) and can slip without blocking anything before M7 |

---

## 14. Revised milestones

Each ends with lint, typecheck and tests green, and is independently reviewable.

| # | Milestone | Acceptance criteria |
|---|---|---|
| M0 | Foundation | git repo; latest stable Next.js + TS + Tailwind + shadcn scaffold with **versions recorded in `docs/VERSIONS.md`**; local Supabase running; CI (lint, typecheck, test); design tokens + base components; `CLAUDE.md`; `docs/INFRA.md` with Supabase Free limitations |
| M1 | Auth | Email/password, magic link, email verification, password reset; profile row auto-created; session guards; unverified-account gating. No OAuth |
| M2 | Schema, RLS, access-path proof | All tables + policies migrated; `folyo_app` role without `BYPASSRLS`; `withUser` txn helper; admin module fenced by lint rule; **identity-assertion tests + full denial matrix + negative control green in CI** |
| M3 | Resume CRUD + editor | Create/rename/duplicate/archive; two-column editor, all sections, reorder, autosave with conflict handling; version snapshots |
| M4 | Templates + preview + export | 4 templates; preview and print render from the same component; print export produces correct 1–2 page PDFs for all fixtures; screenshot regression check |
| M5 | **Resume Health Score** | Deterministic engine, versioned rubric, six dimensions; unit tests assert score bands across fixtures; report UI shows per-dimension evidence and specific fixes. Works with zero AI and no JD |
| M6 | **PDF upload + extraction** | Private-bucket upload with owner-scoped storage policies; pdfjs extraction; all six quality outcomes classified and tested on a fixture corpus (clean, multi-column, scanned, garbled-font, encrypted, corrupt); structural parse with confidences; "import to native resume" flow; Health score runs on uploads; retention policy applied |
| M7 | **Job Match Score** | JD capture and parsing; deterministic match engine, independent rubric; present / missing / weak lists each with evidence and JD weight; unit tests on fixture JD↔resume pairs |
| M8 | AI layer + consent | Consent ledger with provider/purpose/version; adapter refuses personal-data tasks without active consent (tested); Gemini + Groq with fallback; Zod-validated output; `ai_requests` logging linked to consent records; bullet rewrite, summary draft, cover letter. Works with either provider disabled |
| M9 | Jobs, tailoring, applications | Job targets, tailoring suggestions built on M7 findings, application tracker with status board |
| M10 | Institutions + atomic seats | Platform admin creates org and sets seats; tokenised expiring invitations; atomic reserve/accept/revoke functions; **parallel-invite concurrency test green**; staff vs admin permissions enforced and tested; roster (names, emails, invitation/membership/licence status); analytics with cohort suppression; M2 privacy suite re-run and green |
| M11 | Entitlements + hardening | Plans seeded; quota enforcement with clear limit UX; audit log; empty states and onboarding; responsive and a11y passes; error boundaries; rate limiting on AI, upload and export |

Payment processing is out of scope throughout, and no billing tables ship.

---

## 15. Testing strategy

- **Unit (Vitest)** — Resume Health engine, Job Match engine, JD keyword extraction, PDF quality classification, structural parser, entitlement resolution and quota windows, consent evaluation, resume schema migration, date/continuity parsing, invitation token lifecycle.
- **Database suite** — identity assertions per access path, the cross-user and cross-institution denial matrix, the negative control, post-revocation content retention, and seat concurrency. Runs on a real database in CI; failure blocks merge.
- **Fixture corpora** — synthetic resumes (strong, weak, sparse, over-long), PDF corpus covering all six extraction outcomes, and JD↔resume pairs with expected score bands.
- **AI contract tests** — recorded fixtures only, no live calls in CI; schema-violation, 429, fallback and consent-refusal paths all asserted.
- **E2E (Playwright)** — three paths: sign-up → create resume → export; upload PDF → health report; invite → student accepts → seat consumed.

---

## 16. Decisions — approved 2026-11-16

All seven were approved as recommended. These are now settled and binding on implementation:

| | Decision | Approved position |
|---|---|---|
| D1 | Commercial host for public beta | **Vercel Pro**, chosen before the public beta. Hobby for development previews only |
| D2 | Upload retention | **Delete the source PDF immediately** after successful extraction; retain extracted text and parse only |
| D3 | OCR for scanned PDFs | **Post-v1 roadmap**, self-hosted Tesseract. v1 refuses image-only PDFs with a clear explanation |
| D4 | Cohort suppression threshold | **Suppress any analytics cell below 5 members** |
| D5 | Invitation rights | **org_staff may invite**; only org_admin may revoke a seat or change allocation |
| D6 | Template count at M4 | **Four**, more after M11 |
| D7 | Transactional email | **Resend** free tier, behind a swappable mailer interface |

### D8 — development database (decided 2026-11-16)

Docker is not installed and the Supabase CLI requires it, so development runs against a **free hosted Supabase project** rather than a local stack. Acceptable because development uses synthetic fixtures only; the inactivity pause (§12) applies and migrations run remotely. Setup: `docs/SUPABASE_SETUP.md`. Switching to local later costs nothing but an `.env.local` change.
