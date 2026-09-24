"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getCardTagsAction, setCardTagsAction } from "@/server/tags/actions";

const tagsKey = (cardId: string) => ["card-tags", cardId] as const;

/**
 * Cross-module tags for the open card (spec §6.9, ADR-059). Board **labels** remain the
 * board-scoped concept (colour + board filter); these tags group a card with notes and anything
 * else that carries the same name.
 */
export function CardTags({ cardId }: { cardId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);

  const tags = useQuery({
    queryKey: tagsKey(cardId),
    queryFn: async () => {
      const result = await getCardTagsAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const save = useMutation({
    mutationFn: async (value: string) => {
      const names = value
        .split(/[,\n]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag !== "");
      const result = await setCardTagsAction({ cardId, tags: names });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      setDraft(null);
      queryClient.setQueryData(tagsKey(cardId), data);
      void queryClient.invalidateQueries({ queryKey: tagsKey(cardId) });
    },
  });

  const value = draft ?? (tags.data ?? []).join(", ");

  return (
    <div className="flex flex-col gap-1" data-slot="card-tags">
      <span className="font-mono text-xs text-muted-foreground">tags</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="card-tags-input">
          card tags
        </label>
        <input
          id="card-tags-input"
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="tags, comma separated"
          className="h-8 min-w-0 flex-1 border border-border bg-background px-2 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={save.isPending || draft === null}
          onClick={() => save.mutate(value)}
        >
          save tags
        </Button>
      </div>
    </div>
  );
}
