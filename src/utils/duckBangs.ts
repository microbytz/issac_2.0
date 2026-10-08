export interface DuckBang {
  prefix: string; // e.g. '!w'
  aliases?: string[]; // e.g. ['!wiki', '!wikipedia']
  name: string; // 'Wikipedia'
  domain: string; // 'en.wikipedia.org'
  url: string; // 'https://en.wikipedia.org/wiki/Special:Search?search={{{s}}}'
  homeUrl: string; // 'https://en.wikipedia.org'
  category: 'Tech' | 'Research' | 'Entertainment' | 'Shopping' | 'Social' | 'Reference' | 'News';
  icon: string; // Emoji representation
  description: string;
}

export const DUCK_BANGS: DuckBang[] = [
  {
    prefix: '!w',
    aliases: ['!wiki', '!wikipedia'],
    name: 'Wikipedia',
    domain: 'en.wikipedia.org',
    url: 'https://en.wikipedia.org/wiki/Special:Search?search={{{s}}}',
    homeUrl: 'https://en.wikipedia.org',
    category: 'Reference',
    icon: '📚',
    description: 'Search Wikipedia the free encyclopedia'
  },
  {
    prefix: '!g',
    aliases: ['!google'],
    name: 'Google',
    domain: 'google.com',
    url: 'https://www.google.com/search?q={{{s}}}',
    homeUrl: 'https://www.google.com',
    category: 'Tech',
    icon: '🔍',
    description: 'Search Google web index'
  },
  {
    prefix: '!yt',
    aliases: ['!youtube', '!v'],
    name: 'YouTube',
    domain: 'youtube.com',
    url: 'https://www.youtube.com/results?search_query={{{s}}}',
    homeUrl: 'https://www.youtube.com',
    category: 'Entertainment',
    icon: '▶️',
    description: 'Search videos and music on YouTube'
  },
  {
    prefix: '!r',
    aliases: ['!reddit'],
    name: 'Reddit',
    domain: 'reddit.com',
    url: 'https://www.reddit.com/search/?q={{{s}}}',
    homeUrl: 'https://www.reddit.com',
    category: 'Social',
    icon: '💬',
    description: 'Search discussions, subreddits and threads on Reddit'
  },
  {
    prefix: '!gh',
    aliases: ['!github', '!git'],
    name: 'GitHub',
    domain: 'github.com',
    url: 'https://github.com/search?q={{{s}}}',
    homeUrl: 'https://github.com',
    category: 'Tech',
    icon: '🐙',
    description: 'Search code repositories, developers & topics on GitHub'
  },
  {
    prefix: '!so',
    aliases: ['!stackoverflow'],
    name: 'Stack Overflow',
    domain: 'stackoverflow.com',
    url: 'https://stackoverflow.com/search?q={{{s}}}',
    homeUrl: 'https://stackoverflow.com',
    category: 'Tech',
    icon: '💡',
    description: 'Search programming answers and solutions on Stack Overflow'
  },
  {
    prefix: '!a',
    aliases: ['!amazon'],
    name: 'Amazon',
    domain: 'amazon.com',
    url: 'https://www.amazon.com/s?k={{{s}}}',
    homeUrl: 'https://www.amazon.com',
    category: 'Shopping',
    icon: '📦',
    description: 'Search products and reviews on Amazon'
  },
  {
    prefix: '!m',
    aliases: ['!maps', '!gmaps'],
    name: 'Google Maps',
    domain: 'maps.google.com',
    url: 'https://www.google.com/maps/search/{{{s}}}',
    homeUrl: 'https://maps.google.com',
    category: 'Reference',
    icon: '🗺️',
    description: 'Search places, addresses, navigation & directions'
  },
  {
    prefix: '!x',
    aliases: ['!tw', '!twitter'],
    name: 'X (Twitter)',
    domain: 'x.com',
    url: 'https://twitter.com/search?q={{{s}}}',
    homeUrl: 'https://x.com',
    category: 'Social',
    icon: '🐦',
    description: 'Search real-time posts, breaking news & creators on X'
  },
  {
    prefix: '!ddg',
    aliases: ['!duck'],
    name: 'DuckDuckGo',
    domain: 'duckduckgo.com',
    url: 'https://duckduckgo.com/?q={{{s}}}',
    homeUrl: 'https://duckduckgo.com',
    category: 'Reference',
    icon: '🦆',
    description: 'Search anonymously on DuckDuckGo'
  },
  {
    prefix: '!mdn',
    aliases: ['!mozilla'],
    name: 'MDN Web Docs',
    domain: 'developer.mozilla.org',
    url: 'https://developer.mozilla.org/en-US/search?q={{{s}}}',
    homeUrl: 'https://developer.mozilla.org',
    category: 'Tech',
    icon: '🌐',
    description: 'Search JavaScript, HTML, CSS & Web API documentation'
  },
  {
    prefix: '!npm',
    name: 'npm',
    domain: 'npmjs.com',
    url: 'https://www.npmjs.com/search?q={{{s}}}',
    homeUrl: 'https://www.npmjs.com',
    category: 'Tech',
    icon: '📦',
    description: 'Search JavaScript & Node.js packages on npm'
  },
  {
    prefix: '!py',
    aliases: ['!python', '!pydoc'],
    name: 'Python Docs',
    domain: 'docs.python.org',
    url: 'https://docs.python.org/3/search.html?q={{{s}}}',
    homeUrl: 'https://docs.python.org/3/',
    category: 'Tech',
    icon: '🐍',
    description: 'Search Python 3 standard library and language docs'
  },
  {
    prefix: '!hn',
    aliases: ['!hackernews'],
    name: 'Hacker News',
    domain: 'news.ycombinator.com',
    url: 'https://hn.algolia.com/?q={{{s}}}',
    homeUrl: 'https://news.ycombinator.com',
    category: 'Tech',
    icon: '📰',
    description: 'Search startup, tech & software stories on Hacker News'
  },
  {
    prefix: '!imdb',
    name: 'IMDb',
    domain: 'imdb.com',
    url: 'https://www.imdb.com/find?q={{{s}}}',
    homeUrl: 'https://www.imdb.com',
    category: 'Entertainment',
    icon: '🎬',
    description: 'Search movies, TV shows, actors & ratings on IMDb'
  },
  {
    prefix: '!ebay',
    name: 'eBay',
    domain: 'ebay.com',
    url: 'https://www.ebay.com/sch/i.html?_nkw={{{s}}}',
    homeUrl: 'https://www.ebay.com',
    category: 'Shopping',
    icon: '🏷️',
    description: 'Search auctions & online marketplace items on eBay'
  },
  {
    prefix: '!arch',
    aliases: ['!archwiki'],
    name: 'ArchWiki',
    domain: 'wiki.archlinux.org',
    url: 'https://wiki.archlinux.org/index.php?search={{{s}}}',
    homeUrl: 'https://wiki.archlinux.org',
    category: 'Tech',
    icon: '🐧',
    description: 'Search comprehensive Linux & Arch system documentation'
  },
  {
    prefix: '!arxiv',
    name: 'arXiv',
    domain: 'arxiv.org',
    url: 'https://arxiv.org/search/?query={{{s}}}',
    homeUrl: 'https://arxiv.org',
    category: 'Research',
    icon: '📄',
    description: 'Search scientific e-prints in Computer Science, Physics & Math'
  },
  {
    prefix: '!scholar',
    aliases: ['!gscholar'],
    name: 'Google Scholar',
    domain: 'scholar.google.com',
    url: 'https://scholar.google.com/scholar?q={{{s}}}',
    homeUrl: 'https://scholar.google.com',
    category: 'Research',
    icon: '🎓',
    description: 'Search peer-reviewed papers, theses, books & citations'
  },
  {
    prefix: '!dict',
    aliases: ['!define', '!mw'],
    name: 'Merriam-Webster',
    domain: 'merriam-webster.com',
    url: 'https://www.merriam-webster.com/dictionary/{{{s}}}',
    homeUrl: 'https://www.merriam-webster.com',
    category: 'Reference',
    icon: '📖',
    description: 'Lookup English word definitions, synonyms & etymology'
  },
  {
    prefix: '!wolf',
    aliases: ['!wa', '!wolfram'],
    name: 'Wolfram Alpha',
    domain: 'wolframalpha.com',
    url: 'https://www.wolframalpha.com/input?i={{{s}}}',
    homeUrl: 'https://www.wolframalpha.com',
    category: 'Research',
    icon: '🧮',
    description: 'Compute math, chemistry, statistics & computational answers'
  },
  {
    prefix: '!rust',
    aliases: ['!rs'],
    name: 'Rust Docs',
    domain: 'doc.rust-lang.org',
    url: 'https://doc.rust-lang.org/std/index.html?search={{{s}}}',
    homeUrl: 'https://doc.rust-lang.org/std/',
    category: 'Tech',
    icon: '🦀',
    description: 'Search the Rust standard library documentation'
  },
  {
    prefix: '!pypi',
    name: 'PyPI',
    domain: 'pypi.org',
    url: 'https://pypi.org/search/?q={{{s}}}',
    homeUrl: 'https://pypi.org',
    category: 'Tech',
    icon: '🐍',
    description: 'Search Python packages & wheels on PyPI'
  },
  {
    prefix: '!spotify',
    aliases: ['!music'],
    name: 'Spotify',
    domain: 'spotify.com',
    url: 'https://open.spotify.com/search/{{{s}}}',
    homeUrl: 'https://open.spotify.com',
    category: 'Entertainment',
    icon: '🎵',
    description: 'Search tracks, albums, playlists & artists on Spotify'
  },
  {
    prefix: '!steam',
    name: 'Steam',
    domain: 'store.steampowered.com',
    url: 'https://store.steampowered.com/search/?term={{{s}}}',
    homeUrl: 'https://store.steampowered.com',
    category: 'Entertainment',
    icon: '🎮',
    description: 'Search PC games, DLC & discounts on Steam'
  },
  {
    prefix: '!news',
    name: 'Google News',
    domain: 'news.google.com',
    url: 'https://news.google.com/search?q={{{s}}}',
    homeUrl: 'https://news.google.com',
    category: 'News',
    icon: '📰',
    description: 'Search top headlines and worldwide news sources'
  }
];

export interface ParsedBangResult {
  hasBang: boolean;
  bang?: DuckBang;
  rawBang?: string;
  searchQuery: string;
  redirectUrl?: string;
}

/**
 * Parses user input to detect DuckDuckGo-style !bang shortcuts.
 * Supports prefixes at the start ("!w python") or end ("python !w") or alone ("!w").
 */
export function parseBangQuery(input: string): ParsedBangResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { hasBang: false, searchQuery: '' };
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) {
    return { hasBang: false, searchQuery: trimmed };
  }

  // Check prefix bang (e.g. "!w quantum")
  const firstToken = tokens[0].toLowerCase();
  if (firstToken.startsWith('!')) {
    const bang = findBang(firstToken);
    if (bang) {
      const rest = tokens.slice(1).join(' ').trim();
      const redirectUrl = rest
        ? bang.url.replace('{{{s}}}', encodeURIComponent(rest))
        : bang.homeUrl;
      return {
        hasBang: true,
        bang,
        rawBang: firstToken,
        searchQuery: rest,
        redirectUrl
      };
    }
  }

  // Check suffix bang (e.g. "quantum !w")
  const lastToken = tokens[tokens.length - 1].toLowerCase();
  if (lastToken.startsWith('!')) {
    const bang = findBang(lastToken);
    if (bang) {
      const rest = tokens.slice(0, -1).join(' ').trim();
      const redirectUrl = rest
        ? bang.url.replace('{{{s}}}', encodeURIComponent(rest))
        : bang.homeUrl;
      return {
        hasBang: true,
        bang,
        rawBang: lastToken,
        searchQuery: rest,
        redirectUrl
      };
    }
  }

  return { hasBang: false, searchQuery: trimmed };
}

/**
 * Finds a bang by its prefix or any of its aliases.
 */
export function findBang(token: string): DuckBang | undefined {
  const clean = token.toLowerCase().trim();
  return DUCK_BANGS.find(b => {
    if (b.prefix.toLowerCase() === clean) return true;
    if (b.aliases?.some(a => a.toLowerCase() === clean)) return true;
    return false;
  });
}

/**
 * Returns matching bangs based on current user typing (e.g. typing "!" or "!w").
 */
export function getMatchingBangs(prefix: string, limit: number = 8): DuckBang[] {
  const clean = prefix.toLowerCase().trim();
  if (!clean.startsWith('!')) return [];

  if (clean === '!') {
    // Return top popular bangs
    return DUCK_BANGS.slice(0, limit);
  }

  const queryPart = clean.slice(1);
  return DUCK_BANGS.filter(b => {
    const pPart = b.prefix.slice(1).toLowerCase();
    if (pPart.startsWith(queryPart)) return true;
    if (b.aliases?.some(a => a.slice(1).toLowerCase().startsWith(queryPart))) return true;
    if (b.name.toLowerCase().includes(queryPart)) return true;
    return false;
  }).slice(0, limit);
}
