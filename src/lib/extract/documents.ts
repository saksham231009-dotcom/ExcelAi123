import { extractTables, type ExtractedTable } from "./html-tables";

export type Extracted = { kind: "pdf" | "docx"; text: string; tables: ExtractedTable[]; pages?: number; truncated: boolean };
export class ExtractError extends Error {}
const MAX_PAGES = 30;
const MAX_TEXT = 200_000;

export async function extractPdf(bytes: Uint8Array): Promise<Extracted> {
  if (new TextDecoder("latin1").decode(bytes.slice(0, 5)) !== "%PDF-") throw new ExtractError("That file isn't a valid PDF.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: bytes, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  } catch {
    throw new ExtractError("This PDF couldn't be read. It may be corrupted or password-protected.");
  }
  const n = Math.min(doc.numPages, MAX_PAGES);
  const pages: string[] = [];
  for (let p = 1; p <= n; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const lines: { y: number; parts: { x: number; s: string }[] }[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const [, , , , x, y] = it.transform as number[];
      const line = lines.find((l) => Math.abs(l.y - y) < 2);
      if (line) line.parts.push({ x, s: it.str });
      else lines.push({ y, parts: [{ x, s: it.str }] });
    }
    lines.sort((a, b) => b.y - a.y);
    pages.push(lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(" ")).join("\n"));
  }
  const text = pages.join("\n\n").slice(0, MAX_TEXT);
  if (!text.trim())
    throw new ExtractError("This PDF has no readable text (it is probably a scan). Text recognition (OCR) isn't built yet.");
  return { kind: "pdf", text, tables: [], pages: doc.numPages, truncated: doc.numPages > MAX_PAGES || text.length >= MAX_TEXT };
}

/** Rejects zip bombs by summing declared uncompressed sizes before converting. */
async function assertSafeZip(bytes: Uint8Array) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  let total = 0;
  for (const f of Object.values(zip.files)) total += (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  if (total > 50 * 1024 * 1024) throw new ExtractError("This document expands to too large a size to read safely.");
}

export async function extractDocx(bytes: Uint8Array): Promise<Extracted> {
  try {
    await assertSafeZip(bytes);
    const mammoth = await import("mammoth");
    const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
    const { tables } = extractTables(html);
    const text = html.replace(/<\/(p|h\d|li|tr)>/g, "\n").replace(/<\/t[dh]>/g, "\t").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
    if (!text && !tables.length) throw new ExtractError("No text was found in this document.");
    return { kind: "docx", text: text.slice(0, MAX_TEXT), tables, truncated: text.length > MAX_TEXT };
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    throw new ExtractError("This Word file couldn't be read. It may be corrupted or not a .docx file.");
  }
}
