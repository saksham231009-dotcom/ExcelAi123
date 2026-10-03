/**
 * Live Supabase ownership/RLS tests. They SKIP unless these are set in .env.local:
 *   TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
 * Both users must already exist and be able to sign in (confirm their emails first).
 * Requires the migration in supabase/migrations to be applied.
 */
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

loadEnvConfig(process.cwd());
const e = process.env;
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key =
  e.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const enabled = !!(
  url &&
  key &&
  e.TEST_USER_A_EMAIL &&
  e.TEST_USER_A_PASSWORD &&
  e.TEST_USER_B_EMAIL &&
  e.TEST_USER_B_PASSWORD
);

async function login(email: string, password: string) {
  const c = createClient(url!, key!, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user)
    throw new Error(`Test login failed for ${email}: ${error?.message}`);
  return { c, id: data.user.id };
}

describe.skipIf(!enabled)("RLS: workbook ownership", () => {
  let A: { c: SupabaseClient; id: string };
  let B: { c: SupabaseClient; id: string };
  let wbId: string;
  const path = () => `${A.id}/${wbId}.csv`;

  beforeAll(async () => {
    A = await login(e.TEST_USER_A_EMAIL!, e.TEST_USER_A_PASSWORD!);
    B = await login(e.TEST_USER_B_EMAIL!, e.TEST_USER_B_PASSWORD!);
    const { data, error } = await A.c
      .from("workbooks")
      .insert({ owner_id: A.id, name: "rls-test", file_type: "blank" })
      .select("id")
      .single();
    expect(error).toBeNull();
    wbId = data!.id;
  });
  afterAll(async () => {
    await A.c.storage.from("workbooks").remove([path()]);
    await A.c.from("workbooks").delete().eq("id", wbId);
  });

  it("owner can read their workbook", async () => {
    const { data } = await A.c.from("workbooks").select("id").eq("id", wbId);
    expect(data).toHaveLength(1);
  });
  it("other user cannot read it", async () => {
    const { data } = await B.c.from("workbooks").select("id").eq("id", wbId);
    expect(data).toHaveLength(0);
  });
  it("other user cannot rename it", async () => {
    const { data } = await B.c
      .from("workbooks")
      .update({ name: "hacked" })
      .eq("id", wbId)
      .select("id");
    expect(data ?? []).toHaveLength(0);
    const { data: still } = await A.c
      .from("workbooks")
      .select("name")
      .eq("id", wbId)
      .single();
    expect(still?.name).toBe("rls-test");
  });
  it("other user cannot delete it", async () => {
    await B.c.from("workbooks").delete().eq("id", wbId);
    const { data } = await A.c.from("workbooks").select("id").eq("id", wbId);
    expect(data).toHaveLength(1);
  });
  it("cannot insert a workbook owned by someone else", async () => {
    const { error } = await B.c
      .from("workbooks")
      .insert({ owner_id: A.id, name: "spoof", file_type: "blank" });
    expect(error).not.toBeNull();
  });
  it("owner cannot reassign ownership", async () => {
    const { error } = await A.c
      .from("workbooks")
      .update({ owner_id: B.id })
      .eq("id", wbId);
    expect(error).not.toBeNull();
  });
  it("storage: other user cannot upload into owner's folder", async () => {
    const { error } = await B.c.storage
      .from("workbooks")
      .upload(path(), new Blob(["a,b\n1,2"], { type: "text/csv" }));
    expect(error).not.toBeNull();
  });
  it("storage: owner uploads; other user cannot download or delete", async () => {
    const up = await A.c.storage
      .from("workbooks")
      .upload(path(), new Blob(["a,b\n1,2"], { type: "text/csv" }));
    expect(up.error).toBeNull();
    const dl = await B.c.storage.from("workbooks").download(path());
    expect(dl.error).not.toBeNull();
    await B.c.storage.from("workbooks").remove([path()]);
    const still = await A.c.storage.from("workbooks").download(path());
    expect(still.error).toBeNull();
  });
  it("storage: bucket is private (no public URL access)", async () => {
    const res = await fetch(
      `${url}/storage/v1/object/public/workbooks/${path()}`,
    );
    expect(res.ok).toBe(false);
  });
});
