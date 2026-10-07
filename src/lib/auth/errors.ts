type AuthLikeError = {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
};

export const NETWORK_ERROR =
  "Can't reach the server. Check your connection and try again.";
export const CONFIG_ERROR =
  "Authentication isn't configured. Add your Supabase keys to .env.local and restart the dev server.";

/** Maps Supabase auth errors to user-friendly messages without leaking backend details. */
export function mapAuthError(err: AuthLikeError | null | undefined): string {
  if (!err) return "Something went wrong. Please try again.";
  if (err.name === "AuthRetryableFetchError" || err.status === 0)
    return NETWORK_ERROR;
  switch (err.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Verify your email first. Check your inbox for the confirmation link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in or reset your password.";
    case "weak_password":
      return "Choose a stronger password with at least 8 characters.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    case "signup_disabled":
      return "Sign-ups are currently disabled.";
    case "session_not_found":
    case "refresh_token_not_found":
    case "bad_jwt":
      return "Your session has expired. Sign in again.";
    default:
      return err.code
        ? `Something went wrong (${err.code}). Please try again.`
        : "Something went wrong. Please try again.";
  }
}
