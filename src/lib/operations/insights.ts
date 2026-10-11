/**
 * Deterministic insight operations: formula explanation, data health, rule suggestions, live dashboard.
 * Everything is computed here from the workbook; the AI only chooses the operation.
 */
import { linearFit, quantile, type Helpers } from "./analytics";
import type { Cell, Effect, PlanResult, SheetModel, WorkbookModel } from "./engine";
import type { Op } from "./schema";

type A<K extends Op["op"]> = Extract<Op, { op: K }>;
const fail = (error: string): PlanResult => ({ ok: false, error });
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const colIndex = (s: string) => [...s.replace(/\$/g, "").toUpperCase()].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
const q = (name: string) => `'${name.replace(/'/g, "''")}'`;

const GLOSSARY: Record<string, string> = {
  SUM: "adds numbers together", AVERAGE: "takes the average of numbers", MIN: "finds the smallest number", MAX: "finds the largest number",
  COUNT: "counts cells that contain numbers", COUNTA: "counts cells that are not empty", COUNTIF: "counts cells that match a condition",
  COUNTIFS: "counts cells that match several conditions", SUMIF: "adds numbers that match a condition", SUMIFS: "adds numbers that match several conditions",
  AVERAGEIF: "averages numbers that match a condition", IF: "returns one result if a test is true and another if it is false",
  IFERROR: "shows a fallback value instead of an error", IFNA: "shows a fallback value when a lookup finds nothing",
  AND: "is true only if all conditions are true", OR: "is true if any condition is true", NOT: "reverses true/false",
  VLOOKUP: "looks a value up in the first column of a table and returns a value from another column", HLOOKUP: "looks a value up in the first row of a table",
  XLOOKUP: "looks a value up and returns the matching result", INDEX: "returns the value at a position in a range", MATCH: "finds the position of a value in a range",
  ROUND: "rounds a number", ROUNDUP: "rounds a number up", ROUNDDOWN: "rounds a number down", ABS: "removes the minus sign", 
  CONCATENATE: "joins text together", CONCAT: "joins text together", TEXTJOIN: "joins text with a separator", LEFT: "takes characters from the start of text",
  RIGHT: "takes characters from the end of text", MID: "takes characters from the middle of text", LEN: "counts characters", TRIM: "removes extra spaces",
  UPPER: "converts text to capitals", LOWER: "converts text to lower case", PROPER: "capitalises each word", TODAY: "returns today's date", NOW: "returns the current date and time",
  DATE: "builds a date from year, month, day", YEAR: "takes the year from a date", MONTH: "takes the month from a date", DAY: "takes the day from a date",
  SUMPRODUCT: "multiplies ranges together and adds the results", MEDIAN: "finds the middle value", STDEV: "measures how spread out numbers are",
};

export function planExplainFormula(s: SheetModel, op: A<"explain_formula">, h: Helpers): PlanResult {
  const m = /^([A-Za-z]{1,3})([0-9]{1,7})$/.exec(op.cell.trim());
  if (!m) return fail(`"${op.cell}" isn't a cell address like D2.`);
  const c = colIndex(m[1]), r = Number(m[2]) - 1;
  const f = s.formulas[r]?.[c];
  const shown = `${m[1].toUpperCase()}${m[2]}`;
  if (!f) {
    const v = s.values[r]?.[c];
    return fail(`Cell ${shown} on "${s.name}" has no formula${h.isBlank(v) ? " (it is empty)" : ` (it holds the value ${JSON.stringify(v)})`}.`);
  }
  const body = f.replace(/^=/, "");
  const noStrings = body.replace(/"(?:[^"]|"")*"/g, '""');
  const table: Cell[][] = [["Part", "Meaning"]];
  const fns = [...new Set([...noStrings.matchAll(/([A-Za-z][A-Za-z0-9.]*)\(/g)].map((x) => x[1].toUpperCase()))];
  for (const fn of fns) table.push([`${fn}()`, GLOSSARY[fn] ?? "(not in ExcelAI's built-in glossary)"]);
  const seen = new Set<string>();
  const headers = s.values[0] ?? [];
  const label = (ci: number) => (h.isBlank(headers[ci]) ? h.colLetter(ci) : String(headers[ci]));
  for (const x of noStrings.matchAll(/(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?!\()|(\$?[A-Za-z]{1,3}):(\$?[A-Za-z]{1,3})(?![A-Za-z0-9(])/g)) {
    if (x[0].includes("(") || seen.has(x[0])) continue;
    const before = noStrings[x.index! - 1] ?? "";
    if (/[A-Za-z0-9_]/.test(before)) continue;
    seen.add(x[0]);
    if (x[3]) table.push([x[0], `the whole column "${label(colIndex(x[3]))}"`]);
    else if (x[2]) {
      const a = colIndex(x[1].replace(/[^A-Za-z]/g, "")), rr = Number(x[1].replace(/\D/g, ""));
      table.push([x[0], `a range in "${label(a)}" starting at row ${rr}`]);
    } else {
      const ci = colIndex(x[1].replace(/[^A-Za-z]/g, "")), rr = Number(x[1].replace(/\D/g, "")) - 1;
      const v = s.values[rr]?.[ci];
      table.push([x[1], `${label(ci)} in row ${rr + 1}${rr === 0 ? "" : ` (currently ${h.isBlank(v) ? "empty" : JSON.stringify(v)})`}`]);
    }
  }
  const result = s.values[r]?.[c];
  return {
    ok: true,
    effects: [],
    summary: `${shown} on "${s.name}" holds ${f}.${h.isBlank(result) ? "" : ` Its current result is ${typeof result === "number" ? fmt(result) : JSON.stringify(result)}.`} Breakdown below. This explains the formula's parts, not whether it's the right formula for your goal.`,
    destructive: false,
    table,
  };
}

export function planDataHealth(s: SheetModel, h: Helpers): PlanResult {
  if (s.values.length < 2) return fail(`Sheet "${s.name}" has no data rows.`);
  const header = s.values[0];
  const data = s.values.slice(1);
  const table: Cell[][] = [["Column", "Type", "Blank", "Distinct", "Issues"]];
  const total: string[] = [];
  for (let c = 0; c < header.length; c++) {
    const vals = data.map((r) => r[c]).filter((v) => !h.isBlank(v));
    const blanks = data.length - vals.length;
    const nums = vals.filter((v) => h.toNum(v) !== null);
    const type = !vals.length ? "empty" : nums.length === vals.length ? "number" : nums.length >= vals.length * 0.8 ? "mostly number" : nums.length ? "mixed" : "text";
    const issues: string[] = [];
    if (type === "mostly number") issues.push(`${vals.length - nums.length} non-numeric value(s)`);
    const textsOnly = vals.filter((v) => typeof v === "string") as string[];
    const spaces = textsOnly.filter((v) => v !== v.trim() || /\s{2,}/.test(v)).length;
    if (spaces) issues.push(`${spaces} with extra spaces`);
    const groups = new Map<string, Set<string>>();
    for (const v of textsOnly) {
      const k = v.trim().replace(/\s+/g, " ").toLowerCase();
      (groups.get(k) ?? groups.set(k, new Set()).get(k)!).add(v);
    }
    const variants = [...groups.values()].filter((g) => g.size > 1).length;
    if (variants) issues.push(`${variants} value(s) written in inconsistent case/spacing`);
    if (blanks && blanks / data.length > 0.05) issues.push(`${Math.round((blanks / data.length) * 100)}% blank`);
    table.push([h.isBlank(header[c]) ? h.colLetter(c) : String(header[c]), type, blanks, new Set(vals.map((v) => String(v).trim().toLowerCase())).size, issues.join("; ") || "none found"]);
    if (issues.length) total.push(`"${header[c]}": ${issues.join(", ")}`);
  }
  const seen = new Set<string>();
  let dupRows = 0;
  for (const r of data) {
    if (r.every((v) => h.isBlank(v))) continue;
    const k = JSON.stringify(r.map((v) => String(v ?? "").trim().toLowerCase()));
    if (seen.has(k)) dupRows++;
    else seen.add(k);
  }
  const blankRows = data.filter((r) => r.every((v) => h.isBlank(v))).length;
  const parts = [`${data.length} rows, ${header.length} columns.`, `${dupRows} duplicate row(s), ${blankRows} blank row(s).`];
  if (total.length) parts.push(`Issues: ${total.slice(0, 6).join(" | ")}.`);
  else if (!dupRows) parts.push("No obvious problems found.");
  parts.push("Fixes available: clean text, remove duplicates, fill blanks, find errors.");
  return { ok: true, effects: [], summary: `Data health for "${s.name}": ${parts.join(" ")}`, destructive: false, table };
}

export function planSuggestRules(s: SheetModel, h: Helpers): PlanResult {
  if (s.values.length < 2) return fail(`Sheet "${s.name}" has no data rows.`);
  const header = s.values[0];
  const data = s.values.slice(1);
  const table: Cell[][] = [["Column", "Suggested highlight", "Why", "Cells affected"]];
  for (let c = 0; c < header.length && table.length < 9; c++) {
    const name = String(header[c] ?? h.colLetter(c));
    const raw = data.map((r) => r[c]);
    const vals = raw.filter((v) => !h.isBlank(v));
    const nums = vals.map(h.toNum).filter((n): n is number => n !== null);
    if (vals.length && nums.length >= vals.length * 0.8 && nums.length >= 8) {
      const neg = nums.filter((n) => n < 0).length;
      if (neg) table.push([name, `${name} < 0`, "Negative values are often refunds, errors or losses", neg]);
      const sorted = [...nums].sort((a, b) => a - b);
      const lo = quantile(sorted, 0.25) - 1.5 * (quantile(sorted, 0.75) - quantile(sorted, 0.25));
      const hi = quantile(sorted, 0.75) + 1.5 * (quantile(sorted, 0.75) - quantile(sorted, 0.25));
      const out = nums.filter((n) => n < lo || n > hi).length;
      if (out) table.push([name, "unusual values (outliers)", "Values far outside the normal range", out]);
    }
    const blanks = raw.length - vals.length;
    if (blanks && blanks / raw.length <= 0.2) table.push([name, `${name} is empty`, "A few blanks in an otherwise filled column", blanks]);
  }
  const suggestions = table.length - 1;
  return {
    ok: true,
    effects: [],
    summary: suggestions
      ? `${suggestions} suggested highlight${suggestions > 1 ? "s" : ""} for "${s.name}", limited to the most useful so the sheet stays readable. Highlights are static formatting (colours applied now), not live rules that update when data changes. Tell me which to apply.`
      : `Nothing stands out on "${s.name}" that needs highlighting.`,
    destructive: false,
    table,
  };
}

export function planCreateDashboard(model: WorkbookModel, s: SheetModel, op: A<"create_dashboard">, h: Helpers): PlanResult {
  const name = op.name;
  if (model.sheets.some((x) => x.name.toLowerCase() === name.toLowerCase())) return fail(`A sheet named "${name}" already exists.`);
  if (s.values.length < 3) return fail(`Sheet "${s.name}" needs at least 2 data rows for a dashboard.`);
  const header = s.values[0].map((v, i) => (h.isBlank(v) ? h.colLetter(i) : String(v)));
  const data = s.values.slice(1);
  const numeric: number[] = [];
  const textCols: number[] = [];
  header.forEach((_, c) => {
    const vals = data.map((r) => r[c]).filter((v) => !h.isBlank(v));
    if (!vals.length) return;
    const n = vals.filter((v) => h.toNum(v) !== null).length;
    if (n >= vals.length * 0.8) numeric.push(c);
    else if (n === 0) textCols.push(c);
  });
  if (!numeric.length) return fail(`No numeric columns found on "${s.name}", so there is nothing to summarise.`);
  const S = q(s.name);
  const col = (c: number) => `${S}!${h.colLetter(c)}:${h.colLetter(c)}`;
  const rows: Cell[][] = [];
  const styles: { r: number; cols: number; bold?: boolean; bg?: string }[] = [];
  const push = (row: Cell[], st?: { bold?: boolean; bg?: string }) => {
    if (st) styles.push({ r: rows.length, cols: Math.max(row.length, 1), ...st });
    rows.push(row);
  };
  push([`Dashboard: ${s.name}`], { bold: true });
  push([`Numbers below are live formulas on "${s.name}" and update when its data changes. Category lists and "What stands out" are captured as of creation.`]);
  push([]);
  push(["Overview", "Value"], { bold: true, bg: "#F3F4F6" });
  push(["Data rows", `=COUNTA(${col(0)})-1`]);
  push([]);
  const used = numeric.slice(0, 6);
  push(["Column", "Total", "Average", "Min", "Max"], { bold: true, bg: "#F3F4F6" });
  for (const c of used) push([header[c], `=SUM(${col(c)})`, `=AVERAGE(${col(c)})`, `=MIN(${col(c)})`, `=MAX(${col(c)})`]);

  const gi = op.group_by ? h.resolveCol(s, op.group_by) : textCols.find((c) => {
    const d = new Set(data.map((r) => String(r[c] ?? "").trim()).filter(Boolean));
    return d.size >= 2 && d.size <= 12;
  });
  if (typeof gi === "string") return fail(gi);
  const notes: string[] = [];
  if (gi !== undefined) {
    const vi = op.value_column ? h.resolveCol(s, op.value_column) : used[0];
    if (typeof vi === "string") return fail(vi);
    const totals = new Map<string, number>();
    for (const r of data) {
      const k = String(r[gi] ?? "").trim();
      if (k) totals.set(k, (totals.get(k) ?? 0) + (h.toNum(r[vi]) ?? 0));
    }
    const cats = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 12);
    push([]);
    push([header[gi], `Total ${header[vi]}`, "Rows"], { bold: true, bg: "#F3F4F6" });
    for (const [k] of cats) {
      const crit = `"${k.replace(/"/g, '""')}"`;
      push([k, `=SUMIF(${col(gi)},${crit},${col(vi)})`, `=COUNTIF(${col(gi)},${crit})`]);
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    if (cats.length && sum > 0) notes.push(`"${cats[0][0]}" is the largest ${String(header[gi]).toLowerCase()} with ${Math.round((cats[0][1] / sum) * 100)}% of total ${String(header[vi]).toLowerCase()}.`);
  }
  const first = used[0];
  const series = data.map((r) => h.toNum(r[first])).filter((n): n is number => n !== null);
  if (series.length >= 6) {
    const f = linearFit(series);
    const dir = Math.abs(f.slope) < 1e-9 ? "flat" : f.slope > 0 ? "rising" : "falling";
    if (f.r2 >= 0.4) notes.push(`"${header[first]}" is ${dir} across the rows (about ${fmt(f.slope)} per row, fit R² ${f.r2.toFixed(2)}).`);
    const sorted = [...series].sort((a, b) => a - b);
    const k = quantile(sorted, 0.75) - quantile(sorted, 0.25);
    const out = series.filter((n) => n < quantile(sorted, 0.25) - 1.5 * k || n > quantile(sorted, 0.75) + 1.5 * k).length;
    if (out) notes.push(`${out} unusual value(s) in "${header[first]}" worth reviewing.`);
  }
  const blanks = used.reduce((n, c) => n + data.filter((r) => h.isBlank(r[c])).length, 0);
  if (blanks) notes.push(`${blanks} blank cell(s) in the numeric columns may affect averages.`);
  push([]);
  push(["What stands out (as of creation)"], { bold: true, bg: "#F3F4F6" });
  if (notes.length) notes.forEach((n) => push([n]));
  else push(["Nothing unusual detected."]);

  const w = Math.max(...rows.map((r) => r.length));
  const effects: Effect[] = [
    { t: "createSheet", name },
    { t: "set", sheet: name, r: 0, c: 0, values: rows.map((r) => Array.from({ length: w }, (_, i) => r[i] ?? null)) },
    ...styles.map((st): Effect => ({ t: "style", sheet: name, r: st.r, c: 0, rows: 1, cols: st.cols, bold: st.bold, bg: st.bg })),
  ];
  return {
    ok: true,
    effects,
    summary: `Created sheet "${name}" from "${s.name}": row count, totals/averages/min/max for ${used.length} numeric column${used.length > 1 ? "s" : ""}${gi !== undefined ? `, a breakdown by "${header[gi]}"` : ""}, and ${notes.length || "no"} key finding${notes.length === 1 ? "" : "s"}. No charts are included (the editor doesn't support them yet). Your data sheet is unchanged.`,
    destructive: false,
    table: rows.slice(0, 13).map((r) => Array.from({ length: Math.min(w, 5) }, (_, i) => r[i] ?? null)),
  };
}
