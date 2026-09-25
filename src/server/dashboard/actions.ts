"use server";

import { z, ZodError } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { saveLayout } from "@/server/dashboard/widgets";
import type { LayoutInput } from "@/config/dashboard-widgets";
import { DASHBOARD_VARIANTS } from "@/config/dashboard-widgets";
import { templateLayout } from "@/config/dashboard-templates";

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

/**
 * Apply a starter layout (ADR-108). The template is expanded in config and then saved through the
 * same service the reorder buttons use, so a template can never produce a layout the UI could not
 * have produced itself.
 */
export async function applyTemplateAction(input: unknown): Promise<ActionResult<LayoutInput>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };

  const parsed = z
    .object({
      variant: z.enum(DASHBOARD_VARIANTS),
      template: z.string().min(1).max(40),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: "unknown layout" };

  const layout = templateLayout(parsed.data.variant, parsed.data.template);
  if (!layout) return { ok: false, code: "invalid", message: "unknown layout" };

  try {
    return { ok: true, data: await saveLayout(session.user.id, layout) };
  } catch (error) {
    console.error("[dashboard] template failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}
