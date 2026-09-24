"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createWebhookAction,
  deleteWebhookAction,
  retryWebhookAction,
} from "@/server/webhooks/actions";

interface WebhookSummary {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}
interface DeliverySummary {
  id: string;
  event: string;
  status: number;
  error: string | null;
  delivered: boolean;
  attempts: number;
  nextAttemptAt: string | null;
}

const EVENTS = [
  "card.created",
  "card.updated",
  "card.moved",
  "card.completed",
  "job.stage_changed",
  "habit.logged",
  "note.created",
] as const;

/**
 * Outgoing-webhook management (spec §9.3, ADR-066/069). The secret is shown once at creation — it
 * is the receiver's shared secret for verifying the `x-lifeos-signature` header. Failed deliveries
 * are retried on an exponential backoff by the sweep; a row can also be re-attempted now.
 */
export function Webhooks({
  webhooks,
  deliveries,
}: {
  webhooks: WebhookSummary[];
  deliveries: DeliverySummary[];
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Integrations");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["card.created"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleEvent = (event: string) =>
    setEvents((current) =>
      current.includes(event) ? current.filter((value) => value !== event) : [...current, event],
    );

  const add = async () => {
    if (url.trim() === "" || events.length === 0) return;
    setBusy(true);
    setError("");
    const result = await createWebhookAction({ url: url.trim(), events });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSecret(result.data.secret);
    setUrl("");
    setEvents(["card.created"]);
    router.refresh();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await deleteWebhookAction({ id });
    setBusy(false);
    router.refresh();
  };

  const replay = async (id: string) => {
    setBusy(true);
    await retryWebhookAction({ id });
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3" data-slot="webhooks">
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="webhook-url">
          {t("webhookUrl")}
        </label>
        <input
          id="webhook-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("webhookUrlPlaceholder")}
          className="h-8 border border-border bg-background px-2 font-mono text-xs"
        />
        <fieldset className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
          <legend className="sr-only">{t("events")}</legend>
          {EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={events.includes(event)}
                onChange={() => toggleEvent(event)}
              />
              {event}
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || url.trim() === "" || events.length === 0}
            onClick={() => void add()}
          >
            {t("addWebhook")}
          </Button>
          {error ? (
            <span role="alert" className="font-mono text-[10px] text-destructive">
              {error}
            </span>
          ) : null}
        </div>
      </div>

      {secret ? (
        <div
          data-slot="webhook-secret"
          role="status"
          className="flex flex-col gap-1 border border-warning px-2 py-1 font-mono text-[10px]"
        >
          <span>{t("copySecret")}</span>
          <code className="text-warning break-all">{secret}</code>
        </div>
      ) : null}

      {webhooks.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">{t("noWebhooks")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {webhooks.map((hook) => (
            <li
              key={hook.id}
              data-slot="webhook-row"
              className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
            >
              <span className="min-w-0 flex-1 truncate">{hook.url}</span>
              <span className="text-muted-foreground">{hook.events.join(", ")}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                aria-label={t("deleteAria", { url })}
                onClick={() => void remove(hook.id)}
              >
                {t("delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] text-muted-foreground">{t("recentDeliveries")}</span>
        {deliveries.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">{t("nothingDelivered")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {deliveries.map((delivery) => (
              <li
                key={delivery.id}
                data-slot="webhook-delivery"
                className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
              >
                <span className="text-primary">{delivery.event}</span>
                <span className="text-muted-foreground">
                  {delivery.delivered
                    ? t("delivered", { status: delivery.status, attempts: delivery.attempts })
                    : delivery.nextAttemptAt
                      ? t("retryN", {
                          status: delivery.status || t("noResponse"),
                          n: delivery.attempts + 1,
                        })
                      : t("abandoned", { attempts: delivery.attempts })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={t("retryAria", { event: delivery.event })}
                  onClick={() => void replay(delivery.id)}
                >
                  {t("retryNow")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
