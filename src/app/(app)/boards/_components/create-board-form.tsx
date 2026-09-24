"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOARD_TEMPLATES } from "@/config/board-templates";
import { createBoardAction } from "@/server/boards/actions";

/**
 * New-board form: name + one of the spec §6.1 templates. The action returns a discriminated
 * result (never a thrown server error), so failures render inline.
 */
export function CreateBoardForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState(BOARD_TEMPLATES[0]?.id ?? "blank");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    const result = await createBoardAction({ name: value, template });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setName("");
    router.push(`/boards/${result.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 text-xs">
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-board-name">name</Label>
        <Input
          id="new-board-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="reading list"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-board-template">template</Label>
        <select
          id="new-board-template"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          className="h-9 border border-border bg-background px-2 font-mono text-xs"
        >
          {BOARD_TEMPLATES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "creating…" : "create board"}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
