"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET,
  MAX_UPLOAD_BYTES,
  cleanWorkbookName,
  storagePath,
} from "@/lib/workbooks/validate";

type Result = { ok: true; id?: string } | { ok: false; error: string };
const FAIL = (error: string): Result => ({ ok: false, error });
const GENERIC = "Something went wrong. Please try again.";
const uuid = z.string().uuid();

async function authed() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ? { supabase, user: data.user } : null;
  } catch {
    return null;
  }
}
const SESSION = "Your session has expired. Sign in again.";

export async function createBlankWorkbook(): Promise<Result> {
  const a = await authed();
  if (!a) return FAIL(SESSION);
  const { data, error } = await a.supabase
    .from("workbooks")
    .insert({
      owner_id: a.user.id,
      name: "Untitled workbook",
      file_type: "blank",
    })
    .select("id")
    .single();
  if (error || !data)
    return FAIL("Couldn't create the workbook. Please try again.");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

const registerSchema = z.object({
  id: uuid,
  name: z.string(),
  fileType: z.enum(["xlsx", "csv"]),
});

/** Called after the browser uploaded the file to the user's own folder. Verifies it, then records it. */
export async function registerUpload(input: unknown): Promise<Result> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return FAIL("Invalid upload request.");
  const a = await authed();
  if (!a) return FAIL(SESSION);
  const { id, fileType } = parsed.data;
  const name = cleanWorkbookName(parsed.data.name);
  if (!name) return FAIL("Invalid workbook name.");
  const path = storagePath(a.user.id, id, fileType);

  const cleanup = () => a.supabase.storage.from(BUCKET).remove([path]);
  const { data: files, error: listErr } = await a.supabase.storage
    .from(BUCKET)
    .list(a.user.id, { search: `${id}.${fileType}`, limit: 1 });
  const obj = files?.find((f) => f.name === `${id}.${fileType}`);
  if (listErr || !obj)
    return FAIL("The uploaded file could not be found. Please try again.");
  const size = Number(obj.metadata?.size ?? 0);
  if (size <= 0 || size > MAX_UPLOAD_BYTES) {
    await cleanup();
    return FAIL("The uploaded file has an invalid size.");
  }
  const { error } = await a.supabase.from("workbooks").insert({
    id,
    owner_id: a.user.id,
    name,
    file_type: fileType,
    storage_path: path,
    size_bytes: size,
  });
  if (error) {
    await cleanup(); // avoid orphaned files
    return FAIL(
      "Couldn't save the workbook. The upload was discarded. Please try again.",
    );
  }
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function renameWorkbook(
  id: string,
  rawName: string,
): Promise<Result> {
  if (!uuid.safeParse(id).success) return FAIL("Invalid workbook.");
  const name = cleanWorkbookName(rawName);
  if (!name) return FAIL("Enter a name between 1 and 120 characters.");
  const a = await authed();
  if (!a) return FAIL(SESSION);
  const { data, error } = await a.supabase
    .from("workbooks")
    .update({ name })
    .eq("id", id)
    .select("id");
  if (error) return FAIL("Couldn't rename the workbook. Please try again.");
  if (!data?.length) return FAIL("Workbook not found.");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteWorkbook(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return FAIL("Invalid workbook.");
  const a = await authed();
  if (!a) return FAIL(SESSION);
  const { data: wb, error: readErr } = await a.supabase
    .from("workbooks")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return FAIL(GENERIC);
  if (!wb) return FAIL("Workbook not found.");
  if (wb.storage_path) {
    // Remove the file first; if this fails we keep the record so nothing is lost track of.
    const { error } = await a.supabase.storage
      .from(BUCKET)
      .remove([wb.storage_path]);
    if (error)
      return FAIL(
        "Couldn't delete the file. The workbook was kept. Please try again.",
      );
  }
  const { error } = await a.supabase.from("workbooks").delete().eq("id", id);
  if (error)
    return FAIL(
      "The file was removed but the record couldn't be deleted. Try deleting again.",
    );
  revalidatePath("/dashboard");
  return { ok: true };
}
