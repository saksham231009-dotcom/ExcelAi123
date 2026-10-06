import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { importToSnapshot, ImportError } from "@/lib/workbooks/import";

type Sheets = Record<
  string,
  {
    name: string;
    cellData: Record<number, Record<number, { v?: unknown; f?: string }>>;
  }
>;
const sheetsOf = (snap: { sheets?: unknown }) =>
  Object.values(snap.sheets as Sheets);

describe("importToSnapshot", () => {
  it("reads a real XLSX (values, numbers, formulas, multiple sheets)", async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("Sales");
    a.addRow(["Name", "Qty", "Total"]);
    a.addRow(["Pen", 2, { formula: "B2*10", result: 20 }]);
    a.addRow(["Ink", null, 5]);
    wb.addWorksheet("Other").addRow(["x"]);
    const buf = await wb.xlsx.writeBuffer();
    const snap = await importToSnapshot("id1", "T", "xlsx", buf as ArrayBuffer);
    const [s1, s2] = sheetsOf(snap);
    expect(s1.name).toBe("Sales");
    expect(s2.name).toBe("Other");
    expect(s1.cellData[0][0].v).toBe("Name");
    expect(s1.cellData[1][1].v).toBe(2);
    expect(s1.cellData[1][2].f).toBe("=B2*10");
    expect(s1.cellData[2][1]).toBeUndefined();
  });
  it("reads CSV with quotes, numbers and BOM", async () => {
    const csv = '\uFEFFname,amount\n"Smith, J",12.5\nLee,\n';
    const snap = await importToSnapshot(
      "id2",
      "T",
      "csv",
      new TextEncoder().encode(csv).buffer as ArrayBuffer,
    );
    const [s] = sheetsOf(snap);
    expect(s.cellData[1][0].v).toBe("Smith, J");
    expect(s.cellData[1][1].v).toBe(12.5);
    expect(s.cellData[2][1]).toBeUndefined();
  });
  it("rejects corrupted XLSX with a friendly error", async () => {
    await expect(
      importToSnapshot(
        "id3",
        "T",
        "xlsx",
        new TextEncoder().encode("not a zip").buffer as ArrayBuffer,
      ),
    ).rejects.toBeInstanceOf(ImportError);
  });
});
