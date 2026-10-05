// Run with: npm run check
// Reads .env.local on YOUR machine. Prints PASS/FAIL only, never key values.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let failed = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m, fix) => {
  failed++;
  console.log(`FAIL  ${m}${fix ? `\n      Fix: ${fix}` : ""}`);
};

// 1. Env vars present
if (!url || url.startsWith("your-"))
  fail(
    "NEXT_PUBLIC_SUPABASE_URL is missing",
    "Add it to .env.local (Supabase -> Project Settings -> API).",
  );
else pass("NEXT_PUBLIC_SUPABASE_URL is set");
if (!key || key.startsWith("your-"))
  fail(
    "Supabase publishable/anon key is missing",
    "Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
  );
else pass("Supabase publishable/anon key is set");
if (process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log(
    "WARN  SUPABASE_SERVICE_ROLE_KEY is present. This app doesn't need it; remove it from .env.local.",
  );
if (!url || !key || url.startsWith("your-") || key.startsWith("your-"))
  finish();

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL is not a valid URL",
    "It should look like https://xxxx.supabase.co",
  );
  finish();
}

// 2. Reachable + key accepted + email confirmation setting
try {
  const res = await fetch(`${parsed.origin}/auth/v1/settings`, {
    headers: { apikey: key },
  });
  if (res.ok) {
    const s = await res.json();
    pass("Supabase Auth is reachable and the key is accepted");
    console.log(
      `INFO  Email confirmation is ${s.mailer_autoconfirm ? "OFF (users sign in right after sign-up)" : "ON (users must click the email link)"}`,
    );
    if (s.disable_signup)
      fail(
        "Sign-ups are disabled in Supabase",
        "Authentication -> Sign In / Providers -> enable 'Allow new users to sign up'.",
      );
  } else
    fail(
      `Supabase Auth responded with HTTP ${res.status}`,
      "Check the URL and key are from the same project.",
    );
} catch {
  fail(
    "Could not reach Supabase",
    "Check your internet connection and that the URL is correct.",
  );
  finish();
}

// 3. workbooks table exists (migration applied)
try {
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("workbooks").select("id").limit(1);
  if (!error) pass("Table 'workbooks' exists (migration applied)");
  else if (
    error.code === "PGRST205" ||
    /could not find the table/i.test(error.message ?? "")
  )
    fail(
      "Table 'workbooks' not found",
      "Run supabase/migrations/20261003000000_workbooks.sql in Supabase -> SQL Editor.",
    );
  else
    fail(
      `Could not query 'workbooks' (${error.code ?? "error"})`,
      "Re-run the migration in the SQL Editor.",
    );
} catch {
  fail("Could not query the database");
}

finish();

function finish() {
  console.log(
    failed
      ? `\n${failed} check(s) failed.`
      : "\nAll checks passed. You can run: npm run dev",
  );
  process.exit(failed ? 1 : 0);
}
