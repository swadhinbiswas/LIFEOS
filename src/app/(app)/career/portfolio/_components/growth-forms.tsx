"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createAchievementAction,
  createProjectAction,
  createSkillAction,
} from "@/server/career/actions";
import type { ActionResult } from "@/server/boards/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";
const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

/** One submit lifecycle per form: these are the user's own entries, never samples. */
function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (call: () => Promise<ActionResult<unknown>>, reset: () => void) => {
    setBusy(true);
    setError("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    reset();
    router.refresh();
  };

  return { busy, error, submit };
}

export function AddProjectForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      data-slot="add-project"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === "") return;
        void submit(
          () =>
            createProjectAction({
              name: name.trim(),
              url: url.trim() === "" ? null : url.trim(),
              language: language.trim() === "" ? null : language.trim(),
            }),
          () => {
            setName("");
            setUrl("");
            setLanguage("");
          },
        );
      }}
    >
      <label className={label}>
        project
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="name"
          className={field}
          aria-label="project name"
        />
      </label>
      <label className={label}>
        url
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://github.com/…"
          className={field}
          aria-label="project url"
        />
      </label>
      <label className={label}>
        language
        <input
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          placeholder="Go"
          className={field}
          aria-label="project language"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || name.trim() === ""}>
        {busy ? "adding…" : "add project"}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function AddSkillForm() {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      data-slot="add-skill"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === "") return;
        const parsed = level === "" ? null : Number.parseInt(level, 10);
        void submit(
          () =>
            createSkillAction({
              name: name.trim(),
              level: parsed !== null && Number.isFinite(parsed) ? parsed : null,
            }),
          () => {
            setName("");
            setLevel("");
          },
        );
      }}
    >
      <label className={label}>
        skill
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Kubernetes"
          className={field}
          aria-label="skill name"
        />
      </label>
      <label className={label}>
        level 1–5
        <input
          inputMode="numeric"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          placeholder="4"
          className={field}
          aria-label="skill level"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || name.trim() === ""}>
        {busy ? "adding…" : "add skill"}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function AddAchievementForm() {
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      data-slot="add-achievement"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") return;
        void submit(
          () =>
            createAchievementAction({
              title: title.trim(),
              impact: impact.trim() === "" ? null : impact.trim(),
            }),
          () => {
            setTitle("");
            setImpact("");
          },
        );
      }}
    >
      <label className={label}>
        win
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="shipped the billing migration"
          className={field}
          aria-label="achievement title"
        />
      </label>
      <label className={label}>
        impact
        <input
          value={impact}
          onChange={(event) => setImpact(event.target.value)}
          placeholder="cut p95 latency by 40%"
          className={field}
          aria-label="achievement impact"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {busy ? "adding…" : "add win"}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
