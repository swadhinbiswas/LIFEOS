"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteNoteAction, updateNoteAction } from "@/server/notes/actions";
import { setNoteTagsAction } from "@/server/tags/actions";

/**
 * Markdown-first editing (spec §6.5): the body is stored verbatim and saved explicitly. The save
 * button's label never changes, so its accessible name is stable — dirty state is reported in a
 * separate status line instead (a label that flips is a flaky test target and a worse affordance).
 *
 * Tags (ADR-049) save with the note through the tags service, so one save persists the whole note.
 */
export function NoteEditor({
  noteId,
  title: initialTitle,
  body: initialBody,
  pinned: initialPinned,
  secret: initialSecret,
  tags: initialTags,
}: {
  noteId: string;
  title: string;
  body: string;
  pinned: boolean;
  secret: boolean;
  tags: string[];
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Notes");
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [pinned, setPinned] = useState(initialPinned);
  const [secret, setSecret] = useState(initialSecret);
  const [tagText, setTagText] = useState(initialTags.join(", "));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    const names = tagText
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    const result = await updateNoteAction({ noteId, title, body, pinned, secret });
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    const tagged = await setNoteTagsAction({ noteId, tags: names });
    setBusy(false);
    if (!tagged.ok) {
      setError(tagged.message);
      return;
    }
    setDirty(false);
    setStatus("saved");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2" data-slot="note-editor">
      <label className="sr-only" htmlFor="note-title">
        {t("titleLabel")}
      </label>
      <input
        id="note-title"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
          setStatus("idle");
        }}
        placeholder={t("titlePlaceholder")}
        className="border border-border bg-background px-2 py-1 font-mono text-sm outline-none placeholder:text-muted-foreground"
      />

      <label className="sr-only" htmlFor="note-body">
        {t("bodyLabel")}
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
        placeholder={t("bodyPlaceholder")}
        className="w-full border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
      />

      <label className="sr-only" htmlFor="note-tags">
        {t("tagsLabel")}
      </label>
      <input
        id="note-tags"
        value={tagText}
        onChange={(event) => {
          setTagText(event.target.value);
          setDirty(true);
          setStatus("idle");
        }}
        placeholder={t("tagsPlaceholder")}
        className="border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy || !dirty} onClick={() => void save()}>
          {t("save")}
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
          {pinned ? t("unpin") : t("pin")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setSecret(!secret);
            setDirty(true);
          }}
          title={t("secretHint")}
        >
          {secret ? t("makePublic") : t("makeSecret")}
        </Button>
        {secret ? (
          <span className="rounded-[var(--radius)] border border-destructive/40 px-1 font-mono text-[10px] text-destructive">
            {t("secret")}
          </span>
        ) : null}
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
          {t("delete")}
        </Button>
        <span
          data-slot="note-status"
          role="status"
          className="font-mono text-[10px] text-muted-foreground"
        >
          {error ? "" : status === "saved" ? t("saved") : dirty ? t("unsaved") : t("upToDate")}
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
