"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createJobAction } from "@/server/career/actions";
import { boardQueryKey } from "../../../_components/board/use-board";

/**
 * "Add a job in under 10 seconds" (spec §6.3): title and company are the only required fields;
 * everything else is editable on the job's page afterwards. The action creates the card and the
 * application row together (ADR-044).
 */
export function NewJobForm({ boardId }: { boardId: string }) {
  const router = useRouter();
  const t = useTranslations("Pages.Career");
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const result = await createJobAction({
        title: title.trim(),
        companyName: company.trim() === "" ? null : company.trim(),
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: ({ cardId }) => {
      setTitle("");
      setCompany("");
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
      router.push(`/career/jobs/${cardId}`);
    },
    onError: (mutationError: unknown) =>
      setError(mutationError instanceof Error ? mutationError.message : t("couldNotAddJob")),
  });

  return (
    <form
      method="post"
      data-slot="new-job"
      className="flex flex-wrap items-center gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") return;
        setError("");
        create.mutate();
      }}
    >
      <label className="sr-only" htmlFor="job-title">
        {t("jobTitle")}
      </label>
      <input
        id="job-title"
        data-new-item=""
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("jobTitlePlaceholder")}
        className="w-56 border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
      />
      <label className="sr-only" htmlFor="job-company">
        {t("company")}
      </label>
      <input
        id="job-company"
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        placeholder={t("companyPlaceholder")}
        className="w-40 border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
      />
      <Button type="submit" size="sm" disabled={create.isPending || title.trim() === ""}>
        {create.isPending ? t("adding") : t("addJobButton")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
