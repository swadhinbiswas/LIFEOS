import type { CvDocument } from "./schema";

/**
 * CV exports (spec §6.3, ADR-017): pure functions from one parsed document. Markdown and HTML are
 * text-first — a PDF printed from the HTML keeps selectable, ATS-parsable text (no images of text).
 */

const join = (parts: Array<string | undefined | false>): string => parts.filter(Boolean).join("\n");

const dateRange = (start?: string, end?: string): string =>
  [start, end].filter((value) => value && value !== "").join(" – ");

export function toJson(document: CvDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function toMarkdown(document: CvDocument): string {
  const { basics, work, education, skills, projects } = document;
  const contact = [basics.email, basics.url, basics.location?.city, basics.location?.countryCode]
    .filter((value) => value && value !== "")
    .join(" · ");

  const workBlock = work.map((entry) =>
    join([
      `### ${entry.position || "Role"} — ${entry.name || "Company"}`,
      dateRange(entry.startDate, entry.endDate),
      entry.summary,
      entry.highlights.length > 0
        ? entry.highlights.map((line) => `- ${line}`).join("\n")
        : undefined,
    ]),
  );

  const educationBlock = education.map((entry) =>
    join([
      `### ${[entry.studyType, entry.area].filter(Boolean).join(" ")}`.trim(),
      `${entry.institution || ""}${dateRange(entry.startDate, entry.endDate) ? ` · ${dateRange(entry.startDate, entry.endDate)}` : ""}`,
    ]),
  );

  return `${join([
    `# ${basics.name || "Your name"}`,
    basics.label,
    contact,
    "",
    basics.summary,
    workBlock.length > 0 ? `## Experience\n\n${workBlock.join("\n\n")}` : undefined,
    educationBlock.length > 0 ? `## Education\n\n${educationBlock.join("\n\n")}` : undefined,
    skills.length > 0 ? `## Skills\n\n${skills.map((skill) => skill.name).join(", ")}` : undefined,
    projects.length > 0
      ? `## Projects\n\n${projects
          .map(
            (project) =>
              `### ${project.name}${project.url ? ` (${project.url})` : ""}\n\n${project.description}`,
          )
          .join("\n\n")}`
      : undefined,
  ])}\n`;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A print-ready document. It carries its own minimal stylesheet so "Save as PDF" from the browser
 * produces a clean, single-column, ATS-parsable CV without a PDF library.
 */
export function toHtml(document: CvDocument, title: string): string {
  const { basics, work, education, skills, projects } = document;
  const contact = [
    basics.email,
    basics.url,
    [basics.location?.city, basics.location?.countryCode].filter(Boolean).join(", "),
  ]
    .filter((value) => value && value !== "")
    .join(" · ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title || basics.name || "CV")}</title>
<style>
  :root { color-scheme: light; }
  body { font: 11pt/1.45 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 2rem auto; max-width: 48rem; padding: 0 1rem; }
  h1 { font-size: 20pt; margin: 0; }
  h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #999; padding-bottom: 2px; margin-top: 1.4rem; }
  h3 { font-size: 11.5pt; margin: 0.8rem 0 0.1rem; }
  .meta { color: #444; font-size: 10pt; }
  ul { margin: 0.25rem 0 0.5rem 1.1rem; padding: 0; }
  @page { margin: 14mm; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(basics.name || "Your name")}</h1>
    ${basics.label ? `<p class="meta">${escapeHtml(basics.label)}</p>` : ""}
    ${contact ? `<p class="meta">${escapeHtml(contact)}</p>` : ""}
  </header>
  ${basics.summary ? `<p>${escapeHtml(basics.summary)}</p>` : ""}
  ${
    work.length > 0
      ? `<h2>Experience</h2>${work
          .map(
            (entry) => `<section>
    <h3>${escapeHtml(entry.position || "Role")} — ${escapeHtml(entry.name || "Company")}</h3>
    <p class="meta">${escapeHtml(dateRange(entry.startDate, entry.endDate))}</p>
    ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}
    ${
      entry.highlights.length > 0
        ? `<ul>${entry.highlights.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
        : ""
    }
  </section>`,
          )
          .join("")}`
      : ""
  }
  ${
    education.length > 0
      ? `<h2>Education</h2>${education
          .map(
            (entry) => `<section>
    <h3>${escapeHtml([entry.studyType, entry.area].filter(Boolean).join(" "))}</h3>
    <p class="meta">${escapeHtml(entry.institution || "")}${dateRange(entry.startDate, entry.endDate) ? ` · ${escapeHtml(dateRange(entry.startDate, entry.endDate))}` : ""}</p>
  </section>`,
          )
          .join("")}`
      : ""
  }
  ${skills.length > 0 ? `<h2>Skills</h2><p>${escapeHtml(skills.map((skill) => skill.name).join(", "))}</p>` : ""}
  ${
    projects.length > 0
      ? `<h2>Projects</h2>${projects
          .map(
            (project) => `<section>
    <h3>${escapeHtml(project.name)}${project.url ? ` <span class="meta">${escapeHtml(project.url)}</span>` : ""}</h3>
    ${project.description ? `<p>${escapeHtml(project.description)}</p>` : ""}
  </section>`,
          )
          .join("")}`
      : ""
  }
</body>
</html>
`;
}
