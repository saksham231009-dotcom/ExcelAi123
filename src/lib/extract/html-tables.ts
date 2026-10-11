import { parse } from "node-html-parser";

export type ExtractedTable = { caption: string; rows: (string | number | null)[][] };
const MAX_ROWS = 1000, MAX_COLS = 50, MAX_TABLES = 10;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const coerce = (c: string) => (c === "" ? null : /^-?\d+(\.\d+)?$/.test(c) && c.length < 16 ? Number(c) : c);

/** Extracts <table> elements as plain values. Scripts/styles are dropped; nothing is executed. */
export function extractTables(html: string): { title: string; tables: ExtractedTable[] } {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } });
  const title = clean(root.querySelector("title")?.text ?? "");
  const tables: ExtractedTable[] = [];
  for (const t of root.querySelectorAll("table")) {
    if (t.querySelector("table")) continue; // skip layout tables that wrap other tables
    const rows: ExtractedTable["rows"] = [];
    for (const tr of t.querySelectorAll("tr").slice(0, MAX_ROWS)) {
      const row: (string | number | null)[] = [];
      for (const cell of tr.querySelectorAll("th,td").slice(0, MAX_COLS)) {
        const span = Math.min(Number(cell.getAttribute("colspan")) || 1, 10);
        row.push(coerce(clean(cell.text)));
        for (let i = 1; i < span && row.length < MAX_COLS; i++) row.push(null);
      }
      if (row.some((v) => v !== null)) rows.push(row);
    }
    if (rows.length >= 2 && Math.max(...rows.map((r) => r.length)) >= 2)
      tables.push({ caption: clean(t.querySelector("caption")?.text ?? ""), rows });
    if (tables.length >= MAX_TABLES) break;
  }
  return { title, tables };
}
