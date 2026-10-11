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

## Milestone 4: Univer workspace + AI operations (Phase 1C)

Architecture: Univer 1.0.3 (`@univerjs/presets` + `preset-sheets-core`, open-source core) renders the editable grid. The live sheet is stored as a Univer snapshot (jsonb `workbooks.snapshot`, `snapshot_version` for conflict detection) under the existing owner-only RLS. First open of an uploaded XLSX/CSV imports it server-side (ExcelJS/PapaParse) into a snapshot; blank workbooks get an empty Sheet1. Autosave: debounced 1.5 s, direct Supabase update with version check, 4 MB cap, beforeunload warning, retry on error. Export: /api/workbooks/[id]/export builds .xlsx (values + formulas, no styles) from the last saved state.
AI: client builds a compact context (sheet names, dims, headers, types, blank counts, <=4 clipped sample rows for the active sheet only; test shows 20k-row sheet -> <2 KB). POST /api/ai/plan (auth + ownership check + rate limit + 45 s timeout) calls OpenAI chat completions (json_object) and validates the reply with a strict zod schema (19 operations, max 6 per plan). The AI never executes anything. The client re-validates, dry-runs the plan in a pure engine (src/lib/operations/engine.ts), shows a confirm card for destructive plans (delete rows/cols/sheets, clear, remove duplicates, big overwrites), applies effects through Univer's own API, re-reads the sheet and compares with the simulated expected result (verifyModels). Chat reports only engine-computed summaries and results. "Undo last AI change" restores a pre-change snapshot.
Operations: set_cells, add_column, rename_column, delete_columns, insert_rows, delete_rows, clear_range, sort, remove_duplicates, find_replace, fill_blanks, clean_text, format, highlight, create/rename/delete_sheet, query (top_n/sum/avg/min/max/count/summary, group_by, optional write to new sheet). Not supported yet: move/copy ranges, true conditional-formatting rules, merge/unmerge, charts, sorting ranges that contain formulas (refused), importing styles/dates as dates.
New files: src/lib/operations/{schema,engine}.ts, src/lib/ai/{context,prompt}.ts, src/lib/workbooks/{snapshot,import,load}.ts, src/components/workspace/*, src/app/api/ai/plan/route.ts, src/app/api/workbooks/[id]/export/route.ts, supabase/migrations/20261004000000_workbook_snapshot.sql, tests/unit/{engine,import,context}.test.ts. Changed: workspace page, AppShell, scripts/check-supabase.mjs.
Deps added: @univerjs/presets, @univerjs/preset-sheets-core, exceljs, papaparse.
Env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (public); OPENAI_API_KEY, OPENAI_MODEL (server-only).

### Tests actually run (sandbox)

lint, typecheck, prettier, production build: pass. Vitest: 39 passed, 9 skipped (RLS tests need two real accounts). Covered: 21 engine tests (dedupe, sort, formulas, queries, verification, schema rejection), real XLSX/CSV import incl. corrupted file, context size. Smoke (curl): /api/ai/plan and export return 401 without a session, bad id 404, /workspace redirects to sign-in. No secrets in client bundle.

### NOT run (cannot be run in the sandbox)

Univer in a real browser (rendering, editing, facade calls, undo, restore), autosave to Supabase, XLSX open from real storage, OpenAI calls, export download, any live auth/RLS flow, responsive/visual match to reference. The Univer facade calls are type-checked against the installed 1.0.3 types but have never executed.

## Milestone 5: Integration phase (Phase 1D)

Pages now present (all linked from nav, all behind server-side protection in src/proxy.ts and the (app) layout): /dashboard (stats + recent), /workbooks (search, sort, create, upload, rename, delete), /workspace/[id], /settings (account, change password, data/AI note, sign out), /billing (plan + $10/month, display only), /help (guide + FAQ), plus public /, /privacy and /terms (drafts), auth pages. Sidebar contains only working links. Disabled "Soon" items and fake quick actions were removed.
Hardening: security headers (nosniff, frame deny, referrer, permissions), snapshot size CHECK (migration 20261005), server-side error logging with codes only (src/lib/log.ts), visible error codes for unknown auth errors, error/loading/not-found boundaries, route-integrity tests (every nav item and every literal href/redirect resolves to a real route; no "#" links; OpenAI key never in client code), proxy-coverage test.
Fixed during audit: new pages were missing from the proxy matcher (lost the return-to-page redirect); fixed and covered by a test.

### Status

WORKING (reported by the user): workspace opens and edits (user confirmed "Workspace works").
WORKING (verified in sandbox): lint, typecheck, production build; 49 unit tests pass (engine, import, context, routes, proxy, auth helpers); unauthenticated requests to every protected page redirect to sign-in with ?next=; 404 page; security headers present; no secrets in client bundle or git.
NOT VERIFIED (needs your Supabase/OpenAI, not possible in sandbox): real signup/verify/signin/reset flows, Supabase RLS cross-user test (tests/integration/rls.test.ts, 9 tests skipped until TEST_USER_* set), storage upload/delete against the real bucket, real OpenAI plans and full AI loop, export download, browser console/network inspection, responsive/visual checks on real devices, the 32-step end-to-end journey.
NOT IMPLEMENTED: payments, Phase 2 operations (move/copy ranges, true conditional-formatting rules, merge cells, charts, forecasting, PDF/image/web import), support contact, finalized legal text, shared rate limiter, replacing a workbook's source file.
Known: npm audit reports 2 moderate advisories via exceljs -> uuid (buffer bounds check when a caller passes its own buffer; ExcelJS does not do this with user input). Not force-fixed because the suggested fix downgrades exceljs to 3.4.0. Revisit in Phase 3.

## Phase 2 remaining / Phase 3 remaining

Phase 2: more operations, charts/dashboards, imports, forecasting. Phase 3: full E2E + load tests, rate limiting store, custom SMTP, payments, legal review, deployment.

## Milestone 5 — Priority 1 (rendering + timestamp)
Done (unit-tested, NOT browser-tested):
- XLSX import now preserves: values, formulas (+cached results), dates (serial + format), number formats, fonts, fills, borders, alignment/wrap, merges, column widths, row heights, freeze panes, gridlines, tab colour, hidden rows/cols/sheets.
- Unsupported features are reported in a dismissible banner (conditional formatting, data validation, images, filters, comments, rich text, hyperlinks, charts/pivots) and stored in `workbooks.import_notes`.
- Export (.xlsx) now writes styles, merges, sizes, freeze panes and real dates.
- "Last updated": DB trigger now bumps `updated_at` only on a real snapshot change or rename (migration `20261006000000_updated_at_real_changes.sql`); shown in local time via `LocalTime` (hydration-safe).
- Fixed a type error in `UniverSheet.tsx` (lifecycle behaviour unchanged).
Not done yet: Priorities 2–6.

## Milestone 5 — Priority 2 (attachments, microphone, clickable options)
Done (unit-tested, NOT browser-tested):
- Attach button: .csv/.tsv/.txt/.json up to 1 MB; preview chip; bounded text sent to AI as untrusted data; "Add as new sheet" for tables (deterministic, never overwrites).
- Images, PDFs, xlsx are rejected with an explicit message (no OCR/PDF reading yet; Priority 5).
- Microphone: browser SpeechRecognition; appends editable text only, never auto-sends; disabled where unsupported; permission errors shown.
- Clarifications can carry 2–4 clickable options; invalid options are dropped, not fatal.

## Milestone 5 — Priority 3 (AI operation architecture)
Pipeline (all pre-existing except where marked NEW): AI returns JSON plan -> Zod validation -> deterministic engine plans on a simulated copy -> preview/confirmation -> apply via Univer -> verification against the real sheet -> autosave -> "Undo last AI change".
- NEW: `src/lib/operations/registry.ts` is the single source of truth for operations; the AI prompt is generated from it; tests fail if registry, schema or prompt drift.
- NEW: every plan that changes the workbook now shows a preview and asks for confirmation. Opt-out checkbox "Apply non-destructive changes without asking" (per browser). Read-only queries run immediately.

## Milestone 5 — Priority 4 (core intelligence)
New deterministic operations (computed by the app, not the AI; unit-tested, NOT browser-tested):
- `detect_anomalies` (IQR or z-score; optional static highlight; optional result sheet)
- `forecast` (straight-line trend over rows in order; reports R² and limits)
- `merge_sheets` (stack sheets by header name into a NEW sheet; originals untouched)
- `find_errors` (formula errors, text inside numeric columns)
- `wrap_iferror` (wrap a column's formulas in IFERROR with a chosen fallback)
Existing ops cover: data entry (set_cells), cleaning (clean_text, find_replace, fill_blanks), duplicates, sorting, formatting, static highlight, Q&A/aggregation (query), formula columns (add_column).
NOT implemented (do not claim): live conditional-formatting rules, charts, dashboards, recurring/scheduled reports, formula explanation beyond the AI's text answer, seasonal forecasting, date-aware trends, PDF/image extraction (P5), web scraping (P5).

## Milestone 5 — Priority 5 (import, extraction, web)
Unit-tested in Node; NOT tested inside the running Next server or browser:
- Web page import (`/api/scrape`, globe button): static HTML tables only. SSRF controls: http/https only, ports 80/443, no credentials, localhost/.local/.internal blocked, ALL DNS answers must be public (v4+v6, mapped addresses), connection-time DNS re-validation (anti-rebinding), manual redirects re-validated per hop (max 4), 10 s timeout, 2 MB cap, HTML content-type only, login/bot blocks (401/403/429) and CAPTCHA pages are reported, never bypassed. Auth required, 8 requests/min per instance. No JavaScript rendering.
- PDF (text layer only, ≤30 pages) and DOCX (text + tables) via `/api/extract` (5 MB, zip-bomb check). Scanned PDFs are refused with an OCR-not-available message.
- Imported tables are added as a NEW sheet; text starting with = + - @ is prefixed with ' so web/file content can't become formulas.
- Images: still NOT supported (no OCR).
- next.config: `microphone=(self)` (was `()`, which blocked dictation); pdfjs-dist and mammoth are server-external packages.
