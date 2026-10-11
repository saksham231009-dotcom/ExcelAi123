// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ExtractError, extractDocx, extractPdf } from "@/lib/extract/documents";
import { extractTables } from "@/lib/extract/html-tables";
import { FetchBlocked, assertPublicUrl, isBlockedIp, safeFetch, type FetchOnce } from "@/lib/net/ssrf";
import { attachmentToOps } from "@/lib/ai/attachment";

const pub = async () => ["93.184.216.34"];

describe("SSRF protection", () => {
  it("classifies private, loopback, link-local, metadata and mapped IPv6 as blocked", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "not-an-ip"])
      expect(isBlockedIp(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"]) expect(isBlockedIp(ip), ip).toBe(false);
  });
  it("rejects bad schemes, ports, credentials, localhost names and private DNS answers", async () => {
    for (const u of ["file:///etc/passwd", "ftp://a.com", "http://a.com:8080", "http://user:pw@a.com", "http://localhost/", "http://x.localhost/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest", "nonsense"])
      await expect(assertPublicUrl(u, pub), u).rejects.toBeInstanceOf(FetchBlocked);
    await expect(assertPublicUrl("https://evil.example/", async () => ["93.184.216.34", "10.0.0.5"])).rejects.toBeInstanceOf(FetchBlocked);
    await expect(assertPublicUrl("https://ok.example/", pub)).resolves.toBeInstanceOf(URL);
  });
  it("re-validates every redirect hop", async () => {
    const calls: string[] = [];
    const once: FetchOnce = async (u) => {
      calls.push(u.href);
      return u.hostname === "ok.example"
        ? { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" }, body: Buffer.alloc(0) }
        : { status: 200, headers: {}, body: Buffer.from("secret") };
    };
    await expect(safeFetch("https://ok.example/", { resolve: pub, fetchOnce: once })).rejects.toBeInstanceOf(FetchBlocked);
    expect(calls).toEqual(["https://ok.example/"]); // the metadata address was never contacted
  });
  it("follows safe redirects, and stops redirect loops", async () => {
    const ok: FetchOnce = async (u) => (u.pathname === "/a" ? { status: 301, headers: { location: "/b" }, body: Buffer.alloc(0) } : { status: 200, headers: {}, body: Buffer.from("hi") });
    const r = await safeFetch("https://ok.example/a", { resolve: pub, fetchOnce: ok });
    expect(r.url.pathname).toBe("/b");
    const loop: FetchOnce = async () => ({ status: 302, headers: { location: "/x" }, body: Buffer.alloc(0) });
    await expect(safeFetch("https://ok.example/", { resolve: pub, fetchOnce: loop })).rejects.toThrow(/redirects/);
  });
  it("the real network layer refuses a private target without connecting", async () => {
    await expect(safeFetch("http://127.0.0.1:9/")).rejects.toBeInstanceOf(FetchBlocked);
  });
});

describe("HTML tables", () => {
  const html = `<html><title> Prices </title><script>alert(1)</script><table><caption>Fruit</caption>
    <tr><th>Name</th><th>Price</th></tr><tr><td>Apple</td><td>1.5</td></tr><tr><td colspan="2">=HYPERLINK("x")</td></tr></table>
    <table><tr><td>only one cell</td></tr></table></html>`;
  it("extracts real tables, ignores scripts and trivial tables", () => {
    const r = extractTables(html);
    expect(r.title).toBe("Prices");
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].caption).toBe("Fruit");
    expect(r.tables[0].rows[0]).toEqual(["Name", "Price"]);
    expect(r.tables[0].rows[1]).toEqual(["Apple", 1.5]);
  });
  it("neutralises formula injection when tables become sheets", () => {
    const t = extractTables(html).tables[0];
    const ops = attachmentToOps({ name: "web.csv", kind: "table", text: "", rows: t.rows, truncated: false }, []);
    const set = ops!.find((o) => o.op === "set_cells") as { values: unknown[][] };
    expect(set.values[2][0]).toBe("'=HYPERLINK(\"x\")");
  });
});

describe("PDF and DOCX extraction", () => {
  it("reads text from a PDF with a text layer", async () => {
    const r = await extractPdf(new Uint8Array(readFileSync("tests/fixtures/sample.pdf")));
    expect(r.text).toContain("Invoice 42");
    expect(r.text).toContain("Total due 1500");
  });
  it("explains that scanned PDFs need OCR, and rejects non-PDFs", async () => {
    await expect(extractPdf(new Uint8Array(readFileSync("tests/fixtures/blank.pdf")))).rejects.toThrow(/OCR/);
    await expect(extractPdf(new TextEncoder().encode("hello"))).rejects.toBeInstanceOf(ExtractError);
  });
  it("reads DOCX paragraphs and tables", async () => {
    const r = await extractDocx(new Uint8Array(readFileSync("tests/fixtures/sample.docx")));
    expect(r.text).toContain("Quarterly report");
    expect(r.tables[0].rows).toEqual([["Region", "Sales"], ["North", 120], ["South", 95]]);
  });
  it("rejects a corrupted DOCX", async () => {
    await expect(extractDocx(new TextEncoder().encode("not a zip"))).rejects.toBeInstanceOf(ExtractError);
  });
});
