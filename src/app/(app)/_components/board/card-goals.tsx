"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  linkToGoalAction,
  listCardGoalLinksAction,
  listGoalOptionsAction,
  unlinkFromGoalAction,
} from "@/server/goals/actions";

/** Mirrors the goals service option shape without importing a server module into the client. */
interface GoalOption {
  id: string;
  title: string;
}

const optionsKey = ["goal-options"] as const;
const linksKey = (cardId: string) => ["card-goal-links", cardId] as const;

/**
 * Goal links for a card (spec §6.9, ADR-049). Links live in a table of their own, so this loads
 * them when the sheet opens and mutates through the goals service — the same service the goals
 * page reads, so a linked card moves the goal's derived progress immediately.
 */
export function CardGoals({ cardId }: { cardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [chosen, setChosen] = useState("");

  const options = useQuery({
    queryKey: optionsKey,
    queryFn: async () => {
      const result = await listGoalOptionsAction();
      if (!result.ok) throw new Error(result.message);
      return result.data as GoalOption[];
    },
  });

  const links = useQuery({
    queryKey: linksKey(cardId),
    queryFn: async () => {
      const result = await listCardGoalLinksAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data as GoalOption[];
    },
  });

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: linksKey(cardId) });
    void queryClient.invalidateQueries({ queryKey: optionsKey });
  };

  const link = useMutation({
    mutationFn: async (goalId: string) => {
      const result = await linkToGoalAction({ goalId, entityType: "card", entityId: cardId });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      setChosen("");
      afterChange();
    },
  });

  const unlink = useMutation({
    mutationFn: async (goalId: string) => {
      const result = await unlinkFromGoalAction({ goalId, entityType: "card", entityId: cardId });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: afterChange,
  });

  const current = links.data ?? [];
  const linked = new Set(current.map((goal) => goal.id));
  const available = (options.data ?? []).filter((goal) => !linked.has(goal.id));
  const busy = link.isPending || unlink.isPending;

  return (
    <div className="flex flex-col gap-1" data-slot="card-goals">
      <span className="font-mono text-xs text-muted-foreground">{t("goals")}</span>
      {current.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("notLinked")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {current.map((goal) => (
            <li key={goal.id} data-slot="card-goal-link" className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{goal.title}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                aria-label={t("unlinkAria", { name: goal.title })}
                onClick={() => unlink.mutate(goal.id)}
              >
                {t("unlink")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(options.data ?? []).length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("noGoals")}</p>
      ) : (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="card-goal-select">
            {t("linkToGoal")}
          </label>
          <select
            id="card-goal-select"
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className="h-8 min-w-0 flex-1 border border-border bg-background px-2 font-mono text-xs"
          >
            <option value="">{t("linkToGoalOption")}</option>
            {available.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || chosen === ""}
            onClick={() => link.mutate(chosen)}
          >
            {t("link")}
          </Button>
        </div>
      )}
    </div>
  );
}
