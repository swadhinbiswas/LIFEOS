"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createNoteAction, dailyNoteAction } from "@/server/notes/actions";

/** Two entry points that match how notes start: a blank note, or today's journal. */
export function NewNote() {
  const router = useRouter();
  const t = useTranslations("Pages.Notes");
  const [busy, setBusy] = useState<"note" | "daily" | null>(null);
  const [error, setError] = useState("");

  const open = async (kind: "note" | "daily") => {
    setBusy(kind);
    setError("");
    const result =
      kind === "note" ? await createNoteAction({ title: "", body: "" }) : await dailyNoteAction();
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(`/notes/${result.data.id}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={() => void open("note")}
      >
        {busy === "note" ? t("creating") : t("newNote")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={() => void open("daily")}
      >
        {busy === "daily" ? t("opening") : t("todaysJournal")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
