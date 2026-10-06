import { z } from "zod";
import type { Cell, WorkbookModel } from "@/lib/operations/engine";

/** Compact description of the workbook sent to the AI. Never the full data. */
export const contextSchema = z.object({
  active: z.string().max(100),
  sheets: z
    .array(
      z.object({
        name: z.string().max(100),
        rows: z.number().int().min(0), // data rows (excluding header)
        cols: z.number().int().min(0),
        headers: z.array(z.string().max(60)).max(60),
        types: z.array(z.string().max(10)).max(60).optional(),
        blanks: z.array(z.number().int()).max(60).optional(),
        sample: z
          .array(
            z
              .array(
                z.union([
                  z.string().max(60),
                  z.number(),
                  z.boolean(),
                  z.null(),
                ]),
              )
              .max(60),
          )
          .max(5)
          .optional(),
      }),
    )
    .max(20),
});
export type AiContext = z.infer<typeof contextSchema>;

const MAX_COLS = 40;
const clip = (v: Cell): Cell =>
  typeof v === "string" && v.length > 50 ? v.slice(0, 50) + "…" : v;

export function buildContext(m: WorkbookModel, sampleRows = 4): AiContext {
  return {
    active: m.active,
    sheets: m.sheets.slice(0, 20).map((s) => {
      const header = (s.values[0] ?? []).slice(0, MAX_COLS);
      const data = s.values.slice(1);
      const isActive = s.name === m.active;
      const out: AiContext["sheets"][number] = {
        name: s.name,
        rows: data.length,
        cols: s.values[0]?.length ?? 0,
        headers: header.map((h, i) => String(clip(h ?? `Column ${i + 1}`))),
      };
      if (isActive) {
        out.types = header.map((_, c) => {
          const vals = data
            .map((r) => r[c])
            .filter((v) => v !== null && v !== "");
          if (!vals.length) return "empty";
          const n = vals.filter(
            (v) =>
              typeof v === "number" ||
              (typeof v === "string" && /^-?[\d,.]+$/.test(v.trim())),
          ).length;
          return n >= vals.length * 0.8 ? "number" : "text";
        });
        out.blanks = header.map(
          (_, c) => data.filter((r) => r[c] === null || r[c] === "").length,
        );
        out.sample = data
          .slice(0, sampleRows)
          .map(
            (r) =>
              r
                .slice(0, MAX_COLS)
                .map(clip) as AiContext["sheets"][number]["sample"] extends
                (infer T)[] | undefined
                ? T
                : never,
          );
      }
      return out;
    }),
  };
}
