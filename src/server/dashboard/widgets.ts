import { and, eq } from "drizzle-orm";

import {
  defaultLayout,
  layoutSchema,
  mergeLayout,
  type DashboardVariant,
  type LayoutInput,
} from "@/config/dashboard-widgets";
import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { dashboard_widgets } from "@/server/db/schema";

/**
 * Dashboard layout persistence (ADR-046). Reads merge the saved rows over the registry defaults;
 * writes replace the whole variant atomically, so a half-saved layout cannot exist.
 */

export async function getLayout(userId: string, variant: DashboardVariant): Promise<LayoutInput> {
  const rows = await db
    .select()
    .from(dashboard_widgets)
    .where(and(eq(dashboard_widgets.user_id, userId), eq(dashboard_widgets.variant, variant)))
    .orderBy(dashboard_widgets.position);

  if (rows.length === 0) return defaultLayout(variant);
  return mergeLayout(
    variant,
    rows.map((row) => ({
      id: row.widget_id,
      visible: row.visible,
      position: row.position,
    })),
  );
}

export async function saveLayout(userId: string, input: unknown): Promise<LayoutInput> {
  const parsed = layoutSchema.parse(input);
  const merged = mergeLayout(parsed.variant, parsed.widgets);

  await db.transaction(async (tx) => {
    await tx
      .delete(dashboard_widgets)
      .where(
        and(eq(dashboard_widgets.user_id, userId), eq(dashboard_widgets.variant, parsed.variant)),
      );
    if (merged.widgets.length === 0) return;
    await tx.insert(dashboard_widgets).values(
      merged.widgets.map((widget, index) => ({
        id: newId(),
        user_id: userId,
        variant: parsed.variant,
        widget_id: widget.id,
        visible: widget.visible,
        position: index,
      })),
    );
  });

  return merged;
}
