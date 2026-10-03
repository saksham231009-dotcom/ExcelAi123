# PROJECT_STATUS — ExcelAI

## Objective

AI-powered spreadsheet SaaS: natural-language requests -> validated plan -> deterministic operations on real workbooks.

## Stack

Next.js (App Router) + TypeScript, Tailwind v4, Supabase (Postgres/Auth/Storage/RLS), OpenAI (server-side), Zod (planned), ExcelJS + Papa Parse (planned), Vitest, Prettier, ESLint, Vercel.
Grid library: undecided (Univer vs Glide Data Grid; decide in Phase 1 Step 5).

## Structure

src/app (routes), src/components, src/lib/{auth,db,storage,workbook,operations,ai,validation,security}, supabase/migrations, tests/unit.

## Current phase / task

Phase 1, Milestone 1 (scaffold): DONE.

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
