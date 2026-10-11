# Milestone 5 — Final Report

## 1. Summary
P1 upload rendering + timestamp; P2 attach/mic/MCQ; P3 operation registry + preview; P4 anomaly/forecast/merge/errors/IFERROR; P5 web table import (SSRF-safe), PDF/DOCX extraction; P6 explain formula, data health, rule suggestions, live-formula dashboard, reversible header style, response-quality prompt, security hardening. Payments untouched.

## 2. Files
New: src/lib/workbooks/{xlsx-style,export}.ts, src/components/app/LocalTime.tsx, src/components/workspace/useSpeech.ts, src/lib/ai/attachment.ts, src/lib/operations/{registry,analytics,insights}.ts, src/lib/net/ssrf.ts, src/lib/extract/{html-tables,documents}.ts, src/app/api/{scrape,extract}/route.ts, supabase/migrations/20261006000000_updated_at_real_changes.sql, tests (rendering, updated-at-trigger, attachment, registry, analytics, insights, import-web) + tests/fixtures.
Modified: import.ts, snapshot.ts, load.ts, export route, workspace page, WorkbookList, WorkspaceClient/Loader, UniverSheet (type fix only), AiPanel, prompt.ts, schema.ts, engine.ts, plan route, next.config.ts, .env.example (placeholders only), package.json, PROJECT_STATUS.md.

## 3. Root causes
- Plain uploads: importer read only cell values; styles, widths, heights, merges, freeze and dates were discarded and the snapshot was built with empty styles. Export wrote values/formulas only.
- Wrong "last updated": a DB trigger bumped updated_at on every UPDATE, including the silent first-open snapshot creation; the UI showed server-computed relative text.

## 4. The 24 areas (genuine = implemented + unit-tested; browser behaviour NOT TESTED)
Supported: 1 repetitive entry (set_cells, add_column formulas, fill_blanks, attach CSV/web/PDF/DOCX tables -> new sheet); 2 error verification (find_errors, data_health, post-apply verification); 3 scattered info (merge_sheets); 6 data readiness (data_health, clean_text, remove_duplicates, fill_blanks); 7 dashboards that explain (dashboard "What stands out", static as-of-creation); 11 which rules to create (suggest_rules); 13 broken formulas (find_errors, wrap_iferror); 14 trends (forecast, dashboard trend line); 15 NL questions (query); 16 NL control (19+ validated operations, preview/confirm, undo); 17 messy data (clean_text, find_replace, data_health); 18 duplicates/errors (remove_duplicates, find_errors, data_health); 19 dashboard creation (create_dashboard, live formulas, no charts); 21 automatic problem detection (detect_anomalies, data_health); 22 formula explanations (explain_formula); 23 forecasting (linear only); 24 extraction (CSV/TSV/TXT/JSON, PDF text layer, DOCX, static HTML tables).
Partial: 4 manual dashboard updates (dashboard numbers are live formulas; category list is fixed at creation); 8 formatting rules (static highlight/format only); 9 important values easy to miss (static highlight); 12 too many rules (suggestions capped at 8).
NOT supported: 5 disconnected data sources (no live connectors); 10 rules breaking when data changes (no live conditional-formatting rules); 20 recurring reports (no scheduler); charts; seasonal forecasting; OCR/images.

## 5. Extraction formats
Work: CSV, TSV, TXT, JSON (1 MB); PDF with a text layer (5 MB, 30 pages); DOCX text+tables (5 MB); static HTML tables from public pages. Not: scanned PDFs, images, XLSX as attachment (upload as workbook instead), JavaScript-rendered pages, pages behind login/CAPTCHA.

## 6. Incomplete and why
Live conditional formatting, charts, scheduled/recurring reports, data connectors, OCR: need new editor plugins, a scheduler/worker or an OCR/vision service that were not part of the verified stack. Rate limits are per server instance (use a shared store before launch). No CSP header yet (Univer compatibility needs testing).

## 7. Tests
PASS (automated, 99 tests): XLSX formatting round trip, formula-heavy/multi-sheet/CSV import, export round trip, trigger behaviour on real Postgres engine (PGlite), registry/schema/prompt sync, attachments, options, analytics, insights, SSRF, HTML tables, PDF, DOCX. Lint, typecheck, production build: PASS.
NOT TESTED: anything in a real browser (Univer rendering, upload look, dictation, UI buttons, hydration), live Supabase RLS integration (9 skipped), live AI provider calls, /api/scrape and /api/extract inside the running Next server, real network fetches.
FAIL: none known.

## 8. Env vars and migrations
Env (names only): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_APP_URL; server-only OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL. No new variables. Migration to run: 20261006000000_updated_at_real_changes.sql (adds workbooks.import_notes, replaces set_updated_at()).

## 9. Applying to local VS Code
1. Close dev server. 2. Unzip excelai-m5-final.zip over the project root (same paths; replaces files). 3. `npm install`. 4. Supabase SQL editor: run the migration file. 5. `npm run typecheck && npm test && npm run dev`. 6. Re-upload your Excel file (existing workbooks keep their old snapshot).

## 10. Manual browser tests
Upload formatted XLSX and compare with Excel; open without editing -> "last updated" unchanged; edit -> changes; export and reopen in Excel; attach CSV -> Add as new sheet; attach PNG -> rejected; attach PDF/DOCX; dictate (mic permission, text unsent); ask an ambiguous request -> option buttons; web import of a public table page; try localhost/169.254.169.254 links -> refused; "create a dashboard", "explain D2", "check data health", "suggest highlights"; Style header + undo; Undo last AI change; two-account RLS check.

## 11. Regression
Auth, persistence (autosave/optimistic version), RLS migrations, AICredits base-URL support and the Univer deferred-dispose fix are untouched in logic (UniverSheet got a type-only refactor that keeps the same lifecycle); automated tests for them (49 earlier) still pass; browser confirmation is NOT TESTED.

## Security audit notes
Fixed: .env.example now placeholders only (a real-looking key was in git history: rotate it, which you said you did; consider making the repo private); uuid advisory removed via override; microphone permission policy corrected. Accepted: sprintf-js/argparse advisory in mammoth (CLI-only path, no user-controlled format strings). Checked: no NEXT_PUBLIC AI key, no service-role key in code, no dangerouslySetInnerHTML/eval, all API routes authenticate, web/attachment content treated as untrusted data and formula-neutralised.
