import type { IWorkbookData } from "@univerjs/presets";

export type SimpleCell = string | number | boolean | null;
export const MAX_IMPORT_CELLS = 250_000;
export const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024; // keep under typical serverless/body limits

type UCell = { v?: string | number | boolean; t?: number; f?: string };
const STRING = 1,
  NUMBER = 2,
  BOOLEAN = 3; // matches Univer CellValueType

export function emptySheetSkeleton(
  id: string,
  name: string,
  rows: number,
  cols: number,
  cellData: Record<number, Record<number, UCell>>,
) {
  return {
    id,
    name,
    rowCount: Math.max(100, rows + 20),
    columnCount: Math.max(26, cols + 5),
    cellData,
  };
}

/** Builds a Univer workbook snapshot from plain sheet grids. Formulas are strings starting with "=". */
export function buildSnapshot(
  id: string,
  name: string,
  sheets: {
    name: string;
    rows: (SimpleCell | { f: string; v?: SimpleCell })[][];
  }[],
): Partial<IWorkbookData> {
  const out: Record<string, ReturnType<typeof emptySheetSkeleton>> = {};
  const order: string[] = [];
  sheets.forEach((sh, i) => {
    const sid = `sheet-${i + 1}`;
    const cellData: Record<number, Record<number, UCell>> = {};
    let cols = 0;
    sh.rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell === null || cell === undefined || cell === "") return;
        cols = Math.max(cols, c + 1);
        const u: UCell = {};
        if (typeof cell === "object") {
          u.f = cell.f.startsWith("=") ? cell.f : `=${cell.f}`;
          if (cell.v !== null && cell.v !== undefined) u.v = cell.v;
        } else if (typeof cell === "number") {
          u.v = cell;
          u.t = NUMBER;
        } else if (typeof cell === "boolean") {
          u.v = cell;
          u.t = BOOLEAN;
        } else {
          u.v = cell;
          u.t = STRING;
        }
        (cellData[r] ??= {})[c] = u;
      });
    });
    out[sid] = emptySheetSkeleton(
      sid,
      sh.name || `Sheet${i + 1}`,
      sh.rows.length,
      cols,
      cellData,
    );
    order.push(sid);
  });
  return {
    id,
    name,
    appVersion: "1.0.3",
    locale: "enUS" as IWorkbookData["locale"],
    styles: {},
    sheetOrder: order,
    sheets: out as unknown as IWorkbookData["sheets"],
  };
}

export function blankSnapshot(id: string, name: string) {
  return buildSnapshot(id, name, [{ name: "Sheet1", rows: [] }]);
}
