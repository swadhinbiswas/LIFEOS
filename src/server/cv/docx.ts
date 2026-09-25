import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

import type { CvDocument } from "./schema";

/**
 * DOCX export (spec §6.3, ADR-017): a second renderer over the same JSON Resume document, using the
 * `docx` package. It is deliberately plain — real headings, real bullet lists, no text boxes — so an
 * ATS parses the same structure a human sees. Text stays selectable by definition.
 */

const dateRange = (start?: string, end?: string): string =>
  [start, end].filter((value) => value && value !== "").join(" – ");

export async function toDocx(document: CvDocument): Promise<Buffer> {
  const { basics, work, education, skills, projects } = document;
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({ text: basics.name || "Your name", heading: HeadingLevel.HEADING_1 }),
  );
  if (basics.label) children.push(new Paragraph({ children: [new TextRun(basics.label)] }));

  const contact = [
    basics.email,
    basics.url,
    [basics.location?.city, basics.location?.countryCode].filter(Boolean).join(", "),
  ]
    .filter((value) => value && value !== "")
    .join(" · ");
  if (contact) children.push(new Paragraph({ children: [new TextRun(contact)] }));
  if (basics.summary) children.push(new Paragraph({ text: basics.summary }));

  if (work.length > 0) {
    children.push(new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }));
    for (const entry of work) {
      children.push(
        new Paragraph({
          text: `${entry.position || "Role"} — ${entry.name || "Company"}`,
          heading: HeadingLevel.HEADING_3,
        }),
      );
      const dates = dateRange(entry.startDate, entry.endDate);
      if (dates) children.push(new Paragraph({ children: [new TextRun(dates)] }));
      if (entry.summary) children.push(new Paragraph({ text: entry.summary }));
      for (const highlight of entry.highlights) {
        children.push(new Paragraph({ text: highlight, bullet: { level: 0 } }));
      }
    }
  }

  if (education.length > 0) {
    children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }));
    for (const entry of education) {
      const title = [entry.studyType, entry.area].filter(Boolean).join(" ");
      children.push(
        new Paragraph({ text: title || entry.institution, heading: HeadingLevel.HEADING_3 }),
      );
      const dates = dateRange(entry.startDate, entry.endDate);
      children.push(
        new Paragraph({
          children: [new TextRun(`${entry.institution}${dates ? ` · ${dates}` : ""}`)],
        }),
      );
    }
  }

  if (skills.length > 0) {
    children.push(new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: skills.map((skill) => skill.name).join(", ") }));
  }

  if (projects.length > 0) {
    children.push(new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_2 }));
    for (const project of projects) {
      children.push(new Paragraph({ text: project.name, heading: HeadingLevel.HEADING_3 }));
      if (project.url) children.push(new Paragraph({ children: [new TextRun(project.url)] }));
      if (project.description) children.push(new Paragraph({ text: project.description }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
