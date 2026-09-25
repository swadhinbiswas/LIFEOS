"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createBlankCvAction, createCvFromProfileAction } from "@/server/cv/actions";

/** Create actions for the CV list (spec §6.3): a blank CV, or one built from the user's profile. */
export function CvNew() {
  const router = useRouter();
  const t = useTranslations("Pages.Cv");
  const [busy, setBusy] = useState<"blank" | "profile" | null>(null);
  const [error, setError] = useState("");

  const run = async (kind: "blank" | "profile") => {
    setBusy(kind);
    setError("");
    const result =
      kind === "blank" ? await createBlankCvAction() : await createCvFromProfileAction();
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.id) router.push(`/career/cv/${result.id}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={busy !== null}
        onClick={() => void run("profile")}
        data-slot="cv-from-profile"
      >
        {busy === "profile" ? t("working") : t("fromProfile")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={() => void run("blank")}
        data-slot="cv-blank"
      >
        {busy === "blank" ? t("working") : t("blank")}
      </Button>
      {error ? (
        <span role="alert" className="font-mono text-[10px] text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
