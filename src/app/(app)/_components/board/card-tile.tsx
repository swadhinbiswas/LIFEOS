"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Card } from "@/server/boards";
import { cn } from "@/lib/utils";

export type MoveDirection = "up" | "down" | "left" | "right";

const PRIORITY_TONE: Record<string, string> = {
  p0: "text-destructive",
  p1: "text-warning",
  p2: "text-info",
  p3: "text-muted-foreground",
};

/** Plain-token control (ADR-041): opacity modifiers would make axe sample pixels. */
const control =
  "rounded-[var(--radius)] px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground";

export function CardTile({
  card,
  query,
  onMove,
  onOpen,
}: {
  card: Card;
  query: string;
  onMove: (cardId: string, direction: MoveDirection) => void;
  onOpen?: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.column_id },
  });

  const due = card.due_at ? new Date(card.due_at).toISOString().slice(0, 10) : null;
  const matches = query.length > 0 && card.title.toLowerCase().includes(query.toLowerCase());

  return (
    <li
      ref={setNodeRef}
      data-slot="card"
      data-card-id={card.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/card border border-border bg-background", isDragging && "opacity-40")}
    >
      <div className="flex items-start gap-1 p-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab font-mono text-xs text-muted-foreground"
          aria-label={`drag ${card.title}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs">{card.title}</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            {card.priority ? (
              <span className={cn("uppercase", PRIORITY_TONE[card.priority])}>{card.priority}</span>
            ) : null}
            {due ? <time dateTime={due}>{due}</time> : null}
            {matches ? <span className="text-primary">match</span> : null}
          </p>
        </div>
      </div>

      {/* Keyboard-complete path (ADR-016): the move buttons call the same service as drag. */}
      <div className="flex items-center gap-1 border-t border-border px-1 py-1 opacity-60 focus-within:opacity-100 md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
        <button
          type="button"
          className={control}
          onClick={() => onMove(card.id, "up")}
          aria-label={`move ${card.title} up`}
        >
          ↑
        </button>
        <button
          type="button"
          className={control}
          onClick={() => onMove(card.id, "down")}
          aria-label={`move ${card.title} down`}
        >
          ↓
        </button>
        <button
          type="button"
          className={control}
          onClick={() => onMove(card.id, "left")}
          aria-label={`move ${card.title} left`}
        >
          ←
        </button>
        <button
          type="button"
          className={control}
          onClick={() => onMove(card.id, "right")}
          aria-label={`move ${card.title} right`}
        >
          →
        </button>
        <button
          type="button"
          className={cn(control, "ml-auto")}
          onClick={() => onOpen?.(card.id)}
          aria-label={`open ${card.title}`}
          hidden={!onOpen}
        >
          open
        </button>
      </div>
    </li>
  );
}
