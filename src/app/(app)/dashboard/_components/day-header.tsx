import { getTranslations } from "next-intl/server";

/**
 * The Today header (spec §6.8: "greeting and date").
 *
 * The greeting is derived from the user's own timezone, not the server's, because "good morning"
 * has to match the window the user is actually in — a server in UTC telling someone in Dhaka it is
 * afternoon is the kind of small wrongness that makes a dashboard feel unowned. Two messages for
 * the same instant is a real distinction, not decoration: the evening greeting is what the user's
 * day is closing on.
 *
 * Server-rendered: no client JS, and the first paint already has the date.
 */

/** 0…23 in the given zone, read off the offset rather than the runtime's own clock. */
function hourInTimeZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

export type Daypart = "morning" | "afternoon" | "evening";

export function daypartFor(hour: number): Daypart {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export async function DayHeader({
  name,
  day,
  timeZone,
  now,
}: {
  /** The user's display name, or null when the account has none. */
  name: string | null;
  /** `YYYY-MM-DD` in the user's zone. */
  day: string;
  timeZone: string;
  now: Date;
}) {
  const t = await getTranslations("Pages.Dashboard");
  const daypart = daypartFor(hourInTimeZone(now, timeZone));

  // The full date in the user's locale and zone, which is what a person reads on a morning screen.
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: "full",
  }).format(now);

  const firstName = name?.trim().split(/\s+/u)[0] ?? null;

  return (
    <header data-slot="day-header" className="grid gap-0.5">
      <h1 className="font-mono text-sm font-semibold tracking-wider uppercase">
        {firstName
          ? t("greetingNamed", { daypart: t(`greeting_${daypart}`), name: firstName })
          : t("greeting", { daypart: t(`greeting_${daypart}`) })}
      </h1>
      {/* The machine-readable day key, for anything that needs to agree with the server. */}
      <p className="font-mono text-[10px] text-muted-foreground">
        <time dateTime={day}>{dateLabel}</time>
      </p>
    </header>
  );
}
