import { afterEach, describe, expect, it, vi } from "vitest";

import { idempotent } from "@/server/api/v1/support";
import { redis } from "@/server/redis/client";

const okResponse = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("idempotent Redis failures", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs the mutation when the replay cache cannot be read", async () => {
    vi.spyOn(redis, "get").mockRejectedValueOnce(new Error("redis unavailable"));
    const run = vi.fn(async () => okResponse());

    const response = await idempotent("user-1", "key-1", run);

    expect(run).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns the committed response when the replay cache cannot be written", async () => {
    vi.spyOn(redis, "set").mockRejectedValueOnce(new Error("redis unavailable"));

    const response = await idempotent("user-2", "key-2", okResponse);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
