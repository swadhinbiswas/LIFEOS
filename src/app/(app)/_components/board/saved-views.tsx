"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "cn";

import { controlField, controlGhost } from "@/components/tui/controls";
import {
  createSavedViewAction,
  deleteSavedViewAction,
  listSavedViewsAction,
  type ActionResult,
} from "@/server/boards/actions";
import type { SavedView } from "@/server/boards/views";

/**
 * Saved views control (spec §6.1): name the current URL state, apply it back later, or delete
 * it. The query lives in the URL, so "sharing" a view is simply sharing the link.
 */
export function SavedViews({
  scope,
  current,
  onApply,
}: {
  scope: "tasks" | "board";
  current: Record<string, string>;
  onApply: (query: Record<string, string>) => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const key = ["saved-views", scope] as const;
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  const views = useQuery({
    queryKey: key,
    queryFn: async () => {
      const result: ActionResult<SavedView[]> = await listSavedViewsAction({ scope });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: async (viewName: string) => {
      const result = await createSavedViewAction({ scope, name: viewName, query: current });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (view) => {
      setName("");
      setSelected(view.id);
      invalidate();
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : t("couldNotSaveView"));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSavedViewAction({ id });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      setSelected("");
      invalidate();
    },
  });

  const apply = (id: string) => {
    setSelected(id);
    const view = views.data?.find((candidate) => candidate.id === id);
    if (!view) return;
    try {
      onApply(JSON.parse(view.query) as Record<string, string>);
    } catch {
      setError(t("unreadableView"));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      <label htmlFor="saved-view-select" className="font-mono text-[10px] text-muted-foreground">
        {t("views")}
      </label>
      <select
        id="saved-view-select"
        value={selected}
        onChange={(event) => apply(event.target.value)}
        className={cn(controlField, "max-w-32 px-1 py-0.5 text-[10px] focus-visible:border-ring")}
      >
        <option value="">{views.isLoading ? t("loading") : t("savedViews")}</option>
        {(views.data ?? []).map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="saved-view-name">
        {t("nameViewAria")}
      </label>
      {/* Plain control with plain tokens (ADR-041): shadcn's Input carries color-mix
          backgrounds that axe cannot resolve and reports as false contrast failures. */}
      <input
        id="saved-view-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("nameView")}
        className="h-6 w-32 rounded-[var(--radius)] border border-border bg-background px-1 font-mono text-[10px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
      />
      <button
        type="button"
        className={cn(controlGhost, "text-foreground")}
        disabled={save.isPending || name.trim() === ""}
        onClick={() => save.mutate(name.trim())}
      >
        {t("saveView")}
      </button>
      <button
        type="button"
        className={cn(
          controlGhost,
          "text-foreground",
          "hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive",
        )}
        disabled={remove.isPending || selected === ""}
        onClick={() => remove.mutate(selected)}
      >
        {t("deleteView")}
      </button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
