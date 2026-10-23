import { ResolveError } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TrackShare/0.1";

const TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/**
 * Reject URLs that could reach internal services (SSRF): non-HTTPS,
 * IP literals, localhost and private-looking names.
 */
export function assertPublicHttps(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ResolveError("invalidUrl", 400);
  }
  if (url.protocol !== "https:") throw new ResolveError("httpsOnly", 400);
  if (url.username || url.password) throw new ResolveError("credentialsNotAllowed", 400);
  if (url.port && url.port !== "443") throw new ResolveError("customPortNotAllowed", 400);
  const host = url.hostname.toLowerCase();
  const isIpV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isIpV6 = host.startsWith("[") || host.includes(":");
  if (
    isIpV4 ||
    isIpV6 ||
    !host.includes(".") ||
    host === "localhost" ||
    /\.(local|localhost|internal|lan|home|corp)$/.test(host)
  ) {
    throw new ResolveError("hostNotAllowed", 400);
  }
  return url;
}

interface SafeFetchOptions {
  accept?: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "HEAD";
  body?: string;
  /** Extra check on every hop (start URL and each redirect target). */
  allowHost?: (host: string) => boolean;
}

/** fetch() with a timeout and redirects followed by hand, so every hop is checked. */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = assertPublicHttps(current);
    if (opts.allowHost && !opts.allowHost(url.hostname.toLowerCase())) {
      throw new ResolveError("redirectToUnsupportedHost", 400, { host: url.hostname });
    }
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      body: opts.body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": UA,
        "accept-language": "en-US,en;q=0.8",
        ...(opts.accept ? { accept: opts.accept } : {}),
        ...opts.headers,
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = new URL(location, url).toString();
      continue;
    }
    // Keep the final URL available to callers.
    Object.defineProperty(res, "finalUrl", { value: url.toString() });
    return res;
  }
  throw new ResolveError("tooManyRedirects", 400);
}

export function finalUrlOf(res: Response, fallback: string): string {
  return (res as Response & { finalUrl?: string }).finalUrl ?? fallback;
}

async function readLimited(res: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > limit) throw new ResolveError("responseTooLarge", 502);
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new ResolveError("responseTooLarge", 502);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function fetchJson<T>(url: string, opts: SafeFetchOptions = {}): Promise<T> {
  const res = await safeFetch(url, { accept: "application/json", ...opts });
  if (!res.ok) throw new ResolveError("upstreamError", 502, { status: res.status, host: new URL(url).hostname });
  const body = await readLimited(res, MAX_HTML_BYTES);
  return JSON.parse(new TextDecoder().decode(body)) as T;
}

export async function fetchHtml(url: string, opts: SafeFetchOptions = {}): Promise<{ html: string; finalUrl: string }> {
  const res = await safeFetch(url, { accept: "text/html,application/xhtml+xml", ...opts });
  if (!res.ok) throw new ResolveError("upstreamError", 502, { status: res.status, host: new URL(url).hostname });
  const body = await readLimited(res, MAX_HTML_BYTES);
  return { html: new TextDecoder().decode(body), finalUrl: finalUrlOf(res, url) };
}

export async function fetchImage(url: string): Promise<Buffer> {
  const res = await safeFetch(url, { accept: "image/avif,image/webp,image/png,image/jpeg,*/*" });
  if (!res.ok) throw new ResolveError("coverLoadFailed", 502, { status: res.status });
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream")) {
    throw new ResolveError("coverNotImage", 502);
  }
  return Buffer.from(await readLimited(res, MAX_IMAGE_BYTES));
}
