import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extractTables } from "@/lib/extract/html-tables";
import { FetchBlocked, safeFetch } from "@/lib/net/ssrf";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;
const body = z.object({ url: z.string().trim().min(8).max(2000) });
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
  if (recent.length > 8) return err("Too many page reads. Wait a minute and try again.", 429);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Enter a web address (https://…).", 400);
  try {
    const r = await safeFetch(parsed.data.url);
    if (r.status === 401 || r.status === 403 || r.status === 429)
      return err("That site doesn't allow automated reading (it needs a login or blocks bots). ExcelAI doesn't bypass this. Copy the data or export a file from the site instead.", 422);
    if (r.status < 200 || r.status >= 300) return err(`The site returned an error (${r.status}).`, 422);
    if (!/html/i.test(r.headers["content-type"] ?? "")) return err("That link isn't a web page (HTML).", 422);
    const html = r.body.toString("utf8");
    const { title, tables } = extractTables(html);
    if (!tables.length)
      return err(
        /captcha|are you a (robot|human)|enable javascript|verify you are/i.test(html)
          ? "The site asked for a CAPTCHA or JavaScript check, which ExcelAI can't complete."
          : "No data tables were found on that page. Only static HTML tables are supported (not pages that load data with JavaScript).",
        422,
      );
    return NextResponse.json({ source: r.url.hostname, title, tables });
  } catch (e) {
    return err(e instanceof FetchBlocked ? e.message : "Couldn't read that page.", e instanceof FetchBlocked ? 422 : 502);
  }
}
