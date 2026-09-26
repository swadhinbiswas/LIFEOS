"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BoardTemplate } from "@/config/board-templates";
import { authClient } from "@/lib/auth-client";
import { completeOnboardingAction } from "@/server/onboarding/actions";

/**
 * The two-step onboarding wizard (spec §14 Phase 8, ADR-085): name → starter board.
 *
 * There was a third step here — pick a sample profile — and it is gone with the seed module
 * (ADR-123). Leaving the radios in place would have been worse than removing them: the step would
 * still have looked meaningful and would have done nothing, which is exactly the dead control the
 * project rules forbid.
 */
export function OnboardingWizard({
  name,
  templates,
}: {
  name: string;
  templates: BoardTemplate[];
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Onboarding");
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(name);
  const [template, setTemplate] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const next = async () => {
    if (step < 1) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setError("");
    // The display name is Better Auth's field; the rest is our onboarding action.
    if (displayName.trim() && displayName.trim() !== name) {
      await authClient.updateUser({ name: displayName.trim() });
    }
    const result = await completeOnboardingAction({ template });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "could not finish setup");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 text-xs" data-slot="onboarding">
      <p className="font-mono text-[10px] text-muted-foreground">
        {t("hint")} · {step + 1}/2
      </p>

      {step === 0 ? (
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-wider uppercase">{t("step1Title")}</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            aria-label={t("name")}
            className="border border-border bg-background px-2 py-1 font-mono text-xs outline-none"
          />
        </label>
      ) : null}

      {step === 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-mono text-[10px] tracking-wider uppercase">
            {t("step3Title")}
          </legend>
          <label className="flex items-center gap-2 font-mono text-xs">
            <input
              type="radio"
              name="template"
              value="none"
              checked={template === "none"}
              onChange={() => setTemplate("none")}
            />
            {t("none")}
          </label>
          {templates.map((candidate) => (
            <label key={candidate.id} className="flex items-start gap-2 font-mono text-xs">
              <input
                type="radio"
                name="template"
                value={candidate.id}
                checked={template === candidate.id}
                onChange={() => setTemplate(candidate.id)}
              />
              <span>
                <span className="block">{candidate.name}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {candidate.columns.map((column) => column.name).join(" · ")}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {step > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setStep(step - 1)}
          >
            {t("back")}
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={busy} onClick={() => void next()}>
          {busy ? t("finishing") : step === 1 ? t("finish") : t("next")}
        </Button>
        {error ? (
          <span role="alert" className="font-mono text-[10px] text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
