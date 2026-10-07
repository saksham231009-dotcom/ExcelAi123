import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAV } from "@/lib/nav";

// Guards against a page being added to the nav but forgotten in the proxy (server-side route protection).
describe("proxy protects every app route", () => {
  const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
  it.each([...APP_NAV.map((n) => n.href), "/workspace"])(
    "%s is protected and in the matcher",
    (href) => {
      expect(src).toContain(`"${href}"`);
      expect(src).toContain(`"${href}/:path*"`);
    },
  );
});
