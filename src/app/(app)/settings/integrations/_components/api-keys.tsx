"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createApiKeyAction, revokeApiKeyAction } from "@/server/api-keys/actions";

interface KeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  revoked: boolean;
  lastUsedAt: string | null;
}

const SCOPES = [
  "read:*",
  "write:tasks",
  "write:jobs",
  "write:notes",
  "write:life",
  "write:finance",
  "admin:export",
] as const;

/**
 * API-key management (spec §9.1, ADR-062). Creating shows the token **once**; afterwards only the
 * prefix and metadata are ever visible, and a key is revoked instantly.
 */
export function ApiKeys({ keys }: { keys: KeySummary[] }) {
  const router = useRouter();
  const t = useTranslations("Pages.Integrations");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read:*"]);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleScope = (scope: string) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope],
    );

  const create = async () => {
    if (name.trim() === "" || scopes.length === 0) return;
    setBusy(true);
    setError("");
    const result = await createApiKeyAction({ name: name.trim(), scopes });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCreated(result.data.plaintext);
    setName("");
    setScopes(["read:*"]);
    router.refresh();
  };

  const revoke = async (id: string) => {
    setBusy(true);
    await revokeApiKeyAction({ id });
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3" data-slot="api-keys">
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="api-key-name">
          {t("keyName")}
        </label>
        <input
          id="api-key-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("keyNamePlaceholder")}
          className="h-8 border border-border bg-background px-2 font-mono text-xs"
        />
        <fieldset className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
          <legend className="sr-only">{t("scopes")}</legend>
          {SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              {scope}
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || name.trim() === "" || scopes.length === 0}
            onClick={() => void create()}
          >
            {t("createKey")}
          </Button>
          {error ? (
            <span role="alert" className="font-mono text-[10px] text-destructive">
              {error}
            </span>
          ) : null}
        </div>
      </div>

      {created ? (
        <div
          data-slot="api-key-plaintext"
          role="status"
          className="flex flex-col gap-1 border border-warning px-2 py-1 font-mono text-[10px]"
        >
          <span>{t("copyKey")}</span>
          <code className="text-warning break-all">{created}</code>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">{t("noKeys")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {keys.map((key) => (
            <li
              key={key.id}
              data-slot="api-key-row"
              data-revoked={key.revoked ? "true" : "false"}
              className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
            >
              <span className="min-w-0 flex-1 truncate">{key.name}</span>
              <span className="text-muted-foreground">lifeos_live_{key.prefix}…</span>
              <span className="text-muted-foreground">{key.scopes.join(", ")}</span>
              <span className="text-muted-foreground">
                {key.revoked ? t("revoked") : key.lastUsedAt ? t("used") : t("neverUsed")}
              </span>
              {!key.revoked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={t("revokeAria", { name: key.name })}
                  onClick={() => void revoke(key.id)}
                >
                  {t("revoke")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
