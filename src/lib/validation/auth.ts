import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email.")
  .email("Enter a valid email address.")
  .max(254);
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.");
const mismatch = {
  path: ["confirmPassword"],
  message: "Passwords don't match.",
};

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export const forgotSchema = z.object({ email });
export const signUpSchema = z
  .object({ email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, mismatch);
export const resetSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, mismatch);

export type FieldErrors = Record<string, string>;

export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; errors: FieldErrors } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

export function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  return o;
}
