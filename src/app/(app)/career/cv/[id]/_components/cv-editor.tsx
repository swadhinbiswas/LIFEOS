"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCvAction,
  restoreCvVersionAction,
  saveCvAction,
  saveCvVersionAction,
  setCvShareAction,
} from "@/server/cv/actions";
import type { AtsCheck } from "@/server/cv";
import type { CvDocument } from "@/server/cv/schema";

/**
 * The CV editor (spec §6.3): basics, experience, education, skills and projects over one JSON
 * Resume document, a live preview, the derived checklist, version snapshots with restore, the share
 * toggle and exports. Everything saves through the CV service; nothing is stored client-side.
 */
export function CvEditor({
  resumeId,
  title: initialTitle,
  document: initialDocument,
  checks,
  score,
  shareEnabled: initialShare,
  shareSlug: initialSlug,
  versions,
}: {
  resumeId: string;
  title: string;
  document: CvDocument;
  checks: AtsCheck[];
  score: number;
  shareEnabled: boolean;
  shareSlug: string | null;
  versions: Array<{ id: string; label: string | null; createdAt: string }>;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Cv");
  const [title, setTitle] = useState(initialTitle);
  const [doc, setDoc] = useState<CvDocument>(initialDocument);
  const [skillsText, setSkillsText] = useState(
    initialDocument.skills.map((s) => s.name).join(", "),
  );
  const [shareEnabled, setShareEnabled] = useState(initialShare);
  const [shareSlug, setShareSlug] = useState(initialSlug);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const patch = (values: Partial<CvDocument>) => setDoc((current) => ({ ...current, ...values }));
  const patchBasics = (values: Partial<CvDocument["basics"]>) =>
    setDoc((current) => ({ ...current, basics: { ...current.basics, ...values } }));

  const skillsFromText = (value: string) =>
    value
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "")
      .slice(0, 60)
      .map((name) => ({ name, keywords: [] as string[] }));

  const run = async (
    call: () => Promise<{ ok: boolean; message?: string; slug?: string | null }>,
  ) => {
    setBusy(true);
    setStatus("");
    setError("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("couldNotSave"));
      return;
    }
    setStatus(t("saved"));
    router.refresh();
  };

  const save = () =>
    run(() =>
      saveCvAction({
        id: resumeId,
        title,
        document: { ...doc, skills: skillsFromText(skillsText) },
      }),
    );

  return (
    <div className="flex flex-col gap-4" data-slot="cv-editor">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-64 flex-1 flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
          {t("cvTitle")}
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => void save()}
          data-slot="cv-save"
        >
          {busy ? t("saving") : t("save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void run(() => saveCvVersionAction({ id: resumeId }))}
        >
          {t("snapshot")}
        </Button>
        <a
          href={`/career/cv/${resumeId}/print`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-primary hover:underline"
        >
          {t("printPdf")}
        </a>
      </div>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {t("basics")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <Label htmlFor="cv-name">{t("name")}</Label>
            <Input
              id="cv-name"
              value={doc.basics.name}
              onChange={(e) => patchBasics({ name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label htmlFor="cv-label">{t("label")}</Label>
            <Input
              id="cv-label"
              value={doc.basics.label}
              onChange={(e) => patchBasics({ label: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label htmlFor="cv-email">{t("email")}</Label>
            <Input
              id="cv-email"
              type="email"
              value={doc.basics.email}
              onChange={(e) => patchBasics({ email: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label htmlFor="cv-url">{t("url")}</Label>
            <Input
              id="cv-url"
              value={doc.basics.url ?? ""}
              onChange={(e) => patchBasics({ url: e.target.value })}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <Label htmlFor="cv-summary">{t("summary")}</Label>
          <Textarea
            id="cv-summary"
            rows={4}
            value={doc.basics.summary}
            onChange={(e) => patchBasics({ summary: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <Label htmlFor="cv-skills">{t("skills")}</Label>
          <Input
            id="cv-skills"
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="Python, SQL, Spark"
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("experience")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              patch({
                work: [...doc.work, { name: "", position: "", summary: "", highlights: [] }],
              })
            }
          >
            {t("addRole")}
          </Button>
        </div>
        {doc.work.map((entry, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-[var(--radius)] border border-border p-2"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={entry.position}
                placeholder={t("role")}
                aria-label={t("role")}
                onChange={(e) => {
                  const work = [...doc.work];
                  work[index] = { ...entry, position: e.target.value };
                  patch({ work });
                }}
              />
              <Input
                value={entry.name}
                placeholder={t("company")}
                aria-label={t("company")}
                onChange={(e) => {
                  const work = [...doc.work];
                  work[index] = { ...entry, name: e.target.value };
                  patch({ work });
                }}
              />
              <Input
                value={entry.startDate ?? ""}
                placeholder="2023-01"
                aria-label={t("start")}
                onChange={(e) => {
                  const work = [...doc.work];
                  work[index] = { ...entry, startDate: e.target.value };
                  patch({ work });
                }}
              />
              <Input
                value={entry.endDate ?? ""}
                placeholder="2025-01"
                aria-label={t("end")}
                onChange={(e) => {
                  const work = [...doc.work];
                  work[index] = { ...entry, endDate: e.target.value };
                  patch({ work });
                }}
              />
            </div>
            <Textarea
              rows={3}
              value={entry.highlights.join("\n")}
              placeholder={t("highlightsPlaceholder")}
              aria-label={t("highlights")}
              onChange={(e) => {
                const work = [...doc.work];
                work[index] = { ...entry, highlights: e.target.value.split("\n").filter(Boolean) };
                patch({ work });
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-end"
              onClick={() => patch({ work: doc.work.filter((_, i) => i !== index) })}
            >
              {t("remove")}
            </Button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("education")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => patch({ education: [...doc.education, { institution: "" }] })}
          >
            {t("addEducation")}
          </Button>
        </div>
        {doc.education.map((entry, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-[var(--radius)] border border-border p-2 sm:grid-cols-2"
          >
            <Input
              value={entry.institution}
              placeholder={t("institution")}
              aria-label={t("institution")}
              onChange={(e) => {
                const education = [...doc.education];
                education[index] = { ...entry, institution: e.target.value };
                patch({ education });
              }}
            />
            <Input
              value={entry.studyType ?? ""}
              placeholder="BSc"
              aria-label={t("studyType")}
              onChange={(e) => {
                const education = [...doc.education];
                education[index] = { ...entry, studyType: e.target.value };
                patch({ education });
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="justify-self-start"
              onClick={() => patch({ education: doc.education.filter((_, i) => i !== index) })}
            >
              {t("remove")}
            </Button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {t("checklistTitle")}
        </p>
        <div className="flex items-center gap-2">
          <Progress value={score} aria-label={t("checklistTitle")} className="h-1.5 w-40" />
          <span className="font-mono text-[10px] tabular-nums">{score}%</span>
        </div>
        <ul className="flex flex-wrap gap-1">
          {checks.map((check) => (
            <li key={check.key}>
              <Badge
                variant="outline"
                className={`font-mono text-[10px] ${check.ok ? "text-success" : "text-muted-foreground"}`}
              >
                {check.ok ? "✓" : "·"} {t(`check_${check.key}`)}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {t("versionsTitle")}
        </p>
        {versions.length === 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground">{t("noVersions")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-muted-foreground tabular-nums">
                  {version.createdAt.slice(0, 16).replace("T", " ")}
                </span>
                <span className="min-w-0 flex-1 truncate">{version.label ?? ""}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(() => restoreCvVersionAction({ versionId: version.id, id: resumeId }))
                  }
                >
                  {t("restore")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await setCvShareAction({ id: resumeId, enabled: !shareEnabled });
              if (result.ok) {
                setShareEnabled(!shareEnabled);
                if (result.slug !== undefined) setShareSlug(result.slug);
              }
              return result;
            })
          }
        >
          {shareEnabled ? t("sharingOff") : t("sharingOn")}
        </Button>
        {shareEnabled && shareSlug ? (
          <a
            href={`/cv/${shareSlug}`}
            className="font-mono text-[10px] text-primary hover:underline"
          >
            /cv/{shareSlug}
          </a>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await deleteCvAction({ id: resumeId });
              if (result.ok) router.push("/career/cv");
              return result;
            })
          }
        >
          {t("delete")}
        </Button>
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
      </section>
    </div>
  );
}
