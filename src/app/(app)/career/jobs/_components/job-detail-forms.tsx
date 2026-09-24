"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { addInterviewAction, addOfferAction } from "@/server/career/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";

/** Interview log entry (spec §6.3 "per-round records"). */
export function AddInterviewForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const t = useTranslations("Pages.Career");
  const [kind, setKind] = useState("screen");
  const [when, setWhen] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const result = await addInterviewAction({
          applicationId,
          kind,
          startsAt: when === "" ? null : new Date(`${when}T00:00:00.000Z`).toISOString(),
          feedback: feedback.trim() === "" ? null : feedback.trim(),
        });
        setBusy(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setWhen("");
        setFeedback("");
        router.refresh();
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("round")}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className={field}
          aria-label={t("interviewRound")}
        >
          {["screen", "tech", "system_design", "behavioral", "final"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("date")}
        <input
          type="date"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
          className={field}
          aria-label={t("interviewDate")}
        />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("howItWent")}
        <input
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={t("feedbackPlaceholder")}
          className={field}
          aria-label={t("interviewFeedback")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy}>
        {busy ? t("saving") : t("logRound")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/** Offer entry in minor units + currency (ADR-044). */
export function AddOfferForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const t = useTranslations("Pages.Career");
  const [base, setBase] = useState("");
  const [bonus, setBonus] = useState("");
  const [currency, setCurrency] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toMinor = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  };

  return (
    <form
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const result = await addOfferAction({
          applicationId,
          base: toMinor(base),
          bonus: toMinor(bonus),
          currency: currency.trim() === "" ? null : currency.trim().toUpperCase(),
        });
        setBusy(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setBase("");
        setBonus("");
        router.refresh();
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("base")}
        <input
          inputMode="decimal"
          value={base}
          onChange={(event) => setBase(event.target.value)}
          placeholder="60000"
          className={field}
          aria-label={t("offerBase")}
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("bonus")}
        <input
          inputMode="decimal"
          value={bonus}
          onChange={(event) => setBonus(event.target.value)}
          placeholder="5000"
          className={field}
          aria-label={t("offerBonus")}
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("currency")}
        <input
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          placeholder="EUR"
          maxLength={3}
          className={field}
          aria-label={t("offerCurrency")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy}>
        {busy ? t("saving") : t("logOffer")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
