"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "cn";

import { Panel } from "@/components/tui/panel";
import { Button } from "@/components/ui/button";
import { carryOverAction } from "@/server/boards/actions";

import { ToolbarGroup } from "./controls";
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
  const t = useTranslations("Pages.Board");
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState("");

  const carry = useMutation({
    mutationFn: async () => {
      const result = await carryOverAction();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: ({ moved }) => {
      setFlash(moved === 0 ? t("nothingOverdue") : t("carriedOver", { count: moved }));
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      router.refresh();
    },
    onError: () => setFlash(t("carryFailed")),
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
    <Panel title={t("planMyDay")} hint={t("openCards", { count: brief.openCards })}>
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Four counts in a `dl` with only `gap-4` between them rendered as the run-on string
            `OVERVIEW 0 DUE TODAY 0 INBOX 1 PLANNED 65 MIN`: the numbers had nothing to divide
            them, so the eye read one sentence. Each pair is now its own group with a hairline
            rule, and the only count that gets colour is the one that means something is wrong
            (ADR-117). A `dl` is still the right element here — the relation is real, and the
            dividers are decoration, so they are `aria-hidden` rather than announced. */}
        <dl
          className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase"
          data-slot="plan-counts"
        >
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">{t("overdue")}</dt>
            <dd
              className={cn(
                "tabular-nums",
                overdue > 0 ? "font-medium text-warning" : "text-muted-foreground",
              )}
            >
              {overdue}
            </dd>
          </div>
          <ToolbarGroup ruled className="gap-x-1.5">
            <dt className="text-muted-foreground">{t("dueToday")}</dt>
            <dd className="tabular-nums text-muted-foreground">{brief.dueToday.length}</dd>
          </ToolbarGroup>
          <ToolbarGroup ruled className="gap-x-1.5">
            <dt className="text-muted-foreground">{t("inbox")}</dt>
            <dd className="tabular-nums text-muted-foreground">{brief.inbox.length}</dd>
          </ToolbarGroup>
          <ToolbarGroup ruled className="gap-x-1.5">
            <dt className="text-muted-foreground">{t("planned")}</dt>
            <dd className="tabular-nums text-muted-foreground">
              {brief.estimatedMinutesToday} min
            </dd>
          </ToolbarGroup>
        </dl>

        <div className="border-t border-border pt-2">
          {/* Plain token, no opacity modifier: axe cannot resolve `color-mix` behind a
              `/70`, falls back to sampling pixels, and reports a false contrast failure
              (ADR-041). The rule above this line carries the hierarchy instead. */}
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("top3")}
          </p>
          {brief.top.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("nothingOpen")}</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {brief.top.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    className="text-left font-mono text-xs text-foreground/90 hover:text-primary"
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
            {t("carryOver", { count: overdue })}
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
