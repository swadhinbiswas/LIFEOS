import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import proxy from "./proxy";

const request = (pathname: string, cookie?: string): NextRequest =>
  new NextRequest(`http://localhost:3000${pathname}`, {
    headers: cookie ? { cookie } : undefined,
  });

describe("proxy redirect gate", () => {
  it("redirects a protected route when no session cookie is present", () => {
    const response = proxy(request("/settings"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location ?? "", "http://localhost:3000").pathname).toBe("/sign-in");
    expect(new URL(location ?? "", "http://localhost:3000").searchParams.get("next")).toBe(
      "/settings",
    );
  });

  it("lets a protected request with a cookie reach the authoritative app layout", () => {
    const response = proxy(request("/settings", "better-auth.session_token=stale"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("never redirects an auth page based on cookie presence", () => {
    const response = proxy(request("/sign-in", "better-auth.session_token=stale"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
