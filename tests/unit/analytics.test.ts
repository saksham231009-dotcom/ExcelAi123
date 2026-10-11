import { describe, expect, it } from "vitest";
import { applyEffects, planAll, planOp, type Cell, type WorkbookModel } from "@/lib/operations/engine";
import { linearFit, quantile } from "@/lib/operations/analytics";
import { opSchema } from "@/lib/operations/schema";

const sheet = (name: string, values: Cell[][], formulas?: (string | null)[][]) => ({
  name,
  values,
  formulas: formulas ?? values.map((r) => r.map(() => null)),
});
const wb = (...s: ReturnType<typeof sheet>[]): WorkbookModel => ({ sheets: s, active: s[0].name });
const op = (o: unknown) => opSchema.parse(o);

describe("detect_anomalies", () => {
  const data: Cell[][] = [["Amount"], ...[10, 11, 9, 10, 12, 10, 11, 9, 10, 500].map((n) => [n] as Cell[])];
  it("finds the obvious outlier with IQR and highlights it only when asked", () => {
    const m = wb(sheet("S", data));
    const r = planOp(m, op({ op: "detect_anomalies", column: "Amount" }));
    expect(r.ok && r.table?.[1]).toEqual([11, 500, expect.stringMatching(/above/)]);
    expect(r.ok && r.effects).toEqual([]);
    const h = planOp(m, op({ op: "detect_anomalies", column: "Amount", highlight: true }));
    expect(h.ok && h.effects.length).toBe(1);
  });
  it("works with z-score and refuses tiny samples", () => {
    const z = planOp(wb(sheet("S", data)), op({ op: "detect_anomalies", column: "Amount", method: "zscore", threshold: 2.5 }));
    expect(z.ok && z.table?.length).toBe(2);
    const few = planOp(wb(sheet("S", [["A"], [1], [2]])), op({ op: "detect_anomalies", column: "A" }));
    expect(few.ok).toBe(false);
  });
  it("reports clean data honestly", () => {
    const r = planOp(wb(sheet("S", [["A"], ...Array.from({ length: 10 }, (_, i) => [10 + (i % 3)] as Cell[])])), op({ op: "detect_anomalies", column: "A" }));
    expect(r.ok && r.summary).toMatch(/No outliers/);
  });
});

describe("forecast", () => {
  it("fits a perfect line exactly", () => {
    const f = linearFit([2, 4, 6, 8, 10, 12]);
    expect(f.slope).toBeCloseTo(2);
    expect(f.r2).toBeCloseTo(1);
    const m = wb(sheet("S", [["Sales"], ...[2, 4, 6, 8, 10, 12].map((n) => [n] as Cell[])]));
    const r = planOp(m, op({ op: "forecast", column: "Sales", periods: 2, write_to_sheet: "F" }));
    expect(r.ok && r.table).toEqual([["Period", "Forecast"], ["+1", 14], ["+2", 16]]);
    expect(r.ok && r.summary).toMatch(/rising.*R² = 1\.00/);
  });
  it("refuses too little data and quantile is correct", () => {
    expect(planOp(wb(sheet("S", [["A"], [1], [2]])), op({ op: "forecast", column: "A" })).ok).toBe(false);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });
});

describe("merge_sheets", () => {
  const a = sheet("Jan", [["Name", "Amt"], ["x", 1], ["y", 2]]);
  const b = sheet("Feb", [["amt", "Name", "Region"], [3, "z", "N"]]);
  it("stacks rows, matches headers case-insensitively, adds source column", () => {
    const m = wb(a, b);
    const p = planAll(m, [op({ op: "merge_sheets", sheets: ["Jan", "Feb"], into: "All" })]);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const out = p.expected.sheets.find((s) => s.name === "All")!;
    expect(out.values).toEqual([
      ["Name", "Amt", "Region", "Source sheet"],
      ["x", 1, null, "Jan"],
      ["y", 2, null, "Jan"],
      ["z", 3, "N", "Feb"],
    ]);
    expect(p.expected.sheets.find((s) => s.name === "Jan")!.values.length).toBe(3); // originals untouched
  });
  it("rejects missing sheets, duplicate target and single sheet", () => {
    expect(planOp(wb(a, b), op({ op: "merge_sheets", sheets: ["Jan", "Nope"], into: "All" })).ok).toBe(false);
    expect(planOp(wb(a, b), op({ op: "merge_sheets", sheets: ["Jan", "Feb"], into: "jan" })).ok).toBe(false);
    expect(planOp(wb(a, b), op({ op: "merge_sheets", sheets: ["Jan", "jan"], into: "All" })).ok).toBe(false);
  });
});

describe("find_errors and wrap_iferror", () => {
  const m = wb(
    sheet("S", [["A", "B"], [1, "#DIV/0!"], [2, 5], [3, 6], [4, 7], [5, 8], ["abc", 9]], [[null, null], [null, "=A2/0"], [null, null], [null, null], [null, null], [null, null], [null, null]]),
  );
  it("finds formula errors and text in numeric columns", () => {
    const r = planOp(m, op({ op: "find_errors" }));
    expect(r.ok && r.table).toEqual([
      ["Cell", "Problem", "Detail"],
      ["B2", "Formula error", "#DIV/0! in =A2/0"],
      ["A7", "Text in a numeric column", "abc"],
    ]);
  });
  it("wraps formulas once in IFERROR with a safe fallback", () => {
    const r = planOp(m, op({ op: "wrap_iferror", column: "B", fallback: 'n/a "x"' }));
    expect(r.ok && r.effects).toEqual([{ t: "set", sheet: "S", r: 1, c: 1, values: [['=IFERROR(A2/0,"n/a ""x""")']] }]);
    if (!r.ok) return;
    const after = applyEffects(m, r.effects);
    expect(planOp(after, op({ op: "wrap_iferror", column: "B" })).ok && (planOp(after, op({ op: "wrap_iferror", column: "B" })) as { effects: unknown[] }).effects).toEqual([]);
  });
});
