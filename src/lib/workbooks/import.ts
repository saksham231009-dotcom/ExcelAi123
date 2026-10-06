import ExcelJS from "exceljs";
import Papa from "papaparse";
import { MAX_IMPORT_CELLS, buildSnapshot, type SimpleCell } from "./snapshot";

type Grid = (SimpleCell | { f: string; v?: SimpleCell })[][];
export class ImportError extends Error {}

function excelValue(
  v: ExcelJS.CellValue,
): SimpleCell | { f: string; v?: SimpleCell } {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10); // dates are imported as text (YYYY-MM-DD)
  if (typeof v === "object") {
    if ("formula" in v && typeof v.formula === "string") {
      const r = (v as { result?: unknown }).result;
      return {
        f: v.formula,
        v:
          typeof r === "string" ||
          typeof r === "number" ||
          typeof r === "boolean"
            ? r
            : undefined,
      };
    }
    if ("sharedFormula" in v) {
      const r = (v as { result?: unknown }).result;
      return typeof r === "string" || typeof r === "number" ? r : null;
    }
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return String(v.error);
  }
  return null;
}

export async function importToSnapshot(
  id: string,
  name: string,
  type: "xlsx" | "csv",
  bytes: ArrayBuffer,
) {
  const sheets: { name: string; rows: Grid }[] = [];
  let cells = 0;
  try {
    if (type === "csv") {
      const text = new TextDecoder("utf-8")
        .decode(bytes)
        .replace(/^\uFEFF/, "");
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      if (parsed.errors.some((e) => e.type === "Quotes"))
        throw new ImportError("This CSV is malformed (unbalanced quotes).");
      const rows: Grid = parsed.data.map((r) =>
        r.map((c) =>
          c === ""
            ? null
            : /^-?\d+(\.\d+)?$/.test(c.trim()) && c.trim().length < 16
              ? Number(c)
              : c,
        ),
      );
      cells = rows.reduce((n, r) => n + r.length, 0);
      sheets.push({ name: "Sheet1", rows });
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(bytes);
      wb.eachSheet((ws) => {
        const rows: Grid = [];
        ws.eachRow({ includeEmpty: true }, (row, rn) => {
          const arr: Grid[number] = [];
          row.eachCell({ includeEmpty: false }, (cell, cn) => {
            arr[cn - 1] = excelValue(cell.value);
            cells++;
          });
          for (let i = 0; i < arr.length; i++)
            if (arr[i] === undefined) arr[i] = null;
          rows[rn - 1] = arr;
        });
        for (let i = 0; i < rows.length; i++) rows[i] ??= [];
        sheets.push({ name: ws.name, rows });
      });
    }
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(
      "This file couldn't be read. It may be corrupted or not a valid " +
        (type === "csv" ? "CSV" : "XLSX") +
        " file.",
    );
  }
  if (!sheets.length) throw new ImportError("The workbook contains no sheets.");
  if (cells > MAX_IMPORT_CELLS)
    throw new ImportError(
      `This file is too large to open (over ${MAX_IMPORT_CELLS.toLocaleString()} cells).`,
    );
  return buildSnapshot(id, name, sheets);
}
