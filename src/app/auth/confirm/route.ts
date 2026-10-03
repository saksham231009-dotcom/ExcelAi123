import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { safeNext } from "@/lib/auth/redirect";

const OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/** Handles email links: PKCE `code` (default templates) or `token_hash` (custom templates). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const failure = next === "/reset-password" ? "/forgot-password" : "/sign-in";
  const fail = () =>
    NextResponse.redirect(`${origin}${failure}?error=link_invalid`);
  if (!getSupabaseEnv())
    return NextResponse.redirect(`${origin}/sign-in?error=config`);

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  try {
    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  } catch {
    // fall through to failure redirect
  }
  return fail();
}
