import { buildLlmsFullTxt } from "@/server/docs/llms";

/** `/llms-full.txt` (spec §9.2): the same map with every key document inlined for one-shot context. */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  return new Response(await buildLlmsFullTxt(origin), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
