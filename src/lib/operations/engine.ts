/**
 * Deterministic spreadsheet operation engine.
 * Pure functions: planOp() turns a validated Op into low-level Effects against a WorkbookModel,
 * applyEffects() simulates them, and verifyModels() compares the simulation with the real sheet.
 * The AI never executes anything; it only proposes Ops.
 */
import {
  planDetectAnomalies,
  planFindErrors,
  planForecast,
  planMergeSheets,
  planWrapIferror,
  type Helpers,
} from "./analytics";
import type { Op } from "./schema";

export type Cell = string | number | boolean | null;
export type SheetModel = {
  name: string;
  values: Cell[][];
  formulas: (string | null)[][];
};
export type WorkbookModel = { sheets: SheetModel[]; active: string };

export type Effect =
  | { t: "set"; sheet: string; r: number; c: number; values: Cell[][] } // strings starting "=" are formulas
  | { t: "delRows"; sheet: string; r: number; n: number }
  | { t: "delCols"; sheet: string; c: number; n: number }
  | { t: "insRows"; sheet: string; r: number; n: number }
  | { t: "insCols"; sheet: string; c: number; n: number }
  | {
      t: "clear";
      sheet: string;
      r: number;
      c: number;
      rows: number;
      cols: number;
    }
  | { t: "createSheet"; name: string }
  | { t: "deleteSheet"; name: string }
  | { t: "renameSheet"; from: string; to: string }
  | {
      t: "style";
      sheet: string;
      r: number;
      c: number;
      rows: number;
      cols: number;
      bold?: boolean;
      bg?: string;
      color?: string;
      numfmt?: string;
      align?: "left" | "center" | "right";
    };

export type PlanResult =
  | {
      ok: true;
      effects: Effect[];
      summary: string;
      destructive: boolean;
      table?: Cell[][];
    }
  | { ok: false; error: string };

const MAX_EFFECT_CELLS = 20000;
const fail = (error: string): PlanResult => ({ ok: false, error });

// ---------- helpers ----------
export function colLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const letterToIndex = (s: string) =>
  [...s.toUpperCase()].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export function parseA1(
  a1: string,
): { r: number; c: number; rows: number; cols: number } | null {
  const m =
    /^([A-Za-z]{1,3})([0-9]{1,7})(?::([A-Za-z]{1,3})([0-9]{1,7}))?$/.exec(
      a1.trim(),
    );
  if (!m) return null;
  const c1 = letterToIndex(m[1]),
    r1 = +m[2] - 1;
  const c2 = m[3] ? letterToIndex(m[3]) : c1,
    r2 = m[4] ? +m[4] - 1 : r1;
  if (r1 < 0 || r2 < r1 || c2 < c1) return null;
  return { r: r1, c: c1, rows: r2 - r1 + 1, cols: c2 - c1 + 1 };
}

const isBlank = (v: Cell | undefined) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");
export function toNum(v: Cell | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[$€£₹,\s]/g, "");
  if (s === "" || !/^-?\d*\.?\d+(e[+-]?\d+)?%?$/i.test(s)) return null;
  const n = parseFloat(s);
  return s.endsWith("%") ? n / 100 : n;
}
const fmtNum = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const width = (s: SheetModel) =>
  s.values.reduce((w, r) => Math.max(w, r.length), 0);
const cellAt = (s: SheetModel, r: number, c: number): Cell =>
  s.values[r]?.[c] ?? null;
const formulaAt = (s: SheetModel, r: number, c: number) =>
  s.formulas[r]?.[c] ?? null;

export function normalizeSheet(
  name: string,
  values: Cell[][],
  formulas: (string | null)[][],
): SheetModel {
  const w = Math.max(
    0,
    ...values.map((r) => r.length),
    ...formulas.map((r) => r.length),
  );
  // trim trailing fully-blank rows
  let h = Math.max(values.length, formulas.length);
  const rowBlank = (r: number) =>
    Array.from({ length: w }, (_, c) => c).every(
      (c) => isBlank(values[r]?.[c]) && !formulas[r]?.[c],
    );
  while (h > 0 && rowBlank(h - 1)) h--;
  return {
    name,
    values: Array.from({ length: h }, (_, r) =>
      Array.from({ length: w }, (_, c) => values[r]?.[c] ?? null),
    ),
    formulas: Array.from({ length: h }, (_, r) =>
      Array.from({ length: w }, (_, c) => formulas[r]?.[c] || null),
    ),
  };
}

function findSheet(m: WorkbookModel, name?: string): SheetModel | string {
  const target = (name ?? m.active).trim().toLowerCase();
  const s = m.sheets.find((x) => x.name.toLowerCase() === target);
  return (
    s ??
    `Sheet "${name}" not found. Available sheets: ${m.sheets.map((x) => x.name).join(", ")}.`
  );
}

function resolveCol(s: SheetModel, ref: string): number | string {
  const headers = s.values[0] ?? [];
  const key = ref.trim().toLowerCase();
  const i = headers.findIndex(
    (h) => !isBlank(h) && String(h).trim().toLowerCase() === key,
  );
  if (i >= 0) return i;
  if (/^[A-Za-z]{1,3}$/.test(ref.trim())) {
    const li = letterToIndex(ref.trim());
    if (li < Math.max(width(s), 1)) return li;
  }
  const names = headers
    .filter((h) => !isBlank(h))
    .slice(0, 15)
    .join(", ");
  return `Column "${ref}" not found on sheet "${s.name}". Columns: ${names || "(none)"}.`;
}

function compareValues(a: Cell, b: Cell, dir: 1 | -1): number {
  const ab = isBlank(a),
    bb = isBlank(b);
  if (ab || bb) return ab && bb ? 0 : ab ? 1 : -1; // blanks always last
  const na = toNum(a),
    nb = toNum(b);
  const c =
    na !== null && nb !== null
      ? na - nb
      : String(a).localeCompare(String(b), undefined, {
          sensitivity: "base",
          numeric: true,
        });
  return c * dir;
}

function matches(
  v: Cell,
  operator: string,
  value: string | number | undefined,
): boolean {
  if (operator === "empty") return isBlank(v);
  if (operator === "not_empty") return !isBlank(v);
  if (value === undefined) return false;
  if (operator === "contains")
    return String(v ?? "")
      .toLowerCase()
      .includes(String(value).toLowerCase());
  const nv = toNum(v),
    nt = toNum(value);
  if (nv !== null && nt !== null) {
    return operator === ">"
      ? nv > nt
      : operator === "<"
        ? nv < nt
        : operator === ">="
          ? nv >= nt
          : operator === "<="
            ? nv <= nt
            : operator === "=="
              ? nv === nt
              : nv !== nt;
  }
  const sv = String(v ?? "")
      .trim()
      .toLowerCase(),
    st = String(value).trim().toLowerCase();
  if (operator === "==") return sv === st;
  if (operator === "!=") return sv !== st;
  return false;
}

const colsOf = (
  s: SheetModel,
  refs: string[] | undefined,
): number[] | string => {
  if (!refs?.length) return Array.from({ length: width(s) }, (_, i) => i);
  const out: number[] = [];
  for (const r of refs) {
    const i = resolveCol(s, r);
    if (typeof i === "string") return i;
    out.push(i);
  }
  return out;
};

function groupRuns(sortedAsc: number[]): [number, number][] {
  const runs: [number, number][] = [];
  for (const i of sortedAsc) {
    const last = runs[runs.length - 1];
    if (last && last[0] + last[1] === i) last[1]++;
    else runs.push([i, 1]);
  }
  return runs;
}

const analyticsHelpers: Helpers = { resolveCol, toNum, isBlank, colLetter };

// ---------- planning ----------
export function planOp(model: WorkbookModel, op: Op): PlanResult {
  if (op.op === "create_sheet") {
    if (
      model.sheets.some((s) => s.name.toLowerCase() === op.name.toLowerCase())
    )
      return fail(`A sheet named "${op.name}" already exists.`);
    return {
      ok: true,
      effects: [{ t: "createSheet", name: op.name }],
      summary: `Create sheet "${op.name}".`,
      destructive: false,
    };
  }
  if (op.op === "rename_sheet") {
    const s = findSheet(model, op.from);
    if (typeof s === "string") return fail(s);
    if (
      model.sheets.some(
        (x) => x !== s && x.name.toLowerCase() === op.to.toLowerCase(),
      )
    )
      return fail(`A sheet named "${op.to}" already exists.`);
    return {
      ok: true,
      effects: [{ t: "renameSheet", from: s.name, to: op.to }],
      summary: `Rename sheet "${s.name}" to "${op.to}".`,
      destructive: false,
    };
  }
  if (op.op === "delete_sheet") {
    const s = findSheet(model, op.name);
    if (typeof s === "string") return fail(s);
    if (model.sheets.length <= 1)
      return fail("A workbook must keep at least one sheet.");
    return {
      ok: true,
      effects: [{ t: "deleteSheet", name: s.name }],
      summary: `Delete sheet "${s.name}" and all its data.`,
      destructive: true,
    };
  }

  if (op.op === "merge_sheets") return planMergeSheets(model, op);

  const s = findSheet(model, "sheet" in op ? op.sheet : undefined);
  if (typeof s === "string") return fail(s);
  const nData = Math.max(0, s.values.length - 1);
  const needHeader = () =>
    s.values.length === 0 ? `Sheet "${s.name}" is empty.` : null;

  switch (op.op) {
    case "set_cells": {
      const a = parseA1(op.range);
      if (!a) return fail(`Invalid range "${op.range}".`);
      const rows = op.values.length,
        cols = Math.max(0, ...op.values.map((r) => r.length));
      if (rows === 0 || cols === 0) return fail("No values to write.");
      if (rows > a.rows || cols > a.cols)
        return fail(`Values (${rows}×${cols}) don't fit in range ${op.range}.`);
      let overwritten = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (
            !isBlank(cellAt(s, a.r + r, a.c + c)) ||
            formulaAt(s, a.r + r, a.c + c)
          )
            overwritten++;
      const values = op.values.map((row) =>
        Array.from({ length: cols }, (_, c) => row[c] ?? null),
      );
      return {
        ok: true,
        effects: [{ t: "set", sheet: s.name, r: a.r, c: a.c, values }],
        summary: `Write ${rows}×${cols} values at ${op.range}${overwritten ? ` (overwrites ${overwritten} existing cells)` : ""}.`,
        destructive: overwritten > 10,
      };
    }
    case "add_column": {
      const e = needHeader();
      if (e) return fail(e);
      let at = width(s);
      const effects: Effect[] = [];
      if (op.after) {
        const i = resolveCol(s, op.after);
        if (typeof i === "string") return fail(i);
        at = i + 1;
        if (at < width(s))
          effects.push({ t: "insCols", sheet: s.name, c: at, n: 1 });
      }
      effects.push({
        t: "set",
        sheet: s.name,
        r: 0,
        c: at,
        values: [[op.header]],
      });
      if (op.formula && nData > 0) {
        if (!op.formula.startsWith("="))
          return fail('Formula must start with "=".');
        const values = Array.from(
          { length: nData },
          (_, i) => [op.formula!.replaceAll("{row}", String(i + 2))] as Cell[],
        );
        effects.push({ t: "set", sheet: s.name, r: 1, c: at, values });
      }
      return {
        ok: true,
        effects,
        summary: `Add column "${op.header}" at ${colLetter(at)}${op.formula ? ` with formula ${op.formula} for ${nData} rows` : ""}.`,
        destructive: false,
      };
    }
    case "rename_column": {
      const i = resolveCol(s, op.column);
      if (typeof i === "string") return fail(i);
      return {
        ok: true,
        effects: [
          { t: "set", sheet: s.name, r: 0, c: i, values: [[op.new_name]] },
        ],
        summary: `Rename column "${s.values[0][i]}" to "${op.new_name}".`,
        destructive: false,
      };
    }
    case "delete_columns": {
      const idx: number[] = [];
      for (const ref of op.columns) {
        const i = resolveCol(s, ref);
        if (typeof i === "string") return fail(i);
        if (!idx.includes(i)) idx.push(i);
      }
      const names = idx
        .map((i) => `${colLetter(i)} (${s.values[0]?.[i] ?? ""})`)
        .join(", ");
      const effects = groupRuns([...idx].sort((a, b) => a - b))
        .reverse()
        .map(([c, n]): Effect => ({ t: "delCols", sheet: s.name, c, n }));
      return {
        ok: true,
        effects,
        summary: `Delete column${idx.length > 1 ? "s" : ""} ${names} and their data.`,
        destructive: true,
      };
    }
    case "insert_rows":
      return {
        ok: true,
        effects: [
          { t: "insRows", sheet: s.name, r: op.after_row, n: op.count },
        ],
        summary: `Insert ${op.count} blank row${op.count > 1 ? "s" : ""} after row ${op.after_row}.`,
        destructive: false,
      };
    case "delete_rows": {
      if (op.to_row < op.from_row)
        return fail("to_row must be at least from_row.");
      const n = op.to_row - op.from_row + 1;
      return {
        ok: true,
        effects: [{ t: "delRows", sheet: s.name, r: op.from_row - 1, n }],
        summary: `Delete ${n} row${n > 1 ? "s" : ""} (rows ${op.from_row}–${op.to_row}).`,
        destructive: true,
      };
    }
    case "clear_range": {
      const a = parseA1(op.range);
      if (!a) return fail(`Invalid range "${op.range}".`);
      return {
        ok: true,
        effects: [{ t: "clear", sheet: s.name, ...a }],
        summary: `Clear contents of ${op.range}.`,
        destructive: true,
      };
    }
    case "sort": {
      const e = needHeader();
      if (e) return fail(e);
      const ci = resolveCol(s, op.by);
      if (typeof ci === "string") return fail(ci);
      if (nData < 2)
        return {
          ok: true,
          effects: [],
          summary: "Nothing to sort (fewer than 2 data rows).",
          destructive: false,
        };
      if (s.formulas.slice(1).some((r) => r.some((f) => f)))
        return fail(
          "Sorting a range that contains formulas isn't supported yet (formulas would break). Convert them to values first.",
        );
      const dir = op.direction === "asc" ? 1 : -1;
      const rows = s.values.slice(1).map((r, i) => ({ r, i }));
      rows.sort((x, y) => compareValues(x.r[ci], y.r[ci], dir) || x.i - y.i);
      return {
        ok: true,
        effects: [
          { t: "set", sheet: s.name, r: 1, c: 0, values: rows.map((x) => x.r) },
        ],
        summary: `Sort ${nData} rows by "${s.values[0][ci]}" ${op.direction === "asc" ? "ascending" : "descending"} (blanks last).`,
        destructive: false,
      };
    }
    case "remove_duplicates": {
      const e = needHeader();
      if (e) return fail(e);
      const cols = colsOf(s, op.columns);
      if (typeof cols === "string") return fail(cols);
      const seen = new Set<string>();
      const dup: number[] = [];
      for (let r = 1; r < s.values.length; r++) {
        const key = JSON.stringify(
          cols.map((c) => {
            const v = cellAt(s, r, c);
            const t = typeof v === "string" ? v.trim() : v;
            return op.ignore_case && typeof t === "string"
              ? t.toLowerCase()
              : t;
          }),
        );
        if (seen.has(key)) dup.push(r);
        else seen.add(key);
      }
      const on = op.columns?.length
        ? `columns ${op.columns.join(", ")}`
        : "entire rows";
      if (!dup.length)
        return {
          ok: true,
          effects: [],
          summary: `No duplicate rows found (compared ${on}).`,
          destructive: false,
        };
      const effects = groupRuns(dup)
        .reverse()
        .map(([r, n]): Effect => ({ t: "delRows", sheet: s.name, r, n }));
      const listed =
        dup
          .slice(0, 10)
          .map((r) => r + 1)
          .join(", ") + (dup.length > 10 ? ", …" : "");
      return {
        ok: true,
        effects,
        summary: `Remove ${dup.length} duplicate row${dup.length > 1 ? "s" : ""} (sheet rows ${listed}), keeping the first occurrence. Compared ${on}.`,
        destructive: true,
      };
    }
    case "find_replace": {
      let cols: number[];
      if (op.column) {
        const i = resolveCol(s, op.column);
        if (typeof i === "string") return fail(i);
        cols = [i];
      } else cols = Array.from({ length: width(s) }, (_, i) => i);
      const esc = op.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        op.whole_cell ? `^${esc}$` : esc,
        op.match_case ? "g" : "gi",
      );
      const effects: Effect[] = [];
      for (let r = 1; r < s.values.length; r++)
        for (const c of cols) {
          const v = cellAt(s, r, c);
          if (formulaAt(s, r, c) || v === null || typeof v === "boolean")
            continue;
          const text = String(v);
          const next = text.replace(re, () => op.replace);
          if (next !== text)
            effects.push({
              t: "set",
              sheet: s.name,
              r,
              c,
              values: [
                [
                  toNum(next) !== null && /^-?\d+(\.\d+)?$/.test(next)
                    ? Number(next)
                    : next,
                ],
              ],
            });
          if (effects.length > MAX_EFFECT_CELLS)
            return fail("Too many cells would change. Narrow the request.");
        }
      return {
        ok: true,
        effects,
        summary: effects.length
          ? `Replace "${op.find}" with "${op.replace}" in ${effects.length} cell${effects.length > 1 ? "s" : ""}.`
          : `No cells contain "${op.find}".`,
        destructive: false,
      };
    }
    case "fill_blanks": {
      const ci = resolveCol(s, op.column);
      if (typeof ci === "string") return fail(ci);
      const effects: Effect[] = [];
      for (let r = 1; r < s.values.length; r++)
        if (isBlank(cellAt(s, r, ci)) && !formulaAt(s, r, ci))
          effects.push({
            t: "set",
            sheet: s.name,
            r,
            c: ci,
            values: [[op.value]],
          });
      return {
        ok: true,
        effects,
        summary: effects.length
          ? `Fill ${effects.length} blank cell${effects.length > 1 ? "s" : ""} in "${s.values[0][ci]}" with ${JSON.stringify(op.value)}.`
          : `No blank cells in "${s.values[0][ci]}".`,
        destructive: false,
      };
    }
    case "clean_text": {
      let cols: number[];
      if (op.column) {
        const i = resolveCol(s, op.column);
        if (typeof i === "string") return fail(i);
        cols = [i];
      } else cols = Array.from({ length: width(s) }, (_, i) => i);
      const fx = (t: string) =>
        op.mode === "trim"
          ? t.trim().replace(/\s+/g, " ")
          : op.mode === "lowercase"
            ? t.toLowerCase()
            : op.mode === "uppercase"
              ? t.toUpperCase()
              : t
                  .trim()
                  .replace(/\s+/g, " ")
                  .toLowerCase()
                  .replace(/(^|[\s\-'])\p{L}/gu, (m) => m.toUpperCase());
      const effects: Effect[] = [];
      for (let r = 1; r < s.values.length; r++)
        for (const c of cols) {
          const v = cellAt(s, r, c);
          if (typeof v !== "string" || formulaAt(s, r, c)) continue;
          const next = fx(v);
          if (next !== v)
            effects.push({ t: "set", sheet: s.name, r, c, values: [[next]] });
        }
      return {
        ok: true,
        effects,
        summary: effects.length
          ? `Apply ${op.mode} to ${effects.length} text cell${effects.length > 1 ? "s" : ""}.`
          : "No text cells needed changes.",
        destructive: false,
      };
    }
    case "format": {
      const props = {
        bold: op.bold,
        bg: op.background,
        color: op.font_color,
        numfmt: op.number_format,
        align: op.align,
      };
      if (Object.values(props).every((v) => v === undefined))
        return fail("No formatting was specified.");
      let area: { r: number; c: number; rows: number; cols: number };
      if (op.range) {
        const a = parseA1(op.range);
        if (!a) return fail(`Invalid range "${op.range}".`);
        area = a;
      } else if (op.column) {
        const i = resolveCol(s, op.column);
        if (typeof i === "string") return fail(i);
        area = { r: 1, c: i, rows: Math.max(nData, 1), cols: 1 };
      } else return fail("Specify a range or a column to format.");
      return {
        ok: true,
        effects: [{ t: "style", sheet: s.name, ...area, ...props }],
        summary: `Format ${op.range ?? `column "${op.column}"`}.`,
        destructive: false,
      };
    }
    case "highlight": {
      const ci = resolveCol(s, op.condition.column);
      if (typeof ci === "string") return fail(ci);
      const effects: Effect[] = [];
      for (let r = 1; r < s.values.length; r++)
        if (
          matches(cellAt(s, r, ci), op.condition.operator, op.condition.value)
        )
          effects.push({
            t: "style",
            sheet: s.name,
            r,
            c: ci,
            rows: 1,
            cols: 1,
            bg: op.background,
          });
      if (effects.length > MAX_EFFECT_CELLS)
        return fail("Too many cells match. Narrow the request.");
      return {
        ok: true,
        effects,
        summary: effects.length
          ? `Highlight ${effects.length} cell${effects.length > 1 ? "s" : ""} in "${s.values[0][ci]}" (${op.condition.operator} ${op.condition.value ?? ""}). This is static formatting, not a live rule.`
          : "No cells match that condition.",
        destructive: false,
      };
    }
    case "detect_anomalies":
      return planDetectAnomalies(model, s, op, analyticsHelpers);
    case "forecast":
      return planForecast(model, s, op, analyticsHelpers);
    case "find_errors":
      return planFindErrors(model, s, op, analyticsHelpers);
    case "wrap_iferror":
      return planWrapIferror(s, op, analyticsHelpers);
    case "query":
      return planQuery(model, s, op);
  }
}

function planQuery(
  model: WorkbookModel,
  s: SheetModel,
  op: Extract<Op, { op: "query" }>,
): PlanResult {
  if (s.values.length === 0) return fail(`Sheet "${s.name}" is empty.`);
  const header = s.values[0];
  const data = s.values.slice(1);
  let table: Cell[][];
  let text: string;
  const col = (ref?: string) =>
    ref ? resolveCol(s, ref) : fail_("Specify a column.");
  function fail_(m: string) {
    return m;
  }

  if (op.kind === "summary") {
    table = [["Column", "Non-blank", "Blank", "Sum", "Average", "Min", "Max"]];
    for (let c = 0; c < header.length; c++) {
      const vals = data.map((r) => r[c]);
      const nums = vals.map(toNum).filter((n): n is number => n !== null);
      const nonBlank = vals.filter((v) => !isBlank(v)).length;
      const numeric = nums.length > 0 && nums.length >= nonBlank * 0.8;
      table.push([
        String(header[c] ?? colLetter(c)),
        nonBlank,
        vals.length - nonBlank,
        numeric ? nums.reduce((a, b) => a + b, 0) : null,
        numeric ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
        numeric ? Math.min(...nums) : null,
        numeric ? Math.max(...nums) : null,
      ]);
    }
    text = `Summary of "${s.name}": ${data.length} data rows, ${header.length} columns.`;
  } else if (op.kind === "top_n") {
    const ci = col(op.column);
    if (typeof ci === "string") return fail(ci);
    const dir = op.direction === "desc" ? -1 : 1;
    const sorted = data
      .map((r, i) => ({ r, i }))
      .filter((x) => toNum(x.r[ci]) !== null)
      .sort((a, b) => (toNum(a.r[ci])! - toNum(b.r[ci])!) * dir || a.i - b.i)
      .slice(0, op.n);
    table = [header, ...sorted.map((x) => x.r)];
    text = `${op.direction === "desc" ? "Top" : "Bottom"} ${sorted.length} rows by "${header[ci]}".`;
  } else {
    if (op.kind !== "count" && !op.column) return fail("Specify a column.");
    const ci = op.column ? col(op.column) : -1;
    if (typeof ci === "string") return fail(ci);
    const gi = op.group_by ? resolveCol(s, op.group_by) : -1;
    if (typeof gi === "string") return fail(gi);
    const agg = (rows: Cell[][]): number | null => {
      if (op.kind === "count")
        return ci >= 0
          ? rows.filter((r) => !isBlank(r[ci])).length
          : rows.length;
      const nums = rows
        .map((r) => toNum(r[ci]))
        .filter((n): n is number => n !== null);
      if (!nums.length) return null;
      return op.kind === "sum"
        ? nums.reduce((a, b) => a + b, 0)
        : op.kind === "avg"
          ? nums.reduce((a, b) => a + b, 0) / nums.length
          : op.kind === "min"
            ? Math.min(...nums)
            : Math.max(...nums);
    };
    const label = `${op.kind} of ${ci >= 0 ? `"${header[ci]}"` : "rows"}`;
    if (gi >= 0) {
      const groups = new Map<string, Cell[][]>();
      for (const r of data) {
        const k = isBlank(r[gi]) ? "(blank)" : String(r[gi]).trim();
        (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
      }
      const rows = [...groups]
        .map(([k, rs]) => [k, agg(rs)] as Cell[])
        .sort(
          (a, b) =>
            ((b[1] as number) ?? -Infinity) - ((a[1] as number) ?? -Infinity),
        )
        .slice(0, Math.max(op.n, 50));
      table = [[String(header[gi]), label], ...rows];
      text = `${label} by "${header[gi]}": ${groups.size} groups.`;
    } else {
      const v = agg(data);
      table = [[label], [v]];
      text =
        v === null
          ? `No numeric values found for ${label}.`
          : `${label}: ${fmtNum(v)}.`;
    }
  }

  const effects: Effect[] = [];
  if (op.write_to_sheet) {
    if (
      model.sheets.some(
        (x) => x.name.toLowerCase() === op.write_to_sheet!.toLowerCase(),
      )
    )
      return fail(`A sheet named "${op.write_to_sheet}" already exists.`);
    effects.push(
      { t: "createSheet", name: op.write_to_sheet },
      { t: "set", sheet: op.write_to_sheet, r: 0, c: 0, values: table },
    );
    text += ` Written to new sheet "${op.write_to_sheet}".`;
  }
  return { ok: true, effects, summary: text, destructive: false, table };
}

// ---------- simulation ----------
const clone = (m: WorkbookModel): WorkbookModel => ({
  active: m.active,
  sheets: m.sheets.map((s) => ({
    name: s.name,
    values: s.values.map((r) => [...r]),
    formulas: s.formulas.map((r) => [...r]),
  })),
});

export function applyEffects(
  model: WorkbookModel,
  effects: Effect[],
): WorkbookModel {
  const m = clone(model);
  const get = (n: string) => m.sheets.find((s) => s.name === n)!;
  const ensure = (s: SheetModel, rows: number, cols: number) => {
    const w = Math.max(cols, width(s));
    while (s.values.length < rows) {
      s.values.push(Array(w).fill(null));
      s.formulas.push(Array(w).fill(null));
    }
    if (w > width(s) || cols > 0)
      for (let r = 0; r < s.values.length; r++)
        while (s.values[r].length < w) {
          s.values[r].push(null);
          s.formulas[r].push(null);
        }
  };
  for (const e of effects) {
    switch (e.t) {
      case "createSheet":
        m.sheets.push({ name: e.name, values: [], formulas: [] });
        break;
      case "deleteSheet":
        m.sheets = m.sheets.filter((s) => s.name !== e.name);
        if (m.active === e.name) m.active = m.sheets[0]?.name ?? "";
        break;
      case "renameSheet": {
        get(e.from).name = e.to;
        if (m.active === e.from) m.active = e.to;
        break;
      }
      case "set": {
        const s = get(e.sheet);
        ensure(
          s,
          e.r + e.values.length,
          e.c + Math.max(...e.values.map((r) => r.length)),
        );
        e.values.forEach((row, i) =>
          row.forEach((v, j) => {
            if (typeof v === "string" && v.startsWith("=")) {
              s.formulas[e.r + i][e.c + j] = v;
              s.values[e.r + i][e.c + j] = null;
            } else {
              s.formulas[e.r + i][e.c + j] = null;
              s.values[e.r + i][e.c + j] = v;
            }
          }),
        );
        break;
      }
      case "delRows": {
        const s = get(e.sheet);
        s.values.splice(e.r, e.n);
        s.formulas.splice(e.r, e.n);
        break;
      }
      case "insRows": {
        const s = get(e.sheet);
        const w = width(s);
        const at = Math.min(e.r, s.values.length);
        for (let i = 0; i < e.n; i++) {
          s.values.splice(at, 0, Array(w).fill(null));
          s.formulas.splice(at, 0, Array(w).fill(null));
        }
        break;
      }
      case "delCols": {
        const s = get(e.sheet);
        s.values.forEach((r) => r.splice(e.c, e.n));
        s.formulas.forEach((r) => r.splice(e.c, e.n));
        break;
      }
      case "insCols": {
        const s = get(e.sheet);
        s.values.forEach((r) => r.splice(e.c, 0, ...Array(e.n).fill(null)));
        s.formulas.forEach((r) => r.splice(e.c, 0, ...Array(e.n).fill(null)));
        break;
      }
      case "clear": {
        const s = get(e.sheet);
        for (let r = e.r; r < Math.min(s.values.length, e.r + e.rows); r++)
          for (
            let c = e.c;
            c < Math.min(s.values[r].length, e.c + e.cols);
            c++
          ) {
            s.values[r][c] = null;
            s.formulas[r][c] = null;
          }
        break;
      }
      case "style":
        break;
    }
  }
  m.sheets = m.sheets.map((s) => normalizeSheet(s.name, s.values, s.formulas));
  return m;
}

export type Step = {
  op: Op;
  effects: Effect[];
  summary: string;
  destructive: boolean;
  table?: Cell[][];
};
export function planAll(
  model: WorkbookModel,
  ops: Op[],
):
  | { ok: true; steps: Step[]; expected: WorkbookModel }
  | { ok: false; error: string } {
  let cur = model;
  const steps: Step[] = [];
  for (let i = 0; i < ops.length; i++) {
    const r = planOp(cur, ops[i]);
    if (!r.ok)
      return { ok: false, error: `Step ${i + 1} (${ops[i].op}): ${r.error}` };
    steps.push({
      op: ops[i],
      effects: r.effects,
      summary: r.summary,
      destructive: r.destructive,
      table: r.table,
    });
    cur = applyEffects(cur, r.effects);
  }
  return { ok: true, steps, expected: cur };
}

// ---------- verification ----------
const norm = (v: Cell) =>
  isBlank(v) ? "" : typeof v === "number" ? String(v) : String(v).trim();
const sameVal = (a: Cell, b: Cell) => {
  const na = toNum(a),
    nb = toNum(b);
  return na !== null && nb !== null
    ? Math.abs(na - nb) < 1e-9
    : norm(a) === norm(b);
};
const normF = (f: string | null) => (f ?? "").replace(/\s/g, "").toLowerCase();

/** Returns human-readable mismatches between the simulated result and the real sheet (empty = verified). */
export function verifyModels(
  expected: WorkbookModel,
  actual: WorkbookModel,
): string[] {
  const out: string[] = [];
  const en = expected.sheets.map((s) => s.name),
    an = actual.sheets.map((s) => s.name);
  if (en.join("\u0000") !== an.join("\u0000"))
    out.push(
      `Sheets differ: expected [${en.join(", ")}], found [${an.join(", ")}].`,
    );
  for (const e of expected.sheets) {
    const a = actual.sheets.find((s) => s.name === e.name);
    if (!a) continue;
    const rows = Math.max(e.values.length, a.values.length),
      cols = Math.max(width(e), width(a));
    for (let r = 0; r < rows && out.length < 5; r++)
      for (let c = 0; c < cols && out.length < 5; c++) {
        const ef = formulaAt(e, r, c),
          af = formulaAt(a, r, c);
        if (ef || af) {
          if (normF(ef) !== normF(af))
            out.push(
              `${e.name}!${colLetter(c)}${r + 1}: expected formula ${ef ?? "(none)"}, found ${af ?? "(none)"}.`,
            );
        } else if (!sameVal(cellAt(e, r, c), cellAt(a, r, c)))
          out.push(
            `${e.name}!${colLetter(c)}${r + 1}: expected ${JSON.stringify(norm(cellAt(e, r, c)))}, found ${JSON.stringify(norm(cellAt(a, r, c)))}.`,
          );
      }
  }
  return out;
}
