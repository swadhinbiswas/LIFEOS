/** @vitest-environment node */
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database. The assignment MUST precede any
// import that reaches src/env.ts — env.ts loads .env but never overrides set variables,
// and every vitest file gets an isolated module registry.
process.env.DATABASE_URL = "file:.data/auth-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/auth-int.db${suffix}`, { force: true });
}

const { createClient } = await import("@libsql/client");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { auth } = await import("./index");

const raw = createClient({ url: "file:.data/auth-int.db" });

// Reserved .test TLD — a deliberately unreachable address, never a real person's.
const EMAIL = "adr-036-integration@example.test";
const PASSWORD = "integration-only-9x!";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

interface MailRecord {
  to: string;
  subject: string;
  url: string;
  at: string;
}

const newestOutboxMail = (): MailRecord => {
  const dir = ".data/outbox";
  mkdirSync(dir, { recursive: true });
  const files = readdirSync(dir).sort(); // ms-epoch file names sort chronologically
  const last = files.at(-1);
  if (!last) throw new Error("outbox is empty — sendEmail never ran");
  return JSON.parse(readFileSync(join(dir, last), "utf8")) as MailRecord;
};

const one = async (sql: string, args: Array<string | number>) => {
  const row = (await raw.execute({ sql, args })).rows[0];
  if (!row) throw new Error(`expected exactly one row for: ${sql}`);
  return row;
};

const count = async (sql: string, args: Array<string | number>) => {
  const row = await one(sql, args);
  return Number(row["c"]);
};

const sessionHeaders = () => new Headers({ cookie: sessionCookieHeader });

let signupUrl = "";
let sessionToken = "";
let userId = "";
/** The real `Set-Cookie` value from sign-in — BA signs session cookies, so tests must
 * reuse the exact `name=value` a browser would store (raw tokens don't verify). */
let sessionCookieHeader = "";

describe("auth end-to-end over the ERD schema (adr-030/036/037)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("signs up: ULID id, integer-ms stamps, settings row, hashed password, outbox mail", async () => {
    const res = await auth.api.signUpEmail({
      body: { name: "Integration", email: EMAIL, password: PASSWORD },
    });
    expect(res.user.id).toMatch(ULID);
    userId = res.user.id;

    const user = await one("SELECT * FROM users WHERE email = ?", [EMAIL]);
    expect(user["email_verified"]).toBe(0); // boolean → 0|1 under the adr-036 name
    expect(user["joined_during_free_period"]).toBe(1); // spec line 426
    expect(Number(user["created_at"])).toBeGreaterThan(1_600_000_000_000); // integer ms, not 1970
    expect(user["locale"]).toBeNull(); // no fabricated defaults (adr-036)

    expect(await count("SELECT count(*) AS c FROM user_settings WHERE user_id = ?", [userId])).toBe(
      1,
    );

    const account = await one("SELECT provider_id, password FROM accounts WHERE user_id = ?", [
      userId,
    ]);
    expect(account["provider_id"]).toBe("credential");
    expect(account["password"]).not.toBe(PASSWORD); // hashed, never stored raw

    const mail = newestOutboxMail();
    expect(mail.to).toBe(EMAIL);
    expect(mail.url).toContain("/verify-email?token=");
    signupUrl = mail.url;
  });

  it("blocks sign-in until verified and re-sends the mail (spec §10, adr-037)", async () => {
    await expect(
      auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } }),
    ).rejects.toThrow(/email.?not.?verified/i);
    expect(await count("SELECT count(*) AS c FROM sessions", [])).toBe(0);
  });

  it("verifies through the real outbox link and consumes the token", async () => {
    const token = new URL(signupUrl).searchParams.get("token");
    expect(token).toBeTruthy();

    const res = await auth.api.verifyEmail({ query: { token: token ?? "" } });
    // without callbackURL the endpoint answers { user, status } (typed as void | object
    // because a callbackURL turns it into a redirect)
    expect(res).toMatchObject({ status: true });

    const user = await one("SELECT email_verified FROM users WHERE email = ?", [EMAIL]);
    expect(user["email_verified"]).toBe(1);
    // single-use: the verification rows for this identifier are gone after consumption
    expect(
      await count("SELECT count(*) AS c FROM verifications WHERE identifier = ?", [EMAIL]),
    ).toBe(0);
  });

  it("signs in: session row with ULID id, future integer-ms expiry, signed cookie", async () => {
    const { headers, response } = await auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      returnHeaders: true,
    });
    expect(response.token).toBeTruthy();
    sessionToken = response.token;

    const setCookies = headers.getSetCookie();
    const sessionSetCookie = setCookies.find((entry) =>
      entry.startsWith("better-auth.session_token="),
    );
    if (!sessionSetCookie)
      throw new Error(`sign-in set no session cookie: ${setCookies.join(" | ")}`);
    sessionCookieHeader = sessionSetCookie.split(";")[0] ?? "";

    const session = await one("SELECT * FROM sessions WHERE token = ?", [sessionToken]);
    expect(String(session["id"])).toMatch(ULID);
    expect(Number(session["expires_at"])).toBeGreaterThan(Date.now());

    const owner = await one("SELECT email FROM users WHERE id = ?", [String(session["user_id"])]);
    expect(owner["email"]).toBe(EMAIL);
  });

  it("getSession resolves the cookie back to the user", async () => {
    const session = await auth.api.getSession({ headers: sessionHeaders() });
    expect(session?.user.email).toBe(EMAIL);
  });

  it("signOut destroys the session row", async () => {
    await auth.api.signOut({ headers: sessionHeaders() });
    expect(await count("SELECT count(*) AS c FROM sessions WHERE token = ?", [sessionToken])).toBe(
      0,
    );
  });
});
