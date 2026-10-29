import { ImapFlow } from "imapflow";

export interface EmailMessage {
  uid: number;
  subject: string;
  from: string;
  fromName: string;
  date: string;
  unread: boolean;
  /** Gmail web link, when the host is Gmail. */
  gmailLink: string | null;
  /** First ~500 chars of the text body, for the AI summary. */
  preview: string;
}

export interface ImapCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  mailbox: string;
}

function gmailLink(host: string, uid: number): string | null {
  if (!/gmail\.com$/i.test(host)) return null;
  return `https://mail.google.com/mail/u/0/#inbox/${uid}`;
}

/**
 * Fetch the most recent `limit` messages from a mailbox, newest first.
 * Read-only: we never mark, move or delete anything.
 */
export async function fetchRecent(
  credentials: ImapCredentials,
  limit = 30,
): Promise<EmailMessage[]> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: true,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock(credentials.mailbox);
  const out: EmailMessage[] = [];
  try {
    const status = await client.status(credentials.mailbox, { messages: true });
    const total = (status && "messages" in status ? status.messages : 0) ?? 0;
    if (total === 0) return out;
    const start = Math.max(1, total - limit + 1);
    const range = `${start}:${total}`;
    for await (const msg of client.fetch(range, {
      envelope: true,
      flags: true,
      bodyStructure: true,
    })) {
      const env = msg.envelope;
      const from = env?.from?.[0];
      out.push({
        uid: msg.uid,
        subject: env?.subject ?? "(no subject)",
        from: from?.address ?? "",
        fromName: from?.name ?? from?.address ?? "",
        date: (env?.date instanceof Date
          ? env.date
          : new Date(env?.date ?? Date.now())
        ).toISOString(),
        unread: !msg.flags?.has("\\Seen"),
        gmailLink: gmailLink(credentials.host, msg.uid),
        preview: "",
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return out.reverse();
}

/**
 * Fetch messages that arrived in the last `hours` hours, with a short text preview, for the
 * AI summary. Capped at 60.
 */
export async function fetchForSummary(
  credentials: ImapCredentials,
  hours = 24,
  cap = 60,
): Promise<Array<{ from: string; subject: string; preview: string; date: string }>> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: true,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock(credentials.mailbox);
  const out: Array<{ from: string; subject: string; preview: string; date: string }> = [];
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const uids = await client.search({ since }, { uid: true });
    const list = (Array.isArray(uids) ? uids : []).slice(-cap);
    if (list.length === 0) return out;
    for await (const msg of client.fetch(list, { envelope: true, source: true }, { uid: true })) {
      const env = msg.envelope;
      const from = env?.from?.[0];
      let preview = "";
      if (msg.source) {
        const text = msg.source.toString("utf8");
        // Strip headers, take the first ~500 chars of body.
        const bodyStart = text.indexOf("\r\n\r\n");
        preview = (bodyStart >= 0 ? text.slice(bodyStart + 4) : text).slice(0, 500).trim();
      }
      out.push({
        from: from?.address ?? from?.name ?? "",
        subject: env?.subject ?? "(no subject)",
        preview,
        date: (env?.date instanceof Date
          ? env.date
          : new Date(env?.date ?? Date.now())
        ).toISOString(),
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return out;
}

/** Verify credentials by connecting and opening the mailbox. Throws on failure. */
export async function testConnection(credentials: ImapCredentials): Promise<void> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: true,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock(credentials.mailbox);
  lock.release();
  await client.logout();
}
