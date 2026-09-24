import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { listHabits } from "@/server/habits";

import { AddHabitForm, HabitToggle } from "./_components/habit-controls";

export const metadata = { title: "Habits" };

/**
 * `/habits` (spec §6.4): today's check-ins, current streaks and the last four weeks. Streaks are
 * derived from the day-keyed log (ADR-045) and copy stays gentle — a missed day reads as a
 * fresh start, never as a failure.
 */
export default async function HabitsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const rows = await listHabits(session.user.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Habits</h1>

      <div className="grid max-w-4xl gap-4">
        <Panel title="New habit">
          <AddHabitForm />
        </Panel>

        <Panel title="Today" hint={`${rows.filter((row) => row.value > 0).length}/${rows.length}`}>
          {rows.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              no habits yet — add one above and check in daily
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => {
                const doneDays = row.days.filter((day) => day.done).length;
                return (
                  <li
                    key={row.habit.id}
                    data-slot="habit-row"
                    data-habit-id={row.habit.id}
                    className="flex flex-wrap items-center gap-3 border border-border px-2 py-1.5"
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
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        {row.progress ?? 0}% of {row.habit.target}
                        {row.habit.unit ? ` ${row.habit.unit}` : ""}
                      </span>
                    ) : null}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {row.streak > 0 ? `${row.streak} day streak` : "fresh start today"}
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
                      done {doneDays} of the last {row.days.length} days
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
