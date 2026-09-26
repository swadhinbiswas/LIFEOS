"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";

import type { Card } from "@/server/boards";
import { controlGhost } from "@/components/tui/controls";
import { cn } from "@/lib/utils";

export type MoveDirection = "up" | "down" | "left" | "right";

const PRIORITY_TONE: Record<string, string> = {
  p0: "text-destructive",
  p1: "text-warning",
  p2: "text-info",
  p3: "text-muted-foreground",
};

/** Plain-token control (ADR-041): opacity modifiers would make axe sample pixels. */
const cardAction = cn(controlGhost, "px-1.5 text-xs");

export function CardTile({
  card,
  query,
  focused,
  selected,
  meta,
  onMove,
  onOpen,
  onToggleSelect,
}: {
  card: Card;
  query: string;
  focused?: boolean;
  selected?: boolean;
  meta?: Array<{ label: string; href?: string }>;
  onMove: (cardId: string, direction: MoveDirection) => void;
  onOpen?: (cardId: string) => void;
  onToggleSelect?: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.column_id },
  });
  const t = useTranslations("Pages.Board");

  const due = card.due_at ? new Date(card.due_at).toISOString().slice(0, 10) : null;
  const matches = query.length > 0 && card.title.toLowerCase().includes(query.toLowerCase());

  return (
    <div
      ref={setNodeRef}
      data-slot="card"
      data-card-id={card.id}
      data-focused={focused ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      tabIndex={-1}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/card rounded-[var(--radius)] border border-border bg-background outline-none",
        "transition-colors hover:border-ring",
        // Focus is communicated by the border token as well as the ring (spec §4.4).
        focused && "border-ring ring-2 ring-ring/40",
        selected && "border-primary ring-2 ring-primary/40",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1 p-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab font-mono text-xs text-muted-foreground"
          aria-label={t("drag", { title: card.title })}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-mono text-xs">{card.title}</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            {card.priority ? (
              <span
                className={cn(
                  "rounded-[var(--radius)] border border-border px-1 uppercase",
                  PRIORITY_TONE[card.priority],
                )}
              >
                {card.priority}
              </span>
            ) : null}
            {due ? (
              <time dateTime={due} className="tabular-nums">
                {due}
              </time>
            ) : null}
            {card.estimate_min ? <span className="tabular-nums">{card.estimate_min}m</span> : null}
            {matches ? <span className="text-primary">{t("match")}</span> : null}
          </p>
          {meta && meta.length > 0 ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px]">
              {meta.map((chip) =>
                chip.href ? (
                  <a key={chip.label} href={chip.href} className="text-primary hover:underline">
                    {chip.label}
                  </a>
                ) : (
                  <span key={chip.label} className="text-muted-foreground">
                    {chip.label}
                  </span>
                ),
              )}
            </p>
          ) : null}
        </div>
      </div>

      {/* Keyboard-complete path (ADR-016): the move buttons call the same service as drag. */}
      <div className="flex items-center gap-1 border-t border-border px-1 py-1 opacity-60 focus-within:opacity-100 md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
        {onToggleSelect ? (
          <button
            type="button"
            className={cardAction}
            aria-pressed={selected ?? false}
            onClick={() => onToggleSelect(card.id)}
            aria-label={t("select", { title: card.title })}
          >
            {selected ? "▣" : "▢"}
          </button>
        ) : null}
        <button
          type="button"
          className={cardAction}
          onClick={() => onMove(card.id, "up")}
          aria-label={t("moveUp", { title: card.title })}
        >
          ↑
        </button>
        <button
          type="button"
          className={cardAction}
          onClick={() => onMove(card.id, "down")}
          aria-label={t("moveDown", { title: card.title })}
        >
          ↓
        </button>
        <button
          type="button"
          className={cardAction}
          onClick={() => onMove(card.id, "left")}
          aria-label={t("moveLeft", { title: card.title })}
        >
          ←
        </button>
        <button
          type="button"
          className={cardAction}
          onClick={() => onMove(card.id, "right")}
          aria-label={t("moveRight", { title: card.title })}
        >
          →
        </button>
        <button
          type="button"
          className={cn(cardAction, "ml-auto")}
          onClick={() => onOpen?.(card.id)}
          aria-label={t("openCard", { title: card.title })}
          hidden={!onOpen}
        >
          {t("open")}
        </button>
      </div>
    </div>
  );
}
