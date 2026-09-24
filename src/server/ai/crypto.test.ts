/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, isEncryptionConfigured, maskSecret } from "./crypto";

describe("AI at-rest encryption (spec §10, adr-074)", () => {
  it("round-trips a provider key without storing it in the clear", () => {
    const plaintext = "sk-test-1234567890-abcdef";
    const payload = encryptSecret(plaintext);
    expect(payload).not.toContain(plaintext);
    // iv.tag.ciphertext
    expect(payload.split(".")).toHaveLength(3);
    expect(decryptSecret(payload)).toBe(plaintext);
  });

  it("rejects a tampered payload (GCM authentication)", () => {
    const payload = encryptSecret("sk-test-1234567890-abcdef");
    const [iv, tag, data] = payload.split(".");
    const flipped = Buffer.from(data!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    const tampered = [iv, tag, flipped.toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("reveals only the last four characters", () => {
    expect(maskSecret("sk-abcdef1234")).toBe("••••1234");
    expect(maskSecret("abc")).toBe("••••");
  });

  it("has a usable key in dev/test", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });
});
