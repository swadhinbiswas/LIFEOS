import { eq } from "drizzle-orm";

import { parseThemeOverrides, themeOverridesSchema, type ThemeOverrides } from "@/config/themes";
import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { user_settings } from "@/server/db/schema";

/**
 * Settings service (spec §7.2): the only writer of `user_settings`. Every call is scoped to
 * the authenticated user id — tenant isolation is a service-layer rule (ADR-026, spec line 350),
 * so Server Actions, REST and MCP adapters all inherit it.
 */

/** The user's saved customizer overrides, or null when they have never saved any. */
export async function getThemeOverrides(userId: string): Promise<ThemeOverrides | null> {
  const rows = await db
    .select({ overrides: user_settings.theme_overrides })
    .from(user_settings)
    .where(eq(user_settings.user_id, userId))
    .limit(1);

  const raw = rows[0]?.overrides;
  return raw ? parseThemeOverrides(raw) : null;
}

/** Upsert the whole override set (the customizer always sends a complete, Zod-valid set). */
export async function saveThemeOverrides(userId: string, overrides: ThemeOverrides): Promise<void> {
  const value = themeOverridesSchema.parse(overrides);
  const serialized = JSON.stringify(value);

  await db
    .insert(user_settings)
    .values({
      id: newId(),
      user_id: userId,
      theme: value.preset,
      theme_overrides: serialized,
    })
    .onConflictDoUpdate({
      target: user_settings.user_id,
      set: { theme: value.preset, theme_overrides: serialized, updated_at: new Date() },
    });
}
