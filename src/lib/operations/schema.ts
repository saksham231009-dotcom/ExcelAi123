import { z } from "zod";

const sheet = z.string().min(1).max(100).optional();
const col = z.string().min(1).max(100); // header name or column letter
const cellVal = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.null(),
]);
const a1 = z
  .string()
  .regex(
    /^[A-Za-z]{1,3}[0-9]{1,7}(:[A-Za-z]{1,3}[0-9]{1,7})?$/,
    "Use A1 notation like B2:D10",
  );
const cond = z.object({
  column: col,
  operator: z.enum([
    ">",
    "<",
    ">=",
    "<=",
    "==",
    "!=",
    "contains",
    "empty",
    "not_empty",
  ]),
  value: z.union([z.string(), z.number()]).optional(),
});

export const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_cells"),
    sheet,
    range: a1,
    values: z.array(z.array(cellVal).max(100)).max(1000),
  }),
  z.object({
    op: z.literal("add_column"),
    sheet,
    header: z.string().min(1).max(100),
    formula: z.string().max(500).optional(),
    after: col.optional(),
  }),
  z.object({
    op: z.literal("rename_column"),
    sheet,
    column: col,
    new_name: z.string().min(1).max(100),
  }),
  z.object({
    op: z.literal("delete_columns"),
    sheet,
    columns: z.array(col).min(1).max(20),
  }),
  z.object({
    op: z.literal("insert_rows"),
    sheet,
    after_row: z.number().int().min(0).max(1_000_000),
    count: z.number().int().min(1).max(1000),
  }),
  z.object({
    op: z.literal("delete_rows"),
    sheet,
    from_row: z.number().int().min(1),
    to_row: z.number().int().min(1),
  }),
  z.object({ op: z.literal("clear_range"), sheet, range: a1 }),
  z.object({
    op: z.literal("sort"),
    sheet,
    by: col,
    direction: z.enum(["asc", "desc"]).default("asc"),
  }),
  z.object({
    op: z.literal("remove_duplicates"),
    sheet,
    columns: z.array(col).max(50).optional(),
    ignore_case: z.boolean().default(false),
  }),
  z.object({
    op: z.literal("find_replace"),
    sheet,
    find: z.string().min(1).max(500),
    replace: z.string().max(500),
    column: col.optional(),
    match_case: z.boolean().default(false),
    whole_cell: z.boolean().default(false),
  }),
  z.object({
    op: z.literal("fill_blanks"),
    sheet,
    column: col,
    value: z.union([z.string().max(500), z.number()]),
  }),
  z.object({
    op: z.literal("clean_text"),
    sheet,
    column: col.optional(),
    mode: z.enum(["trim", "lowercase", "uppercase", "titlecase"]),
  }),
  z.object({
    op: z.literal("format"),
    sheet,
    range: a1.optional(),
    column: col.optional(),
    bold: z.boolean().optional(),
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    font_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    number_format: z.string().max(50).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
  }),
  z.object({
    op: z.literal("highlight"),
    sheet,
    condition: cond,
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#FFF3A3"),
  }),
  z.object({ op: z.literal("create_sheet"), name: z.string().min(1).max(100) }),
  z.object({
    op: z.literal("rename_sheet"),
    from: z.string().min(1).max(100),
    to: z.string().min(1).max(100),
  }),
  z.object({ op: z.literal("delete_sheet"), name: z.string().min(1).max(100) }),
  z.object({
    op: z.literal("detect_anomalies"),
    sheet,
    column: col,
    method: z.enum(["iqr", "zscore"]).default("iqr"),
    threshold: z.number().min(0.5).max(10).optional(),
    highlight: z.boolean().default(false),
    write_to_sheet: z.string().min(1).max(100).optional(),
  }),
  z.object({
    op: z.literal("forecast"),
    sheet,
    column: col,
    periods: z.number().int().min(1).max(60).default(3),
    write_to_sheet: z.string().min(1).max(100).optional(),
  }),
  z.object({
    op: z.literal("merge_sheets"),
    sheets: z.array(z.string().min(1).max(100)).min(2).max(10),
    into: z.string().min(1).max(100),
  }),
  z.object({
    op: z.literal("find_errors"),
    sheet,
    write_to_sheet: z.string().min(1).max(100).optional(),
  }),
  z.object({
    op: z.literal("wrap_iferror"),
    sheet,
    column: col,
    fallback: z.union([z.string().max(100), z.number()]).default(""),
  }),
  z.object({
    op: z.literal("query"),
    sheet,
    kind: z.enum(["top_n", "sum", "avg", "min", "max", "count", "summary"]),
    column: col.optional(),
    group_by: col.optional(),
    n: z.number().int().min(1).max(100).default(10),
    direction: z.enum(["desc", "asc"]).default("desc"),
    write_to_sheet: z.string().min(1).max(100).optional(),
  }),
]);
export type Op = z.infer<typeof opSchema>;

export const planSchema = z.object({
  message: z.string().max(2000).optional(),
  clarification: z.string().max(1000).optional(),
  /** 2-4 short answers the user can click when a clarification is needed. */
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(4).optional().catch(undefined),
  operations: z.array(opSchema).max(6).default([]),
});
export type Plan = z.infer<typeof planSchema>;
