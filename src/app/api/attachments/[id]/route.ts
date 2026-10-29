import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { attachments } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { readAttachmentBytes } from "@/server/storage/attachments";

type Params = { params: Promise<{ id: string }> };

/**
 * Authenticated download for a file attachment (ADR-140). Links are opened directly by the browser;
 * only `kind = 'file'` bytes go through here, so a link attachment 404s.
 */
export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession();
  if (!session) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const [row] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.user_id, session.user.id)))
    .limit(1);
  if (!row || row.kind !== "file" || !row.storage_key) {
    return new Response("not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readAttachmentBytes(row.storage_key);
  } catch {
    return new Response("not found", { status: 404 });
  }

  const name = row.name ?? "file";
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
