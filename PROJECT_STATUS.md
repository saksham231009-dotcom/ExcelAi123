# PROJECT_STATUS — ExcelAI

## Objective

AI-powered spreadsheet SaaS: natural-language requests -> validated plan -> deterministic operations on real workbooks.

## Stack

Next.js (App Router) + TypeScript, Tailwind v4, Supabase (Postgres/Auth/Storage/RLS), OpenAI (server-side), Zod (planned), ExcelJS + Papa Parse (planned), Vitest, Prettier, ESLint, Vercel.
Grid library: undecided (Univer vs Glide Data Grid; decide in Phase 1 Step 5).

## Structure

src/app (routes), src/components, src/lib/{auth,db,storage,workbook,operations,ai,validation,security}, supabase/migrations, tests/unit.

## Current phase / task

Phase 1B: auth + dashboard + workbook management code COMPLETE. Live verification against the user's Supabase project: PENDING (not possible from sandbox).

## Completed

- Next.js scaffold, Tailwind, ESLint+Prettier, Vitest, git init, .env.example, system font stack (no Google Fonts fetch).

## Tests run (actual)

- lint: pass | typecheck: pass | vitest: 1/1 pass | prettier check: pass | npm audit (prod): 0 vulns
- build: pass; dev server: HTTP 200 on /

## Known limitations

- Built in a temporary sandbox; project must be moved to user's machine.
- No auth, DB, UI, or AI yet.

## Environment variables

Public: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_APP_URL
Server-only: OPENAI_API_KEY, OPENAI_MODEL
SUPABASE_SERVICE_ROLE_KEY: not used.

## Security decisions

- Secrets only in .env.local (gitignored); .env.example holds placeholders.
- Server-side authorization + RLS planned.

## DB migrations

None.

## Next

Milestone 2: landing page.

## Milestone 2: Landing page

- Files: src/components/landing/{Logo,Header,Hero,Sections,Notice}.tsx, src/app/page.tsx, (legal)/privacy, (legal)/terms, sign-in & sign-up PLACEHOLDER pages (no auth), layout.tsx (Inter via @fontsource-variable/inter).
- Deps added: @fontsource-variable/inter, lucide-react.
- Deviations from reference: fake stats/testimonials/model badge removed; single $10/month plan, no toggle; unbuilt features labeled; no About/Blog/social links.
- Checks run: lint, typecheck, vitest 1/1, prettier, build pass; prod server returns 200 for /, /privacy, /terms, /sign-in, /sign-up; anchors #features #how-it-works #pricing present.
- NOT verified: visual fidelity, responsive layout in a browser, mobile menu interaction, keyboard/accessibility audit.

## Milestone 3: Auth + dashboard + workbooks (Phase 1B)

Architecture: Supabase Auth with @supabase/ssr. Server actions for sign-in/up/forgot/reset/sign-out. `src/proxy.ts` (Next 16) refreshes session via getUser() and gates /dashboard, /workspace (redirect to /sign-in) and guest pages (redirect to /dashboard). Protected layout re-checks on the server. Email links handled at /auth/confirm (supports `code` and `token_hash`). `next` param sanitized (no open redirect).
Files: src/proxy.ts, src/lib/{supabase,auth,validation,workbooks}/_, src/app/(auth)/_, src/app/auth/confirm/route.ts, src/app/(app)/{layout,dashboard,workspace/[id]}/_, src/components/{auth,app}/_, supabase/migrations/20261003000000_workbooks.sql, tests/unit/{auth,workbooks}.test.ts, tests/integration/rls.test.ts, README.md.
Deps added: @supabase/supabase-js, @supabase/ssr, zod.
Schema: public.workbooks (id, owner_id, name, file_type blank|xlsx|csv, storage_path, size_bytes, created_at, updated_at) + updated_at trigger + RLS (select/insert/update/delete own, update cannot change owner). Private bucket `workbooks` (5 MB, xlsx/csv MIME) + storage policies scoped to folder = user id. Path check constraint ties storage_path to owner folder.
Upload flow: browser validates -> uploads to own folder -> server action verifies object, inserts row; on failure removes file. Delete: removes file first (abort if it fails), then row.
Dashboard shows only real data (workbook count, uploaded files, storage used). Unbuilt nav items are disabled and labeled. Plan box says "Development account, billing not enabled". No payments.
Env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (+ optional TEST_USER_A/B_* for integration tests). No service-role key used.

### Tests actually run (sandbox, no Supabase project)

- lint, typecheck, prettier: pass. Unit tests: 15/15 pass (validation, redirects, error mapping, upload validation, helpers). Production build: pass.
- Prod-server smoke (curl): without env, /dashboard, /workspace/*, /reset-password redirect to /sign-in?error=config. With a fake unreachable Supabase URL: protected routes redirect to /sign-in, stale cookie gives session_expired and /sign-in still loads (no loop), bad /auth/confirm links redirect with link_invalid. No service_role/OPENAI key in client bundle.
- NOT RUN (needs real Supabase): sign-up, email verification, sign-in, session persistence, password reset, create/upload/rename/delete, RLS cross-user test (9 tests, currently skipped), sign-out, browser UI/responsive check.

## Known limitations

- Uploaded files are stored, not parsed. Workspace page is a placeholder. Blank workbooks are records only.
- Not yet browser-tested; visual match to dashboard reference unverified.
- Supabase built-in mailer is rate limited; custom SMTP recommended before launch.
- Dashboard lists up to 500 workbooks, no pagination.

## Next

Run live verification checklist (README + chat), fix any defects, then Milestone 4: workbook parsing + editable grid.
