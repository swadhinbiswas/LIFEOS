"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { addCommentAction, listCommentsAction, removeCommentAction } from "@/server/boards/actions";
import type { CardComment } from "@/server/boards/comments";

const commentsKey = (cardId: string) => ["card-comments", cardId] as const;

/**
 * The card's comment thread (spec §6.1).
 *
 * A comment is written and read, not rendered: the app ships no Markdown renderer on purpose
 * (spec §10 — sanitize or don't render), so the body is shown as text with its whitespace kept.
 * Half-rendering Markdown would be the dishonest middle.
 *
 * The timestamp is formatted in the reader's own zone on the client, where it can be — the thread
 * arrives after hydration, so there is no server/client mismatch to fear — with the exact instant
 * kept in `dateTime` and `title` for anyone who needs it. The author is shown only when it is not
 * the person reading: every row today is theirs, and a column of "you" is noise, while a future
 * agent entry has a name that matters.
 */
export function CardComments({ cardId }: { cardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [draft, setDraft] = useState("");

  const comments = useQuery({
    queryKey: commentsKey(cardId),
    queryFn: async () => {
      const result = await listCommentsAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const cache = (data: CardComment[]) => queryClient.setQueryData(commentsKey(cardId), data);

  const add = useMutation({
    mutationFn: async (body: string) => {
      const result = await addCommentAction({ cardId, body });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      setDraft("");
      cache(data);
    },
  });

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const result = await removeCommentAction({ commentId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: cache,
  });

  const items = comments.data ?? [];

  return (
    <div className="flex flex-col gap-1" data-slot="card-comments">
      <span className="font-mono text-xs text-muted-foreground">{t("comments")}</span>

      {items.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("noComments")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((comment) => (
            <li key={comment.id} data-slot="comment" className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                {comment.actor !== "user" ? (
                  <span className="text-info" data-slot="comment-actor">
                    {comment.actor}
                  </span>
                ) : null}
                <time dateTime={new Date(comment.created_at).toISOString()}>
                  {new Date(comment.created_at).toLocaleString()}
                </time>
                <button
                  type="button"
                  aria-label={t("removeComment")}
                  onClick={() => remove.mutate(comment.id)}
                  className="ml-auto min-h-6 min-w-6 text-[10px] hover:text-destructive"
                >
                  ✕
                </button>
              </div>
              <p className="whitespace-pre-wrap font-mono text-xs">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        method="post"
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() === "") return;
          add.mutate(draft.trim());
        }}
      >
        <label className="sr-only" htmlFor="card-comment-input">
          {t("newComment")}
        </label>
        <textarea
          id="card-comment-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("newComment")}
          rows={2}
          className="min-h-7 w-full border border-border bg-background px-2 py-1 font-mono text-xs"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={add.isPending || !draft.trim()}
        >
          {t("addComment")}
        </Button>
      </form>
    </div>
  );
}
