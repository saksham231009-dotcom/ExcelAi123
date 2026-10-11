import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261006000000_updated_at_real_changes.sql", "utf8");

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create table public.workbooks (
      id int primary key, name text, snapshot jsonb, snapshot_version int default 0,
      updated_at timestamptz not null default now()
    );
    alter table public.workbooks add column import_notes jsonb;`);
  // Minimal stand-in: the migration creates the function; attach the trigger like the original migration.
  await db.exec(migration.replace(/alter table public\.workbooks add column if not exists import_notes jsonb;/, ""));
  await db.exec(`create trigger t before update on public.workbooks for each row execute function public.set_updated_at();`);
  await db.exec(`insert into public.workbooks (id, name, updated_at) values (1, 'A', '2020-01-01T00:00:00Z');`);
  return db;
}
const stamp = async (db: PGlite) =>
  Number((await db.query<{ u: string }>(`select (extract(epoch from updated_at)*1000000)::bigint::text u from public.workbooks where id=1`)).rows[0].u);

describe("workbooks.updated_at trigger", () => {
  it("does not change when the first-open snapshot is created", async () => {
    const db = await setup();
    const before = await stamp(db);
    await db.exec(`update public.workbooks set snapshot='{"a":1}', snapshot_version=1, import_notes='[]' where id=1`);
    expect(await stamp(db)).toBe(before);
  });
  it("changes when the snapshot content really changes", async () => {
    const db = await setup();
    await db.exec(`update public.workbooks set snapshot='{"a":1}' where id=1`);
    const before = await stamp(db);
    await db.exec(`update public.workbooks set snapshot='{"a":2}', snapshot_version=2 where id=1`);
    expect(await stamp(db)).toBeGreaterThan(before);
  });
  it("does not change when an identical snapshot is saved again", async () => {
    const db = await setup();
    await db.exec(`update public.workbooks set snapshot='{"a":1}' where id=1`);
    const before = await stamp(db);
    await db.exec(`update public.workbooks set snapshot='{"a":1}', snapshot_version=3 where id=1`);
    expect(await stamp(db)).toBe(before);
  });
  it("changes on rename", async () => {
    const db = await setup();
    const before = await stamp(db);
    await db.exec(`update public.workbooks set name='B' where id=1`);
    expect(await stamp(db)).toBeGreaterThan(before);
  });
});
