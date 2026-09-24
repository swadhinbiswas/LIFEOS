"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteNoteAction, updateNoteAction } from "@/server/notes/actions";

/**
 * Markdown-first editing (spec §6.5): the body is stored verbatim and saved explicitly. The save
 * button's label never changes, so its accessible name is stable — dirty state is reported in a
 * separate status line instead (a label that flips is a flaky test target and a worse affordance).
 */
export function NoteEditor({
  noteId,
  title: initialTitle,
  body: initialBody,
  pinned: initialPinned,
}: {
  noteId: string;
  title: string;
  body: string;
  pinned: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [pinned, setPinned] = useState(initialPinned);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    const result = await updateNoteAction({ noteId, title, body, pinned });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDirty(false);
    setStatus("saved");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2" data-slot="note-editor">
      <label className="sr-only" htmlFor="note-title">
        note title
      </label>
      <input
        id="note-title"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
          setStatus("idle");
        }}
        placeholder="title"
        className="border border-border bg-background px-2 py-1 font-mono text-sm outline-none placeholder:text-muted-foreground"
      />

      <label className="sr-only" htmlFor="note-body">
        note body markdown
      </label>
      <textarea
        id="note-body"
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setDirty(true);
          setStatus("idle");
        }}
        rows={16}
        placeholder={"# heading\n\nlink another note with [[its title]]"}
        className="w-full border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy || !dirty} onClick={() => void save()}>
          save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setPinned(!pinned);
            setDirty(true);
          }}
        >
          {pinned ? "unpin" : "pin"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await deleteNoteAction({ noteId });
            setBusy(false);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.push("/notes");
          }}
        >
          delete
        </Button>
        <span
          data-slot="note-status"
          role="status"
          className="font-mono text-[10px] text-muted-foreground"
        >
          {error ? "" : status === "saved" ? "saved" : dirty ? "unsaved changes" : "up to date"}
        </span>
        {error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
