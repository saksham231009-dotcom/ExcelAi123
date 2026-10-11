import ExcelJS from "exceljs";
import Papa from "papaparse";
import {
  MAX_IMPORT_CELLS,
  buildSnapshot,
  type Cell,
  type SheetExtras,
  type SimpleCell,
} from "./snapshot";
import {
  dateToSerial,
  parseRange,
  toHex,
  toUniverStyle,
  type UStyle,
} from "./xlsx-style";

type Grid = Cell[][];
export class ImportError extends Error {}

type Raw = { v: SimpleCell; f?: string; isDate?: boolean };

function excelValue(v: ExcelJS.CellValue, notes: Set<string>): Raw {
  if (v === null || v === undefined) return { v: null };
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return { v };
  if (v instanceof Date) return { v: dateToSerial(v), isDate: true };
  if (typeof v === "object") {
    if ("formula" in v && typeof v.formula === "string") {
      const r = (v as { result?: unknown }).result;
      let res: SimpleCell = null;
      if (r instanceof Date) res = dateToSerial(r);
      else if (typeof r === "string" || typeof r === "number" || typeof r === "boolean") res = r;
      return { v: res, f: v.formula, isDate: r instanceof Date };
    }
    if ("sharedFormula" in v) {
      const r = (v as { result?: unknown }).result;
      return { v: typeof r === "string" || typeof r === "number" ? r : null };
    }
    if ("richText" in v) {
      notes.add("Rich text inside cells (mixed fonts or colours in one cell) was flattened to plain text.");
      return { v: v.richText.map((t) => t.text).join("") };
    }
    if ("hyperlink" in v) {
      notes.add("Hyperlinks were kept as plain text; the link targets were not preserved.");
      return { v: String((v as { text?: unknown }).text ?? "") };
    }
    if ("text" in v) return { v: String(v.text) };
    if ("error" in v) return { v: String(v.error) };
  }
  return { v: null };
}

export async function importWorkbook(
  id: string,
  name: string,
  type: "xlsx" | "csv",
  bytes: ArrayBuffer,
) {
  const sheets: { name: string; rows: Grid; extras?: SheetExtras }[] = [];
  const styles: Record<string, UStyle> = {};
  const notes = new Set<string>();
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
      const styleIds = new Map<string, string>();
      wb.eachSheet((ws) => {
        const rows: Grid = [];
        const extras: SheetExtras = {};
        const colWidths: Record<number, number> = {};
        const rowHeights: Record<number, number> = {};
        const hiddenCols: number[] = [];
        const hiddenRows: number[] = [];
        const sid = (st: UStyle | undefined) => {
          if (!st) return undefined;
          const key = JSON.stringify(st);
          let id = styleIds.get(key);
          if (!id) {
            id = `s${styleIds.size + 1}`;
            styleIds.set(key, id);
            styles[id] = st;
          }
          return id;
        };
        ws.eachRow({ includeEmpty: true }, (row, rn) => {
          const arr: Grid[number] = [];
          if (row.height) rowHeights[rn - 1] = Math.round((row.height * 4) / 3);
          if (row.hidden) hiddenRows.push(rn - 1);
          row.eachCell({ includeEmpty: true }, (cell, cn) => {
            const merged = cell.type === ExcelJS.ValueType.Merge;
            const raw = merged ? { v: null } : excelValue(cell.value, notes);
            if (cell.note) notes.add("Cell comments/notes were not preserved.");
            const st = sid(
              toUniverStyle(
                {
                  font: cell.font,
                  fill: cell.fill,
                  border: cell.border,
                  alignment: cell.alignment,
                  numFmt: cell.numFmt,
                },
                { isDate: raw.isDate, notes },
              ),
            );
            if (raw.v === null && raw.f === undefined && !st) return;
            cells++;
            arr[cn - 1] = { v: raw.v, f: raw.f, s: st };
          });
          for (let i = 0; i < arr.length; i++)
            if (arr[i] === undefined) arr[i] = null;
          rows[rn - 1] = arr;
        });
        for (let i = 0; i < rows.length; i++) rows[i] ??= [];
        const maxCols = Math.min(ws.columnCount, 16_384);
        for (let c = 1; c <= maxCols; c++) {
          const col = ws.getColumn(c);
          if (col.width) colWidths[c - 1] = Math.round(col.width * 7 + 5);
          if (col.hidden) hiddenCols.push(c - 1);
        }
        extras.colWidths = colWidths;
        extras.rowHeights = rowHeights;
        extras.hiddenCols = hiddenCols;
        extras.hiddenRows = hiddenRows;
        extras.merges = (ws.model.merges ?? [])
          .map((m) => parseRange(String(m)))
          .filter((m): m is NonNullable<typeof m> => !!m);
        const view = ws.views?.[0] as
          | { state?: string; xSplit?: number; ySplit?: number; showGridLines?: boolean }
          | undefined;
        if (view?.state === "frozen")
          extras.freeze = { xSplit: view.xSplit ?? 0, ySplit: view.ySplit ?? 0 };
        if (view?.showGridLines === false) extras.showGridlines = false;
        const tab = toHex(ws.properties?.tabColor);
        if (tab) extras.tabColor = tab;
        if (ws.state !== "visible") {
          extras.hidden = true;
        }
        if (((ws.model as unknown as { conditionalFormattings?: unknown[] }).conditionalFormattings?.length ?? 0) > 0)
          notes.add(`Sheet "${ws.name}": conditional formatting rules were not preserved.`);
        const dv = (ws as unknown as { dataValidations?: { model?: Record<string, unknown> } }).dataValidations?.model;
        if (dv && Object.keys(dv).length)
          notes.add(`Sheet "${ws.name}": data validation (drop-downs and input rules) was not preserved.`);
        if (ws.getImages().length)
          notes.add(`Sheet "${ws.name}": images were not preserved.`);
        if (ws.autoFilter)
          notes.add(`Sheet "${ws.name}": the filter setting was not preserved.`);
        sheets.push({ name: ws.name, rows, extras });
      });
      notes.add("Charts and pivot tables, if present, are not supported and were not imported.");
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
  return { snapshot: buildSnapshot(id, name, sheets, styles), warnings: [...notes] };
}

/** Back-compat wrapper that returns only the snapshot. */
export async function importToSnapshot(
  id: string,
  name: string,
  type: "xlsx" | "csv",
  bytes: ArrayBuffer,
) {
  return (await importWorkbook(id, name, type, bytes)).snapshot;
}
