import { describe, expect, it } from "vitest";
import { buildContext, contextSchema } from "@/lib/ai/context";
import { normalizeSheet } from "@/lib/operations/engine";

describe("buildContext (token efficiency)", () => {
  const rows = [
    ["Name", "Revenue", "Notes"],
    ...Array.from({ length: 20000 }, (_, i) => [
      `Customer ${i}`,
      i * 3,
      "x".repeat(200),
    ]),
  ];
  const m = {
    active: "Data",
    sheets: [
      normalizeSheet("Data", rows, []),
      normalizeSheet("Other", [["a"], [1], [2]], []),
    ],
  };
  const ctx = buildContext(m);
  it("sends metadata and at most 4 clipped sample rows, never the data", () => {
    expect(ctx.sheets[0].rows).toBe(20000);
    expect(ctx.sheets[0].sample).toHaveLength(4);
    expect(String(ctx.sheets[0].sample![0][2]).length).toBeLessThanOrEqual(51);
    expect(ctx.sheets[1].sample).toBeUndefined();
    expect(JSON.stringify(ctx).length).toBeLessThan(2000);
  });
  it("infers column types and blanks", () => {
    expect(ctx.sheets[0].types).toEqual(["text", "number", "text"]);
  });
  it("passes its own schema", () => {
    expect(contextSchema.safeParse(ctx).success).toBe(true);
  });
});
