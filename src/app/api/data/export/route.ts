import { getServerSession } from "@/server/auth/session";
import {
  CSV_MODULES,
  exportAll,
  moduleCsv,
  notesToMarkdown,
  toJsonResume,
  type CsvModule,
} from "@/server/data/export";

/**
 * Full data export (spec §10, ADR-083): `?format=json|md|resume|csv&module=…`. Session-authenticated
 * and strictly the caller's own data; the download is a real attachment so the browser saves it.
 */
export const runtime = "nodejs";

const attachment = (filename: string, contentType: string) => ({
  "content-type": contentType,
  "content-disposition": `attachment; filename="${filename}"`,
});

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);
  const data = await exportAll(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  if (format === "json") {
    return new Response(JSON.stringify(data, null, 2), {
      headers: attachment(`lifeos-export-${stamp}.json`, "application/json; charset=utf-8"),
    });
  }

  if (format === "md") {
    return new Response(notesToMarkdown(data.notes as Array<Record<string, unknown>>), {
      headers: attachment(`lifeos-notes-${stamp}.md`, "text/markdown; charset=utf-8"),
    });
  }

  if (format === "resume") {
    const resume = toJsonResume({
      name: session.user.name,
      skills: data.skills as Array<{ name: string; level?: number | null }>,
      projects: data.projects as Array<{
        name: string;
        description?: string | null;
        url?: string | null;
        language?: string | null;
      }>,
    });
    return new Response(JSON.stringify(resume, null, 2), {
      headers: attachment(`lifeos-resume-${stamp}.json`, "application/json; charset=utf-8"),
    });
  }

  if (format === "csv") {
    const moduleName = url.searchParams.get("module");
    if (!moduleName || !(CSV_MODULES as readonly string[]).includes(moduleName)) {
      return Response.json({ error: "unknown module" }, { status: 400 });
    }
    return new Response(
      moduleCsv(moduleName as CsvModule, data[moduleName as CsvModule] as unknown[]),
      {
        headers: attachment(`lifeos-${moduleName}-${stamp}.csv`, "text/csv; charset=utf-8"),
      },
    );
  }

  return Response.json({ error: "unknown format" }, { status: 400 });
}
