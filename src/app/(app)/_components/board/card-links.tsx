"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createCardLinkAction,
  deleteCardLinkAction,
  listCardLinksAction,
  listCardOptionsAction,
} from "@/server/links/actions";

/** Mirrors the links service shapes without importing a server module into the client. */
interface CardLinkView {
  linkId: string;
  kind: string;
  cardId: string;
  title: string;
}
interface CardOption {
  id: string;
  title: string;
}

const KINDS = ["relates", "blocks", "duplicates"] as const;
const KIND_KEYS: Record<string, string> = {
  relates: "kindRelates",
  blocks: "kindBlocks",
  duplicates: "kindDuplicates",
};
/** Return the translated label for a link kind, falling back to the raw value. */
const kindKey = (kind: string): string | undefined => KIND_KEYS[kind];
const linksKey = (cardId: string) => ["card-links", cardId] as const;
const optionsKey = (cardId: string) => ["card-link-options", cardId] as const;

/**
 * Card↔card links for the open card (spec §6.9, ADR-056). Loaded when the sheet opens, with a
 * simple picker of the user's other cards; a link's two endpoints are checked by the service.
 */
export function CardLinks({ cardId }: { cardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("relates");

  const links = useQuery({
    queryKey: linksKey(cardId),
    queryFn: async () => {
      const result = await listCardLinksAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data as CardLinkView[];
    },
  });

  const options = useQuery({
    queryKey: optionsKey(cardId),
    queryFn: async () => {
      const result = await listCardOptionsAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data as CardOption[];
    },
  });

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: linksKey(cardId) });
    void queryClient.invalidateQueries({ queryKey: optionsKey(cardId) });
  };

  const link = useMutation({
    mutationFn: async () => {
      const result = await createCardLinkAction({ srcId: cardId, dstId: target, kind });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      setTarget("");
      afterChange();
    },
  });

  const unlink = useMutation({
    mutationFn: async (linkId: string) => {
      const result = await deleteCardLinkAction({ linkId });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: afterChange,
  });

  const current = links.data ?? [];
  const available = (options.data ?? []).filter(
    (option) => !current.some((entry) => entry.cardId === option.id),
  );

  return (
    <div className="flex flex-col gap-1" data-slot="card-links">
      <span className="font-mono text-xs text-muted-foreground">{t("linksTo")}</span>
      {current.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("noLinkedCards")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {current.map((entry) => (
            <li key={entry.linkId} data-slot="card-link" className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {kindKey(entry.kind) ? t(kindKey(entry.kind) as string) : entry.kind}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={unlink.isPending}
                aria-label={t("unlinkAria", { name: entry.title })}
                onClick={() => unlink.mutate(entry.linkId)}
              >
                {t("unlink")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(options.data ?? []).length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("noOtherCards")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="card-link-target">
            {t("linkToCard")}
          </label>
          <select
            id="card-link-target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="h-8 min-w-0 flex-1 border border-border bg-background px-2 font-mono text-xs"
          >
            <option value="">{t("linkToCardOption")}</option>
            {available.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="card-link-kind">
            {t("linkKind")}
          </label>
          <select
            id="card-link-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as (typeof KINDS)[number])}
            className="h-8 border border-border bg-background px-2 font-mono text-xs"
          >
            {KINDS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(kindKey(candidate) as string)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={link.isPending || target === ""}
            onClick={() => link.mutate()}
          >
            {t("link")}
          </Button>
        </div>
      )}
    </div>
  );
}
