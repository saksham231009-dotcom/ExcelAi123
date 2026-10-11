import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export class FetchBlocked extends Error {}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and cloud-metadata addresses (IPv4 and IPv6). */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isBlockedIp(mapped[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v);
    if (hex) {
      const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16);
      return isBlockedIp(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
    }
    return /^(fc|fd|fe[89ab]|ff)/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8");
  }
  return true; // not an IP at all
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolve: Resolver = async (h) => (await dns.lookup(h, { all: true })).map((a) => a.address);

/** Validates scheme, port, credentials and that EVERY resolved address is public. */
export async function assertPublicUrl(raw: string, resolve: Resolver = defaultResolve): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new FetchBlocked("That isn't a valid URL."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new FetchBlocked("Only http and https links are allowed.");
  if (u.username || u.password) throw new FetchBlocked("Links with embedded credentials aren't allowed.");
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new FetchBlocked("Only standard web ports (80, 443) are allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
    throw new FetchBlocked("That address is not allowed.");
  const addrs = net.isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (!addrs.length) throw new FetchBlocked("That address couldn't be found.");
  if (addrs.some(isBlockedIp)) throw new FetchBlocked("That address is not allowed.");
  return u;
}

export type RawResponse = { status: number; headers: Record<string, string | undefined>; body: Buffer };
export type FetchOnce = (u: URL, opts: { maxBytes: number; timeoutMs: number }) => Promise<RawResponse>;

/** Real network call. The connection's DNS lookup is re-validated, so DNS rebinding can't swap in a private IP. */
export const fetchOnce: FetchOnce = (u, { maxBytes, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(
      u,
      {
        method: "GET",
        timeout: timeoutMs,
        headers: { "User-Agent": "ExcelAI-Importer/1.0 (+user-requested page read)", Accept: "text/html,application/xhtml+xml" },
        lookup: (host, _o, cb) => {
          dns.lookup(host, { all: true }).then(
            (all) => {
              const bad = all.find((a) => isBlockedIp(a.address));
              if (bad || !all.length) return cb(new FetchBlocked("That address is not allowed.") as never, "", 4);
              cb(null, all[0].address, all[0].family);
            },
            (e) => cb(e, "", 4),
          );
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) { req.destroy(new FetchBlocked("That page is too large (over 2 MB).")); return; }
          chunks.push(c);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new FetchBlocked("The site took too long to respond.")));
    req.on("error", reject);
    req.end();
  });

/** GET with manual redirect handling: every hop is re-validated. */
export async function safeFetch(
  url: string,
  deps: { resolve?: Resolver; fetchOnce?: FetchOnce; maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<{ url: URL; status: number; headers: RawResponse["headers"]; body: Buffer }> {
  const once = deps.fetchOnce ?? fetchOnce;
  let u = await assertPublicUrl(url, deps.resolve);
  for (let hop = 0; hop <= (deps.maxRedirects ?? 4); hop++) {
    let r: RawResponse;
    try {
      r = await once(u, { maxBytes: deps.maxBytes ?? 2 * 1024 * 1024, timeoutMs: deps.timeoutMs ?? 10_000 });
    } catch (e) {
      if (e instanceof FetchBlocked) throw e;
      throw new FetchBlocked("Couldn't reach that site.");
    }
    if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.location) {
      u = await assertPublicUrl(new URL(r.headers.location, u).toString(), deps.resolve);
      continue;
    }
    return { url: u, status: r.status, headers: r.headers, body: r.body };
  }
  throw new FetchBlocked("Too many redirects.");
}
