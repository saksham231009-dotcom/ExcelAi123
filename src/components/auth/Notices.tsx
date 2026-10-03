import { Banner } from "./AuthUI";
import { getSupabaseEnv } from "@/lib/supabase/env";

const MESSAGES: Record<
  string,
  { kind: "error" | "success" | "info"; text: string }
> = {
  password_updated: {
    kind: "success",
    text: "Password updated. Sign in with your new password.",
  },
  link_invalid: {
    kind: "error",
    text: "That link is invalid, expired or already used. Request a new one.",
  },
  session_expired: {
    kind: "info",
    text: "Your session expired. Sign in again to continue.",
  },
  config: {
    kind: "error",
    text: "Supabase isn't configured. Add your keys to .env.local and restart the dev server.",
  },
};

export function Notices({ code }: { code?: string | string[] }) {
  const key = Array.isArray(code) ? code[0] : code;
  const m = key ? MESSAGES[key] : undefined;
  return (
    <>
      {!getSupabaseEnv() && (
        <div className="mb-4">
          <Banner kind="error">{MESSAGES.config.text}</Banner>
        </div>
      )}
      {m && key !== "config" && (
        <div className="mb-4">
          <Banner kind={m.kind}>{m.text}</Banner>
        </div>
      )}
    </>
  );
}
