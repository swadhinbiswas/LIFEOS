import { describe, expect, it } from "vitest";

import {
  authErrorMessage,
  resetPasswordSchema,
  safeNext,
  signInSchema,
  signUpSchema,
} from "./auth-form";

describe("safeNext (open-redirect defense, spec §10)", () => {
  it("accepts same-origin paths", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/boards/abc?view=kanban")).toBe("/boards/abc?view=kanban");
    expect(safeNext("/")).toBe("/");
  });

  it("rejects cross-origin and protocol-relative targets", () => {
    expect(safeNext("https://evil.example")).toBe("/settings");
    expect(safeNext("//evil.example")).toBe("/settings");
    expect(safeNext("/\\evil.example")).toBe("/settings");
    expect(safeNext("settings")).toBe("/settings");
    expect(safeNext(null)).toBe("/settings");
    expect(safeNext(undefined)).toBe("/settings");
    expect(safeNext("")).toBe("/settings");
  });
});

describe("authErrorMessage", () => {
  it("maps known Better Auth codes to voice-consistent copy", () => {
    expect(
      authErrorMessage({ code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }),
    ).toContain("re-sends");
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", message: "…" })).toBe(
      "wrong email or password",
    );
    expect(authErrorMessage({ code: "INVALID_TOKEN", message: "invalid token" })).toContain(
      "request a new one",
    );
    expect(authErrorMessage({ code: "RATE_LIMIT_ERROR", message: "rate limit" })).toContain(
      "too many attempts",
    );
  });

  it("falls back to the server message, then to a generic line", () => {
    expect(authErrorMessage({ message: "custom server detail" })).toBe("custom server detail");
    expect(authErrorMessage(null)).toBe("something went wrong — try again");
    expect(authErrorMessage(undefined)).toBe("something went wrong — try again");
    expect(authErrorMessage(new Error("boom"))).toBe("something went wrong — try again");
  });

  it("matches the unverified case by message when the code is absent", () => {
    expect(authErrorMessage({ message: "Email not verified" })).toContain("open the link");
  });
});

describe("form schemas", () => {
  it("signIn requires a valid email and a password", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("signUp enforces the 8-character minimum and trims the name", () => {
    expect(
      signUpSchema.safeParse({ name: "  Ada  ", email: "a@b.co", password: "longenough" }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({ name: "Ada", email: "a@b.co", password: "short" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ name: "   ", email: "a@b.co", password: "longenough" }).success,
    ).toBe(false);
  });

  it("resetPassword requires confirmation to match, flagged on the confirm field", () => {
    const ok = resetPasswordSchema.safeParse({ password: "longenough", confirm: "longenough" });
    expect(ok.success).toBe(true);
    const bad = resetPasswordSchema.safeParse({ password: "longenough", confirm: "different1" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.path).toEqual(["confirm"]);
  });
});
