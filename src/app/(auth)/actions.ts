"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { CONFIG_ERROR, NETWORK_ERROR, mapAuthError } from "@/lib/auth/errors";
import { safeNext } from "@/lib/auth/redirect";
import {
  forgotSchema,
  formToObject,
  resetSchema,
  signInSchema,
  signUpSchema,
  validate,
} from "@/lib/validation/auth";

export type FormState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

async function client() {
  return getSupabaseEnv() ? await createClient() : null;
}

export async function signInAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const v = validate(signInSchema, formToObject(fd));
  if (!v.ok) return { fieldErrors: v.errors };
  const supabase = await client();
  if (!supabase) return { error: CONFIG_ERROR };
  try {
    const { error } = await supabase.auth.signInWithPassword(v.data);
    if (error) return { error: mapAuthError(error) };
  } catch {
    return { error: NETWORK_ERROR };
  }
  redirect(safeNext(String(fd.get("next") ?? "")));
}

export async function signUpAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const v = validate(signUpSchema, formToObject(fd));
  if (!v.ok) return { fieldErrors: v.errors };
  const supabase = await client();
  if (!supabase) return { error: CONFIG_ERROR };
  let hasSession = false;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: v.data.email,
      password: v.data.password,
      options: {
        emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/dashboard`,
      },
    });
    if (error) return { error: mapAuthError(error) };
    // With email confirmation on, an existing email returns a user with no identities.
    if (data.user && data.user.identities?.length === 0)
      return { error: mapAuthError({ code: "user_already_exists" }) };
    hasSession = !!data.session;
  } catch {
    return { error: NETWORK_ERROR };
  }
  if (hasSession) redirect("/dashboard");
  return {
    message:
      "Check your email for a confirmation link. You must verify your email before signing in.",
  };
}

export async function forgotPasswordAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const v = validate(forgotSchema, formToObject(fd));
  if (!v.ok) return { fieldErrors: v.errors };
  const supabase = await client();
  if (!supabase) return { error: CONFIG_ERROR };
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(v.data.email, {
      redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password`,
    });
    if (
      error &&
      (error.code === "over_email_send_rate_limit" ||
        error.code === "over_request_rate_limit" ||
        error.name === "AuthRetryableFetchError")
    ) {
      return { error: mapAuthError(error) };
    }
  } catch {
    return { error: NETWORK_ERROR };
  }
  // Same message whether or not the account exists (prevents account enumeration).
  return {
    message: "If an account exists for that email, a reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const v = validate(resetSchema, formToObject(fd));
  if (!v.ok) return { fieldErrors: v.errors };
  const supabase = await client();
  if (!supabase) return { error: CONFIG_ERROR };
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user)
      return { error: "This reset link has expired. Request a new one." };
    const { error } = await supabase.auth.updateUser({
      password: v.data.password,
    });
    if (error) return { error: mapAuthError(error) };
    await supabase.auth.signOut();
  } catch {
    return { error: NETWORK_ERROR };
  }
  redirect("/sign-in?notice=password_updated");
}

export async function signOutAction() {
  const supabase = await client();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Cookies are cleared by the redirect target regardless.
    }
  }
  redirect("/sign-in");
}
