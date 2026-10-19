import { gunzipSync, inflateSync } from 'node:zlib';

/**
 * Common Crawl WARC ingestion — pulls the *stored page content* out of Common
 * Crawl's archive instead of re-fetching the live site. Each index record
 * points at a byte range inside a .warc.gz file on data.commoncrawl.org.
 */

export interface CCRecord {
  url: string;
  timestamp: string;
  filename: string;
  offset: number;
  length: number;
  digest: string;
  status: string;
  mime: string;
}

const CC_UA = 'IsaacSearchEngine/2.0';
const MAX_WARC_RECORD_BYTES = 3 * 1024 * 1024; // compressed record cap
const MAX_HTML_BYTES = 1024 * 1024;            // decompressed HTML cap

/** Query the CDX index for a domain; returns records including WARC pointers. */
export async function queryCCIndex(indexId: string, domain: string, limit: number): Promise<CCRecord[]> {
  const ccUrl =
    `https://index.commoncrawl.org/${indexId}-index?url=${encodeURIComponent(domain + '/*')}` +
    `&output=json&filter=status:200&filter=mime:text/html&matchType=domain&limit=${limit}`;
  const res = await fetch(ccUrl, {
    headers: { 'User-Agent': CC_UA },
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) throw new Error(`commoncrawl index ${res.status}`);

  const text = await res.text();
  const seen = new Set<string>();
  const records: CCRecord[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const rec = JSON.parse(trimmed);
      const url = String(rec.url || '');
      const filename = String(rec.filename || '');
      const offset = Number(rec.offset);
      const length = Number(rec.length);
      if (!url || !filename || !Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) continue;
      if (length > MAX_WARC_RECORD_BYTES) continue;
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        url,
        timestamp: String(rec.timestamp || ''),
        filename,
        offset,
        length,
        digest: String(rec.digest || ''),
        status: String(rec.status || ''),
        mime: String(rec.mime || '')
      });
      if (records.length >= limit) break;
    } catch (_) {}
  }
  return records;
}

/** Deflate a transfer-encoding: chunked HTTP body. */
function dechunk(buf: Buffer): Buffer | null {
  const chunks: Buffer[] = [];
  let pos = 0;
  for (let guard = 0; guard < 100_000; guard++) {
    const lineEnd = buf.indexOf('\r\n', pos);
    if (lineEnd === -1) return null;
    const sizeStr = buf.toString('ascii', pos, lineEnd).split(';')[0].trim();
    const size = parseInt(sizeStr, 16);
    if (!Number.isFinite(size) || size < 0) return null;
    pos = lineEnd + 2;
    if (size === 0) return Buffer.concat(chunks);
    if (pos + size > buf.length) return null;
    chunks.push(buf.subarray(pos, pos + size));
    pos += size + 2; // chunk data + trailing CRLF
  }
  return null;
}

/**
 * Range-fetch a WARC record from data.commoncrawl.org and unwrap it:
 * gzip(record) → WARC headers → HTTP response headers → entity body
 * (itself possibly chunked and/or gzip content-encoded).
 */
export async function fetchWarcHtml(rec: CCRecord): Promise<{ html: string; httpStatus: number } | null> {
  const res = await fetch(`https://data.commoncrawl.org/${rec.filename}`, {
    headers: {
      Range: `bytes=${rec.offset}-${rec.offset + rec.length - 1}`,
      'User-Agent': CC_UA
    },
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) return null;

  const raw = Buffer.from(await res.arrayBuffer());
  let record: Buffer;
  try {
    record = gunzipSync(raw);
  } catch (_) {
    record = raw; // rare: uncompressed record
  }

  const warcSep = record.indexOf('\r\n\r\n');
  if (warcSep === -1) return null;
  const warcHead = record.subarray(0, warcSep).toString('utf8');
  if (!/^WARC\/1\.[01]/m.test(warcHead.trimStart())) return null;
  if (!/WARC-Type:\s*response/i.test(warcHead)) return null;

  const rest = record.subarray(warcSep + 4);
  const httpSep = rest.indexOf('\r\n\r\n');
  if (httpSep === -1) return null;
  const httpHead = rest.subarray(0, httpSep).toString('utf8');
  const statusMatch = /^HTTP\/\d(?:\.\d+)?\s+(\d{3})/m.exec(httpHead);
  if (!statusMatch) return null;
  const httpStatus = Number(statusMatch[1]);
  if (httpStatus < 200 || httpStatus >= 400) return null;

  let body = rest.subarray(httpSep + 4);
  if (/transfer-encoding:\s*chunked/i.test(httpHead)) {
    const dechunked = dechunk(body);
    if (dechunked) body = dechunked;
  }
  if (/content-encoding:\s*gzip/i.test(httpHead)) {
    try { body = gunzipSync(body); } catch (_) { return null; }
  } else if (/content-encoding:\s*deflate/i.test(httpHead)) {
    try { body = inflateSync(body); } catch (_) { return null; }
  }
  if (body.length > MAX_HTML_BYTES) body = body.subarray(0, MAX_HTML_BYTES);

  const html = body.toString('utf8');
  if (html.length < 64) return null;
  return { html, httpStatus };
}
