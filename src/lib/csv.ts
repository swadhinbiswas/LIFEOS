/**
 * CSV serialisation for board export (spec §6.1 "CSV in/out"). Pure and separately tested —
 * quoting rules (commas, quotes, newlines) are exactly the kind of thing that silently corrupts
 * a file, so they are not left inside a route handler.
 */

/** RFC 4180: wrap in quotes when needed and double any embedded quote. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map((column) => escapeCsvValue(column)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(","));
  // Trailing newline so the file ends with a record separator, as spreadsheets expect.
  return `${[header, ...body].join("\n")}\n`;
}
