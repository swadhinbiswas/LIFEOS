import { getSharedResume } from "@/server/cv";
import { toHtml } from "@/server/cv/export";

/**
 * A shared CV (spec §6.3): `/cv/<slug>` serves the same print-ready HTML, but only while the owner
 * has sharing enabled. No session — the slug **is** the capability, so it is random, not guessable.
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const shared = await getSharedResume(slug);
  if (!shared) return new Response("not found", { status: 404 });

  return new Response(toHtml(shared.document, shared.title), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
