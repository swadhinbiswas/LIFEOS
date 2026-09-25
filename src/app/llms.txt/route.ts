import { buildLlmsTxt } from "@/server/docs/llms";

/**
 * `/llms.txt` (spec §9.2): a short, public index of the product for AI agents. No user data, so no
 * session is required.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  return new Response(await buildLlmsTxt(origin), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
