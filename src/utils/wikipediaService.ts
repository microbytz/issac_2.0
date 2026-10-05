// Dynamic Wikipedia Entity InfoBox Service with typo correction & live lookup

export interface WikiEntityInfobox {
  title: string;
  category: string;
  subtitle: string;
  description: string;
  thumbnailUrl?: string;
  attributes: { label: string; value: string }[];
  wikiUrl: string;
  tags: string[];
}

// Built-in instant knowledge base for iconic historical figures, scientists & entities
export const OFFLINE_WIKI_ENTITIES: Record<string, WikiEntityInfobox> = {
  'isaac newton': {
    title: 'Isaac Newton',
    category: 'Mathematician & Physicist',
    subtitle: 'English polymath (1643–1727) • Formulated Classical Mechanics & Gravitation',
    description: 'Sir Isaac Newton was an English mathematician, physicist, astronomer, alchemist, and author who is widely recognized as one of the greatest mathematicians and physicists of all time and among the most influential scientists. A key figure in the Scientific Revolution, Newton formulated the laws of motion and universal gravitation.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '4 January 1643, Woolsthorpe Manor, England' },
      { label: 'Died', value: '31 March 1727 (aged 84), Kensington, Middlesex, England' },
      { label: 'Known for', value: 'Newtonian mechanics, Universal gravitation, Calculus, Optics, Newton\'s laws of motion' },
      { label: 'Alma mater', value: 'Trinity College, Cambridge' },
      { label: 'Major work', value: 'Philosophiæ Naturalis Principia Mathematica (1687)' },
      { label: 'Fields', value: 'Physics, Mathematics, Astronomy, Natural philosophy' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Isaac_Newton',
    tags: ['isaac newton', 'physics', 'mathematics', 'gravitation', 'science']
  },
  'albert einstein': {
    title: 'Albert Einstein',
    category: 'Theoretical Physicist',
    subtitle: 'Developer of Special & General Relativity (1879–1955) • Nobel Laureate',
    description: 'Albert Einstein was a German-born theoretical physicist who is widely held to be one of the greatest and most influential scientists of all time. Best known for developing the theory of relativity, he also made fundamental contributions to quantum mechanics.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: 'March 14, 1879, Ulm, Kingdom of Württemberg, Germany' },
      { label: 'Died', value: 'April 18, 1955 (aged 76), Princeton, New Jersey, US' },
      { label: 'Known for', value: 'General relativity, Special relativity, Photoelectric effect, E = mc²' },
      { label: 'Awards', value: 'Nobel Prize in Physics (1921), Copley Medal (1925), Max Planck Medal (1929)' },
      { label: 'Alma mater', value: 'Federal Polytechnic School, Zurich (ETH Zurich)' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Albert_Einstein',
    tags: ['albert einstein', 'relativity', 'physics', 'nobel', 'science']
  },
  'nikola tesla': {
    title: 'Nikola Tesla',
    category: 'Inventor & Electrical Engineer',
    subtitle: 'Serbian-American pioneer of Alternating Current (AC) electricity (1856–1943)',
    description: 'Nikola Tesla was a Serbian-American engineer and futurist best known for his contributions to the design of the modern alternating current (AC) electricity supply system, induction motors, and wireless communication experiments.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '10 July 1856, Smiljan, Austrian Empire (Croatia)' },
      { label: 'Died', value: '7 January 1943 (aged 86), New York City, US' },
      { label: 'Known for', value: 'Alternating Current (AC), Induction motor, Tesla coil, Radio transmission' },
      { label: 'Fields', value: 'Electrical engineering, Mechanical engineering, Physics' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Nikola_Tesla',
    tags: ['nikola tesla', 'electricity', 'engineering', 'ac', 'inventor']
  },
  'marie curie': {
    title: 'Marie Curie',
    category: 'Physicist & Chemist',
    subtitle: 'Pioneer of Radioactivity (1867–1934) • First person to win two Nobel Prizes',
    description: 'Marie Salomea Skłodowska-Curie was a Polish and naturalized-French physicist and chemist who conducted pioneering research on radioactivity. She was the first woman to win a Nobel Prize, the first person to win a Nobel Prize twice, and the only person to win a Nobel Prize in two scientific fields.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '7 November 1867, Warsaw, Poland' },
      { label: 'Died', value: '4 July 1934 (aged 66), Passy, Haute-Savoie, France' },
      { label: 'Discovered', value: 'Radium (Ra) and Polonium (Po)' },
      { label: 'Awards', value: 'Nobel Prize in Physics (1903), Nobel Prize in Chemistry (1911)' },
      { label: 'Alma mater', value: 'University of Paris (Sorbonne)' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Marie_Curie',
    tags: ['marie curie', 'chemistry', 'physics', 'nobel', 'radioactivity']
  },
  'alan turing': {
    title: 'Alan Turing',
    category: 'Mathematician & Computer Scientist',
    subtitle: 'Father of Modern Computing & Artificial Intelligence (1912–1954)',
    description: 'Alan Mathison Turing was an English mathematician, computer scientist, logician, cryptanalyst, philosopher, and theoretical biologist. Turing was highly influential in the development of theoretical computer science, providing a formalisation of the concepts of algorithm and computation with the Turing machine.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '23 June 1912, Maida Vale, London, England' },
      { label: 'Died', value: '7 June 1954 (aged 41), Wilmslow, Cheshire, England' },
      { label: 'Known for', value: 'Turing machine, Cryptanalysis of the Enigma, Turing test, ACE' },
      { label: 'Alma mater', value: 'King\'s College, Cambridge • Princeton University' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Alan_Turing',
    tags: ['alan turing', 'computing', 'cryptography', 'ai', 'enigma']
  },
  'charles darwin': {
    title: 'Charles Darwin',
    category: 'Naturalist & Biologist',
    subtitle: 'Author of On the Origin of Species (1809–1882) • Theory of Evolution',
    description: 'Charles Robert Darwin was an English naturalist, geologist, and biologist, widely known for his contributions to evolutionary biology. His proposition that all species of life have descended from a common ancestor is now generally accepted and considered a fundamental concept in science.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '12 February 1809, The Mount, Shrewsbury, England' },
      { label: 'Died', value: '19 April 1882 (aged 73), Down House, Kent, England' },
      { label: 'Known for', value: 'Evolution by natural selection, On the Origin of Species' },
      { label: 'Expedition', value: 'Voyage of HMS Beagle (1831–1836)' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Charles_Darwin',
    tags: ['charles darwin', 'evolution', 'biology', 'science']
  },
  'galileo galilei': {
    title: 'Galileo Galilei',
    category: 'Astronomer & Physicist',
    subtitle: 'Father of Modern Observational Astronomy (1564–1642)',
    description: 'Galileo Galilei was an Italian astronomer, physicist, and engineer whose work championed heliocentrism, discovered the four largest moons of Jupiter (the Galilean moons), and confirmed the phases of Venus with telescope observations.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '15 February 1564, Pisa, Duchy of Florence' },
      { label: 'Died', value: '8 January 1642 (aged 77), Arcetri, Grand Duchy of Tuscany' },
      { label: 'Known for', value: 'Kinematics, Telescope astronomy, Moons of Jupiter, Heliocentrism' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Galileo_Galilei',
    tags: ['galileo', 'astronomy', 'physics', 'telescope', 'jupiter']
  },
  'leonardo da vinci': {
    title: 'Leonardo da Vinci',
    category: 'Polymath & Artist',
    subtitle: 'Renaissance Master (1452–1519) • Painter of Mona Lisa & The Last Supper',
    description: 'Leonardo di ser Piero da Vinci was an Italian polymath of the High Renaissance who was active as a painter, draughtsman, engineer, scientist, theorist, sculptor, and architect. Widely considered one of the greatest painters in history.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '15 April 1452, Anchiano, Republic of Florence' },
      { label: 'Died', value: '2 May 1519 (aged 67), Clos Lucé, Amboise, France' },
      { label: 'Works', value: 'Mona Lisa, The Last Supper, Vitruvian Man, Salvator Mundi' },
      { label: 'Movement', value: 'High Renaissance' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Leonardo_da_Vinci',
    tags: ['da vinci', 'art', 'renaissance', 'mona lisa', 'inventor']
  },
  'stephen hawking': {
    title: 'Stephen Hawking',
    category: 'Theoretical Physicist',
    subtitle: 'Author of A Brief History of Time (1942–2018) • Hawking Radiation',
    description: 'Stephen William Hawking was an English theoretical physicist, cosmologist, and author who was director of research at the Centre for Theoretical Cosmology at the University of Cambridge. Best known for predicting Hawking radiation emitted by black holes.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '8 January 1942, Oxford, England' },
      { label: 'Died', value: '14 March 2018 (aged 76), Cambridge, England' },
      { label: 'Known for', value: 'Hawking radiation, Penrose–Hawking theorems, Gravitational singularities' },
      { label: 'Alma mater', value: 'University College, Oxford • Trinity Hall, Cambridge' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Stephen_Hawking',
    tags: ['stephen hawking', 'black holes', 'physics', 'cosmology']
  },
  'ada lovelace': {
    title: 'Ada Lovelace',
    category: 'Mathematician & Computing Pioneer',
    subtitle: 'The First Computer Programmer (1815–1852) • Work on Analytical Engine',
    description: 'Augusta Ada King, Countess of Lovelace, was an English mathematician and writer, chiefly known for her work on Charles Babbage\'s mechanical general-purpose computer, the Analytical Engine. She was the first to recognize that the machine had applications beyond pure calculation and published the first algorithm.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80',
    attributes: [
      { label: 'Born', value: '10 December 1815, London, England' },
      { label: 'Died', value: '27 November 1852 (aged 36), Marylebone, London, England' },
      { label: 'Known for', value: 'First computer program (Algorithm for Bernoulli numbers)' },
      { label: 'Collaborator', value: 'Charles Babbage' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Ada_Lovelace',
    tags: ['ada lovelace', 'programming', 'computing', 'mathematics']
  },
  'python': {
    title: 'Python',
    category: 'Programming Language',
    subtitle: 'High-level general-purpose programming language',
    description: 'Python is a high-level, interpreted programming language known for its emphasis on code readability, concise syntax, and comprehensive standard library supporting dynamic typing and automatic memory management.',
    attributes: [
      { label: 'Designed by', value: 'Guido van Rossum' },
      { label: 'First released', value: 'February 20, 1991' },
      { label: 'Paradigm', value: 'Multi-paradigm (OOP, Functional, Imperative)' },
      { label: 'Typing discipline', value: 'Dynamic, Duck typing, Strong' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Python_(programming_language)',
    tags: ['python', 'programming', 'software']
  },
  'fastapi': {
    title: 'FastAPI',
    category: 'Web Framework',
    subtitle: 'High-performance modern Python web framework',
    description: 'FastAPI is a modern, fast (high-performance) web framework for building APIs with Python 3.8+ based on standard Python type hints, Pydantic, and Starlette with automatic OpenAPI docs generation.',
    attributes: [
      { label: 'Author', value: 'Sebastián Ramírez' },
      { label: 'First released', value: 'December 2018' },
      { label: 'Base ecosystem', value: 'Starlette & Pydantic' },
      { label: 'License', value: 'MIT License' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/FastAPI',
    tags: ['fastapi', 'python', 'api', 'backend']
  },
  'duckduckgo': {
    title: 'DuckDuckGo',
    category: 'Search Engine',
    subtitle: 'Privacy-focused internet search engine',
    description: 'DuckDuckGo is an internet search engine that emphasizes protecting searchers\' privacy and avoiding the filter bubble of personalized search results by neither profiling its users nor tracking searches.',
    attributes: [
      { label: 'Founder', value: 'Gabriel Weinberg' },
      { label: 'Launch date', value: 'September 25, 2008' },
      { label: 'Headquarters', value: 'Paoli, Pennsylvania, US' },
      { label: 'Key Features', value: '!Bangs, Zero-Click Answers, Tracker Protection' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/DuckDuckGo',
    tags: ['duckduckgo', 'search', 'privacy']
  },
  'linux': {
    title: 'Linux',
    category: 'Operating System Kernel',
    subtitle: 'Free and open-source monolithic Unix-like kernel',
    description: 'Linux is a family of open-source Unix-like operating systems based on the Linux kernel, first released on September 17, 1991, by Linus Torvalds. Powers the vast majority of web servers, cloud infrastructure, and Android devices.',
    attributes: [
      { label: 'Initial developer', value: 'Linus Torvalds' },
      { label: 'First released', value: 'September 17, 1991' },
      { label: 'License', value: 'GPLv2' },
      { label: 'Platforms', value: 'x86, ARM, RISC-V, PowerPC, MIPS' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/Linux',
    tags: ['linux', 'kernel', 'opensource', 'unix']
  },
  'javascript': {
    title: 'JavaScript',
    category: 'Programming Language',
    subtitle: 'Core technology of the World Wide Web',
    description: 'JavaScript, often abbreviated as JS, is a programming language and core technology of the World Wide Web, alongside HTML and CSS. Over 98% of websites use JavaScript on the client side.',
    attributes: [
      { label: 'Created by', value: 'Brendan Eich' },
      { label: 'First appeared', value: 'December 4, 1995' },
      { label: 'Standard', value: 'ECMAScript (ECMA-262)' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/JavaScript',
    tags: ['javascript', 'web', 'frontend']
  },
  'typescript': {
    title: 'TypeScript',
    category: 'Programming Language',
    subtitle: 'Typed superset of JavaScript developed by Microsoft',
    description: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving developers better tooling at any scale. Developed and maintained by Microsoft and created by Anders Hejlsberg.',
    attributes: [
      { label: 'Designed by', value: 'Anders Hejlsberg' },
      { label: 'Developer', value: 'Microsoft' },
      { label: 'First released', value: 'October 1, 2012' }
    ],
    wikiUrl: 'https://en.wikipedia.org/wiki/TypeScript',
    tags: ['typescript', 'javascript', 'microsoft']
  }
};

// Aliases and typo normalizations (e.g. "issac newton" -> "isaac newton")
const ENTITY_ALIASES: Record<string, string> = {
  'issac newton': 'isaac newton',
  'sir isaac newton': 'isaac newton',
  'isaac newton': 'isaac newton',
  'newton': 'isaac newton',
  'albert einstien': 'albert einstein',
  'einstein': 'albert einstein',
  'einstein albert': 'albert einstein',
  'nikola tensla': 'nikola tesla',
  'tesla': 'nikola tesla',
  'marie sklodowska curie': 'marie curie',
  'madame curie': 'marie curie',
  'curie': 'marie curie',
  'alan mathison turing': 'alan turing',
  'turing': 'alan turing',
  'charles robert darwin': 'charles darwin',
  'darwin': 'charles darwin',
  'galileo': 'galileo galilei',
  'da vinci': 'leonardo da vinci',
  'leonardo': 'leonardo da vinci',
  'stephen william hawking': 'stephen hawking',
  'hawking': 'stephen hawking',
  'ada king': 'ada lovelace',
  'lovelace': 'ada lovelace',
  'python language': 'python',
  'python programming': 'python',
  'fast api': 'fastapi',
  'duck duck go': 'duckduckgo',
  'ddg': 'duckduckgo',
  'linux os': 'linux',
  'js': 'javascript',
  'ts': 'typescript'
};

/**
 * Normalizes query string for entity matching
 */
export function normalizeEntityQuery(rawQuery: string): string {
  let q = rawQuery
    .trim()
    .toLowerCase()
    .replace(/^(?:who is|who was|what is|tell me about|information about|wiki|wikipedia)\s+/i, '')
    .replace(/[?!.]+$/g, '')
    .trim();

  // Check aliases dictionary first
  if (ENTITY_ALIASES[q]) {
    return ENTITY_ALIASES[q];
  }

  // Handle common typo "issac" -> "isaac"
  if (q.includes('issac')) {
    q = q.replace(/\bissac\b/g, 'isaac');
  }
  // Handle typo "einstien" -> "einstein"
  if (q.includes('einstien')) {
    q = q.replace(/\beinstien\b/g, 'einstein');
  }

  return ENTITY_ALIASES[q] || q;
}

/**
 * Checks if we have an immediate offline Wikipedia card
 */
export function getOfflineWikiEntity(query: string): WikiEntityInfobox | null {
  const norm = normalizeEntityQuery(query);
  return OFFLINE_WIKI_ENTITIES[norm] || null;
}

/**
 * Live search and fetch from Wikipedia REST API
 */
export async function lookupWikipediaEntity(rawQuery: string): Promise<WikiEntityInfobox | null> {
  const normalized = normalizeEntityQuery(rawQuery);

  // If already in offline database, return instantly
  if (OFFLINE_WIKI_ENTITIES[normalized]) {
    return OFFLINE_WIKI_ENTITIES[normalized];
  }

  // Check if query looks like an entity or concept (minimum 2 words or notable name, not a generic search)
  const isLikelyEntity =
    rawQuery.length >= 3 &&
    !/^(calc|calculator|weather|time|convert|\d+)/i.test(rawQuery);

  if (!isLikelyEntity) return null;

  try {
    // 1. Search Wikipedia OpenSearch for best matching page title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(normalized)}&limit=1&namespace=0&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    const titles = searchData[1];
    if (!Array.isArray(titles) || titles.length === 0) {
      return null;
    }

    const matchedTitle = titles[0];
    if (!matchedTitle) return null;

    // 2. Fetch Page Summary from Wikipedia REST API
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(matchedTitle.replace(/ /g, '_'))}`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();

    if (!summaryData.extract || summaryData.type === 'disambiguation') {
      return null;
    }

    const title = summaryData.title || matchedTitle;
    const description = summaryData.description || 'Topic Overview';
    const extract = summaryData.extract;
    const thumbnailUrl = summaryData.thumbnail?.source;
    const wikiUrl = summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(matchedTitle.replace(/ /g, '_'))}`;

    // Extract quick attributes
    const attributes: { label: string; value: string }[] = [];
    if (description) {
      attributes.push({ label: 'Subject', value: description });
    }
    attributes.push({ label: 'Source', value: 'Wikipedia Article' });

    return {
      title,
      category: description.split(',')[0] || 'Wikipedia Summary',
      subtitle: description,
      description: extract,
      thumbnailUrl,
      attributes,
      wikiUrl,
      tags: [title.toLowerCase(), 'encyclopedia', 'wikipedia']
    };
  } catch (_) {
    return null;
  }
}
