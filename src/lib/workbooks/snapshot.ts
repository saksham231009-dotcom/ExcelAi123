import type { IWorkbookData } from "@univerjs/presets";

export type SimpleCell = string | number | boolean | null;
export const MAX_IMPORT_CELLS = 250_000;
export const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024; // keep under typical serverless/body limits

type UCell = { v?: string | number | boolean; t?: number; f?: string; s?: string };
export type RichCell = { f?: string; v?: SimpleCell; s?: string };
export type Cell = SimpleCell | RichCell;
export type SheetExtras = {
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  hiddenCols?: number[];
  hiddenRows?: number[];
  merges?: { startRow: number; startColumn: number; endRow: number; endColumn: number }[];
  freeze?: { xSplit: number; ySplit: number };
  showGridlines?: boolean;
  tabColor?: string;
  hidden?: boolean;
};
const STRING = 1,
  NUMBER = 2,
  BOOLEAN = 3; // matches Univer CellValueType

export function emptySheetSkeleton(
  id: string,
  name: string,
  rows: number,
  cols: number,
  cellData: Record<number, Record<number, UCell>>,
  extras: SheetExtras = {},
) {
  const sheet: Record<string, unknown> = {
    id,
    name,
    rowCount: Math.max(100, rows + 20),
    columnCount: Math.max(26, cols + 5),
    cellData,
  };
  if (extras.merges?.length) sheet.mergeData = extras.merges;
  if (extras.freeze && (extras.freeze.xSplit || extras.freeze.ySplit))
    sheet.freeze = {
      xSplit: extras.freeze.xSplit,
      ySplit: extras.freeze.ySplit,
      startRow: extras.freeze.ySplit,
      startColumn: extras.freeze.xSplit,
    };
  if (extras.showGridlines === false) sheet.showGridlines = 0;
  if (extras.tabColor) sheet.tabColor = extras.tabColor;
  if (extras.hidden) sheet.hidden = 1;
  const rowData: Record<number, { h?: number; hd?: number }> = {};
  for (const [r, h] of Object.entries(extras.rowHeights ?? {})) rowData[+r] = { h };
  for (const r of extras.hiddenRows ?? []) (rowData[r] ??= {}).hd = 1;
  if (Object.keys(rowData).length) sheet.rowData = rowData;
  const columnData: Record<number, { w?: number; hd?: number }> = {};
  for (const [c, w] of Object.entries(extras.colWidths ?? {})) columnData[+c] = { w };
  for (const c of extras.hiddenCols ?? []) (columnData[c] ??= {}).hd = 1;
  if (Object.keys(columnData).length) sheet.columnData = columnData;
  return sheet as {
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
    cellData: Record<number, Record<number, UCell>>;
  };
}

/** Builds a Univer workbook snapshot from plain sheet grids. Formulas are strings starting with "=". */
export function buildSnapshot(
  id: string,
  name: string,
  sheets: { name: string; rows: Cell[][]; extras?: SheetExtras }[],
  styles: Record<string, unknown> = {},
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
          if (cell.s) u.s = cell.s;
          if (cell.f) {
            u.f = cell.f.startsWith("=") ? cell.f : `=${cell.f}`;
            if (cell.v !== null && cell.v !== undefined) u.v = cell.v;
          } else if (typeof cell.v === "number") {
            u.v = cell.v;
            u.t = NUMBER;
          } else if (typeof cell.v === "boolean") {
            u.v = cell.v;
            u.t = BOOLEAN;
          } else if (typeof cell.v === "string" && cell.v !== "") {
            u.v = cell.v;
            u.t = STRING;
          }
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
      sh.extras,
    );
    order.push(sid);
  });
  return {
    id,
    name,
    appVersion: "1.0.3",
    locale: "enUS" as IWorkbookData["locale"],
    styles: styles as IWorkbookData["styles"],
    sheetOrder: order,
    sheets: out as unknown as IWorkbookData["sheets"],
  };
}

export function blankSnapshot(id: string, name: string) {
  return buildSnapshot(id, name, [{ name: "Sheet1", rows: [] }]);
}
