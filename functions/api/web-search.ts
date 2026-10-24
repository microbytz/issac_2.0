// Cloudflare Pages Function: GET /api/web-search?q=...&page=1&country=US
// Lets the static web deployment (no Express backend) serve real web results;
// set BRAVE_SEARCH_API_KEY in the Pages project's environment variables.
import { searchWeb } from '../../shared/webSearch';

interface PagesContext {
  request: Request;
  env: { BRAVE_SEARCH_API_KEY?: string };
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 300);
  const page = Math.min(10, Math.max(1, Number(url.searchParams.get('page')) || 1));
  const country = url.searchParams.get('country') || 'ALL';
  const result = q ? await searchWeb(q, { page, country, braveApiKey: env.BRAVE_SEARCH_API_KEY?.trim() }) : { hits: [], sources: [] };
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  });
};
