import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { OP_IDS, REGISTRY, mutatesWorkbook } from "@/lib/operations/registry";
import { opSchema } from "@/lib/operations/schema";

describe("operation registry", () => {
  it("matches the Zod schema exactly (no drift)", () => {
    const schemaIds = opSchema.options.map((o) => o.shape.op.value).sort();
    expect([...OP_IDS].sort()).toEqual(schemaIds);
    expect(new Set(OP_IDS).size).toBe(OP_IDS.length);
  });
  it("every operation appears in the AI prompt", () => {
    for (const r of REGISTRY) expect(SYSTEM_PROMPT).toContain(r.signature);
  });
  it("classifies read-only vs mutating plans", () => {
    expect(mutatesWorkbook([{ op: "query", kind: "sum", column: "A", n: 10, direction: "desc" }])).toBe(false);
    expect(mutatesWorkbook([{ op: "query", kind: "sum", column: "A", n: 10, direction: "desc", write_to_sheet: "R" }])).toBe(true);
    expect(mutatesWorkbook([{ op: "create_sheet", name: "X" }])).toBe(true);
  });
});
