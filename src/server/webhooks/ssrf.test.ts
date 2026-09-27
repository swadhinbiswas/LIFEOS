import { describe, expect, it } from "vitest";

import {
  assertDeliverableUrl,
  assertDeliverableUrlShape,
  BlockedUrlError,
  isBlockedAddress,
} from "./ssrf";

/**
 * The SSRF guard (ADR-135). Every range is pinned individually, because the failure mode this
 * protects against — the server answering a request to a private address — is invisible until it
 * is exploited, and a deny-list is only as good as the ranges someone remembered to write down.
 */

const resolveTo =
  (...addresses: string[]) =>
  async () =>
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

describe("isBlockedAddress", () => {
  it("blocks loopback, private, link-local, CGNAT and metadata ranges", () => {
    for (const address of [
      "0.0.0.0",
      "10.0.0.1",
      "10.255.255.255",
      "100.64.0.1",
      "127.0.0.1",
      "127.1.2.3",
      "169.254.0.1",
      "169.254.169.254", // the cloud metadata endpoint
      "172.16.0.1",
      "172.31.255.254",
      "192.0.0.1",
      "192.168.1.1",
      "198.18.0.1",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it("blocks the IPv6 forms that wrap a private IPv4 address", () => {
    for (const address of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "::ffff:7f00:1",
      "[::1]",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it("allows global unicast addresses", () => {
    for (const address of [
      "8.8.8.8",
      "93.184.216.34",
      "172.15.0.1",
      "172.32.0.1",
      "2606:4700::1111",
    ]) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });
});

describe("assertDeliverableUrlShape", () => {
  it("rejects a non-http scheme, credentials and a literal private host", () => {
    expect(() => assertDeliverableUrlShape("ftp://example.com/hook")).toThrow(BlockedUrlError);
    expect(() => assertDeliverableUrlShape("https://user:pass@example.com/hook")).toThrow(
      BlockedUrlError,
    );
    expect(() => assertDeliverableUrlShape("http://127.0.0.1:3000/hook")).toThrow(
      /private address/u,
    );
    expect(() => assertDeliverableUrlShape("http://169.254.169.254/latest/meta-data")).toThrow(
      /metadata/u,
    );
    expect(() => assertDeliverableUrlShape("http://localhost:3000/hook")).toThrow(/localhost/u);
  });

  it("accepts a public https endpoint, and a local one only when the operator opts in", () => {
    expect(assertDeliverableUrlShape("https://hooks.example.com/lifeos").toString()).toBe(
      "https://hooks.example.com/lifeos",
    );
    expect(
      assertDeliverableUrlShape("http://127.0.0.1:3000/hook", { allowPrivate: true }).toString(),
    ).toBe("http://127.0.0.1:3000/hook");
    // The opt-out covers addresses, not schemes or embedded credentials.
    expect(() => assertDeliverableUrlShape("ftp://127.0.0.1/hook", { allowPrivate: true })).toThrow(
      BlockedUrlError,
    );
  });
});

describe("assertDeliverableUrl", () => {
  it("refuses a hostname that resolves to a private address", async () => {
    await expect(
      assertDeliverableUrl("https://internal.example.com/hook", {
        resolver: resolveTo("10.0.0.5"),
      }),
    ).rejects.toThrow(/private address/u);
    // One bad address among good ones is still a no: the client may pick it.
    await expect(
      assertDeliverableUrl("https://rebind.example.com/hook", {
        resolver: resolveTo("93.184.216.34", "127.0.0.1"),
      }),
    ).rejects.toThrow(BlockedUrlError);
  });

  it("refuses a name that does not resolve, or resolves to nothing", async () => {
    const failing = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(
      assertDeliverableUrl("https://nope.example.com/hook", { resolver: failing }),
    ).rejects.toThrow(/Could not resolve/u);
    await expect(
      assertDeliverableUrl("https://empty.example.com/hook", { resolver: resolveTo() }),
    ).rejects.toThrow(/Could not resolve/u);
  });

  it("allows a hostname that resolves to a public address", async () => {
    const url = await assertDeliverableUrl("https://hooks.example.com/lifeos", {
      resolver: resolveTo("93.184.216.34", "2606:4700::1111"),
    });
    expect(url.hostname).toBe("hooks.example.com");
  });

  it("skips resolution entirely when private targets are allowed", async () => {
    const never = async () => {
      throw new Error("should not resolve");
    };
    const url = await assertDeliverableUrl("http://127.0.0.1:3000/hook", {
      allowPrivate: true,
      resolver: never,
    });
    expect(url.hostname).toBe("127.0.0.1");
  });
});
