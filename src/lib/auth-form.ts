import { z } from "zod";

/**
 * Auth form schemas + pure helpers shared by the (auth) pages.
 *
 * These guard the *client* experience; Better Auth validates again on the server (Zod at
 * every boundary, spec §10) — the rules here mirror its config: password minimum 8
 * (better-auth default), email via `z.email()`.
 */

export const signInSchema = z.object({
  email: z.email("enter a valid email"),
  password: z.string().min(1, "password is required"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(64, "keep it under 64 characters"),
  email: z.email("enter a valid email"),
  password: z.string().min(8, "at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "at least 8 characters"),
    confirm: z.string().min(8, "at least 8 characters"),
  })
  .refine((values) => values.password === values.confirm, {
    message: "passwords don't match",
    path: ["confirm"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * Resolve a `?next=…` redirect to a same-origin path only, so a crafted link can never
 * bounce a fresh sign-in to another host (open-redirect defense, spec §10).
 * Blocks absolute URLs, `//host` protocol-relative forms and `/\host` backslash tricks.
 */
export const safeNext = (raw: string | null | undefined): string =>
  typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
    ? raw
    : "/settings";

/** Copy for Better Auth error payloads; codes checked against better-auth 1.7.5 routes. */
const FALLBACK = "something went wrong — try again";

export function authErrorMessage(error: unknown): string {
  const payload = error as { code?: string; message?: string } | null | undefined;
  const code = typeof payload?.code === "string" ? payload.code : "";
  const message = typeof payload?.message === "string" ? payload.message : "";

  if (code === "EMAIL_NOT_VERIFIED" || /email not verified/i.test(message)) {
    return "email not verified yet — open the link we mailed you; signing in again re-sends it";
  }
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "wrong email or password";
  if (code === "USER_ALREADY_EXISTS")
    return "an account with that email already exists — sign in instead";
  if (code === "PASSWORD_TOO_SHORT") return "passwords must be at least 8 characters";
  if (code === "INVALID_TOKEN" || /invalid or expired/i.test(message)) {
    return "this link expired or was already used — request a new one";
  }
  if (code === "RATE_LIMIT_ERROR") return "too many attempts — wait a moment and try again";
  // Better Auth payloads carry a `code` and curated messages; a bare Error is an
  // unexpected client/JS failure — show the generic line instead of leaking internals.
  if (code) return message || FALLBACK;
  if (error instanceof Error) return FALLBACK;
  return message || FALLBACK;
}
