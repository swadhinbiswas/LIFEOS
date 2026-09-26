import { eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { user_settings, weather_cache } from "@/server/db/schema";

/**
 * Today's weather, cached (ADR-132).
 *
 * **Open-Meteo, which needs no API key.** Every other provider in this file's neighbourhood wants a
 * signup, and a personal OS that will not run without an account is not the thing this repo is
 * (spec §1). Open-Meteo is free, keyless, and returns a WMO code we can map to words.
 *
 * **A cache, not a live call.** A forecast on a dashboard people open several times a day, against a
 * free service, is how you get somebody's IP throttled. One row per user, refreshed at most every
 * {@link MAX_AGE_MS}, and a failed refresh keeps the last good reading rather than blanking the
 * widget — a stale temperature beats a spinner.
 */
const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 6_000;
/** Half an hour. A forecast does not change in five minutes, and the provider updates hourly. */
export const MAX_AGE_MS = 30 * 60 * 1000;

export interface WeatherNow {
  temperatureC: number | null;
  /** Our own word for the code, never the provider's number. */
  description: string;
  /** A single glyph, for the widget. Not the only signal — the description is always beside it. */
  glyph: string;
  place: string | null;
  observedAt: Date | null;
  /** True when the reading is older than {@link MAX_AGE_MS}, so the widget can say so. */
  stale: boolean;
}

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  place: string | null;
}

export async function getWeatherLocation(userId: string): Promise<WeatherLocation | null> {
  const [row] = await db
    .select({
      lat: user_settings.weather_lat,
      lon: user_settings.weather_lon,
      place: user_settings.weather_place,
    })
    .from(user_settings)
    .where(eq(user_settings.user_id, userId))
    .limit(1);
  if (row?.lat === null || row?.lat === undefined || row?.lon === null || row?.lon === undefined) {
    return null;
  }
  return { latitude: row.lat, longitude: row.lon, place: row.place };
}

export async function setWeatherLocation(
  userId: string,
  input: { latitude: number; longitude: number; place?: string | null },
): Promise<void> {
  // The cache belongs to the *place*. Moving and keeping the old reading would attribute one city's
  // temperature to another.
  await db.delete(weather_cache).where(eq(weather_cache.user_id, userId));
  // `user_settings` is keyed on a ULID and written only by the settings service, so the row may not
  // exist yet — insert-or-update keyed on the user, with the id supplied.
  await db
    .insert(user_settings)
    .values({
      id: newId(),
      user_id: userId,
      weather_lat: input.latitude,
      weather_lon: input.longitude,
      weather_place: input.place ?? null,
    })
    .onConflictDoUpdate({
      target: user_settings.user_id,
      set: {
        weather_lat: input.latitude,
        weather_lon: input.longitude,
        weather_place: input.place ?? null,
      },
    });
}

/**
 * The current reading, refreshing only when the cache has gone stale.
 *
 * Returns a `WeatherNow` either way: with no location it is `description: "not set"`, and with a
 * failed refresh it is the last good reading marked stale. A widget that renders nothing on a
 * network error is a widget that teaches people to ignore it.
 */
export async function getWeatherNow(userId: string, now: Date = new Date()): Promise<WeatherNow> {
  const location = await getWeatherLocation(userId);
  if (!location) return notSet();

  const [cached] = await db
    .select()
    .from(weather_cache)
    .where(eq(weather_cache.user_id, userId))
    .limit(1);

  const fresh = cached !== undefined && now.getTime() - cached.observed_at.getTime() < MAX_AGE_MS;
  if (fresh && cached !== undefined) return fromRow(cached, now);
  if (cached === undefined) return notSet();

  try {
    const reading = await fetchNow(location);
    await db
      .insert(weather_cache)
      .values({
        user_id: userId,
        latitude: location.latitude,
        longitude: location.longitude,
        place: location.place,
        temperature_c: reading.temperatureC,
        code: reading.code,
        is_day: reading.isDay,
        observed_at: now,
      })
      .onConflictDoUpdate({
        target: weather_cache.user_id,
        set: {
          latitude: location.latitude,
          longitude: location.longitude,
          place: location.place,
          temperature_c: reading.temperatureC,
          code: reading.code,
          is_day: reading.isDay,
          observed_at: now,
          last_error: null,
        },
      });
    return {
      temperatureC: reading.temperatureC,
      description: describe(reading.code, reading.isDay),
      glyph: glyph(reading.code, reading.isDay),
      place: location.place,
      observedAt: now,
      stale: false,
    };
  } catch (error) {
    // Fail open, and keep the last reading. The error is recorded so the widget can say why it is
    // showing you an hour-old temperature.
    const message = error instanceof Error ? error.message.slice(0, 120) : "unknown error";
    await db
      .update(weather_cache)
      .set({ last_error: message })
      .where(eq(weather_cache.user_id, userId));
    return { ...fromRow(cached, now), stale: true };
  }
}

interface Reading {
  temperatureC: number | null;
  code: number | null;
  isDay: boolean;
}

async function fetchNow(location: WeatherLocation): Promise<Reading> {
  const url =
    `${ENDPOINT}?latitude=${location.latitude}&longitude=${location.longitude}` +
    "&current=temperature_2m,weather_code,is_day&timezone=UTC";
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`weather provider returned ${response.status}`);
  const body = (await response.json()) as {
    current?: { temperature_2m?: unknown; weather_code?: unknown; is_day?: unknown };
  };
  const current = body.current ?? {};
  const temperature = current.temperature_2m;
  const code = current.weather_code;
  return {
    temperatureC: typeof temperature === "number" ? temperature : null,
    code: typeof code === "number" ? code : null,
    isDay: current.is_day === 1 || current.is_day === true,
  };
}

/**
 * WMO code to a phrase.
 *
 * **Grouped, not enumerated.** A person wants "rain", not "light drizzle". The unknown case has a
 * real answer rather than a blank, because an unrecognised code is the provider adding a code and
 * the honest thing to say is that we do not know what it means yet.
 */
export function describe(code: number | null, isDay: boolean): string {
  if (code === null) return "unknown";
  if (code === 0) return isDay ? "clear" : "clear night";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}

function glyph(code: number | null, isDay: boolean): string {
  if (code === 0) return isDay ? "☀" : "☾";
  if (code !== null && code <= 2) return "⛅";
  if (code !== null && code <= 48) return "▒";
  if (code !== null && code <= 67) return "▓";
  if (code !== null && code <= 77) return "*";
  if (code !== null && code <= 86) return "▒";
  if (code !== null && code <= 95) return "!";
  return "?";
}

function fromRow(row: typeof weather_cache.$inferSelect, now: Date): WeatherNow {
  return {
    temperatureC: row.temperature_c,
    description: describe(row.code, row.is_day ?? true),
    glyph: glyph(row.code, row.is_day ?? true),
    place: row.place,
    observedAt: row.observed_at,
    stale: now.getTime() - row.observed_at.getTime() >= MAX_AGE_MS,
  };
}

function notSet(): WeatherNow {
  return {
    temperatureC: null,
    description: "not set",
    glyph: "·",
    place: null,
    observedAt: null,
    stale: false,
  };
}
