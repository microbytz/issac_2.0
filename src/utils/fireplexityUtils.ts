export interface FireplexitySource {
  url: string;
  title: string;
  description?: string;
  content?: string;
  markdown?: string;
  publishedDate?: string;
  author?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

export interface FireplexityNewsItem {
  url: string;
  title: string;
  description?: string;
  publishedDate?: string;
  source?: string;
  image?: string;
}

export interface FireplexityImageItem {
  url: string;
  title: string;
  thumbnail: string;
  source?: string;
  width?: number;
  height?: number;
  position?: number;
}

export interface TickerMatch {
  ticker: string;
  companyName: string;
}

export interface FireplexityTurn {
  id: string;
  query: string;
  answer: string;
  sources: FireplexitySource[];
  newsResults: FireplexityNewsItem[];
  imageResults: FireplexityImageItem[];
  followUpQuestions: string[];
  ticker?: TickerMatch | null;
  statusMessage?: string | null;
  isStreaming: boolean;
  error?: string | null;
  errorSuggestion?: string | null;
  providerInfo?: {
    searchProvider: string;
    llmProvider: string;
  };
  createdAt: string;
}

const COMPANY_TICKER_MAP: Array<{
  keywords: string[];
  ticker: string;
  companyName: string;
}> = [
  { keywords: ['nvidia', 'nvda', 'geforce', 'cuda', 'blackwell', 'jensen huang'], ticker: 'NASDAQ:NVDA', companyName: 'NVIDIA Corporation' },
  { keywords: ['apple', 'aapl', 'iphone', 'macbook', 'tim cook'], ticker: 'NASDAQ:AAPL', companyName: 'Apple Inc.' },
  { keywords: ['microsoft', 'msft', 'azure', 'satya nadella'], ticker: 'NASDAQ:MSFT', companyName: 'Microsoft Corporation' },
  { keywords: ['alphabet', 'google', 'googl', 'goog', 'waymo', 'sundar pichai'], ticker: 'NASDAQ:GOOGL', companyName: 'Alphabet Inc.' },
  { keywords: ['amazon', 'amzn', 'aws', 'andy jassy'], ticker: 'NASDAQ:AMZN', companyName: 'Amazon.com, Inc.' },
  { keywords: ['meta', 'facebook', 'instagram', 'whatsapp', 'zuckerberg'], ticker: 'NASDAQ:META', companyName: 'Meta Platforms, Inc.' },
  { keywords: ['tesla', 'tsla', 'cybertruck', 'elon musk'], ticker: 'NASDAQ:TSLA', companyName: 'Tesla, Inc.' },
  { keywords: ['amd', 'advanced micro devices', 'ryzen', 'epyc', 'lisa su'], ticker: 'NASDAQ:AMD', companyName: 'Advanced Micro Devices, Inc.' },
  { keywords: ['intel', 'intc'], ticker: 'NASDAQ:INTC', companyName: 'Intel Corporation' },
  { keywords: ['netflix', 'nflx'], ticker: 'NASDAQ:NFLX', companyName: 'Netflix, Inc.' },
  { keywords: ['palantir', 'pltr'], ticker: 'NYSE:PLTR', companyName: 'Palantir Technologies Inc.' },
  { keywords: ['snowflake', 'snow'], ticker: 'NYSE:SNOW', companyName: 'Snowflake Inc.' },
  { keywords: ['cloudflare', 'net'], ticker: 'NYSE:NET', companyName: 'Cloudflare, Inc.' },
  { keywords: ['datadog', 'ddog'], ticker: 'NASDAQ:DDOG', companyName: 'Datadog, Inc.' },
  { keywords: ['mongodb', 'mdb'], ticker: 'NASDAQ:MDB', companyName: 'MongoDB, Inc.' },
  { keywords: ['elastic', 'estc', 'elasticsearch'], ticker: 'NYSE:ESTC', companyName: 'Elastic N.V.' },
  { keywords: ['coinbase', 'coin'], ticker: 'NASDAQ:COIN', companyName: 'Coinbase Global, Inc.' },
  { keywords: ['shopify', 'shop'], ticker: 'NYSE:SHOP', companyName: 'Shopify Inc.' },
  { keywords: ['uber'], ticker: 'NYSE:UBER', companyName: 'Uber Technologies, Inc.' },
  { keywords: ['airbnb', 'abnb'], ticker: 'NASDAQ:ABNB', companyName: 'Airbnb, Inc.' },
  { keywords: ['salesforce', 'crm'], ticker: 'NYSE:CRM', companyName: 'Salesforce, Inc.' },
  { keywords: ['oracle', 'orcl'], ticker: 'NYSE:ORCL', companyName: 'Oracle Corporation' },
  { keywords: ['broadcom', 'avgo'], ticker: 'NASDAQ:AVGO', companyName: 'Broadcom Inc.' },
  { keywords: ['tsmc', 'taiwan semiconductor'], ticker: 'NYSE:TSM', companyName: 'Taiwan Semiconductor Manufacturing' },
  { keywords: ['arm holdings', 'arm chip'], ticker: 'NASDAQ:ARM', companyName: 'Arm Holdings plc' },
  { keywords: ['spotify', 'spot'], ticker: 'NYSE:SPOT', companyName: 'Spotify Technology S.A.' },
  { keywords: ['ibm'], ticker: 'NYSE:IBM', companyName: 'International Business Machines' },
  { keywords: ['crowdstrike', 'crwd'], ticker: 'NASDAQ:CRWD', companyName: 'CrowdStrike Holdings, Inc.' },
  { keywords: ['palo alto networks', 'panw'], ticker: 'NASDAQ:PANW', companyName: 'Palo Alto Networks, Inc.' },
  { keywords: ['servicenow', 'now'], ticker: 'NYSE:NOW', companyName: 'ServiceNow, Inc.' },
  { keywords: ['adobe', 'adbe'], ticker: 'NASDAQ:ADBE', companyName: 'Adobe Inc.' }
];

export function detectCompanyTicker(query: string): TickerMatch | null {
  if (!query || !query.trim()) return null;
  const lower = query.toLowerCase();

  // Check if the query is asking about stock, market, finance, price, shares, revenue, earnings, or directly naming a company/ticker
  const financialOrCompanyIntent =
    /\b(stock|share|shares|price|market|cap|ticker|earnings|revenue|valuation|chart|nasdaq|nyse|invest|financial|quarter|q1|q2|q3|q4|nvda|aapl|msft|googl|amzn|meta|tsla|pltr|amd|snow|ddog|mdb|estc|crwd)\b/i.test(
      lower
    );

  for (const entry of COMPANY_TICKER_MAP) {
    for (const kw of entry.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(lower)) {
        // Trigger chart if financial intent or if explicit ticker/company query
        if (financialOrCompanyIntent || entry.keywords.slice(0, 2).some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower))) {
          return {
            ticker: entry.ticker,
            companyName: entry.companyName
          };
        }
      }
    }
  }

  return null;
}

/**
 * Smart content selection ported from Fireplexity's lib/content-selection.ts.
 * Extracts the most query-relevant paragraphs from scraped Markdown while preserving
 * the introductory context and staying within maxLength.
 */
export function selectRelevantContent(markdown: string, query: string, maxLength: number = 2000): string {
  if (!markdown) return '';

  const cleaned = markdown
    .replace(/!\[.*?\]\(.*?\)/g, '') // Strip markdown images to save context tokens
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Simplify inline links to anchor text
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const paragraphs = cleaned
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 25);

  if (paragraphs.length === 0) {
    return cleaned.slice(0, maxLength);
  }

  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'what', 'how', 'why',
    'when', 'where', 'who', 'which', 'are', 'was', 'were', 'been', 'have', 'has',
    'had', 'can', 'could', 'would', 'should', 'will', 'about', 'into', 'over', 'after'
  ]);

  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const scored = paragraphs.map((text, index) => {
    const lower = text.toLowerCase();
    let score = 0;

    // Always boost the first two paragraphs for introductory context
    if (index === 0) score += 5;
    if (index === 1) score += 2.5;

    // Boost headings + structured content slightly
    if (text.startsWith('#')) score += 1.5;

    for (const word of queryWords) {
      if (lower.includes(word)) {
        score += 3;
        // Count multiple occurrences (capped)
        const matches = lower.split(word).length - 1;
        score += Math.min(matches, 3) * 1.2;
      }
    }

    return { text, index, score };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: Array<{ text: string; index: number }> = [];
  let currentLength = 0;

  for (const item of scored) {
    if (currentLength + item.text.length + 2 <= maxLength) {
      selected.push({ text: item.text, index: item.index });
      currentLength += item.text.length + 2;
    }
  }

  // Re-order selected paragraphs in their original document order
  selected.sort((a, b) => a.index - b.index);

  if (selected.length === 0) {
    return cleaned.slice(0, maxLength);
  }

  return selected.map(s => s.text).join('\n\n');
}
