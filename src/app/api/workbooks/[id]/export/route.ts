import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { exportSnapshot, type Snap } from "@/lib/workbooks/export";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Exports the last SAVED state of a workbook as .xlsx (values, formulas, styles, merges, sizes, freeze panes). */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/workbooks/[id]/export">,
) {
  const { id } = await ctx.params;
  if (!UUID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!getSupabaseEnv())
    return NextResponse.json(
      { error: "Server isn't configured." },
      { status: 500 },
    );
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: wb } = await supabase
    .from("workbooks")
    .select("name, snapshot")
    .eq("id", id)
    .maybeSingle();
  if (!wb?.snapshot)
    return NextResponse.json({ error: "Workbook not found." }, { status: 404 });

  const snap = wb.snapshot as Snap;
  const out = exportSnapshot(snap);
  const buf = await out.xlsx.writeBuffer();
  const safe = wb.name.replace(/[^\w\- ]+/g, "_").slice(0, 80) || "workbook";
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
