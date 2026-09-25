"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { regenerateBriefAction } from "@/server/ai/actions";

export interface BriefView {
  title: string;
  body: string;
  /** ISO instant, so the caller formats it in the user's locale. */
  createdAt: string;
  /** False when the brief on screen is older than today. */
  isToday: boolean;
}

/**
 * The AI morning brief, in full, on the dashboard (ADR-106).
 *
 * This is the whole point of the widget: the brief was already being generated, and the only
 * surface that showed it truncated the text to one ellipsised line. Here it is the model's own
 * words, preserved as written line breaks - a 3-5 line brief stays 3-5 lines. The user can ask for
 * a fresh one, which replaces today's brief rather than stacking another one.
 *
 * Client-side only for the button. The text itself is server-rendered, so a reader with JavaScript
 * off still gets the brief.
 */
export function AiBriefPanel({
  brief,
  /** False when the user has proactive briefs switched off. */
  enabled,
  labels,
}: {
  brief: BriefView | null;
  enabled: boolean;
  labels: {
    regenerate: string;
    regenerating: string;
    stale: string;
    noBrief: string;
    noBriefHint: string;
    enableLink: string;
    regenerateLink: string;
    aiSettings: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const regenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await regenerateBriefAction();
      if (!result.ok) {
        setError(result.message ?? "");
        return;
      }
      router.refresh();
    });
  };

  if (!brief) {
    return (
      <div data-slot="ai-brief" className="flex flex-col items-start gap-1">
        <p className="font-mono text-xs">{labels.noBrief}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{labels.noBriefHint}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" onClick={regenerate} disabled={pending}>
            {pending ? labels.regenerating : labels.regenerate}
          </Button>
          {enabled ? null : (
            <Link
              href="/settings/ai"
              className="font-mono text-[10px] text-primary hover:underline"
            >
              {labels.enableLink}
            </Link>
          )}
        </div>
        {error ? (
          <p role="alert" className="font-mono text-[10px] text-destructive">
            {error} {labels.regenerateLink}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <article data-slot="ai-brief" className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {brief.title}
        </span>
        <time dateTime={brief.createdAt} className="font-mono text-[10px] text-muted-foreground">
          {new Date(brief.createdAt).toLocaleDateString()}
        </time>
        {brief.isToday ? null : (
          <span className="font-mono text-[10px] text-warning">{labels.stale}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={regenerate}
            disabled={pending}
            data-slot="ai-brief-regenerate"
          >
            {pending ? labels.regenerating : labels.regenerate}
          </Button>
          <Link href="/ai" className="font-mono text-[10px] text-primary hover:underline">
            {labels.aiSettings}
          </Link>
        </div>
      </div>

      {/* whitespace-pre-wrap keeps the model's own line breaks; prose is rendered as text, never
          as HTML (spec §10), so a brief can never inject markup. */}
      <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap">{brief.body}</p>

      {error ? (
        <p role="alert" className="font-mono text-[10px] text-destructive">
          {error} {labels.regenerateLink}
        </p>
      ) : null}
    </article>
  );
}
