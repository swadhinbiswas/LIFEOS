"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Pages.Learning");
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
      setError(result.message ?? t("couldNotSave"));
      return;
    }
    reset?.();
    router.refresh();
  };
  return { busy, error, submit };
}

export function AddCourseForm() {
  const t = useTranslations("Pages.Learning");
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      method="post"
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
        {t("course")}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("coursePlaceholder")}
          className={field}
          aria-label={t("ariaCourseTitle")}
        />
      </label>
      <label className={label}>
        {t("provider")}
        <input
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder={t("providerPlaceholder")}
          className={field}
          aria-label={t("ariaCourseProvider")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {t("addCourse")}
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
  const t = useTranslations("Pages.Learning");
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
        aria-label={t("lessProgress")}
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
        aria-label={t("moreProgress")}
      >
        +10
      </Button>
    </span>
  );
}

export function AddBookForm() {
  const t = useTranslations("Pages.Learning");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      method="post"
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
        {t("book")}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("bookTitlePlaceholder")}
          className={field}
          aria-label={t("ariaBookTitle")}
        />
      </label>
      <label className={label}>
        {t("author")}
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder={t("authorPlaceholder")}
          className={field}
          aria-label={t("ariaBookAuthor")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {t("addBook")}
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
  const t = useTranslations("Pages.Learning");
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
      aria-label={t("bookStatus")}
    >
      {["want", "reading", "finished", "abandoned"].map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
