import Papa from "papaparse";
import type { Op } from "@/lib/operations/schema";

export const MAX_ATTACHMENT_BYTES = 1024 * 1024;
export const ATTACH_ACCEPT = ".csv,.tsv,.txt,.json";
const MAX_ROWS = 1000;
const MAX_COLS = 100;
export const MAX_PROMPT_CHARS = 6000;

export type Attachment = {
  name: string;
  kind: "table" | "text";
  /** Bounded text that is sent to the AI as untrusted data. */
  text: string;
  /** Parsed rows (tables only), capped at 1000 x 100. Never sent to the server. */
  rows?: (string | number | null)[][];
  truncated: boolean;
};
export type AttachResult = { ok: true; attachment: Attachment } | { ok: false; error: string };

/** Returns an error string if the file can't be read, otherwise null. Checked before reading. */
export function rejectReason(name: string, type: string, size: number): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext))
    return "Images can't be read yet: text recognition (OCR) isn't built. Type the data in, or attach a CSV.";
  if (type === "application/pdf" || ext === "pdf")
    return "PDF reading isn't supported yet. Attach a CSV/TXT/JSON file instead.";
  if (["xlsx", "xls", "xlsm"].includes(ext))
    return "To work with an Excel file, upload it from the dashboard as its own workbook.";
  if (!["csv", "tsv", "txt", "json"].includes(ext))
    return "Unsupported file type. You can attach .csv, .tsv, .txt or .json files.";
  if (size > MAX_ATTACHMENT_BYTES) return "That file is over 1 MB. Attach a smaller file.";
  if (size === 0) return "That file is empty.";
  return null;
}

const coerce = (c: string): string | number | null =>
  c === "" ? null : /^-?\d+(\.\d+)?$/.test(c.trim()) && c.trim().length < 16 ? Number(c) : c;

export function parseAttachment(name: string, text: string): AttachResult {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const clean = text.replace(/^\uFEFF/, "");
  if (clean.includes("\u0000")) return { ok: false, error: "That file looks binary, not text." };
  if (ext === "csv" || ext === "tsv") {
    const parsed = Papa.parse<string[]>(clean, {
      skipEmptyLines: true,
      delimiter: ext === "tsv" ? "\t" : "",
    });
    if (parsed.errors.some((e) => e.type === "Quotes"))
      return { ok: false, error: "This CSV is malformed (unbalanced quotes)." };
    if (!parsed.data.length) return { ok: false, error: "That file has no rows." };
    const all = parsed.data;
    const rows = all.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS).map(coerce));
    const truncated = all.length > MAX_ROWS || all.some((r) => r.length > MAX_COLS);
    const preview = Papa.unparse(all.slice(0, 21).map((r) => r.slice(0, 20).map((c) => c.slice(0, 60))));
    return {
      ok: true,
      attachment: { name, kind: "table", text: preview.slice(0, MAX_PROMPT_CHARS), rows, truncated },
    };
  }
  if (!clean.trim()) return { ok: false, error: "That file is empty." };
  return {
    ok: true,
    attachment: {
      name,
      kind: "text",
      text: clean.slice(0, MAX_PROMPT_CHARS),
      truncated: clean.length > MAX_PROMPT_CHARS,
    },
  };
}

/** Deterministic ops that put a parsed table on a NEW sheet (never overwrites existing data). */
export function attachmentToOps(att: Attachment, existingSheets: string[]): Op[] | null {
  if (att.kind !== "table" || !att.rows?.length) return null;
  const base = att.name.replace(/\.[^.]+$/, "").replace(/[\\/?*[\]:]/g, "_").slice(0, 80) || "Imported";
  const taken = new Set(existingSheets.map((s) => s.toLowerCase()));
  let name = base;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base.slice(0, 90)} ${i}`;
  const width = Math.max(...att.rows.map((r) => r.length));
  const col = (i: number) => {
    let s = "";
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const values = att.rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null));
  return [
    { op: "create_sheet", name },
    { op: "set_cells", sheet: name, range: `A1:${col(width - 1)}${values.length}`, values },
  ];
}
