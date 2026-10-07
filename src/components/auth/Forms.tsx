"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  changePasswordAction,
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from "@/app/(auth)/actions";
import {
  forgotSchema,
  formToObject,
  resetSchema,
  signInSchema,
  signUpSchema,
  validate,
  type FieldErrors,
} from "@/lib/validation/auth";
import type { z } from "zod";
import { Banner, Field, Submit } from "./AuthUI";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function useAuthForm(action: Action, schema: z.ZodType) {
  const [state, formAction, pending] = useActionState(action, {});
  const [local, setLocal] = useState<FieldErrors>({});
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const r = validate(schema, formToObject(new FormData(e.currentTarget)));
    if (!r.ok) {
      e.preventDefault();
      setLocal(r.errors);
    } else setLocal({});
  };
  const errors = { ...(state.fieldErrors ?? {}), ...local };
  return { state, formAction, pending, onSubmit, errors };
}

export function SignInForm({ next }: { next?: string }) {
  const f = useAuthForm(signInAction, signInSchema);
  return (
    <form
      action={f.formAction}
      onSubmit={f.onSubmit}
      noValidate
      className="space-y-4"
    >
      {f.state.error && <Banner kind="error">{f.state.error}</Banner>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={f.errors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={f.errors.password}
      />
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot password?
        </Link>
      </div>
      <Submit pending={f.pending}>
        {f.pending ? "Signing in…" : "Sign in"}
      </Submit>
    </form>
  );
}

export function SignUpForm() {
  const f = useAuthForm(signUpAction, signUpSchema);
  if (f.state.message) {
    return (
      <div className="space-y-4">
        <Banner kind="success">{f.state.message}</Banner>
        <Link
          href="/sign-in"
          className="block rounded-full border border-neutral-300 py-2.5 text-center text-sm font-medium hover:bg-neutral-50"
        >
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      action={f.formAction}
      onSubmit={f.onSubmit}
      noValidate
      className="space-y-4"
    >
      {f.state.error && <Banner kind="error">{f.state.error}</Banner>}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={f.errors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={f.errors.password}
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={f.errors.confirmPassword}
      />
      <Submit pending={f.pending}>
        {f.pending ? "Creating account…" : "Create account"}
      </Submit>
    </form>
  );
}

export function ForgotForm() {
  const f = useAuthForm(forgotPasswordAction, forgotSchema);
  return (
    <form
      action={f.formAction}
      onSubmit={f.onSubmit}
      noValidate
      className="space-y-4"
    >
      {f.state.error && <Banner kind="error">{f.state.error}</Banner>}
      {f.state.message && <Banner kind="success">{f.state.message}</Banner>}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={f.errors.email}
      />
      <Submit pending={f.pending}>
        {f.pending ? "Sending…" : "Send reset link"}
      </Submit>
    </form>
  );
}

export function ResetForm() {
  const f = useAuthForm(resetPasswordAction, resetSchema);
  return (
    <form
      action={f.formAction}
      onSubmit={f.onSubmit}
      noValidate
      className="space-y-4"
    >
      {f.state.error && (
        <Banner kind="error">
          {f.state.error}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </Banner>
      )}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={f.errors.password}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={f.errors.confirmPassword}
      />
      <Submit pending={f.pending}>
        {f.pending ? "Saving…" : "Set new password"}
      </Submit>
    </form>
  );
}

export function ChangePasswordForm() {
  const f = useAuthForm(changePasswordAction, resetSchema);
  return (
    <form
      action={f.formAction}
      onSubmit={f.onSubmit}
      noValidate
      className="max-w-sm space-y-4"
    >
      {f.state.error && <Banner kind="error">{f.state.error}</Banner>}
      {f.state.message && <Banner kind="success">{f.state.message}</Banner>}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={f.errors.password}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={f.errors.confirmPassword}
      />
      <Submit pending={f.pending}>
        {f.pending ? "Saving…" : "Change password"}
      </Submit>
    </form>
  );
}
