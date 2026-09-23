import { expect, test } from "@playwright/test";

/**
 * ADR-038: the first evaluation of the native libsql binding (`@libsql/client → libsql →
 * @neon-rs/load`) probes glibc with `process.report.getReport()`, which costs ~8 s per call on
 * a dev server whose heap is already warm from compiling the client bundle — two calls block
 * the event loop ~16 s and blow past test timeouts. Loading the `/api/auth` graph now, over a
 * plain HTTP request (the `request` fixture opens no browser, so no client chunks are
 * compiled), costs a few hundred ms on a small heap and keeps every test fast.
 */
test("warm the server auth graph", async ({ request }) => {
  const response = await request.get("/api/auth/get-session");
  expect(response.ok()).toBe(true);
});
