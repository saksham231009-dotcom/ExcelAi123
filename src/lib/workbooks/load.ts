import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "./validate";
import { ImportError, importToSnapshot } from "./import";
import { blankSnapshot } from "./snapshot";

export type WorkbookRow = {
  id: string;
  name: string;
  file_type: "blank" | "xlsx" | "csv";
  storage_path: string | null;
  snapshot: unknown | null;
  snapshot_version: number;
};

/** Returns the saved snapshot, creating it on first open (blank sheet, or import of the uploaded file). */
export async function ensureSnapshot(
  supabase: SupabaseClient,
  wb: WorkbookRow,
): Promise<{ snapshot: unknown; version: number } | { error: string }> {
  if (wb.snapshot)
    return { snapshot: wb.snapshot, version: wb.snapshot_version };
  let snap;
  if (wb.file_type === "blank" || !wb.storage_path)
    snap = blankSnapshot(wb.id, wb.name);
  else {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(wb.storage_path);
    if (error || !data)
      return { error: "The uploaded file couldn't be loaded from storage." };
    try {
      snap = await importToSnapshot(
        wb.id,
        wb.name,
        wb.file_type,
        await data.arrayBuffer(),
      );
    } catch (e) {
      return {
        error:
          e instanceof ImportError
            ? e.message
            : "This file couldn't be opened.",
      };
    }
  }
  const { data: saved, error } = await supabase
    .from("workbooks")
    .update({ snapshot: snap, snapshot_version: 1 })
    .eq("id", wb.id)
    .is("snapshot", null)
    .select("snapshot_version");
  if (error)
    return {
      error:
        "Couldn't save the opened workbook. Check that the latest database migration was applied.",
    };
  if (!saved?.length) {
    // another tab won the race: reload theirs
    const { data: again } = await supabase
      .from("workbooks")
      .select("snapshot, snapshot_version")
      .eq("id", wb.id)
      .single();
    if (again?.snapshot)
      return { snapshot: again.snapshot, version: again.snapshot_version };
    return { error: "Couldn't open the workbook. Please reload." };
  }
  return { snapshot: snap, version: 1 };
}
