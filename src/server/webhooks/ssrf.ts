import { lookup } from "node:dns/promises";

/**
 * SSRF protection for server-side fetches to a URL the user supplied (spec §10).
 *
 * The one such surface today is outgoing webhook delivery: `createWebhook` stores a URL the user
 * types and `emitEvent` later fetches it from inside the deployment. Without a check that URL can
 * be `http://169.254.169.254/latest/meta-data/` or `http://10.0.0.5/`, and the response status the
 * delivery log records ("200") silently reports whether an internal service answered — the server
 * becomes a probe for the private network it runs in.
 *
 * Two rules do the work:
 *
 * - **Only global unicast addresses are reachable.** {@link isBlockedAddress} enumerates the
 *   ranges that must never be a fetch target (loopback, private, link-local incl. cloud metadata,
 *   CGNAT, ULA, multicast, unspecified, reserved). The enumeration is a deny-list, not an
 *   allow-list, so the *tests* can pin each range individually and a new range is one line.
 * - **Check at delivery time, not just at creation.** A hostname's address can change between when
 *   a webhook is saved and when it fires (DNS rebinding), so {@link assertDeliverableUrl} resolves
 *   immediately before every attempt. `redirect: "manual"` in the caller closes the other half of
 *   the hole — a public URL that 302s to `http://localhost/` — because the redirect is surfaced as
 *   a failed delivery instead of being followed.
 *
 * Residual risk, recorded honestly: between the resolve here and the connection the fetch opens,
 * a malicious resolver could answer differently (a narrow TOCTOU window). Pinning the connection to
 * the checked address needs a custom undici dispatcher and is not attempted; the window is
 * milliseconds and the attacker must already control a DNS server for the webhook's own host.
 */

/** The narrow slice of `dns.lookup` this module needs, so tests can inject a resolver. */
export type Resolver = (
  hostname: string,
  options: { all: true },
) => Promise<{ address: string; family: number }[]>;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u;

const ipv4Bytes = (address: string): number[] | null => {
  const match = IPV4.exec(address);
  if (!match) return null;
  const bytes = match.slice(1, 5).map(Number);
  return bytes.every((byte) => byte <= 255) ? bytes : null;
};

/** `fc00::/7` and friends, in the compressed forms a URL can carry. */
const isBlockedIpv6 = (address: string): boolean => {
  const value = address.toLowerCase().replace(/^\[|\]$/gu, "");

  // An IPv4-mapped or IPv4-compatible address (`::ffff:127.0.0.1`) is the IPv4 address wearing a
  // different hat, and the check has to come off before it counts as public.
  const mapped = /^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(value);
  if (mapped?.[1]) return isBlockedAddress(mapped[1]);
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(value);
  if (hexMapped) {
    const high = Number.parseInt(hexMapped[1]!, 16);
    const low = Number.parseInt(hexMapped[2]!, 16);
    return isBlockedAddress(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }

  if (value === "::" || value === "::1") return true; // unspecified, loopback
  const head = value.split(":").find((part) => part.length > 0) ?? "";
  if (!/^[0-9a-f]{1,4}$/u.test(head)) return false; // not a literal we can reason about
  const prefix = Number.parseInt(head.padStart(4, "0").slice(0, 4), 16);
  return (
    (prefix & 0xfe00) === 0xfc00 || // fc00::/7 unique-local
    (prefix & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (prefix & 0xff00) === 0xff00 // ff00::/8 multicast
  );
};

/**
 * Should a server-side fetch refuse to connect to `address`? (spec §10)
 *
 * Exported for the tests and for any future URL-fetching feature (job clipper, link previews) that
 * should share exactly one definition of "the private network".
 */
export function isBlockedAddress(address: string): boolean {
  const value = address.trim();
  const bytes = ipv4Bytes(value);
  if (bytes) {
    const [a = 0, b = 0] = bytes;
    return (
      a === 0 || // 0.0.0.0/8 "this network"
      a === 10 || // 10/8 private
      a === 127 || // 127/8 loopback
      (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
      (a === 169 && b === 254) || // 169.254/16 link-local, incl. 169.254.169.254 metadata
      (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
      (a === 192 && b === 0) || // 192.0.0/24 protocol assignments, 192.0.2/24 TEST-NET-1
      (a === 192 && b === 168) || // 192.168/16 private
      (a === 198 && (b === 18 || b === 19)) || // 198.18/15 benchmarking
      (a === 198 && b === 51) || // 198.51.100/24 TEST-NET-2
      (a === 203 && b === 0) || // 203.0.113/24 TEST-NET-3
      a >= 224 // 224/4 multicast, 240/4 reserved, 255.255.255.255 broadcast
    );
  }
  if (value.includes(":")) return isBlockedIpv6(value);
  return false;
}

/** A scheme/credentials problem the user can fix, or a host that must not be fetched. */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

export interface GuardOptions {
  /**
   * Permit private, loopback and link-local targets. Off in a deployment; a developer pointing a
   * webhook at a local listener needs it, and so does the suite that proves delivery works against
   * a real server. The operator turns it on explicitly (ADR-135).
   */
  allowPrivate?: boolean;
  /** Injected in tests; the real `dns.lookup` otherwise. */
  resolver?: Resolver;
}

const describe = (address: string): string => {
  if (ipv4Bytes(address))
    return address.startsWith("169.254") ? "link-local metadata address" : "private address";
  return "private address";
};

/**
 * The synchronous half: is this a URL a webhook may even be saved with?
 *
 * Called at creation so a user who pastes `http://localhost:3000/hook` is told immediately, rather
 * than discovering it in the delivery log after the first real event.
 */
export function assertDeliverableUrlShape(raw: string, options: GuardOptions = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("That is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedUrlError("Webhook URLs must use http or https.");
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("Webhook URLs must not embed credentials.");
  }
  if (options.allowPrivate) return url;
  if (url.hostname.replace(/^\[|\]$/gu, "").toLowerCase() === "localhost") {
    throw new BlockedUrlError("Webhook URLs cannot point at localhost.");
  }
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  if (isBlockedAddress(host)) {
    throw new BlockedUrlError(`Webhook URLs cannot point at a ${describe(host)}.`);
  }
  return url;
}

/**
 * The whole check, including the DNS answer the connection will actually use. Resolve fresh on
 * every attempt — see the module comment on rebinding.
 */
export async function assertDeliverableUrl(raw: string, options: GuardOptions = {}): Promise<URL> {
  const url = assertDeliverableUrlShape(raw, options);
  if (options.allowPrivate) return url;
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  if (isBlockedAddress(host)) return url; // already rejected above; kept for clarity of the IP path

  const resolver: Resolver = options.resolver ?? ((host, options2) => lookup(host, options2));
  let addresses: { address: string; family: number }[];
  try {
    addresses = await resolver(host, { all: true });
  } catch {
    throw new BlockedUrlError(`Could not resolve ${host}.`);
  }
  if (addresses.length === 0) throw new BlockedUrlError(`Could not resolve ${host}.`);
  const blocked = addresses.find((entry) => isBlockedAddress(entry.address));
  if (blocked) {
    throw new BlockedUrlError(`Webhook URLs cannot point at a ${describe(blocked.address)}.`);
  }
  return url;
}
