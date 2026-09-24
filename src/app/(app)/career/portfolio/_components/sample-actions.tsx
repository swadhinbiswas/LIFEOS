"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clearSampleGrowthAction, importSamplePortfolioAction } from "@/server/career/actions";

/**
 * The sample import is explicit and reversible (spec §12): it tells the user exactly what it
 * will add and where the data comes from, marks every row as a sample, and can be undone
 * without touching the user's own entries.
 */
export function SampleActions({
  source,
  fetchedAt,
  totalRepos,
  projectCount,
  skillCount,
  hasSamples,
}: {
  source: string;
  fetchedAt: string;
  totalRepos: number;
  projectCount: number;
  skillCount: number;
  hasSamples: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = async (action: "import" | "clear") => {
    setBusy(true);
    setError("");
    setMessage("");
    const result =
      action === "import" ? await importSamplePortfolioAction() : await clearSampleGrowthAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(
      action === "import"
        ? `added ${"projectsAdded" in result.data ? result.data.projectsAdded : 0} projects and ${"skillsAdded" in result.data ? result.data.skillsAdded : 0} skills`
        : `removed ${"removed" in result.data ? result.data.removed : 0} sample projects`,
    );
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="font-mono text-[10px] text-muted-foreground">
        {projectCount} projects · {skillCount} skills · source: {source} (fetched{" "}
        {fetchedAt.slice(0, 10)}, {totalRepos} repos)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void run("import")}
        >
          import sample portfolio
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !hasSamples}
          onClick={() => void run("clear")}
        >
          remove sample rows
        </Button>
        {message ? (
          <span role="status" className="font-mono text-[10px] text-muted-foreground">
            {message}
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
