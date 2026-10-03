"use client";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { FieldErrors } from "@/lib/validation/auth";

export function Field({
  label,
  name,
  type = "text",
  error,
  autoComplete,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  error?: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  const id = `f-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-neutral-900"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPw && show ? "text" : type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          required
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 aria-[invalid=true]:border-red-600"
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-3 text-neutral-500 hover:text-neutral-900"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Submit({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
    >
      {pending && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Banner({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const style =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : kind === "success"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-neutral-200 bg-neutral-50 text-neutral-700";
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-lg border p-3 text-sm ${style}`}
    >
      {children}
    </p>
  );
}

export function mergeErrors(
  local: FieldErrors,
  server?: FieldErrors,
): FieldErrors {
  return { ...(server ?? {}), ...local };
}
