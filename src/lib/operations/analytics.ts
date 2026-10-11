/**
 * Deterministic analysis operations: anomaly detection, linear forecast, sheet merge,
 * error scan and IFERROR wrapping. All results are computed here, never by the AI.
 * Helpers are injected by the engine to avoid a runtime import cycle.
 */
import type { Cell, Effect, PlanResult, SheetModel, WorkbookModel } from "./engine";
import type { Op } from "./schema";

export type Helpers = {
  resolveCol: (s: SheetModel, ref: string) => number | string;
  toNum: (v: Cell | undefined) => number | null;
  isBlank: (v: Cell | undefined) => boolean;
  colLetter: (i: number) => string;
};
type A<K extends Op["op"]> = Extract<Op, { op: K }>;
const fail = (error: string): PlanResult => ({ ok: false, error });
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function writeTable(model: WorkbookModel, name: string | undefined, table: Cell[][], effects: Effect[]): string | null {
  if (!name) return null;
  if (model.sheets.some((x) => x.name.toLowerCase() === name.toLowerCase()))
    return `A sheet named "${name}" already exists.`;
  effects.push({ t: "createSheet", name }, { t: "set", sheet: name, r: 0, c: 0, values: table });
  return null;
}

export function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (pos - lo);
}

/** Ordinary least squares on x = 0..n-1. */
export function linearFit(y: number[]) {
  const n = y.length;
  const mx = (n - 1) / 2;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (y[i] - my);
    sxx += (i - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

export function planDetectAnomalies(model: WorkbookModel, s: SheetModel, op: A<"detect_anomalies">, h: Helpers): PlanResult {
  if (s.values.length < 2) return fail(`Sheet "${s.name}" has no data rows.`);
  const ci = h.resolveCol(s, op.column);
  if (typeof ci === "string") return fail(ci);
  const rows: { r: number; v: number }[] = [];
  for (let r = 1; r < s.values.length; r++) {
    const v = h.toNum(s.values[r][ci]);
    if (v !== null) rows.push({ r, v });
  }
  if (rows.length < 8) return fail(`Need at least 8 numeric values in "${s.values[0][ci]}" to detect outliers (found ${rows.length}).`);
  const vals = rows.map((x) => x.v);
  const sorted = [...vals].sort((a, b) => a - b);
  let lo: number, hi: number, how: string;
  if (op.method === "zscore") {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
    if (sd === 0) return { ok: true, effects: [], summary: "All values are identical; no outliers.", destructive: false, table: [["Row", "Value"]] };
    const t = op.threshold ?? 3;
    lo = mean - t * sd; hi = mean + t * sd;
    how = `z-score beyond ±${t}`;
  } else {
    const q1 = quantile(sorted, 0.25), q3 = quantile(sorted, 0.75);
    const k = op.threshold ?? 1.5;
    lo = q1 - k * (q3 - q1); hi = q3 + k * (q3 - q1);
    how = `IQR rule (×${k})`;
  }
  const found = rows.filter((x) => x.v < lo || x.v > hi);
  const table: Cell[][] = [["Row", "Value", "Reason"], ...found.slice(0, 200).map((x) => [x.r + 1, x.v, x.v > hi ? `above ${fmt(hi)}` : `below ${fmt(lo)}`] as Cell[])];
  const effects: Effect[] = [];
  if (op.highlight)
    for (const x of found)
      effects.push({ t: "style", sheet: s.name, r: x.r, c: ci, rows: 1, cols: 1, bg: "#FFC7CE" });
  const werr = writeTable(model, op.write_to_sheet, table, effects);
  if (werr) return fail(werr);
  const name = String(s.values[0][ci]);
  return {
    ok: true,
    effects,
    summary: found.length
      ? `Found ${found.length} unusual value${found.length > 1 ? "s" : ""} of ${rows.length} in "${name}" using the ${how}. Outliers are candidates to review, not necessarily errors.${op.highlight ? " Highlighted (static formatting)." : ""}${op.write_to_sheet ? ` Written to "${op.write_to_sheet}".` : ""}`
      : `No outliers found in "${name}" (${rows.length} values, ${how}).`,
    destructive: false,
    table,
  };
}

export function planForecast(model: WorkbookModel, s: SheetModel, op: A<"forecast">, h: Helpers): PlanResult {
  const ci = h.resolveCol(s, op.column);
  if (typeof ci === "string") return fail(ci);
  const y: number[] = [];
  for (let r = 1; r < s.values.length; r++) {
    const v = h.toNum(s.values[r][ci]);
    if (v !== null) y.push(v);
  }
  if (y.length < 6) return fail(`Need at least 6 numeric values in "${s.values[0]?.[ci]}" to estimate a trend (found ${y.length}).`);
  const { slope, intercept, r2 } = linearFit(y);
  const table: Cell[][] = [["Period", "Forecast"]];
  for (let p = 1; p <= op.periods; p++) table.push([`+${p}`, Math.round((intercept + slope * (y.length - 1 + p)) * 100) / 100]);
  const strength = r2 >= 0.7 ? "strong" : r2 >= 0.4 ? "moderate" : "weak";
  const dir = Math.abs(slope) < 1e-9 ? "flat" : slope > 0 ? "rising" : "falling";
  const effects: Effect[] = [];
  const werr = writeTable(model, op.write_to_sheet, table, effects);
  if (werr) return fail(werr);
  return {
    ok: true,
    effects,
    summary: `Trend of "${s.values[0][ci]}" is ${dir} by about ${fmt(slope)} per row (fit R² = ${r2.toFixed(2)}, ${strength}). Forecast uses a straight line over ${y.length} values in row order, so it assumes rows are in time order and ignores seasonality. Treat it as an estimate.${op.write_to_sheet ? ` Written to "${op.write_to_sheet}".` : ""}`,
    destructive: false,
    table,
  };
}

export function planMergeSheets(model: WorkbookModel, op: A<"merge_sheets">): PlanResult {
  if (model.sheets.some((x) => x.name.toLowerCase() === op.into.toLowerCase()))
    return fail(`A sheet named "${op.into}" already exists.`);
  const picked: SheetModel[] = [];
  for (const n of op.sheets) {
    const s = model.sheets.find((x) => x.name.toLowerCase() === n.trim().toLowerCase());
    if (!s) return fail(`Sheet "${n}" not found. Available: ${model.sheets.map((x) => x.name).join(", ")}.`);
    if (!s.values.length) return fail(`Sheet "${s.name}" is empty.`);
    if (!picked.includes(s)) picked.push(s);
  }
  if (picked.length < 2) return fail("Pick at least two different sheets to merge.");
  const keyOf = (v: Cell) => String(v ?? "").trim().toLowerCase();
  const headers: string[] = [];
  const index = new Map<string, number>();
  for (const s of picked)
    for (const hd of s.values[0]) {
      const k = keyOf(hd);
      if (k && !index.has(k)) { index.set(k, headers.length); headers.push(String(hd).trim()); }
    }
  const out: Cell[][] = [[...headers, "Source sheet"]];
  for (const s of picked)
    for (let r = 1; r < s.values.length; r++) {
      const row: Cell[] = Array(headers.length + 1).fill(null);
      s.values[0].forEach((hd, c) => {
        const i = index.get(keyOf(hd));
        if (i !== undefined) row[i] = s.values[r][c];
      });
      if (row.slice(0, headers.length).every((v) => v === null || v === "")) continue;
      row[headers.length] = s.name;
      out.push(row);
    }
  if (out.length > 5001) return fail("The merged result would exceed 5,000 rows.");
  if (headers.length > 100) return fail("The merged result would exceed 100 columns.");
  return {
    ok: true,
    effects: [{ t: "createSheet", name: op.into }, { t: "set", sheet: op.into, r: 0, c: 0, values: out }],
    summary: `Merged ${picked.map((s) => `"${s.name}"`).join(", ")} into new sheet "${op.into}": ${out.length - 1} rows, ${headers.length} columns matched by header name (case-insensitive), plus a "Source sheet" column. Values only; formulas are not carried over. Originals are unchanged.`,
    destructive: false,
    table: out.slice(0, 13),
  };
}

const ERR = /^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|SPILL!|CALC!)/;

export function planFindErrors(model: WorkbookModel, s: SheetModel, op: A<"find_errors">, h: Helpers): PlanResult {
  if (!s.values.length) return fail(`Sheet "${s.name}" is empty.`);
  const table: Cell[][] = [["Cell", "Problem", "Detail"]];
  let formulaErrs = 0, typeIssues = 0;
  const width = Math.max(...s.values.map((r) => r.length));
  for (let r = 1; r < s.values.length; r++)
    for (let c = 0; c < width; c++) {
      const v = s.values[r][c];
      if (typeof v === "string" && ERR.test(v.trim())) {
        formulaErrs++;
        if (table.length <= 200) table.push([`${h.colLetter(c)}${r + 1}`, "Formula error", `${v.trim()}${s.formulas[r]?.[c] ? ` in ${s.formulas[r][c]}` : ""}`]);
      }
    }
  for (let c = 0; c < width; c++) {
    const col = s.values.slice(1).map((r) => r[c]).filter((v) => !h.isBlank(v));
    const nums = col.filter((v) => h.toNum(v) !== null).length;
    if (col.length >= 5 && nums / col.length >= 0.8 && nums < col.length) {
      for (let r = 1; r < s.values.length; r++) {
        const v = s.values[r][c];
        if (!h.isBlank(v) && h.toNum(v) === null && !(typeof v === "string" && ERR.test(v.trim()))) {
          typeIssues++;
          if (table.length <= 200) table.push([`${h.colLetter(c)}${r + 1}`, "Text in a numeric column", String(v).slice(0, 40)]);
        }
      }
    }
  }
  const effects: Effect[] = [];
  const werr = writeTable(model, op.write_to_sheet, table, effects);
  if (werr) return fail(werr);
  const total = formulaErrs + typeIssues;
  return {
    ok: true,
    effects,
    summary: total
      ? `Found ${total} issue${total > 1 ? "s" : ""} on "${s.name}": ${formulaErrs} formula error${formulaErrs === 1 ? "" : "s"}, ${typeIssues} text value${typeIssues === 1 ? "" : "s"} in mostly numeric columns.${total > 200 ? " Showing the first 200." : ""}`
      : `No formula errors or mixed-type numeric columns found on "${s.name}".`,
    destructive: false,
    table,
  };
}

export function planWrapIferror(s: SheetModel, op: A<"wrap_iferror">, h: Helpers): PlanResult {
  const ci = h.resolveCol(s, op.column);
  if (typeof ci === "string") return fail(ci);
  const fb = typeof op.fallback === "number" ? String(op.fallback) : `"${String(op.fallback).replace(/"/g, '""')}"`;
  const effects: Effect[] = [];
  for (let r = 1; r < s.values.length; r++) {
    const f = s.formulas[r]?.[ci];
    if (!f || /^=\s*IFERROR\(/i.test(f)) continue;
    effects.push({ t: "set", sheet: s.name, r, c: ci, values: [[`=IFERROR(${f.replace(/^=/, "")},${fb})`]] });
  }
  return {
    ok: true,
    effects,
    summary: effects.length
      ? `Wrap ${effects.length} formula${effects.length > 1 ? "s" : ""} in "${s.values[0][ci]}" with IFERROR(…, ${fb}). Errors will show ${fb} instead of hiding the cause, so review them first.`
      : `No unwrapped formulas found in "${s.values[0]?.[ci]}".`,
    destructive: false,
  };
}
