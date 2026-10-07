import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { contextSchema } from "@/lib/ai/context";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompt";
import { logError } from "@/lib/log";
import { planSchema } from "@/lib/operations/schema";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  workbookId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  context: contextSchema,
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(500),
      }),
    )
    .max(6)
    .default([]),
});

// Best-effort per-instance rate limit (serverless instances don't share memory; add a shared store before launch).
const hits = new Map<string, number[]>();
function limited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 15;
}

const err = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  if (!getSupabaseEnv()) return err("Server isn't configured.", 500);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return err("Your session has expired. Sign in again.", 401);

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (
    !apiKey ||
    apiKey.startsWith("your-") ||
    !model ||
    model.startsWith("your-")
  ) {
    return err(
      "AI isn't configured. Set OPENAI_API_KEY and OPENAI_MODEL in the server environment.",
      503,
    );
  }
  if (limited(auth.user.id))
    return err("Too many AI requests. Wait a minute and try again.", 429);

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.text();
    if (raw.length > 60_000) return err("Request too large.", 413);
    const parsed = bodySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return err("Invalid request.", 400);
    body = parsed.data;
  } catch {
    return err("Invalid request.", 400);
  }

  // Ownership check (RLS returns nothing for other users' workbooks).
  const { data: wb } = await supabase
    .from("workbooks")
    .select("id")
    .eq("id", body.workbookId)
    .maybeSingle();
  if (!wb) return err("Workbook not found.", 404);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...body.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: buildUserPrompt(body.message, body.context) },
  ];

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        max_completion_tokens: 1500,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return err("The AI service didn't respond in time. Try again.", 504);
  }
  if (!res.ok) {
    logError("openai", { status: res.status });
    if (res.status === 401)
      return err(
        "The AI key is invalid. Check OPENAI_API_KEY on the server.",
        502,
      );
    if (res.status === 429)
      return err(
        "The AI service is rate limited or out of quota. Try again later.",
        502,
      );
    return err("The AI service returned an error. Try again.", 502);
  }

  let content = "";
  let usage: unknown;
  try {
    const json = await res.json();
    content = json.choices?.[0]?.message?.content ?? "";
    usage = json.usage;
    if (json.choices?.[0]?.finish_reason === "length")
      return err("The AI response was cut off. Try a smaller request.", 502);
  } catch {
    return err("The AI service returned an unreadable response.", 502);
  }

  let plan;
  try {
    const parsed = planSchema.safeParse(JSON.parse(content));
    if (!parsed.success)
      return err(
        "The AI proposed an operation the app doesn't support or that is malformed. Nothing was changed. Try rephrasing.",
        422,
      );
    plan = parsed.data;
  } catch {
    return err(
      "The AI response wasn't valid. Nothing was changed. Try again.",
      422,
    );
  }
  return NextResponse.json({ plan, usage });
}
