import { describe, it, expect } from "vitest";
import {
  applyEffects,
  normalizeSheet,
  parseA1,
  planAll,
  planOp,
  verifyModels,
  type Cell,
  type WorkbookModel,
} from "@/lib/operations/engine";
import { opSchema, planSchema } from "@/lib/operations/schema";

const mk = (rows: Cell[][], name = "Sheet1"): WorkbookModel => ({
  active: name,
  sheets: [normalizeSheet(name, rows, [])],
});
const sales: Cell[][] = [
  ["Customer", "Product", "Revenue"],
  ["Ava", "Pen", 100],
  ["Ben", "Ink", 250],
  ["Ava", "Pen", 100],
  ["Cy", "Pad", null],
  ["ben", "Ink", "250"],
];
const run = (m: WorkbookModel, op: unknown) => {
  const r = planAll(m, [opSchema.parse(op)]);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe("remove_duplicates", () => {
  it("removes exact duplicate rows, keeps first, flags destructive", () => {
    const r = run(mk(sales), { op: "remove_duplicates" });
    expect(r.steps[0].destructive).toBe(true);
    expect(r.expected.sheets[0].values.map((x) => x[0])).toEqual([
      "Customer",
      "Ava",
      "Ben",
      "Cy",
      "ben",
    ]);
  });
  it("by selected column, case-insensitive", () => {
    const r = run(mk(sales), {
      op: "remove_duplicates",
      columns: ["customer"],
      ignore_case: true,
    });
    expect(r.expected.sheets[0].values.map((x) => x[0])).toEqual([
      "Customer",
      "Ava",
      "Ben",
      "Cy",
    ]);
  });
  it("reports none found without effects", () => {
    const r = run(mk([["a"], [1], [2]]), { op: "remove_duplicates" });
    expect(r.steps[0].effects).toEqual([]);
    expect(r.steps[0].summary).toMatch(/No duplicate/);
  });
  it("errors on unknown column and lists real headers", () => {
    const r = planAll(mk(sales), [
      opSchema.parse({ op: "remove_duplicates", columns: ["Nope"] }),
    ]);
    expect(!r.ok && r.error).toMatch(/Customer, Product, Revenue/);
  });
});

describe("sort", () => {
  it("sorts numerically desc with blanks last, header kept", () => {
    const r = run(mk(sales), { op: "sort", by: "Revenue", direction: "desc" });
    expect(r.expected.sheets[0].values.map((x) => x[2])).toEqual([
      "Revenue",
      250,
      "250",
      100,
      100,
      null,
    ]);
  });
  it("refuses to sort formula ranges", () => {
    const m = mk([
      ["a", "b"],
      [1, 2],
      [2, 3],
    ]);
    m.sheets[0].formulas[1][1] = "=A2*2";
    expect(planAll(m, [opSchema.parse({ op: "sort", by: "a" })]).ok).toBe(
      false,
    );
  });
});

describe("other operations", () => {
  it("add_column with formula uses real row numbers", () => {
    const r = run(mk(sales), {
      op: "add_column",
      header: "Tax",
      formula: "=C{row}*0.1",
    });
    expect(r.expected.sheets[0].formulas[1][3]).toBe("=C2*0.1");
    expect(r.expected.sheets[0].formulas[5][3]).toBe("=C6*0.1");
    expect(r.expected.sheets[0].values[0][3]).toBe("Tax");
  });
  it("delete_columns is destructive and removes the column", () => {
    const r = run(mk(sales), { op: "delete_columns", columns: ["Product"] });
    expect(r.steps[0].destructive).toBe(true);
    expect(r.expected.sheets[0].values[0]).toEqual(["Customer", "Revenue"]);
  });
  it("find_replace whole cell, case-insensitive", () => {
    const r = run(mk(sales), {
      op: "find_replace",
      find: "ava",
      replace: "Alice",
      column: "Customer",
      whole_cell: true,
    });
    expect(
      r.expected.sheets[0].values.filter((x) => x[0] === "Alice"),
    ).toHaveLength(2);
  });
  it("fill_blanks and clean_text", () => {
    expect(
      run(mk(sales), { op: "fill_blanks", column: "Revenue", value: 0 })
        .expected.sheets[0].values[4][2],
    ).toBe(0);
    const t = run(mk([["n"], ["  jOHN   smith "]]), {
      op: "clean_text",
      column: "n",
      mode: "titlecase",
    });
    expect(t.expected.sheets[0].values[1][0]).toBe("John Smith");
  });
  it("highlight emits style effects only for matches", () => {
    const r = run(mk(sales), {
      op: "highlight",
      condition: { column: "Revenue", operator: ">", value: 99 },
    });
    expect(r.steps[0].effects).toHaveLength(4);
  });
  it("sheet management", () => {
    const r = run(mk(sales), { op: "create_sheet", name: "Summary" });
    expect(r.expected.sheets.map((s) => s.name)).toEqual(["Sheet1", "Summary"]);
    expect(planOp(mk(sales), { op: "delete_sheet", name: "Sheet1" }).ok).toBe(
      false,
    );
  });
  it("query computes real numbers (sum, group, top_n)", () => {
    const sum = run(mk(sales), { op: "query", kind: "sum", column: "Revenue" })
      .steps[0];
    expect(sum.summary).toMatch(/700/);
    const grp = run(mk(sales), {
      op: "query",
      kind: "sum",
      column: "Revenue",
      group_by: "Product",
    }).steps[0];
    expect(grp.table?.[1]).toEqual(["Ink", 500]);
    const top = run(mk(sales), {
      op: "query",
      kind: "top_n",
      column: "Revenue",
      n: 1,
    }).steps[0];
    expect(top.table?.[1][0]).toBe("Ben");
  });
  it("query can write results to a new sheet", () => {
    const r = run(mk(sales), {
      op: "query",
      kind: "summary",
      write_to_sheet: "Stats",
    });
    expect(r.expected.sheets[1].name).toBe("Stats");
    expect(r.expected.sheets[1].values[0][0]).toBe("Column");
  });
  it("later steps see earlier steps' results", () => {
    const r = planAll(mk(sales), [
      opSchema.parse({ op: "remove_duplicates" }),
      opSchema.parse({ op: "query", kind: "count" }),
    ]);
    expect(r.ok && r.steps[1].summary).toMatch(/4/);
  });
});

describe("verifyModels / schema / A1", () => {
  it("verifies matching state and reports mismatches", () => {
    const r = run(mk(sales), { op: "sort", by: "Revenue" });
    expect(verifyModels(r.expected, r.expected)).toEqual([]);
    const tampered = applyEffects(r.expected, [
      { t: "set", sheet: "Sheet1", r: 1, c: 0, values: [["X"]] },
    ]);
    expect(verifyModels(r.expected, tampered)[0]).toMatch(/A2/);
  });
  it("rejects malformed operations", () => {
    expect(opSchema.safeParse({ op: "drop_database" }).success).toBe(false);
    expect(opSchema.safeParse({ op: "sort" }).success).toBe(false);
    expect(
      opSchema.safeParse({ op: "format", background: "red" }).success,
    ).toBe(false);
    expect(
      planSchema.safeParse({
        operations: Array(7).fill({ op: "create_sheet", name: "a" }),
      }).success,
    ).toBe(false);
  });
  it("parses A1", () => {
    expect(parseA1("B2:D10")).toEqual({ r: 1, c: 1, rows: 9, cols: 3 });
    expect(parseA1("D10:B2")).toBeNull();
  });
});
