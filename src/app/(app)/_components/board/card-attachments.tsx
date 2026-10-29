"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  addAttachmentAction,
  listAttachmentsAction,
  removeAttachmentAction,
} from "@/server/boards/actions";
import type { CardAttachment } from "@/server/boards/attachments";

const attachmentsKey = (cardId: string) => ["card-attachments", cardId] as const;

/**
 * The card's attachments (spec §6.1). v1 is links only — a URL plus an optional display name.
 * Files would need a storage backend decision that is not settled for self-hosters, so bytes are
 * out of scope here; the `storage_key` column is reserved for that later pass.
 *
 * A link is stored as written and rendered as an anchor with `rel="noopener noreferrer"`. The app
 * ships no preview renderer, so a link is a link rather than a half-embedded card.
 */
export function CardAttachments({ cardId }: { cardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const attachments = useQuery({
    queryKey: attachmentsKey(cardId),
    queryFn: async () => {
      const result = await listAttachmentsAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const cache = (data: CardAttachment[]) => queryClient.setQueryData(attachmentsKey(cardId), data);

  const add = useMutation({
    mutationFn: async () => {
      const result = await addAttachmentAction({
        cardId,
        url: url.trim(),
        name: name.trim() || undefined,
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      setUrl("");
      setName("");
      cache(data);
    },
  });

  const remove = useMutation({
    mutationFn: async (attachmentId: string) => {
      const result = await removeAttachmentAction({ attachmentId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: cache,
  });

  const items = attachments.data ?? [];

  return (
    <div className="flex flex-col gap-1" data-slot="card-attachments">
      <span className="font-mono text-xs text-muted-foreground">{t("attachments")}</span>

      {items.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("noAttachments")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((attachment) => (
            <li
              key={attachment.id}
              data-slot="attachment"
              className="flex items-center gap-2 font-mono text-xs"
            >
              <a
                href={attachment.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-primary hover:underline"
              >
                {attachment.name?.trim() ? attachment.name : (attachment.url ?? "")}
              </a>
              <button
                type="button"
                aria-label={t("removeAttachment")}
                onClick={() => remove.mutate(attachment.id)}
                className="min-h-6 min-w-6 text-[10px] text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        method="post"
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!url.trim()) return;
          add.mutate();
        }}
      >
        <label className="sr-only" htmlFor="card-attachment-url">
          {t("attachmentUrl")}
        </label>
        <input
          id="card-attachment-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("attachmentUrlPlaceholder")}
          className="min-h-7 w-full border border-border bg-background px-2 py-1 font-mono text-xs"
        />
        <label className="sr-only" htmlFor="card-attachment-name">
          {t("attachmentName")}
        </label>
        <input
          id="card-attachment-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("attachmentNamePlaceholder")}
          className="min-h-7 w-full border border-border bg-background px-2 py-1 font-mono text-xs"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={add.isPending || !url.trim()}
        >
          {t("addAttachment")}
        </Button>
      </form>
    </div>
  );
}
