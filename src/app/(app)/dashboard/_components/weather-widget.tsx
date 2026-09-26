import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getWeatherNow } from "@/server/weather";

/**
 * Today's weather, on the dashboard, if the user has said where they are (ADR-132).
 *
 * **Keyless and optional.** Open-Meteo needs no account, so this is the one external signal that
 * costs nothing to leave switched on — but it still needs a place, and a place is not guessed from
 * the timezone. A timezone is a hundred square miles of nowhere in particular; a forecast for the
 * wrong city is worse than no forecast, and "it is 4° and raining" when you are at home is a lie
 * that gets believed. Until it is set, the widget says so and links to the setting.
 */
export async function WeatherWidget({ userId }: { userId: string }) {
  const t = await getTranslations("Pages.Dashboard");
  const weather = await getWeatherNow(userId);

  if (weather.place === null) {
    return (
      <div className="grid gap-1" data-slot="weather-widget">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {t("weatherTitle")}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">{t("weatherNotSet")}</p>
        <Link
          href="/settings"
          className="w-fit rounded-[var(--radius)] border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          {t("weatherSetPlace")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-1" data-slot="weather-widget" data-stale={weather.stale}>
      <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        {t("weatherTitle")}
      </p>
      <p className="flex items-baseline gap-2 font-mono">
        {/* The glyph is decorative; the words beside it carry the fact (spec §4.4). */}
        <span aria-hidden="true" className="text-base text-muted-foreground">
          {weather.glyph}
        </span>
        <span className="text-sm tabular-nums">
          {weather.temperatureC === null ? "—" : `${Math.round(weather.temperatureC)}°C`}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          {weather.description} · {weather.place}
        </span>
      </p>
      {weather.stale ? (
        // Saying so is the difference between a cached reading and a wrong one. A widget that shows
        // an hour-old temperature without saying so is quietly lying.
        <p className="font-mono text-[10px] text-warning">{t("weatherStale")}</p>
      ) : null}
    </div>
  );
}
