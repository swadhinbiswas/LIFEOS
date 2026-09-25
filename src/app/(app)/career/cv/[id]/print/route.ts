import { getServerSession } from "@/server/auth/session";
import { getResume } from "@/server/cv";
import { toHtml } from "@/server/cv/export";

/**
 * The CV as a print-ready document (spec §6.3). Opening this and using the browser's "Save as PDF"
 * produces a single-column PDF whose text stays selectable and ATS-parsable — no PDF library and no
 * images of text. Session-authenticated like every other surface.
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getServerSession();
  if (!session) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const detail = await getResume(session.user.id, id);
  if (!detail) return new Response("not found", { status: 404 });

  return new Response(toHtml(detail.document, detail.summary.title), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
