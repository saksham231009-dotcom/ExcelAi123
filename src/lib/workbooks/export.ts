import ExcelJS from "exceljs";
import { fromUniverStyle, serialToDate, toArgb, type UStyle } from "./xlsx-style";

type UCell = { v?: string | number | boolean | null; f?: string; s?: string | UStyle; t?: number };
type USheet = {
  name: string;
  cellData?: Record<string, Record<string, UCell>>;
  mergeData?: { startRow: number; startColumn: number; endRow: number; endColumn: number }[];
  freeze?: { xSplit?: number; ySplit?: number };
  rowData?: Record<string, { h?: number; hd?: number }>;
  columnData?: Record<string, { w?: number; hd?: number }>;
  showGridlines?: number;
  tabColor?: string;
  hidden?: number;
};
export type Snap = {
  sheetOrder?: string[];
  sheets?: Record<string, USheet>;
  styles?: Record<string, UStyle>;
};

const DATE_FMT = /[ymdhs]/i;
const isDateFormat = (p?: string) =>
  !!p && p !== "General" && DATE_FMT.test(p.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""));

/** Builds an .xlsx from a saved Univer snapshot, preserving values, formulas, styles, merges, sizes, freeze panes. */
export function exportSnapshot(snap: Snap): ExcelJS.Workbook {
  const out = new ExcelJS.Workbook();
  const used = new Set<string>();
  for (const sid of snap.sheetOrder ?? Object.keys(snap.sheets ?? {})) {
    const s = snap.sheets?.[sid];
    if (!s) continue;
    let nm = s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, "_") || "Sheet";
    for (let i = 2; used.has(nm.toLowerCase()); i++) nm = `${nm.slice(0, 28)} ${i}`;
    used.add(nm.toLowerCase());
    const ws = out.addWorksheet(nm, {
      properties: s.tabColor ? { tabColor: { argb: toArgb({ rgb: s.tabColor }) } } : undefined,
      state: s.hidden ? "hidden" : "visible",
      views: [
        {
          ...(s.freeze && (s.freeze.xSplit || s.freeze.ySplit)
            ? { state: "frozen" as const, xSplit: s.freeze.xSplit ?? 0, ySplit: s.freeze.ySplit ?? 0 }
            : {}),
          showGridLines: s.showGridlines !== 0,
        },
      ],
    });
    for (const [c, col] of Object.entries(s.columnData ?? {})) {
      const wc = ws.getColumn(Number(c) + 1);
      if (col.w) wc.width = Math.max(1, (col.w - 5) / 7);
      if (col.hd) wc.hidden = true;
    }
    for (const [r, row] of Object.entries(s.rowData ?? {})) {
      const wr = ws.getRow(Number(r) + 1);
      if (row.h) wr.height = (row.h * 3) / 4;
      if (row.hd) wr.hidden = true;
    }
    for (const [r, row] of Object.entries(s.cellData ?? {})) {
      for (const [c, cell] of Object.entries(row)) {
        const target = ws.getCell(Number(r) + 1, Number(c) + 1);
        const st = typeof cell.s === "string" ? snap.styles?.[cell.s] : cell.s;
        const parts = fromUniverStyle(st);
        const dateLike = isDateFormat(parts.numFmt) && typeof cell.v === "number";
        if (cell.f)
          target.value = {
            formula: cell.f.replace(/^=/, ""),
            result: (dateLike ? serialToDate(cell.v as number) : cell.v) ?? undefined,
          } as ExcelJS.CellFormulaValue;
        else if (cell.v !== undefined && cell.v !== null)
          target.value = dateLike ? serialToDate(cell.v as number) : cell.v;
        if (parts.font) target.font = parts.font;
        if (parts.fill) target.fill = parts.fill;
        if (parts.border) target.border = parts.border;
        if (parts.alignment) target.alignment = parts.alignment;
        if (parts.numFmt) target.numFmt = parts.numFmt;
      }
    }
    for (const m of s.mergeData ?? []) {
      try {
        ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1);
      } catch {
        /* overlapping merges in a damaged snapshot: skip */
      }
    }
  }
  return out;
}
