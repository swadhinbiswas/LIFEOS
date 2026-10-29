"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { controlField } from "@/components/tui/controls";
import {
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  setRoleAction,
} from "@/server/admin/actions";

const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

export function AdminSettingsForm({
  users,
  currentUserId,
}: {
  users: Array<{ id: string; email: string; name: string; role: string; createdAt: Date }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const run = async (call: () => Promise<{ ok: boolean; message?: string }>, done: string) => {
    setBusy(true);
    setError("");
    setStatus("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "failed");
      return;
    }
    setStatus(done);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      <ul className="flex flex-col gap-1">
        {users.map((u) => (
          <li
            key={u.id}
            data-slot="admin-user"
            className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
          >
            <span className="min-w-0 flex-1 truncate">
              {u.name} <span className="text-muted-foreground">&lt;{u.email}&gt;</span>
            </span>
            <span className="rounded-[var(--radius)] border border-border px-1 text-[10px] uppercase">
              {u.role}
            </span>
            {u.id !== currentUserId ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        setRoleAction({
                          userId: u.id,
                          role: u.role === "admin" ? "user" : "admin",
                        }),
                      "role updated",
                    )
                  }
                >
                  {u.role === "admin" ? "demote" : "promote"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setResetFor(u.id)}
                >
                  reset password
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`Delete ${u.email}?`)) return;
                    void run(() => deleteUserAction({ userId: u.id }), "deleted").then(() =>
                      setResetFor(null),
                    );
                  }}
                >
                  delete
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">(you)</span>
            )}
          </li>
        ))}
      </ul>

      {resetFor ? (
        <div className="flex flex-wrap items-end gap-2 border border-border p-2">
          <label className={`${label} min-w-48 flex-1`}>
            new password
            <input
              type="password"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              className={controlField}
              autoComplete="off"
            />
          </label>
          <Button
            size="sm"
            disabled={busy || resetPw.length < 8}
            onClick={() =>
              void run(
                () => resetPasswordAction({ userId: resetFor, password: resetPw }),
                "password reset",
              ).then(() => {
                setResetFor(null);
                setResetPw("");
              })
            }
          >
            save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setResetFor(null)}>
            cancel
          </Button>
        </div>
      ) : null}

      <div className="border-t border-border pt-3">
        <p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase">create account</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${label} min-w-48 flex-1`}>
            email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={controlField}
            />
          </label>
          <label className={`${label} min-w-32 flex-1`}>
            name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={controlField}
            />
          </label>
          <label className={`${label} min-w-32`}>
            password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={controlField}
              autoComplete="off"
            />
          </label>
          <label className={label}>
            role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className={controlField}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <Button
            size="sm"
            disabled={busy || !email.trim() || !name.trim() || password.length < 8}
            onClick={() =>
              void run(
                () => createUserAction({ email: email.trim(), name: name.trim(), password, role }),
                "created",
              ).then(() => {
                setEmail("");
                setName("");
                setPassword("");
              })
            }
          >
            {busy ? "…" : "create"}
          </Button>
        </div>
      </div>

      {status ? (
        <span role="status" className="font-mono text-[10px] text-success">
          {status}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="font-mono text-[10px] text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
