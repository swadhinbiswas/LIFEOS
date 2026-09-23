import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Shape written by src/server/email/index.ts (ADR-022). */
export interface OutboxMail {
  to: string;
  subject: string;
  url: string;
  at: string;
}

/**
 * The newest mail of one kind from the dev file-outbox. Runs are serial (workers: 1) and
 * global-setup empties the directory first, so the newest verify/reset file is always the
 * mail the action under test just produced — tests then follow this real signed URL
 * end to end instead of fabricating tokens.
 */
export function newestMail(kind: "verify" | "reset"): OutboxMail {
  const dir = join(process.cwd(), ".data", "outbox");
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(`-${kind}.json`))
    .sort();
  const latest = files.at(-1);
  if (latest === undefined) {
    throw new Error(`no "${kind}" mail in the outbox — the action under test never sent it`);
  }
  return JSON.parse(readFileSync(join(dir, latest), "utf8")) as OutboxMail;
}
