import { eq } from "drizzle-orm";

import { parseThemeOverrides, themeOverridesSchema, type ThemeOverrides } from "@/config/themes";
import { newId } from "@/lib/id";
import {
  dayKeyInTimeZone,
  resolveTimeZone,
  resolveWeekStart,
  type WeekStart,
} from "@/lib/timezone";
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

/**
 * The user's IANA timezone, defaulting to UTC (ADR-057). All day bucketing flows through this, so a
 * user in any zone gets the day they are actually in.
 */
export async function getTimeZone(userId: string): Promise<string> {
  const rows = await db
    .select({ timezone: user_settings.timezone })
    .from(user_settings)
    .where(eq(user_settings.user_id, userId))
    .limit(1);
  return resolveTimeZone(rows[0]?.timezone);
}

export async function setTimeZone(userId: string, timeZone: string): Promise<void> {
  const zone = resolveTimeZone(timeZone);
  await db
    .insert(user_settings)
    .values({ id: newId(), user_id: userId, timezone: zone })
    .onConflictDoUpdate({
      target: user_settings.user_id,
      set: { timezone: zone, updated_at: new Date() },
    });
}

/** The user's current calendar day — the one default every day-key service resolves to. */
export async function getUserDayKey(userId: string, at: Date = new Date()): Promise<string> {
  return dayKeyInTimeZone(at, await getTimeZone(userId));
}

/** Timezone + week start in one read, for the surfaces that need both (dashboards). */
export async function getRegionalSettings(
  userId: string,
): Promise<{ timeZone: string; weekStart: WeekStart }> {
  const rows = await db
    .select({ timezone: user_settings.timezone, weekStart: user_settings.week_start })
    .from(user_settings)
    .where(eq(user_settings.user_id, userId))
    .limit(1);
  return {
    timeZone: resolveTimeZone(rows[0]?.timezone),
    weekStart: resolveWeekStart(rows[0]?.weekStart),
  };
}

export async function setWeekStart(userId: string, weekStart: string): Promise<void> {
  const value = resolveWeekStart(weekStart);
  await db
    .insert(user_settings)
    .values({ id: newId(), user_id: userId, week_start: value })
    .onConflictDoUpdate({
      target: user_settings.user_id,
      set: { week_start: value, updated_at: new Date() },
    });
}
