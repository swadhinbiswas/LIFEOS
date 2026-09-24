"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createBookAction,
  createCourseAction,
  setBookStatusAction,
  setCourseProgressAction,
} from "@/server/learning/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";
const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (
    call: () => Promise<{ ok: boolean; message?: string }>,
    reset?: () => void,
  ) => {
    setBusy(true);
    setError("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "could not save");
      return;
    }
    reset?.();
    router.refresh();
  };
  return { busy, error, submit };
}

export function AddCourseForm() {
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      data-slot="add-course"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") return;
        void submit(
          () =>
            createCourseAction({
              title: title.trim(),
              provider: provider.trim() === "" ? null : provider.trim(),
            }),
          () => {
            setTitle("");
            setProvider("");
          },
        );
      }}
    >
      <label className={`${label} min-w-56 flex-1`}>
        course
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="distributed systems"
          className={field}
          aria-label="course title"
        />
      </label>
      <label className={label}>
        provider
        <input
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="MIT OCW"
          className={field}
          aria-label="course provider"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        add course
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/** Progress is set by the learner in steps, never inferred from activity. */
export function CourseProgress({ courseId, progress }: { courseId: string; progress: number }) {
  const { busy, submit } = useSubmit();
  const set = (next: number) =>
    void submit(() =>
      setCourseProgressAction({ courseId, progress: Math.max(0, Math.min(100, next)) }),
    );

  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => set(progress - 10)}
        aria-label="less progress"
      >
        −10
      </Button>
      <span className="w-12 text-center font-mono text-xs tabular-nums">{progress}%</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => set(progress + 10)}
        aria-label="more progress"
      >
        +10
      </Button>
    </span>
  );
}

export function AddBookForm() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      data-slot="add-book"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") return;
        void submit(
          () =>
            createBookAction({
              title: title.trim(),
              author: author.trim() === "" ? null : author.trim(),
            }),
          () => {
            setTitle("");
            setAuthor("");
          },
        );
      }}
    >
      <label className={`${label} min-w-56 flex-1`}>
        book
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Designing Data-Intensive Applications"
          className={field}
          aria-label="book title"
        />
      </label>
      <label className={label}>
        author
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Martin Kleppmann"
          className={field}
          aria-label="book author"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        add book
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function BookStatus({ bookId, status }: { bookId: string; status: string }) {
  const { busy, submit } = useSubmit();

  return (
    <select
      value={status}
      disabled={busy}
      onChange={(event) =>
        void submit(() =>
          setBookStatusAction({
            bookId,
            status: event.target.value as "want" | "reading" | "finished" | "abandoned",
          }),
        )
      }
      className={field}
      aria-label="book status"
    >
      {["want", "reading", "finished", "abandoned"].map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
