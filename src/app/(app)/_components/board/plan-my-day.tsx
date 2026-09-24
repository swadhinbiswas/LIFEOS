"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Panel } from "@/components/tui/panel";
import { Button } from "@/components/ui/button";
import { carryOverAction } from "@/server/boards/actions";
import type { DailyBrief } from "@/server/boards/brief";

/**
 * Plan my day (spec §6.2): the counts that matter, the three cards worth doing first, the
 * estimated work already planned, and carry-over of overdue work on `c`.
 *
 * The spec also asks for a time-blocked schedule against the calendar and a workload meter
 * versus available hours; both need the calendar module and a user-set capacity, so this panel
 * reports the facts it can (counts, estimates) instead of inventing hours.
 */
export function PlanMyDay({ boardId, brief }: { boardId: string; brief: DailyBrief }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState("");

  const carry = useMutation({
    mutationFn: async () => {
      const result = await carryOverAction();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: ({ moved }) => {
      setFlash(moved === 0 ? "nothing overdue" : `carried over ${moved}`);
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      router.refresh();
    },
    onError: () => setFlash("could not carry over — please retry"),
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "c") {
        event.preventDefault();
        carry.mutate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [carry]);

  const overdue = brief.carryEligible.length;

  return (
    <Panel title="Plan my day" hint={`${brief.openCards} open`}>
      <div className="flex flex-col gap-2 text-xs">
        <dl className="flex flex-wrap gap-4 font-mono text-[10px] uppercase">
          <div className="flex items-center gap-1">
            <dt className="text-muted-foreground">overdue</dt>
            <dd className={overdue > 0 ? "text-warning" : "text-muted-foreground"}>{overdue}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="text-muted-foreground">due today</dt>
            <dd className="text-muted-foreground">{brief.dueToday.length}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="text-muted-foreground">inbox</dt>
            <dd className="text-muted-foreground">{brief.inbox.length}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="text-muted-foreground">planned</dt>
            <dd className="text-muted-foreground tabular-nums">
              {brief.estimatedMinutesToday} min
            </dd>
          </div>
        </dl>

        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">top 3</p>
          {brief.top.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">nothing open — nice</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {brief.top.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    className="font-mono text-xs hover:text-primary"
                    onClick={() => router.push(`/tasks?card=${card.id}`)}
                  >
                    {card.priority ? `[${card.priority}] ` : ""}
                    {card.title}
                    {card.due_at ? ` · ${new Date(card.due_at).toISOString().slice(0, 10)}` : ""}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={carry.isPending || overdue === 0}
            onClick={() => carry.mutate()}
          >
            carry over overdue ({overdue}) · c
          </Button>
          {flash ? (
            <span role="status" className="font-mono text-[10px] text-muted-foreground">
              {flash}
            </span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
