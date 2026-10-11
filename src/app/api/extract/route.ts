import { NextResponse, type NextRequest } from "next/server";
import { ExtractError, extractDocx, extractPdf } from "@/lib/extract/documents";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;
const MAX_BYTES = 5 * 1024 * 1024;
const hits = new Map<string, number[]>();
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  if (!getSupabaseEnv()) return err("Server isn't configured.", 500);
  const { data: auth } = await (await createClient()).auth.getUser();
  if (!auth.user) return err("Your session has expired. Sign in again.", 401);
  const now = Date.now();
  const recent = (hits.get(auth.user.id) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(auth.user.id, recent);
  if (recent.length > 10) return err("Too many requests. Wait a minute and try again.", 429);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 10_000) return err("That file is over 5 MB.", 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return err("No file received.", 400);
  if (file.size === 0) return err("That file is empty.", 400);
  if (file.size > MAX_BYTES) return err("That file is over 5 MB.", 413);
  const ext = file.name.toLowerCase().split(".").pop();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (ext === "pdf") return NextResponse.json(await extractPdf(bytes));
    if (ext === "docx") return NextResponse.json(await extractDocx(bytes));
    return err("Only .pdf and .docx files can be read here.", 415);
  } catch (e) {
    if (e instanceof ExtractError) return err(e.message, 422);
    return err("That file couldn't be read.", 422);
  }
}
