import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { AsciiMeter } from "@/components/tui/ascii-meter";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { listHabits } from "@/server/habits";

import { AddHabitForm, HabitToggle } from "./_components/habit-controls";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Habits", "title");
}

/**
 * `/habits` (spec §6.4): today's check-ins, current streaks and the last four weeks. Streaks are
 * derived from the day-keyed log (ADR-045) and copy stays gentle — a missed day reads as a
 * fresh start, never as a failure.
 */
export default async function HabitsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Habits");
  const rows = await listHabits(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} count={rows.length} />

      <div className="grid max-w-4xl gap-4">
        <Panel title={t("newHabit")}>
          <AddHabitForm />
        </Panel>

        <Panel
          title={t("today")}
          hint={`${rows.filter((row) => row.value > 0).length}/${rows.length}`}
        >
          {rows.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => {
                const doneDays = row.days.filter((day) => day.done).length;
                return (
                  <li
                    key={row.habit.id}
                    data-slot="habit-row"
                    data-habit-id={row.habit.id}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border px-2 py-1.5 transition-colors hover:border-ring"
                  >
                    <span className="flex min-w-40 items-center gap-1 font-mono text-xs">
                      {row.habit.glyph ? <span aria-hidden="true">{row.habit.glyph}</span> : null}
                      {row.habit.name}
                    </span>
                    <HabitToggle
                      habitId={row.habit.id}
                      today={row.today}
                      value={row.value}
                      kind={row.habit.kind === "numeric" ? "numeric" : "binary"}
                    />
                    {row.habit.kind === "numeric" && row.habit.target ? (
                      <>
                        <AsciiMeter
                          value={Math.min(1, Math.max(0, (row.progress ?? 0) / 100))}
                          label={row.habit.name}
                          cells={10}
                          showValue={false}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                          {t("ofTarget", { progress: row.progress ?? 0, target: row.habit.target })}
                          {row.habit.unit ? ` ${row.habit.unit}` : ""}
                        </span>
                      </>
                    ) : null}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {row.streak > 0 ? t("streak", { count: row.streak }) : t("freshStart")}
                    </span>
                    {/* Colour is never the only signal: the text alternative carries the facts. */}
                    <span
                      aria-hidden="true"
                      className="flex gap-0.5 font-mono text-[10px] text-primary"
                    >
                      {row.days.slice(-14).map((day) => (
                        <span
                          key={day.key}
                          title={day.key}
                          className={day.done ? "" : "opacity-25"}
                        >
                          {day.done ? "▇" : "▁"}
                        </span>
                      ))}
                    </span>
                    <span className="sr-only">
                      {t("doneOf", { done: doneDays, total: row.days.length })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
