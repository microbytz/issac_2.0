// Shared outbound-fetch safety helpers. Any server-side fetch whose target is
// influenced by users, search results, or discovered links must go through these
// so requests cannot pivot into the internal network (SSRF).

export const MAX_SAFE_FETCH_BYTES = 2 * 1024 * 1024;

// Loopback, link-local and RFC1918/CGNAT hosts.
export const PRIVATE_HOST_RE = /^localhost$|\.local$|\.internal$|^0\.0\.0\.0$|^::$|^\[?::1\]?$|^127\.|^10\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./i;

export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_RE.test(hostname);
}

export interface SafeFetchOptions {
  userAgent?: string;
  accept?: string;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  status: number;
  contentType: string;
  finalUrl: string;
  body?: Buffer;
}

// Validates the scheme and host of the URL and every redirect target, and reads
// at most maxBytes of the body. Redirect hops are followed manually so each
// destination is revalidated. Returns undefined when a redirect target is
// unsafe/unresolvable; otherwise returns the final response (check .status).
export async function fetchPublicResource(
  pageUrl: string,
  opts: SafeFetchOptions & { timeoutMs: number }
): Promise<SafeFetchResult | undefined> {
  const maxBytes = opts.maxBytes ?? MAX_SAFE_FETCH_BYTES;
  const maxRedirects = opts.maxRedirects ?? 4;
  let url = pageUrl;
  for (let hop = 0; hop < maxRedirects; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (_) {
      return undefined;
    }
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || isPrivateHost(parsed.hostname)) {
      return undefined;
    }
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': opts.userAgent || 'IsaacSearchEngine/2.0',
          'Accept': opts.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(opts.timeoutMs),
        redirect: 'manual'
      });
    } catch (_) {
      return undefined;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return undefined;
      try {
        url = new URL(location, url).toString();
      } catch (_) {
        return undefined;
      }
      continue;
    }
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !response.body) {
      return { status: response.status, contentType, finalUrl: url };
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) {
      return { status: response.status, contentType, finalUrl: url };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel();
          return { status: response.status, contentType, finalUrl: url };
        }
        chunks.push(value);
      }
    } catch (_) {
      return undefined;
    }
    return { status: response.status, contentType, finalUrl: url, body: Buffer.concat(chunks) };
  }
  return undefined;
}

// Text-only convenience wrapper around fetchPublicResource — returns undefined
// on any failure or missing body.
export async function fetchPublicText(
  pageUrl: string,
  timeoutMs: number,
  opts: SafeFetchOptions = {}
): Promise<string | undefined> {
  const res = await fetchPublicResource(pageUrl, { ...opts, timeoutMs });
  if (!res || !res.body) return undefined;
  return res.body.toString('utf-8');
}
