import type { Op } from "./schema";

export type OpId = Op["op"];
export type OpMeta = {
  id: OpId;
  category: "edit" | "structure" | "clean" | "format" | "sheet" | "analyze";
  /** Prompt signature shown to the AI; the single source of truth for the prompt. */
  signature: string;
  /** Changes the workbook (false = read-only answer). */
  mutates: boolean;
  /** Can remove or overwrite existing data. The engine decides per plan whether it actually does. */
  canDestroy: boolean;
};

/** Every operation the app can execute. Tests guarantee this list, the Zod schema and the engine stay in sync. */
export const REGISTRY: OpMeta[] = [
  { id: "set_cells", category: "edit", signature: 'set_cells{range:"A1:B2",values:[[..]]} (strings starting "=" are formulas)', mutates: true, canDestroy: true },
  { id: "add_column", category: "structure", signature: 'add_column{header,formula?:"=B{row}*C{row}" ({row} = row number),after?:column}', mutates: true, canDestroy: false },
  { id: "rename_column", category: "structure", signature: "rename_column{column,new_name}", mutates: true, canDestroy: false },
  { id: "delete_columns", category: "structure", signature: "delete_columns{columns:[..]}", mutates: true, canDestroy: true },
  { id: "insert_rows", category: "structure", signature: "insert_rows{after_row,count}", mutates: true, canDestroy: false },
  { id: "delete_rows", category: "structure", signature: "delete_rows{from_row,to_row}", mutates: true, canDestroy: true },
  { id: "clear_range", category: "edit", signature: "clear_range{range}", mutates: true, canDestroy: true },
  { id: "sort", category: "structure", signature: 'sort{by,direction:"asc"|"desc"}', mutates: true, canDestroy: false },
  { id: "remove_duplicates", category: "clean", signature: "remove_duplicates{columns?:[..],ignore_case?:bool}", mutates: true, canDestroy: true },
  { id: "find_replace", category: "clean", signature: "find_replace{find,replace,column?,match_case?,whole_cell?}", mutates: true, canDestroy: true },
  { id: "fill_blanks", category: "clean", signature: "fill_blanks{column,value}", mutates: true, canDestroy: false },
  { id: "clean_text", category: "clean", signature: 'clean_text{column?,mode:"trim"|"lowercase"|"uppercase"|"titlecase"}', mutates: true, canDestroy: true },
  { id: "format", category: "format", signature: 'format{range?|column?,bold?,background?:"#RRGGBB",font_color?:"#RRGGBB",number_format?,align?:"left"|"center"|"right"}', mutates: true, canDestroy: false },
  { id: "highlight", category: "format", signature: 'highlight{condition:{column,operator:">"|"<"|">="|"<="|"=="|"!="|"contains"|"empty"|"not_empty",value?},background?:"#RRGGBB"}', mutates: true, canDestroy: false },
  { id: "create_sheet", category: "sheet", signature: "create_sheet{name}", mutates: true, canDestroy: false },
  { id: "rename_sheet", category: "sheet", signature: "rename_sheet{from,to}", mutates: true, canDestroy: false },
  { id: "delete_sheet", category: "sheet", signature: "delete_sheet{name}", mutates: true, canDestroy: true },
  { id: "detect_anomalies", category: "analyze", signature: 'detect_anomalies{column,method?:"iqr"|"zscore",threshold?,highlight?:bool,write_to_sheet?}', mutates: false, canDestroy: false },
  { id: "forecast", category: "analyze", signature: "forecast{column,periods?:1-60,write_to_sheet?} (straight-line trend over rows in order)", mutates: false, canDestroy: false },
  { id: "merge_sheets", category: "structure", signature: "merge_sheets{sheets:[name,name,..],into:newSheetName} (stacks rows, matches columns by header)", mutates: true, canDestroy: false },
  { id: "find_errors", category: "analyze", signature: "find_errors{write_to_sheet?} (formula errors and text inside numeric columns)", mutates: false, canDestroy: false },
  { id: "wrap_iferror", category: "edit", signature: 'wrap_iferror{column,fallback?:"" or number} (wraps that column\'s formulas in IFERROR)', mutates: true, canDestroy: false },
  { id: "conditional_format", category: "format", signature: 'conditional_format{column,operator:">"|"<"|">="|"<="|"=="|"!="|"contains"|"empty"|"not_empty",value?,background?:"#RRGGBB",font_color?} (LIVE rule that keeps applying as data changes; prefer this over highlight when the user wants rules that stay up to date)', mutates: true, canDestroy: false },
  { id: "explain_formula", category: "analyze", signature: 'explain_formula{cell:"D2"} (plain-language breakdown of one formula)', mutates: false, canDestroy: false },
  { id: "data_health", category: "analyze", signature: "data_health{} (finds blanks, mixed types, inconsistent text, duplicate rows)", mutates: false, canDestroy: false },
  { id: "suggest_rules", category: "analyze", signature: "suggest_rules{} (suggests which values are worth highlighting; does not apply them)", mutates: false, canDestroy: false },
  { id: "create_dashboard", category: "sheet", signature: "create_dashboard{name?,group_by?,value_column?} (new sheet of live totals/averages, a category breakdown and key findings; no charts)", mutates: true, canDestroy: false },
  { id: "query", category: "analyze", signature: 'query{kind:"top_n"|"sum"|"avg"|"min"|"max"|"count"|"summary",column?,group_by?,n?,direction?,write_to_sheet?}', mutates: false, canDestroy: false },
];

export const OP_IDS = REGISTRY.map((r) => r.id);
export const operationsPrompt = () => REGISTRY.map((r) => r.signature).join("\n");

/** True when applying these ops would change the workbook (anything other than a pure query without write_to_sheet). */
export function mutatesWorkbook(ops: Op[]): boolean {
  return ops.some((o) =>
    o.op === "explain_formula" || o.op === "data_health" || o.op === "suggest_rules" ? false : o.op === "query" || o.op === "detect_anomalies" || o.op === "forecast" || o.op === "find_errors"
      ? !!o.write_to_sheet || ("highlight" in o && o.highlight === true)
      : REGISTRY.find((r) => r.id === o.op)?.mutates !== false,
  );
}
