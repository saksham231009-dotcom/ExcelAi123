import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAV } from "@/lib/nav";

const SRC = join(process.cwd(), "src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** All route patterns that exist, e.g. "/dashboard", "/workspace/[id]". Route groups "(x)" are ignored. */
const routes = walk(join(SRC, "app"))
  .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f))
  .map(
    (f) =>
      "/" +
      f
        .slice(join(SRC, "app").length + 1)
        .replace(/\/?(page\.tsx|route\.ts)$/, "")
        .split("/")
        .filter((s) => s && !/^\(.*\)$/.test(s))
        .join("/"),
  )
  .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));

const exists = (href: string) =>
  routes.some((r) =>
    new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "$").test(href),
  );

describe("route integrity (no broken internal links)", () => {
  it("every nav item points to a real page", () => {
    for (const n of APP_NAV) expect(exists(n.href), n.href).toBe(true);
  });
  it("every literal internal href/redirect in the source points to a real route", () => {
    const bad: string[] = [];
    for (const f of walk(SRC).filter((x) => /\.(tsx?|ts)$/.test(x))) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(
        /(?:href|action)=["'`](\/[^"'`#?$ {]*)|redirect\(\s*["'`](\/[^"'`#?$ {]*)/g,
      )) {
        const href = (m[1] ?? m[2]).replace(/\/$/, "") || "/";
        if (href.startsWith("/_next") || href === "/favicon.ico") continue;
        if (!exists(href)) bad.push(`${f.replace(SRC, "src")}: ${href}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("no placeholder '#' links remain", () => {
    for (const f of walk(SRC).filter((x) => x.endsWith(".tsx")))
      expect(readFileSync(f, "utf8")).not.toMatch(/href=["']#["']/);
  });
  it("OpenAI key is never exposed to the client", () => {
    for (const f of walk(SRC)) {
      const t = readFileSync(f, "utf8");
      expect(t).not.toMatch(/NEXT_PUBLIC_OPENAI/);
      if (t.includes("OPENAI_API_KEY"))
        expect(t.startsWith('"use client"'), f).toBe(false);
    }
  });
});
