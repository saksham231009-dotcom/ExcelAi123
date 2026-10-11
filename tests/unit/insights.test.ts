import { describe, expect, it } from "vitest";
import { applyEffects, planAll, planOp, verifyModels, type Cell, type WorkbookModel } from "@/lib/operations/engine";
import { mutatesWorkbook } from "@/lib/operations/registry";
import { opSchema } from "@/lib/operations/schema";

const sheet = (name: string, values: Cell[][], formulas?: (string | null)[][]) => ({ name, values, formulas: formulas ?? values.map((r) => r.map(() => null)) });
const wb = (...s: ReturnType<typeof sheet>[]): WorkbookModel => ({ sheets: s, active: s[0].name });
const op = (o: unknown) => opSchema.parse(o);

const sales = sheet("Sales", [
  ["Region", "Qty", "Price", "Total"],
  ["North", 2, 10, 20], ["South", 3, 10, 30], ["North", 4, 12, 48], ["East", 1, 10, 10],
  ["South", 5, 11, 55], ["North", 6, 12, 72], ["East", 2, 10, 20], ["South", 3, 9, 27],
], [[null, null, null, null], ...Array.from({ length: 8 }, (_, i) => [null, null, null, `=B${i + 2}*C${i + 2}`])]);

describe("explain_formula", () => {
  it("explains functions and references using real headers and values", () => {
    const m = wb(sheet("S", [["Qty", "Price", "Total"], [2, 10, 20]], [[null, null, null], [null, null, "=IF(A2>1,A2*B2,0)"]]));
    const r = planOp(m, op({ op: "explain_formula", cell: "C2" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary).toContain("=IF(A2>1,A2*B2,0)");
    expect(r.table).toEqual(expect.arrayContaining([["IF()", expect.stringMatching(/test is true/)], ["A2", "Qty in row 2 (currently 2)"], ["B2", "Price in row 2 (currently 10)"]]));
  });
  it("handles ranges, whole columns, strings and unknown functions", () => {
    const m = wb(sheet("S", [["A", "B"], [1, 2]], [[null, null], [null, '=FOO(SUM(A:A),"B2")+SUM(A2:A9)']]));
    const r = planOp(m, op({ op: "explain_formula", cell: "B2" }));
    expect(r.ok && r.table).toEqual(expect.arrayContaining([["FOO()", expect.stringMatching(/not in/)], ["A:A", 'the whole column "A"']]));
    expect(r.ok && JSON.stringify(r.table)).not.toContain('"B2"'); // text inside quotes is not a reference
  });
  it("refuses cells without formulas", () => {
    expect(planOp(wb(sales), op({ op: "explain_formula", cell: "B2" })).ok).toBe(false);
    expect(planOp(wb(sales), op({ op: "explain_formula", cell: "zz" })).ok).toBe(false);
  });
});

describe("data_health", () => {
  it("finds spacing, case, mixed type, blanks and duplicate rows", () => {
    const rows: Cell[][] = [["City", "Amt"], ["Paris ", 1], ["paris", 2], ["Rome", "x"], ["Rome", 4], ["Rome", 4], [null, 6], ["Oslo", 7], ["Oslo", 8], ["Oslo", 9], ["Bern", 10], ["Bern", 11]];
    const r = planOp(wb(sheet("D", rows)), op({ op: "data_health" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary).toMatch(/1 duplicate row/);
    expect(r.summary).toMatch(/extra spaces/);
    expect(r.summary).toMatch(/inconsistent case/);
    expect(r.summary).toMatch(/non-numeric/);
  });
  it("reports a clean sheet honestly", () => {
    const r = planOp(wb(sheet("D", [["A"], [1], [2], [3]])), op({ op: "data_health" }));
    expect(r.ok && r.summary).toMatch(/No obvious problems/);
  });
});

describe("suggest_rules", () => {
  it("suggests a few relevant highlights and applies nothing", () => {
    const rows: Cell[][] = [["Amt"], ...[10, 12, 11, 9, 10, 11, 12, -5, 10, 400].map((n) => [n] as Cell[])];
    const r = planOp(wb(sheet("R", rows)), op({ op: "suggest_rules" }));
    expect(r.ok && r.effects).toEqual([]);
    expect(r.ok && r.table!.map((x) => x[1])).toEqual(expect.arrayContaining(["Amt < 0", "unusual values (outliers)"]));
    expect(r.ok && r.summary).toMatch(/static formatting/);
  });
});

describe("create_dashboard", () => {
  it("builds a live-formula dashboard on a new sheet and verifies against its own simulation", () => {
    const m = wb(sales);
    const p = planAll(m, [op({ op: "create_dashboard" })]);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const d = p.expected.sheets.find((s) => s.name === "Dashboard")!;
    expect(d.formulas.flat()).toEqual(expect.arrayContaining(["=COUNTA('Sales'!A:A)-1", "=SUM('Sales'!B:B)", "=AVERAGE('Sales'!D:D)", '=SUMIF(\'Sales\'!A:A,"North",\'Sales\'!B:B)', '=COUNTIF(\'Sales\'!A:A,"South")']));
    expect(d.values.flat().join("|")).toMatch(/largest region/);
    expect(p.expected.sheets[0].values).toEqual(sales.values); // source untouched
    expect(verifyModels(p.expected, applyEffects(m, p.steps.flatMap((s) => s.effects)))).toEqual([]);
  });
  it("fails clearly on duplicate name, tiny or non-numeric data", () => {
    expect(planOp(wb(sales, sheet("Dashboard", [["x"]])), op({ op: "create_dashboard" })).ok).toBe(false);
    expect(planOp(wb(sheet("T", [["A"], ["x"]])), op({ op: "create_dashboard" })).ok).toBe(false);
    expect(planOp(wb(sheet("T", [["A"], ["x"], ["y"]])), op({ op: "create_dashboard" })).ok).toBe(false);
  });
  it("is classified as mutating; insight ops are read-only", () => {
    expect(mutatesWorkbook([op({ op: "create_dashboard" })])).toBe(true);
    expect(mutatesWorkbook([op({ op: "data_health" }), op({ op: "explain_formula", cell: "A1" }), op({ op: "suggest_rules" })])).toBe(false);
  });
});

describe("conditional_format (live rule)", () => {
  const m = wb(sheet("S", [["Qty"], [1], [-2]]));
  it("plans a live rule without changing cell values", () => {
    const p = planAll(m, [op({ op: "conditional_format", column: "Qty", operator: "<", value: 0 })]);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.steps[0].effects[0]).toMatchObject({ t: "condFormat", operator: "<", value: 0, bg: "#FFC7CE" });
    expect(p.expected.sheets[0].values).toEqual(m.sheets[0].values);
    expect(p.steps[0].summary).toMatch(/live rule/);
  });
  it("rejects missing values, non-numeric thresholds and unknown columns", () => {
    expect(planOp(m, op({ op: "conditional_format", column: "Qty", operator: ">" })).ok).toBe(false);
    expect(planOp(m, op({ op: "conditional_format", column: "Qty", operator: ">", value: "abc" })).ok).toBe(false);
    expect(planOp(m, op({ op: "conditional_format", column: "Nope", operator: "empty" })).ok).toBe(false);
    expect(planOp(m, op({ op: "conditional_format", column: "Qty", operator: "empty" })).ok).toBe(true);
  });
  it("is a mutating operation", () => {
    expect(mutatesWorkbook([op({ op: "conditional_format", column: "Qty", operator: "empty" })])).toBe(true);
  });
});
