"use server";

import { ZodError } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { saveLayout } from "@/server/dashboard/widgets";
import type { LayoutInput } from "@/config/dashboard-widgets";

export async function saveLayoutAction(input: unknown): Promise<ActionResult<LayoutInput>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await saveLayout(session.user.id, input) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that layout is not valid" };
    }
    console.error("[dashboard] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}
