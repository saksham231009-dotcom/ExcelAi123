import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { importWorkbook } from "@/lib/workbooks/import";
import { exportSnapshot, type Snap } from "@/lib/workbooks/export";

type S = {
  name: string;
  cellData: Record<number, Record<number, { v?: unknown; f?: string; s?: string; t?: number }>>;
  mergeData?: unknown[];
  freeze?: { xSplit: number; ySplit: number };
  columnData?: Record<number, { w?: number }>;
  rowData?: Record<number, { h?: number }>;
  showGridlines?: number;
  tabColor?: string;
};
const load = async (wb: ExcelJS.Workbook) =>
  importWorkbook("id", "T", "xlsx", (await wb.xlsx.writeBuffer()) as ArrayBuffer);
const sheets = (snap: { sheets?: unknown }) => Object.values(snap.sheets as Record<string, S>);
type StyleRec = { bg?: unknown; cl?: unknown; bd: { b: { s: number } }; n: { pattern: string } } & Record<string, unknown>;
const styles = (snap: { styles?: unknown }) => snap.styles as Record<string, StyleRec>;

function formatted() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1, showGridLines: false }],
    properties: { tabColor: { argb: "FF00AA00" } },
  });
  ws.addRow(["Item", "Date", "Amount"]);
  ws.addRow(["Pen", new Date(Date.UTC(2026, 9, 3)), 1234.5]);
  ws.mergeCells("A4:C4");
  ws.getCell("A4").value = "Merged note";
  const h = ws.getCell("A1");
  h.font = { bold: true, italic: true, size: 14, name: "Arial", color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  h.border = { bottom: { style: "medium", color: { argb: "FF000000" } } };
  h.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getCell("C2").numFmt = "#,##0.00";
  ws.getColumn(1).width = 30;
  ws.getRow(1).height = 30;
  return wb;
}

describe("import preserves formatting", () => {
  it("styles, fills, borders, fonts, alignment, number formats", async () => {
    const { snapshot } = await load(formatted());
    const [s] = sheets(snapshot);
    const st = styles(snapshot)[s.cellData[0][0].s!];
    expect(st).toMatchObject({ bl: 1, it: 1, fs: 14, ff: "Arial", ht: 2, vt: 2, tb: 3 });
    expect(st.bg).toEqual({ rgb: "#1F4E78" });
    expect(st.cl).toEqual({ rgb: "#FFFFFF" });
    expect(st.bd.b.s).toBe(8);
    expect(styles(snapshot)[s.cellData[1][2].s!].n.pattern).toBe("#,##0.00");
  });
  it("dates are serial numbers with a date format, not text", async () => {
    const { snapshot } = await load(formatted());
    const [s] = sheets(snapshot);
    const c = s.cellData[1][1];
    expect(c.v).toBe(46298); // 2026-10-03
    expect(c.t).toBe(2);
    expect(styles(snapshot)[c.s!].n.pattern).toBe("m/d/yyyy");
  });
  it("merges, widths, heights, freeze, gridlines, tab colour", async () => {
    const { snapshot } = await load(formatted());
    const [s] = sheets(snapshot);
    expect(s.mergeData).toEqual([{ startRow: 3, startColumn: 0, endRow: 3, endColumn: 2 }]);
    expect(s.columnData![0].w).toBe(215);
    expect(s.rowData![0].h).toBe(40);
    expect(s.freeze).toMatchObject({ xSplit: 1, ySplit: 1 });
    expect(s.showGridlines).toBe(0);
    expect(s.tabColor).toBe("#00AA00");
  });
  it("reports unsupported features instead of silently dropping them", async () => {
    const wb = formatted();
    const ws = wb.getWorksheet("Report")!;
    ws.addConditionalFormatting({
      ref: "C2:C3",
      rules: [{ type: "cellIs", operator: "greaterThan", formulae: [100], priority: 1, style: { font: { bold: true } } }],
    });
    ws.getCell("B3").value = { richText: [{ text: "a" }, { text: "b", font: { bold: true } }] };
    const { warnings } = await load(wb);
    expect(warnings.join("|")).toMatch(/conditional formatting/);
    expect(warnings.join("|")).toMatch(/Rich text/);
  });
});

describe("formula-heavy, multi-sheet and CSV", () => {
  it("keeps formulas with cached results across sheets", async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("Data");
    a.addRows([[1], [2], [3]]);
    a.getCell("B1").value = { formula: "SUM(A1:A3)", result: 6 };
    a.getCell("B2").value = { formula: "IF(B1>5,\"big\",\"small\")", result: "big" };
    const b = wb.addWorksheet("Calc");
    b.getCell("A1").value = { formula: "Data!B1*2", result: 12 };
    const { snapshot } = await load(wb);
    const [d, c] = sheets(snapshot);
    expect(d.cellData[0][1]).toMatchObject({ f: "=SUM(A1:A3)", v: 6 });
    expect(d.cellData[1][1]).toMatchObject({ f: '=IF(B1>5,"big","small")', v: "big" });
    expect(c.cellData[0][0]).toMatchObject({ f: "=Data!B1*2", v: 12 });
  });
  it("plain CSV still imports as numbers and text", async () => {
    const { snapshot, warnings } = await importWorkbook(
      "id", "T", "csv", new TextEncoder().encode("a,b\n1,x\n2.5,y\n").buffer as ArrayBuffer,
    );
    const [s] = sheets(snapshot);
    expect(s.cellData[1][0].v).toBe(1);
    expect(s.cellData[2][0].v).toBe(2.5);
    expect(s.cellData[0][1].v).toBe("b");
    expect(warnings).toEqual([]);
  });
});

describe("export round trip", () => {
  it("re-exports styles, merges, sizes, freeze, dates and formulas", async () => {
    const { snapshot } = await load(formatted());
    const out = exportSnapshot(snapshot as Snap);
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load((await out.xlsx.writeBuffer()) as ArrayBuffer);
    const ws = reread.getWorksheet("Report")!;
    expect(ws.getCell("A1").font).toMatchObject({ bold: true, italic: true, size: 14, name: "Arial" });
    expect(ws.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FF1F4E78" } });
    expect(ws.getCell("A1").border.bottom?.style).toBe("medium");
    expect(ws.getCell("A1").alignment).toMatchObject({ horizontal: "center", wrapText: true });
    expect(ws.getCell("B2").value).toEqual(new Date(Date.UTC(2026, 9, 3)));
    expect(ws.getCell("C2").numFmt).toBe("#,##0.00");
    expect(ws.model.merges).toEqual(["A4:C4"]);
    expect(ws.getColumn(1).width).toBeCloseTo(30, 0);
    expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 1 });
  });
});
