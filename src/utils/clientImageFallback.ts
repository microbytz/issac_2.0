/**
 * Direct Client-Side Image Search Fallback
 *
 * Used when the backend /api/search/images endpoint is unreachable (e.g. the app
 * is deployed as a static site without the Express server, or the device is
 * offline). Queries Openverse and Wikimedia Commons directly — both are public,
 * keyless, CORS-enabled APIs. Mirrors the provider order and the whole-token
 * relevance filtering used by server.ts.
 */

export interface FallbackImageItem {
  url: string;
  alt_text: string;
  source_url: string;
  title: string;
  dominant_color?: string;
}

const IMAGE_QUERY_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'for', 'from', 'how', 'image', 'images', 'in', 'is', 'of', 'on',
  'or', 'photo', 'photos', 'picture', 'pictures', 'the', 'to', 'what', 'with'
]);

function imageQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length >= 2 && !IMAGE_QUERY_STOPWORDS.has(t))
    .map(t => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t));
}

// Whole-token match so 'cat' can't pass on 'Cathedral'.
function matchesImageQuery(terms: string[], fields: unknown[]): boolean {
  if (terms.length === 0) return true;
  const tokens = new Set(
    fields
      .filter((f): f is string => typeof f === 'string')
      .join(' ')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .map(t => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
  );
  return terms.some(term => tokens.has(term));
}

// Flickr serves fixed size variants that share the same secret (except `_o`
// originals), so a medium copy can be shown in the grid and a small one sampled
// for colour.
function flickrSizedUrls(url: string): { display: string; sample: string } | null {
  const match = url.match(/^(https:\/\/live\.staticflickr\.com\/\d+\/\d+_[0-9a-f]+)(?:_([a-z]))?\.jpg$/);
  if (!match || match[2] === 'o') return null;
  return { display: `${match[1]}_z.jpg`, sample: `${match[1]}_m.jpg` };
}

function rgbToPaletteColor(r: number, g: number, b: number): { name: string; chromatic: boolean; sat: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;
  const sat = max === 0 ? 0 : delta / max;
  if (max < 0.2) return { name: 'black', chromatic: false, sat };
  if (sat < 0.2) return { name: max > 0.6 ? 'white' : 'black', chromatic: false, sat };

  let hue = 0;
  const rn = r / 255, gn = g / 255, bn = b / 255;
  if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
  else hue = 60 * ((rn - gn) / delta + 4);
  if (hue < 0) hue += 360;

  if (hue >= 15 && hue < 45 && max < 0.6) return { name: 'brown', chromatic: true, sat };
  if (hue < 15 || hue >= 345) return { name: max < 0.45 && sat < 0.5 ? 'brown' : 'red', chromatic: true, sat };
  if (hue < 45) return { name: 'orange', chromatic: true, sat };
  if (hue < 70) return { name: 'yellow', chromatic: true, sat };
  if (hue < 160) return { name: 'green', chromatic: true, sat };
  if (hue < 190) return { name: 'teal', chromatic: true, sat };
  if (hue < 250) return { name: 'blue', chromatic: true, sat };
  if (hue < 290) return { name: 'purple', chromatic: true, sat };
  return { name: 'pink', chromatic: true, sat };
}

// Downsamples the image and returns the most common palette color, weighting the
// centre (where the subject usually is) and preferring colourful pixels over
// grey/black/white backgrounds. Mirrors the server-side sharp pipeline.
function classifyDominantColor(pixels: Uint8ClampedArray, width: number, height: number): string | undefined {
  const scores = new Map<string, number>();
  let chromaticWeight = 0;
  let totalWeight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dx = (x + 0.5) / width - 0.5;
      const dy = (y + 0.5) / height - 0.5;
      const centreWeight = 1.5 - Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const { name, chromatic, sat } = rgbToPaletteColor(pixels[i], pixels[i + 1], pixels[i + 2]);
      const weight = chromatic ? centreWeight * (0.5 + sat) : centreWeight;
      scores.set(name, (scores.get(name) || 0) + weight);
      totalWeight += weight;
      if (chromatic) chromaticWeight += weight;
    }
  }
  if (totalWeight === 0) return undefined;
  const preferChromatic = chromaticWeight / totalWeight >= 0.15;
  let best: string | undefined;
  let bestScore = -1;
  for (const [name, score] of scores) {
    if (preferChromatic && (name === 'white' || name === 'black')) continue;
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

const colorCache = new Map<string, string>();

// Loads the image cross-origin (Openverse's thumbnail proxy and Wikimedia's
// upload CDN both send CORS headers) and classifies a 24x24 downscale. Returns
// undefined on CORS-tainted or failed loads — the image still shows, it just
// won't be color-filterable.
async function detectDominantColor(imageUrl: string): Promise<string | undefined> {
  const cached = colorCache.get(imageUrl);
  if (cached) return cached;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image load failed'));
      setTimeout(() => reject(new Error('image load timeout')), 4000);
    });
    img.src = imageUrl;
    await loaded;

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const color = classifyDominantColor(data, size, size);
    if (color) {
      if (colorCache.size >= 2000) colorCache.delete(colorCache.keys().next().value as string);
      colorCache.set(imageUrl, color);
    }
    return color;
  } catch (_) {
    return undefined;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchClientSideImageResults(query: string, page: number): Promise<FallbackImageItem[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];
  const terms = imageQueryTerms(cleanQ);

  type Candidate = FallbackImageItem & { color_url?: string };
  const attachColors = async (items: Candidate[]) =>
    mapWithConcurrency(items, 6, async ({ color_url, ...img }) => ({
      ...img,
      dominant_color: color_url ? await detectDominantColor(color_url) : undefined
    }));

  // 1. Openverse (openly licensed images; public keyless CORS API)
  try {
    const ovRes = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(cleanQ)}&page=${page}&page_size=20&mature=false`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) }
    );
    if (ovRes.ok) {
      const ovData: any = await ovRes.json();
      const results = Array.isArray(ovData?.results) ? ovData.results : [];
      const images: Candidate[] = results
        .filter((r: any) => (r?.thumbnail || r?.url) && matchesImageQuery(terms, [
          r.title,
          ...(Array.isArray(r.tags) ? r.tags.map((t: any) => t?.name) : [])
        ]))
        .map((r: any) => {
          const flickr = typeof r.url === 'string' ? flickrSizedUrls(r.url) : null;
          return {
            url: flickr?.display || r.thumbnail || r.url,
            alt_text: r.title || cleanQ,
            source_url: r.foreign_landing_url || r.url || '',
            title: r.title || cleanQ,
            color_url: flickr?.sample || r.thumbnail || r.url
          };
        });
      if (images.length > 0) return attachColors(images);
    }
  } catch (_) {}

  // 2. Wikimedia Commons file search (actual image files; CORS via origin=*)
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      `${cleanQ} filetype:bitmap`
    )}&gsrlimit=20&gsroffset=${(page - 1) * 20}&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json&origin=*`;
    const commonsRes = await fetch(commonsUrl, { signal: AbortSignal.timeout(4000) });
    if (commonsRes.ok) {
      const commonsData: any = await commonsRes.json();
      const pages = commonsData?.query?.pages ? (Object.values(commonsData.query.pages) as any[]) : [];
      const images: Candidate[] = pages
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map(p => ({ page: p, info: p?.imageinfo?.[0] }))
        .filter(({ page, info }) =>
          info &&
          /^image\/(jpeg|png|webp|gif)$/.test(info.mime || '') &&
          (info.thumburl || info.url) &&
          matchesImageQuery(terms, [page.title])
        )
        .map(({ page, info }) => ({
          url: info.thumburl || info.url,
          alt_text: String(page.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '),
          source_url: info.descriptionurl || info.url,
          title: String(page.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '),
          color_url: info.thumburl || info.url
        }));
      if (images.length > 0) return attachColors(images);
    }
  } catch (_) {}

  return [];
}
