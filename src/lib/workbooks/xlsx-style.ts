/**
 * Conversion between ExcelJS cell styles and Univer IStyleData.
 * Pure functions, no I/O. Univer enum values are inlined (verified against 1.0.3 typings):
 * HorizontalAlign LEFT=1 CENTER=2 RIGHT=3 JUSTIFIED=4 DISTRIBUTED=6;
 * VerticalAlign TOP=1 MIDDLE=2 BOTTOM=3; WrapStrategy OVERFLOW=1 CLIP=2 WRAP=3;
 * BorderStyleTypes THIN=1 HAIR=2 DOTTED=3 DASHED=4 DASH_DOT=5 DASH_DOT_DOT=6 DOUBLE=7 MEDIUM=8
 * MEDIUM_DASHED=9 MEDIUM_DASH_DOT=10 MEDIUM_DASH_DOT_DOT=11 SLANT_DASH_DOT=12 THICK=13.
 */
import type ExcelJS from "exceljs";

export type UColor = { rgb?: string; th?: number };
export type UBorder = { s: number; cl: UColor };
export type UStyle = {
  ff?: string;
  fs?: number;
  it?: 0 | 1;
  bl?: 0 | 1;
  ul?: { s: 0 | 1 };
  st?: { s: 0 | 1 };
  bg?: UColor;
  cl?: UColor;
  bd?: { t?: UBorder; r?: UBorder; b?: UBorder; l?: UBorder };
  n?: { pattern: string };
  ht?: number;
  vt?: number;
  tb?: number;
};

// Default Office theme palette, indexed per the xlsx theme order (lt1, dk1, lt2, dk2, accent1-6).
const THEME = [
  "FFFFFF",
  "000000",
  "E7E6E6",
  "44546A",
  "4472C4",
  "ED7D31",
  "A5A5A5",
  "FFC000",
  "5B9BD5",
  "70AD47",
];

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function applyTint(hex: string, tint: number): string {
  const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const t = Math.max(-1, Math.min(1, tint));
  const out = ch.map((c) => (t < 0 ? c * (1 + t) : c + (255 - c) * t));
  return out.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
}

/** ExcelJS colour -> "#RRGGBB". Theme colours use the default Office palette (tint is approximate). */
export function toHex(
  c: (Partial<ExcelJS.Color> & { tint?: number }) | undefined,
): string | undefined {
  if (!c) return undefined;
  if (typeof c.argb === "string" && /^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c.argb)) {
    return `#${c.argb.slice(-6).toUpperCase()}`;
  }
  if (typeof c.theme === "number" && THEME[c.theme]) {
    const base = THEME[c.theme];
    return `#${(c.tint ? applyTint(base, c.tint) : base).toUpperCase()}`;
  }
  return undefined;
}

/** Univer colour ("#RRGGBB", "#RGB" or "rgb(r,g,b)") -> ARGB hex for ExcelJS. */
export function toArgb(c: UColor | undefined): string | undefined {
  const v = c?.rgb;
  if (!v) return undefined;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(v);
  if (m) {
    return (
      "FF" +
      [m[1], m[2], m[3]]
        .map((x) => clamp(Number(x)).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }
  const h = v.replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(h))
    return "FF" + h.split("").map((x) => x + x).join("").toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(h)) return "FF" + h.toUpperCase();
  return undefined;
}

const BORDER_TO_U: Record<string, number> = {
  thin: 1,
  hair: 2,
  dotted: 3,
  dashed: 4,
  dashDot: 5,
  dashDotDot: 6,
  double: 7,
  medium: 8,
  mediumDashed: 9,
  mediumDashDot: 10,
  mediumDashDotDot: 11,
  slantDashDot: 12,
  thick: 13,
};
const U_TO_BORDER: Record<number, ExcelJS.BorderStyle> = Object.fromEntries(
  Object.entries(BORDER_TO_U).map(([k, v]) => [v, k as ExcelJS.BorderStyle]),
);
const H_TO_U: Record<string, number> = {
  left: 1,
  center: 2,
  centerContinuous: 2,
  right: 3,
  justify: 4,
  distributed: 6,
  fill: 1,
};
const U_TO_H: Record<number, ExcelJS.Alignment["horizontal"]> = {
  1: "left",
  2: "center",
  3: "right",
  4: "justify",
  6: "distributed",
};
const V_TO_U: Record<string, number> = { top: 1, middle: 2, bottom: 3, distributed: 2, justify: 2 };
const U_TO_V: Record<number, ExcelJS.Alignment["vertical"]> = {
  1: "top",
  2: "middle",
  3: "bottom",
};

// Excel built-in date formats that ExcelJS reports by name; mapped to explicit patterns.
const BUILTIN_FMT: Record<string, string> = {
  "mm-dd-yy": "m/d/yyyy",
  "d-mmm-yy": "d-mmm-yy",
  "d-mmm": "d-mmm",
  "mmm-yy": "mmm-yy",
  "h:mm AM/PM": "h:mm AM/PM",
  "h:mm:ss AM/PM": "h:mm:ss AM/PM",
};

export type StyleInput = {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  border?: Partial<ExcelJS.Borders>;
  alignment?: Partial<ExcelJS.Alignment>;
  numFmt?: string;
};

/** ExcelJS style -> Univer style. Returns undefined when nothing visible is set. `notes` collects lossy conversions. */
export function toUniverStyle(
  s: StyleInput,
  opts: { isDate?: boolean; notes?: Set<string> } = {},
): UStyle | undefined {
  const u: UStyle = {};
  const f = s.font;
  if (f) {
    if (f.name) u.ff = f.name;
    if (typeof f.size === "number") u.fs = f.size;
    if (f.bold) u.bl = 1;
    if (f.italic) u.it = 1;
    if (f.underline) u.ul = { s: 1 };
    if (f.strike) u.st = { s: 1 };
    const col = toHex(f.color);
    if (col) u.cl = { rgb: col };
  }
  const fill = s.fill;
  if (fill && fill.type === "pattern" && fill.pattern === "solid") {
    const bg = toHex(fill.fgColor);
    if (bg) u.bg = { rgb: bg };
  } else if (fill && fill.type === "pattern" && fill.pattern !== "none") {
    const bg = toHex(fill.fgColor);
    if (bg) u.bg = { rgb: bg };
    opts.notes?.add("Patterned cell fills were converted to solid fills.");
  } else if (fill && fill.type === "gradient") {
    const stop = fill.stops?.[0]?.color;
    const bg = toHex(stop);
    if (bg) u.bg = { rgb: bg };
    opts.notes?.add("Gradient fills were converted to a solid colour.");
  }
  const b = s.border;
  if (b) {
    const bd: NonNullable<UStyle["bd"]> = {};
    for (const [k, key] of [
      ["top", "t"],
      ["right", "r"],
      ["bottom", "b"],
      ["left", "l"],
    ] as const) {
      const side = b[k];
      if (side?.style && BORDER_TO_U[side.style]) {
        bd[key] = {
          s: BORDER_TO_U[side.style],
          cl: { rgb: toHex(side.color) ?? "#000000" },
        };
      }
    }
    if (Object.keys(bd).length) u.bd = bd;
  }
  const a = s.alignment;
  if (a) {
    if (a.horizontal && H_TO_U[a.horizontal]) u.ht = H_TO_U[a.horizontal];
    if (a.vertical && V_TO_U[a.vertical]) u.vt = V_TO_U[a.vertical];
    if (a.wrapText) u.tb = 3;
  }
  if (s.numFmt && s.numFmt !== "General")
    u.n = { pattern: BUILTIN_FMT[s.numFmt] ?? s.numFmt };
  else if (opts.isDate) u.n = { pattern: "yyyy-mm-dd" };
  return Object.keys(u).length ? u : undefined;
}

/** Univer style -> ExcelJS style pieces. */
export function fromUniverStyle(u: UStyle | undefined): StyleInput {
  const out: StyleInput = {};
  if (!u) return out;
  const font: Partial<ExcelJS.Font> = {};
  if (u.ff) font.name = u.ff;
  if (u.fs) font.size = u.fs;
  if (u.bl) font.bold = true;
  if (u.it) font.italic = true;
  if (u.ul?.s) font.underline = true;
  if (u.st?.s) font.strike = true;
  const fc = toArgb(u.cl);
  if (fc) font.color = { argb: fc };
  if (Object.keys(font).length) out.font = font;
  const bg = toArgb(u.bg);
  if (bg)
    out.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  if (u.bd) {
    const border: Partial<ExcelJS.Borders> = {};
    for (const [key, k] of [
      ["t", "top"],
      ["r", "right"],
      ["b", "bottom"],
      ["l", "left"],
    ] as const) {
      const side = u.bd[key];
      if (side && U_TO_BORDER[side.s]) {
        border[k] = {
          style: U_TO_BORDER[side.s],
          color: { argb: toArgb(side.cl) ?? "FF000000" },
        };
      }
    }
    if (Object.keys(border).length) out.border = border;
  }
  const al: Partial<ExcelJS.Alignment> = {};
  if (u.ht && U_TO_H[u.ht]) al.horizontal = U_TO_H[u.ht];
  if (u.vt && U_TO_V[u.vt]) al.vertical = U_TO_V[u.vt];
  if (u.tb === 3) al.wrapText = true;
  if (Object.keys(al).length) out.alignment = al;
  if (u.n?.pattern) out.numFmt = u.n.pattern;
  return out;
}

/** Excel serial date (1900 system) from a JS Date holding UTC values. */
export function dateToSerial(d: Date): number {
  return d.getTime() / 86_400_000 + 25569;
}
export function serialToDate(n: number): Date {
  return new Date(Math.round((n - 25569) * 86_400_000));
}

/** "A1:C3" -> zero-based Univer range. */
export function parseRange(ref: string) {
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(ref);
  if (!m) return null;
  const col = (s: string) =>
    s.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const sr = Number(m[2]) - 1;
  const sc = col(m[1]);
  return {
    startRow: sr,
    startColumn: sc,
    endRow: m[4] ? Number(m[4]) - 1 : sr,
    endColumn: m[3] ? col(m[3]) : sc,
  };
}
