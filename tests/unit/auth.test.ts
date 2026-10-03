import { describe, it, expect } from "vitest";
import { signUpSchema, signInSchema, validate } from "@/lib/validation/auth";
import { safeNext } from "@/lib/auth/redirect";
import { mapAuthError } from "@/lib/auth/errors";

describe("validation", () => {
  it("rejects short passwords", () => {
    const r = validate(signUpSchema, {
      email: "a@b.co",
      password: "short",
      confirmPassword: "short",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.password).toMatch(/8/);
  });
  it("rejects mismatched confirmation", () => {
    const r = validate(signUpSchema, {
      email: "a@b.co",
      password: "longenough1",
      confirmPassword: "different1",
    });
    expect(!r.ok && r.errors.confirmPassword).toBeTruthy();
  });
  it("normalizes email", () => {
    const r = validate(signInSchema, { email: "  A@B.CO ", password: "x" });
    expect(r.ok && r.data.email).toBe("a@b.co");
  });
  it("rejects invalid email", () => {
    expect(validate(signInSchema, { email: "nope", password: "x" }).ok).toBe(
      false,
    );
  });
});

describe("safeNext", () => {
  it("allows relative paths", () =>
    expect(safeNext("/workspace/1")).toBe("/workspace/1"));
  it("blocks open redirects", () => {
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "",
      null,
      undefined,
    ]) {
      expect(safeNext(bad as string)).toBe("/dashboard");
    }
  });
});

describe("mapAuthError", () => {
  it("maps known codes", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toMatch(/Incorrect/);
    expect(mapAuthError({ code: "email_not_confirmed" })).toMatch(/Verify/);
  });
  it("maps network errors", () => {
    expect(mapAuthError({ name: "AuthRetryableFetchError" })).toMatch(
      /connect|reach/i,
    );
  });
  it("does not leak unknown messages", () => {
    expect(
      mapAuthError({ code: "weird", message: "secret db detail" }),
    ).not.toMatch(/secret/);
  });
});
