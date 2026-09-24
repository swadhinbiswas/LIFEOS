"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { addQuestionAction, addStoryAction } from "@/server/career/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";
const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

export function AddQuestionForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      data-slot="add-question"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={async (event) => {
        event.preventDefault();
        if (question.trim() === "") return;
        setBusy(true);
        setError("");
        const result = await addQuestionAction({
          question: question.trim(),
          category: category.trim() === "" ? null : category.trim(),
          difficulty: difficulty === "" ? null : difficulty,
        });
        setBusy(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setQuestion("");
        router.refresh();
      }}
    >
      <label className={`${label} min-w-64 flex-1`}>
        question
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="tell me about a hard migration"
          className={field}
          aria-label="question"
        />
      </label>
      <label className={label}>
        topic
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="behavioural"
          className={field}
          aria-label="question topic"
        />
      </label>
      <label className={label}>
        difficulty
        <select
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
          className={field}
          aria-label="question difficulty"
        >
          <option value="">—</option>
          {["easy", "medium", "hard"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || question.trim() === ""}>
        {busy ? "adding…" : "add question"}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function AddStoryForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      data-slot="add-story"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={async (event) => {
        event.preventDefault();
        if (title.trim() === "") return;
        setBusy(true);
        setError("");
        const outcome = await addStoryAction({
          title: title.trim(),
          result: result.trim() === "" ? null : result.trim(),
        });
        setBusy(false);
        if (!outcome.ok) {
          setError(outcome.message);
          return;
        }
        setTitle("");
        setResult("");
        router.refresh();
      }}
    >
      <label className={label}>
        headline
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="cut checkout latency"
          className={field}
          aria-label="story headline"
        />
      </label>
      <label className={`${label} min-w-64 flex-1`}>
        result
        <input
          value={result}
          onChange={(event) => setResult(event.target.value)}
          placeholder="p95 down 40%, no incidents after rollout"
          className={field}
          aria-label="story result"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {busy ? "adding…" : "add story"}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
