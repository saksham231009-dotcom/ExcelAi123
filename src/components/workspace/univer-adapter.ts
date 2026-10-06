import type { FWorkbook, FWorksheet } from "@univerjs/preset-sheets-core";
import {
  normalizeSheet,
  type Cell,
  type Effect,
  type WorkbookModel,
} from "@/lib/operations/engine";

/** Reads the live Univer workbook into the engine's plain model. */
export function extractModel(wb: FWorkbook): WorkbookModel {
  const sheets = wb.getSheets().map((ws) => {
    const dr = ws.getDataRange();
    const r0 = dr.getRow(),
      c0 = dr.getColumn();
    const vals = dr.getValues(),
      fms = dr.getFormulas();
    const values: Cell[][] = [],
      formulas: (string | null)[][] = [];
    for (let r = 0; r < vals.length; r++) {
      values[r0 + r] = [];
      formulas[r0 + r] = [];
      for (let c = 0; c < vals[r].length; c++) {
        const f = fms[r]?.[c];
        const hasF = typeof f === "string" && f.startsWith("=");
        values[r0 + r][c0 + c] = hasF
          ? null
          : ((vals[r][c] as Cell | undefined) ?? null);
        formulas[r0 + r][c0 + c] = hasF ? f : null;
      }
    }
    for (let r = 0; r < values.length; r++) {
      values[r] ??= [];
      formulas[r] ??= [];
      for (let c = 0; c < Math.max(values[r].length, formulas[r].length); c++) {
        values[r][c] ??= null;
        formulas[r][c] ??= null;
      }
    }
    return normalizeSheet(ws.getSheetName(), values, formulas);
  });
  return { sheets, active: wb.getActiveSheet().getSheetName() };
}

function sheetOf(wb: FWorkbook, name: string): FWorksheet {
  const ws = wb.getSheetByName(name);
  if (!ws) throw new Error(`Sheet "${name}" not found.`);
  return ws;
}

/** Applies one low-level effect through Univer's own API (so undo/redo and formulas work normally). */
export function applyEffect(wb: FWorkbook, e: Effect): void {
  switch (e.t) {
    case "createSheet":
      wb.insertSheet(e.name);
      return;
    case "deleteSheet":
      if (!wb.deleteSheet(e.name))
        throw new Error(`Couldn't delete sheet "${e.name}".`);
      return;
    case "renameSheet":
      sheetOf(wb, e.from).setName(e.to);
      return;
    case "delRows":
      sheetOf(wb, e.sheet).deleteRows(e.r, e.n);
      return;
    case "insRows":
      sheetOf(wb, e.sheet).insertRows(e.r, e.n);
      return;
    case "delCols":
      sheetOf(wb, e.sheet).deleteColumns(e.c, e.n);
      return;
    case "insCols":
      sheetOf(wb, e.sheet).insertColumns(e.c, e.n);
      return;
    case "clear":
      sheetOf(wb, e.sheet).getRange(e.r, e.c, e.rows, e.cols).clearContent();
      return;
    case "style": {
      const ws = sheetOf(wb, e.sheet);
      const rg = ws.getRange(e.r, e.c, e.rows, e.cols);
      if (e.bold !== undefined) rg.setFontWeight(e.bold ? "bold" : "normal");
      if (e.bg) rg.setBackground(e.bg);
      if (e.color) rg.setFontColor(e.color);
      if (e.numfmt) rg.setNumberFormat(e.numfmt);
      if (e.align)
        rg.setHorizontalAlignment(e.align === "right" ? "normal" : e.align);
      return;
    }
    case "set": {
      const ws = sheetOf(wb, e.sheet);
      const rows = e.values.length,
        cols = Math.max(...e.values.map((r) => r.length));
      if (e.r + rows > ws.getMaxRows()) ws.setRowCount(e.r + rows + 20);
      if (e.c + cols > ws.getMaxColumns()) ws.setColumnCount(e.c + cols + 5);
      const isF = (v: Cell | undefined) =>
        typeof v === "string" && v.startsWith("=");
      const grid = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => e.values[r][c] ?? null),
      );
      const allFormulas = grid.every((row) => row.every(isF));
      if (allFormulas) {
        ws.getRange(e.r, e.c, rows, cols).setFormulas(
          grid.map((row) => row.map(String)),
        );
        return;
      }
      ws.getRange(e.r, e.c, rows, cols).setValues(
        grid.map((row) => row.map((v) => (v === null || isF(v) ? "" : v))),
      );
      grid.forEach((row, r) =>
        row.forEach((v, c) => {
          if (isF(v)) ws.getRange(e.r + r, e.c + c).setFormula(String(v));
        }),
      );
      return;
    }
  }
}
