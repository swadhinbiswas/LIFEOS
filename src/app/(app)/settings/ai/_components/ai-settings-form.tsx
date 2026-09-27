"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TuiCheckbox } from "@/components/tui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CredentialSummary } from "@/server/ai/credentials";
import { AI_PROVIDERS, type AiPrefs, type AiProvider } from "@/server/ai/prefs";
import { AUTO_APPROVABLE_TOOLS } from "@/server/ai/tools/catalog";
import type { UsageSummary } from "@/server/ai/usage";
import { controlField } from "@/components/tui/controls";
import {
  deleteCredentialAction,
  saveAiPrefsAction,
  saveCredentialAction,
  testAiConnectionAction,
  listCommandCodeModelsAction,
} from "@/server/ai/actions";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  openrouter: "OpenRouter",
  commandcode: "Command Code",
  compatible: "Ollama / OpenAI-compatible",
};

export function AiSettingsForm({
  prefs,
  credentials,
  encryptionOn,
  usage,
}: {
  prefs: AiPrefs;
  credentials: CredentialSummary[];
  encryptionOn: boolean;
  usage: UsageSummary;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.AiSettings");
  const [provider, setProvider] = useState<AiProvider>(prefs.provider ?? "openai");
  const [model, setModel] = useState(prefs.model ?? "");
  const [key, setKey] = useState("");
  const [autoApprove, setAutoApprove] = useState<string[]>(prefs.autoApprove);
  const [memoryEnabled, setMemoryEnabled] = useState(prefs.memoryEnabled);
  const [morningBrief, setMorningBrief] = useState(prefs.morningBrief);
  const [fridayReview, setFridayReview] = useState(prefs.fridayReview);
  const [zdr, setZdr] = useState(prefs.commandCodeZdr);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<Array<{ id: string; shape: string }>>([]);
  const [catalogNote, setCatalogNote] = useState("");

  const stored = credentials.find((credential) => credential.provider === provider);

  const run = async (call: () => Promise<{ ok: boolean; message?: string }>, done: string) => {
    setBusy(true);
    setError("");
    setStatus("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("couldNotSave"));
      return;
    }
    setStatus(done);
    router.refresh();
  };

  const saveKey = () =>
    run(
      () =>
        saveCredentialAction({
          provider,
          key: key.trim(),
          ...(model.trim() ? { model: model.trim() } : {}),
        }),
      t("saved"),
    ).then(() => setKey(""));

  const removeKey = () => run(() => deleteCredentialAction({ provider }), t("saved"));

  const savePrefs = () =>
    run(
      () =>
        saveAiPrefsAction({
          provider,
          ...(model.trim() ? { model: model.trim() } : {}),
          autoApprove,
          memoryEnabled,
          morningBrief,
          fridayReview,
          commandCodeZdr: zdr,
        }),
      t("saved"),
    );

  // Their catalog is the only trustworthy model list (ADR-134), so it is read on request rather
  // than typed here. A failure is a note, not an error state: the model field stays a free-text box,
  // because a model this page has never heard of is still a model the user can call.
  const loadCatalog = async () => {
    setBusy(true);
    const result = await listCommandCodeModelsAction();
    setBusy(false);
    if (!result.ok || !result.models) {
      setCatalog([]);
      setCatalogNote(result.message ?? t("catalogNone"));
      return;
    }
    setCatalog(result.models);
    setCatalogNote(
      result.models.length === 0
        ? t("catalogNone")
        : t("catalogCount", { count: result.models.length }),
    );
  };

  return (
    <form
      method="post"
      className="flex flex-col gap-4 text-xs"
      data-slot="ai-settings"
      onSubmit={(event) => {
        event.preventDefault();
        void savePrefs();
      }}
    >
      <p className="font-mono text-[10px] text-muted-foreground">{t("intro")}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ai-provider">{t("provider")}</Label>
          <select
            id="ai-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as AiProvider)}
            className={controlField}
          >
            {AI_PROVIDERS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {PROVIDER_LABELS[candidate]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ai-model">{t("model")}</Label>
          <input
            id="ai-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder={t("modelPlaceholder")}
            // The list is a suggestion, never a limit: it stays a text input so a model released
            // after this page loaded can still be typed.
            list={
              provider === "commandcode" && catalog.length > 0 ? "commandcode-models" : undefined
            }
            className={`${controlField} w-56`}
          />
          {provider === "commandcode" && catalog.length > 0 ? (
            <datalist id="commandcode-models">
              {catalog.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.shape === "anthropic" ? t("shapeMessages") : t("shapeChat")}
                </option>
              ))}
            </datalist>
          ) : null}
        </div>
        {provider === "commandcode" ? (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-muted-foreground" id="catalog-label">
              {catalogNote || t("catalogHint")}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              aria-describedby="catalog-label"
              onClick={() => void loadCatalog()}
            >
              {busy ? t("loading") : t("loadModels")}
            </Button>
          </div>
        ) : null}
      </div>

      {provider === "commandcode" ? (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <TuiCheckbox
            checked={zdr}
            onCheckedChange={(checked) => setZdr(checked)}
            className="normal-case"
          >
            {t("zdr")}
          </TuiCheckbox>
          {/* Why it is off by default, in the place the person is about to turn it on. Their docs
              are explicit that a model with no ZDR-capable upstream fails with a 422 rather than
              falling back, so this is a tradeoff and not a free privacy win. */}
          <p className="font-mono text-[10px] text-muted-foreground">{t("zdrHint")}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label htmlFor="ai-key">{t("key")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="ai-key"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={encryptionOn ? t("keyPlaceholder") : t("encryptionOff")}
            disabled={!encryptionOn}
            className={`${controlField} w-72`}
            autoComplete="off"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !encryptionOn || key.trim().length < 8}
            onClick={() => void saveKey()}
          >
            {t("saveKey")}
          </Button>
          {stored ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void removeKey()}
            >
              {t("removeKey")}
            </Button>
          ) : null}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {stored ? t("stored", { hint: stored.hint }) : t("none")}
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-mono text-[10px] text-muted-foreground uppercase">
          {t("autoApprove")}
        </legend>
        <p className="font-mono text-[10px] text-muted-foreground">{t("autoApproveHint")}</p>
        {AUTO_APPROVABLE_TOOLS.map((tool) => (
          <TuiCheckbox
            key={tool}
            checked={autoApprove.includes(tool)}
            onCheckedChange={(checked) =>
              setAutoApprove((current) =>
                checked
                  ? [...new Set([...current, tool])]
                  : current.filter((name) => name !== tool),
              )
            }
            className="normal-case"
          >
            {tool}
          </TuiCheckbox>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <TuiCheckbox
          checked={memoryEnabled}
          onCheckedChange={(checked) => setMemoryEnabled(checked)}
          className="normal-case"
        >
          {t("memory")}
        </TuiCheckbox>
        <TuiCheckbox
          checked={fridayReview}
          onCheckedChange={(checked) => setFridayReview(checked)}
          className="normal-case"
        >
          {t("fridayReview")}
        </TuiCheckbox>
        <label className="flex items-center gap-2 font-mono text-xs">
          {t("morningBrief")}
          <select
            value={morningBrief}
            onChange={(event) => setMorningBrief(event.target.value as AiPrefs["morningBrief"])}
            className={controlField}
          >
            <option value="off">{t("off")}</option>
            <option value="in_app">{t("inApp")}</option>
            <option value="email">{t("email")}</option>
          </select>
        </label>
      </div>

      <p className="font-mono text-[10px] text-muted-foreground">{t("privacy")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("saving") : t("savePreferences")}
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {usage.runs > 0
            ? t("usage", {
                runs: usage.runs,
                input: usage.inputTokens,
                output: usage.outputTokens,
              })
            : t("usageNone")}
        </span>
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setTestStatus("");
            const result = await testAiConnectionAction();
            setBusy(false);
            setTestStatus(
              result.ok
                ? t("testOk", { provider: result.provider ?? "", model: result.model ?? "" })
                : t("testFailed", { message: result.message ?? "" }),
            );
          }}
        >
          {busy ? t("testing") : t("testConnection")}
        </Button>
        {testStatus ? (
          <span role="status" className="font-mono text-[10px] text-muted-foreground">
            {testStatus}
          </span>
        ) : null}
      </div>
    </form>
  );
}
