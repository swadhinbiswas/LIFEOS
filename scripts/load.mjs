/**
 * Load test (spec §14 Phase 9). A dependency-free concurrency check: it fires N requests with a
 * fixed concurrency at a target URL and prints throughput and p50/p95 latency.
 *
 *   pnpm start                # in another terminal
 *   node scripts/load.mjs     # defaults to http://localhost:3000/api/health
 *   node scripts/load.mjs http://localhost:3000/api/v1/cards 200 20
 *
 * Against an authenticated route, pass a Bearer key via LIFEOS_API_KEY.
 */

const url = process.argv[2] ?? "http://localhost:3000/api/health";
const total = Number(process.argv[3] ?? 200);
const concurrency = Number(process.argv[4] ?? 20);
const apiKey = process.env.LIFEOS_API_KEY;

const latencies = [];
let failures = 0;
let index = 0;

const timedFetch = async () => {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    });
    await response.arrayBuffer();
    if (!response.ok) failures += 1;
  } catch {
    failures += 1;
  }
  latencies.push(performance.now() - started);
};

const worker = async () => {
  while (index < total) {
    index += 1;
    await timedFetch();
  }
};

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[at] ?? 0;
};

const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const elapsed = (performance.now() - started) / 1000;

console.info(`[load] ${url}`);
console.info(
  `[load] ${total} requests · concurrency ${concurrency} · ${(total / elapsed).toFixed(1)} req/s · ` +
    `p50 ${percentile(latencies, 50).toFixed(0)}ms · p95 ${percentile(latencies, 95).toFixed(0)}ms · ` +
    `${failures} failed`,
);
process.exit(failures > 0 ? 1 : 0);
