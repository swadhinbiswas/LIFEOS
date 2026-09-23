import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Resend } from "resend";

import { APP_NAME } from "@/config/app";
import { env, hasResend } from "@/env";

/**
 * ADR-022: one `sendEmail()` port, two transports — Resend when RESEND_API_KEY is present,
 * otherwise a dev file outbox in `.data/outbox/` (gitignored) that also logs the signed
 * URL. The Playwright suite reads the newest outbox file and follows the *real* link, so
 * tokens, DB writes and route handlers are exercised end-to-end; only the transport differs.
 *
 * Failure policy: an outbox write throws — in dev/test a mail that didn't land must fail
 * loudly. A Resend error is logged and swallowed so sign-up never dies mid-flight; the
 * user recovers by signing in again (ADR-037 `sendOnSignIn` re-send) and the URL stays in
 * the server log.
 *
 * Only two mails ship in the MVP (verify + reset); React Email templates wait for a
 * transport that actually needs them (ADR-022).
 */

const OUTBOX_DIR = join(process.cwd(), ".data", "outbox");

const resend = hasResend && env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  /** The single action URL (verify/reset) — recorded for the E2E outbox reader. */
  url: string;
  /** File-name discriminator only: "verify" | "reset". */
  kind: "verify" | "reset";
}

export async function sendEmail({ to, subject, text, url, kind }: OutboundEmail): Promise<void> {
  if (!resend) {
    mkdirSync(OUTBOX_DIR, { recursive: true });
    const file = join(OUTBOX_DIR, `${Date.now()}-${kind}.json`);
    // ADR-022 record shape: { to, subject, url, at } — nothing else (no bodies, no PII
    // beyond the recipient the flow already addresses).
    writeFileSync(file, JSON.stringify({ to, subject, url, at: new Date().toISOString() }), "utf8");
    console.info(`[email:${kind}] outbox → ${file}\n  ${url}`);
    return;
  }

  // Resend's shared dev domain until EMAIL_FROM is configured for production.
  const from = env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`;
  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) {
    console.error(`[email:${kind}] resend failed: ${error.name}: ${error.message}`);
    console.error(`[email:${kind}] action url (recoverable via re-send): ${url}`);
  }
}
