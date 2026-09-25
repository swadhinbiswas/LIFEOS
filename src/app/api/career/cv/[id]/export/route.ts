import { getServerSession } from "@/server/auth/session";
import { getResume } from "@/server/cv";
import { toJson, toMarkdown } from "@/server/cv/export";

/**
 * CV export (spec §6.3): `?format=json|md`. Session-authenticated and strictly the caller's own CV;
 * the print/PDF path is `/career/cv/[id]/print` (browser "Save as PDF" keeps selectable text).
 */
export const runtime = "nodejs";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "cv";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const detail = await getResume(session.user.id, id);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const filename = slugify(detail.summary.title);

  if (format === "json") {
    return new Response(toJson(detail.document), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }
  if (format === "md") {
    return new Response(toMarkdown(detail.document), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }
  return Response.json({ error: "unknown format" }, { status: 400 });
}
