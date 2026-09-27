"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Card } from "@/server/boards";

import { CardGoals } from "./card-goals";
import { CardChecklist } from "./card-checklist";
import { CardLabels } from "./card-labels";
import { CardLinks } from "./card-links";
import { CardReminder } from "./card-reminder";
import { CardTags } from "./card-tags";
import type { UpdateCardVars } from "./use-board";

const PRIORITIES = [
  { value: "", label: "none" },
  { value: "p0", label: "P0" },
  { value: "p1", label: "P1" },
  { value: "p2", label: "P2" },
  { value: "p3", label: "P3" },
];

const dayValue = (date: Date | null): string =>
  date ? new Date(date).toISOString().slice(0, 10) : "";

/**
 * The card detail sheet (spec §6.1), deep-linked by `?card=<id>` (ADR-042). Fields save when
 * they change or lose focus, so there is no unsaved state to lose; every write goes through
 * the same optimistic mutation as a drag, with the ADR-011 version check.
 *
 * Mounted with `key={card.id}` so the local drafts re-seed per card without an effect.
 */
export function CardSheet({
  card,
  onOpenChange,
  onUpdate,
  onArchive,
  onDelete,
}: {
  card: Card;
  onOpenChange: (open: boolean) => void;
  onUpdate: (vars: UpdateCardVars) => void;
  onArchive: (cardId: string) => void;
  onDelete: (cardId: string) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const t = useTranslations("Pages.Board");
  const [description, setDescription] = useState(card.description ?? "");
  const [estimate, setEstimate] = useState(
    card.estimate_min === null ? "" : String(card.estimate_min),
  );
  const [recurrence, setRecurrence] = useState(card.recurrence ?? "");

  const patch = (values: Partial<UpdateCardVars>) =>
    onUpdate({ cardId: card.id, version: card.version, ...values });

  /** Snooze shifts the due date; with no due date it counts from now. */
  const snooze = (days: number) => {
    const base = card.due_at ? new Date(card.due_at) : new Date();
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    patch({ dueAt: next.toISOString() });
  };

  // ADR-015: store the instant as UTC; the date input is day-granular.
  const datePatch = (value: string) =>
    value === "" ? null : new Date(`${value}T00:00:00.000Z`).toISOString();

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-y-auto border-l border-border"
        style={{
          top: 0,
          left: "auto",
          right: 0,
          height: "100%",
          maxWidth: "28rem",
          transform: "none",
          borderRadius: 0,
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("cardTitle")}</DialogTitle>
          <DialogDescription>{t("changesSave")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <Label htmlFor="card-title">{t("fieldTitle")}</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                if (value && value !== card.title) patch({ title: value });
                else if (!value) setTitle(card.title);
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="card-description">{t("fieldDescription")}</Label>
            <Textarea
              id="card-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={(event) => {
                const value = event.currentTarget.value;
                if (value !== (card.description ?? "")) {
                  patch({ description: value === "" ? null : value });
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="card-priority">{t("fieldPriority")}</Label>
              <select
                id="card-priority"
                value={card.priority ?? ""}
                onChange={(event) =>
                  patch({ priority: event.target.value === "" ? null : event.target.value })
                }
                className="h-9 border border-border bg-background px-2 font-mono text-xs"
              >
                {PRIORITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value === "" ? t("none") : option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="card-estimate">{t("fieldEstimate")}</Label>
              <Input
                id="card-estimate"
                inputMode="numeric"
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
                onBlur={(event) => {
                  const raw = event.currentTarget.value.trim();
                  const parsed = raw === "" ? null : Number.parseInt(raw, 10);
                  const next = parsed !== null && Number.isFinite(parsed) ? parsed : null;
                  if (next !== card.estimate_min) patch({ estimateMin: next });
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="card-start">{t("fieldStart")}</Label>
              <Input
                id="card-start"
                type="date"
                value={dayValue(card.start_at)}
                onChange={(event) => patch({ startAt: datePatch(event.target.value) })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="card-due">{t("fieldDue")}</Label>
              <Input
                id="card-due"
                type="date"
                value={dayValue(card.due_at)}
                onChange={(event) => patch({ dueAt: datePatch(event.target.value) })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="card-recurrence">{t("fieldRecurrence")}</Label>
            <Input
              id="card-recurrence"
              placeholder="FREQ=WEEKLY;INTERVAL=1"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                if (value !== (card.recurrence ?? "")) {
                  patch({ recurrence: value === "" ? null : value });
                }
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{t("snooze")}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => snooze(1)}>
              {t("oneDay")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => snooze(7)}>
              {t("oneWeek")}
            </Button>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <CardChecklist cardId={card.id} boardId={card.board_id} />
            <CardLabels cardId={card.id} boardId={card.board_id} />
            <CardGoals cardId={card.id} />
            <CardReminder cardId={card.id} />
            <CardTags cardId={card.id} />
            <CardLinks cardId={card.id} />
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => onArchive(card.id)}>
              {t("archive")}
            </Button>
            <Button type="button" variant="outline" onClick={() => onDelete(card.id)}>
              {t("delete")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              onClick={() => onOpenChange(false)}
            >
              {t("closeCard")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
