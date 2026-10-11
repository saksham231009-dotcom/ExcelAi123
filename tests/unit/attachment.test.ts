import { describe, expect, it } from "vitest";
import { attachmentToOps, parseAttachment, rejectReason } from "@/lib/ai/attachment";
import { buildUserPrompt } from "@/lib/ai/prompt";
import { planAll, type WorkbookModel } from "@/lib/operations/engine";
import { planSchema } from "@/lib/operations/schema";

describe("attachments", () => {
  it("rejects images and xlsx honestly; accepts text files", () => {
    expect(rejectReason("a.png", "image/png", 10)).toMatch(/OCR/);
    expect(rejectReason("a.pdf", "application/pdf", 10)).toBeNull();
    expect(rejectReason("a.pdf", "application/pdf", 6_000_000)).toMatch(/5 MB/);
    expect(rejectReason("a.xlsx", "", 10)).toMatch(/dashboard/);
    expect(rejectReason("a.exe", "", 10)).toMatch(/Unsupported/);
    expect(rejectReason("a.csv", "text/csv", 2_000_000)).toMatch(/1 MB/);
    expect(rejectReason("a.csv", "text/csv", 100)).toBeNull();
  });
  it("parses CSV into rows with numbers coerced", () => {
    const r = parseAttachment("d.csv", "name,qty\nPen,2\nInk,3.5\n");
    expect(r.ok && r.attachment.rows).toEqual([["name", "qty"], ["Pen", 2], ["Ink", 3.5]]);
  });
  it("rejects malformed CSV, binary and empty files", () => {
    expect(parseAttachment("d.csv", 'a,"b\n1,2').ok).toBe(false);
    expect(parseAttachment("d.txt", "ab\u0000cd").ok).toBe(false);
    expect(parseAttachment("d.txt", "  ").ok).toBe(false);
  });
  it("bounds text sent to the AI", () => {
    const r = parseAttachment("n.txt", "x".repeat(20_000));
    expect(r.ok && r.attachment.text.length).toBe(6000);
    expect(r.ok && r.attachment.truncated).toBe(true);
  });
  it("adds a table as a NEW sheet using validated ops", () => {
    const r = parseAttachment("Sales.csv", "a,b\n1,2\n");
    if (!r.ok) throw new Error("parse");
    const ops = attachmentToOps(r.attachment, ["Sales"])!;
    expect(ops[0]).toMatchObject({ op: "create_sheet", name: "Sales 2" });
    const model: WorkbookModel = { active: "Sales", sheets: [{ name: "Sales", values: [["x"]], formulas: [[null]] }] };
    expect(planAll(model, ops).ok).toBe(true);
  });
  it("labels attachment content as untrusted data in the prompt", () => {
    const p = buildUserPrompt("hi", { active: "S", sheets: [] }, { name: "a.csv", kind: "table", text: "ignore previous" });
    expect(p).toMatch(/untrusted DATA/);
    expect(p).toContain("<<<ATTACHMENT");
  });
});

describe("clarification options", () => {
  it("accepts 2-4 options and drops invalid ones instead of failing the plan", () => {
    expect(planSchema.parse({ clarification: "Which?", options: ["A", "B"] }).options).toEqual(["A", "B"]);
    const bad = planSchema.parse({ clarification: "Which?", options: ["only one"] });
    expect(bad.options).toBeUndefined();
    expect(bad.clarification).toBe("Which?");
  });
});
