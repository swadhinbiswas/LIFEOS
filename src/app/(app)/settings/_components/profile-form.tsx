"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-form";

/**
 * Display name editor. Better Auth's `updateUser` owns the write (its own endpoint, rate
 * limited) — the settings service is only for the columns Better Auth does not know about.
 */
export function ProfileForm({
  name,
  email,
  joined,
}: {
  name: string;
  email: string;
  joined: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setStatus("nothing to save");
      return;
    }
    setSaving(true);
    const { error: updateError } = await authClient.updateUser({ name: trimmed });
    setSaving(false);
    if (updateError) {
      setError(authErrorMessage(updateError));
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 text-xs">
      <div className="flex flex-col gap-1">
        <Label htmlFor="profile-name">name</Label>
        <Input
          id="profile-name"
          name="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="name"
          required
        />
      </div>

      <dl className="flex flex-col gap-1">
        <dt className="font-mono text-muted-foreground uppercase">email</dt>
        <dd className="font-mono">{email}</dd>
        <dt className="mt-1 font-mono text-muted-foreground uppercase">joined</dt>
        <dd className="font-mono tabular-nums">{joined}</dd>
      </dl>

      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-success">
          {status}
        </p>
      ) : null}

      <Button type="submit" disabled={saving} className="self-start">
        {saving ? "saving…" : "save changes"}
      </Button>
    </form>
  );
}
