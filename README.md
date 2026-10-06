# ExcelAI

AI-powered spreadsheet app (in development). Next.js 16 + TypeScript + Tailwind + Supabase.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local`; fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key). Never use the service_role key.
3. Supabase Dashboard -> SQL Editor: paste and run `supabase/migrations/20261003000000_workbooks.sql`.
4. Supabase -> Authentication -> URL Configuration: Site URL `http://localhost:3000`; Redirect URLs: `http://localhost:3000/**`.
5. Run the second migration the same way: `supabase/migrations/20261004000000_workbook_snapshot.sql` (adds the spreadsheet storage column).
6. For AI: add `OPENAI_API_KEY` and `OPENAI_MODEL` to `.env.local` (server-only; never prefix with NEXT_PUBLIC_).
7. `npm run dev` and open http://localhost:3000.

Restart `npm run dev` after editing `.env.local` (NEXT_PUBLIC values are read at build/start).

## Auth notes

- Email confirmation ON (default): sign-up shows "check your email". Default email templates work as-is (PKCE `code` link).
- Local email sending is rate-limited by Supabase's built-in mailer. For heavy testing, turn "Confirm email" off temporarily.
- Reset flow: /forgot-password -> email link -> /auth/confirm -> /reset-password.

## Limits

Uploads: .xlsx and .csv, max 5 MB (private `workbooks` bucket, enforced in client, server, and bucket settings).
Uploaded files are stored only. They are not parsed or editable yet.

## Checks

**First, run `npm run check`** (tests your `.env.local` and database; prints PASS/FAIL only, never keys).

`npm run lint && npm run typecheck && npm test && npm run build`
Live ownership tests: set TEST_USER_A/B vars in `.env.local` (two confirmed accounts), then `npm test`.
