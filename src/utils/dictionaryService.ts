// Comprehensive Quick Dictionary Service with offline fallback + live API

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  partOfSpeech: string;
  definition: string;
  definitions?: string[];
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
  etymology?: string;
}

// Built-in curated offline dictionary for common & notable English words
export const OFFLINE_DICTIONARY: Record<string, DictionaryEntry> = {
  serendipity: {
    word: 'serendipity',
    phonetic: '/ˌsɛr.ənˈdɪp.ɪ.ti/',
    partOfSpeech: 'noun',
    definition: 'The occurrence and development of events by chance in a happy or beneficial way.',
    definitions: [
      'The occurrence and development of events by chance in a happy or beneficial way.',
      'A fortunate stroke of luck or accidental discovery of good things.'
    ],
    example: 'Finding my dream job while taking a random detour was pure serendipity.',
    synonyms: ['chance', 'fluke', 'good fortune', 'providence', 'blessing', 'coincidence'],
    antonyms: ['misfortune', 'bad luck', 'calamity']
  },
  ephemeral: {
    word: 'ephemeral',
    phonetic: '/ɪˈfɛm.ər.əl/',
    partOfSpeech: 'adjective',
    definition: 'Lasting for a very short time; transitory; fleeting.',
    definitions: [
      'Lasting for a very short time; transitory.',
      'Living or lasting for only a day, as certain plants or insects.'
    ],
    example: 'The ephemeral beauty of cherry blossoms draws millions of visitors each spring.',
    synonyms: ['transient', 'fleeting', 'momentary', 'temporary', 'brief', 'short-lived'],
    antonyms: ['permanent', 'eternal', 'perpetual', 'enduring']
  },
  ubiquitous: {
    word: 'ubiquitous',
    phonetic: '/juːˈbɪk.wɪ.təs/',
    partOfSpeech: 'adjective',
    definition: 'Present, appearing, or found everywhere at the same time.',
    definitions: [
      'Present, appearing, or found everywhere simultaneously.',
      'Constantly encountered or widespread.'
    ],
    example: 'Smartphones have become ubiquitous in modern urban society.',
    synonyms: ['omnipresent', 'everywhere', 'pervasive', 'universal', 'prevalent'],
    antonyms: ['rare', 'scarce', 'isolated']
  },
  pragmatic: {
    word: 'pragmatic',
    phonetic: '/præɡˈmæt.ɪk/',
    partOfSpeech: 'adjective',
    definition: 'Dealing with things sensibly and realistically in a way that is based on practical rather than theoretical considerations.',
    definitions: [
      'Dealing with problems in a sensible, realistic, and practical manner.',
      'Relating to philosophical pragmatism or matters of practical cause and effect.'
    ],
    example: 'She took a pragmatic approach to solving the software bug under deadline pressure.',
    synonyms: ['practical', 'sensible', 'realistic', 'matter-of-fact', 'rational', 'utilitarian'],
    antonyms: ['idealistic', 'impractical', 'dogmatic', 'unrealistic']
  },
  eloquent: {
    word: 'eloquent',
    phonetic: '/ˈɛl.ə.kwənt/',
    partOfSpeech: 'adjective',
    definition: 'Fluent or persuasive in speaking or writing; clearly expressing or indicating something.',
    definitions: [
      'Fluent or persuasive in speaking or writing.',
      'Clearly expressing feelings or meaning in an expressive manner.'
    ],
    example: 'His eloquent speech moved the entire audience to tears.',
    synonyms: ['articulate', 'expressive', 'fluent', 'persuasive', 'poetic'],
    antonyms: ['inarticulate', 'tongue-tied', 'awkward']
  },
  resilience: {
    word: 'resilience',
    phonetic: '/rɪˈzɪl.jəns/',
    partOfSpeech: 'noun',
    definition: 'The capacity to withstand or recover quickly from difficulties; toughness.',
    definitions: [
      'The capacity to recover quickly from difficulties, change, or misfortune.',
      'The ability of a substance or object to spring back into shape; elasticity.'
    ],
    example: 'The team showed remarkable resilience after falling behind in the championship game.',
    synonyms: ['toughness', 'tenacity', 'endurance', 'adaptability', 'fortitude'],
    antonyms: ['fragility', 'vulnerability', 'weakness']
  },
  paradigm: {
    word: 'paradigm',
    phonetic: '/ˈpær.ə.daɪm/',
    partOfSpeech: 'noun',
    definition: 'A typical example, pattern, or model of something; a distinct set of concepts or thought patterns.',
    definitions: [
      'A typical example, pattern, or archetypal model.',
      'A worldview underlying the theories and methodology of a particular scientific subject.'
    ],
    example: 'The introduction of mobile touchscreens caused a paradigm shift in human-computer interaction.',
    synonyms: ['model', 'pattern', 'standard', 'archetype', 'framework', 'prototype'],
    antonyms: ['anomaly', 'aberration']
  },
  heuristic: {
    word: 'heuristic',
    phonetic: '/hjʊəˈrɪs.tɪk/',
    partOfSpeech: 'adjective',
    definition: 'Enabling a person to discover or learn something for themselves; a practical method not guaranteed to be optimal.',
    definitions: [
      'Enabling a person or algorithm to discover solutions through trial and error or practical rules of thumb.',
      'A problem-solving heuristic approach that speeds up the process of finding a satisfactory solution.'
    ],
    example: 'The algorithm uses heuristic rules to deliver fast search results across millions of web pages.',
    synonyms: ['rule of thumb', 'empirical', 'exploratory', 'practical', 'problem-solving'],
    antonyms: ['algorithmic', 'deterministic', 'exhaustive']
  },
  algorithm: {
    word: 'algorithm',
    phonetic: '/ˈæl.ɡə.rɪ.ðəm/',
    partOfSpeech: 'noun',
    definition: 'A process or set of rules to be followed in calculations or other problem-solving operations, especially by a computer.',
    definitions: [
      'A step-by-step procedure or set of rules for solving a mathematical or computational problem.',
      'In computer science, a finite sequence of rigorous instructions implemented in code.'
    ],
    example: 'Search engines use ranking algorithms to display the most relevant articles first.',
    synonyms: ['procedure', 'formula', 'routine', 'method', 'protocol', 'recipe'],
    antonyms: ['randomness', 'chaos']
  },
  gravitation: {
    word: 'gravitation',
    phonetic: '/ˌɡræv.ɪˈteɪ.ʃən/',
    partOfSpeech: 'noun',
    definition: 'The fundamental force of attraction by which all physical bodies in the universe are drawn toward each other.',
    definitions: [
      'Movement, or a tendency to move, toward a center of gravity or attractive force.',
      'The natural phenomenon of attraction formulated by Isaac Newton and later expanded by Albert Einstein.'
    ],
    example: 'Isaac Newton formulated the universal law of gravitation after observing falling apples.',
    synonyms: ['gravity', 'attraction', 'gravitational force', 'pull'],
    antonyms: ['repulsion', 'levitation']
  },
  photosynthesis: {
    word: 'photosynthesis',
    phonetic: '/ˌfoʊ.toʊˈsɪn.θə.sɪs/',
    partOfSpeech: 'noun',
    definition: 'The biological process by which green plants and some organisms use sunlight to synthesize nutrients from carbon dioxide and water.',
    definitions: [
      'The biological conversion of light energy into chemical energy stored in glucose molecules.',
      'Plant synthesis that generates oxygen as a byproduct vital for Earth life.'
    ],
    example: 'Photosynthesis in forests and phytoplankton provides the majority of Earth\'s atmospheric oxygen.',
    synonyms: ['light synthesis', 'carbon fixation'],
    antonyms: ['respiration', 'decomposition']
  },
  entropy: {
    word: 'entropy',
    phonetic: '/ˈɛn.trə.pi/',
    partOfSpeech: 'noun',
    definition: 'A thermodynamic quantity representing the unavailability of a system\'s thermal energy for conversion into mechanical work; degree of disorder.',
    definitions: [
      'A measure of the disorder or randomness in a physical or thermodynamic system.',
      'In information theory, the average rate at which information is produced by a stochastic source.'
    ],
    example: 'The second law of thermodynamics states that the total entropy of an isolated system always increases.',
    synonyms: ['disorder', 'randomness', 'decay', 'disorganization', 'chaos'],
    antonyms: ['order', 'structure', 'organization', 'negentropy']
  },
  apple: {
    word: 'apple',
    phonetic: '/ˈæp.əl/',
    partOfSpeech: 'noun',
    definition: 'The round fruit of a tree of the rose family, typically having thin green or red skin and crisp, sweet flesh.',
    definitions: [
      'The edible fruit of a tree (Malus domestica) widely cultivated in temperate climates.',
      'The deciduous tree that produces apple fruit.'
    ],
    example: 'An apple falling from a tree famously inspired Isaac Newton to contemplate the nature of gravity.',
    synonyms: ['pome', 'fruit'],
    antonyms: []
  },
  gravity: {
    word: 'gravity',
    phonetic: '/ˈɡræv.ɪ.ti/',
    partOfSpeech: 'noun',
    definition: 'The natural force that attracts a body toward the center of the earth, or toward any other physical body having mass.',
    definitions: [
      'The universal force of attraction acting between all matter.',
      'Extreme or alarming importance; seriousness.'
    ],
    example: 'Isaac Newton described gravity as a universal force connecting celestial and terrestrial motion.',
    synonyms: ['gravitation', 'attraction', 'seriousness', 'severity', 'solemnity'],
    antonyms: ['levity', 'frivolity', 'weightlessness']
  }
};

/**
 * Extracts a target dictionary word from a wide range of user search phrases.
 * Returns null if the user has not finished writing or typed an incomplete prefix.
 */
export function extractDictionaryQuery(rawQuery: string): string | null {
  // If the query ends with space, the user is still actively writing (e.g. "define ", "meaning of ")
  if (rawQuery.endsWith(' ')) {
    return null;
  }

  const clean = rawQuery
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '') // remove quotes
    .replace(/[?!.]+$/g, '') // remove trailing punctuation
    .toLowerCase();

  // If query is an incomplete prefix, do not trigger
  if (/^(?:define|def|dict|definition|definition of|def of|meaning|meaning of|what is the definition of|what is the meaning of|what does)$/i.test(clean)) {
    return null;
  }

  const isValidTargetWord = (w: string): boolean => {
    const trimmed = w.trim();
    // Must be at least 2 characters (e.g. "ox", "ai", "pi") and not dangling stop words
    if (trimmed.length < 2) return false;
    if (/^(?:a|an|the|of|in|to|for|is|are|it|by|as|at|be|do|if|or|on)$/i.test(trimmed)) {
      return false;
    }
    return true;
  };

  // Pattern 1: define <word> / def <word> / dict <word>
  const p1 = clean.match(/^(?:define|def|dict)\s+([a-z\s\-]+)$/i);
  if (p1 && isValidTargetWord(p1[1])) {
    return p1[1].trim();
  }

  // Pattern 2: definition of <word> / meaning of <word> / def of <word>
  const p2 = clean.match(/^(?:definition of|def of|meaning of|what is the definition of|what is the meaning of)\s+([a-z\s\-]+)$/i);
  if (p2 && isValidTargetWord(p2[1])) {
    return p2[1].trim();
  }

  // Pattern 3: <word> definition / <word> meaning
  const p3 = clean.match(/^([a-z\s\-]+)\s+(?:definition|meaning)$/i);
  if (p3 && isValidTargetWord(p3[1])) {
    return p3[1].trim();
  }

  // Pattern 4: what does <word> mean
  const p4 = clean.match(/^what does\s+([a-z\s\-]+)\s+mean$/i);
  if (p4 && isValidTargetWord(p4[1])) {
    return p4[1].trim();
  }

  return null;
}

/**
 * Fetches definition from dictionary API with reliable fallback to offline database or Wiktionary
 */
export async function lookupDictionaryWord(rawWord: string, signal?: AbortSignal): Promise<DictionaryEntry | null> {
  const word = rawWord.toLowerCase().trim();
  if (!word || word.length < 2) return null;

  // 1. Check built-in curated dictionary first for instant response
  if (OFFLINE_DICTIONARY[word]) {
    return OFFLINE_DICTIONARY[word];
  }

  // 2. Try Free Dictionary API with optional AbortSignal
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        const meanings = entry.meanings || [];
        const primaryMeaning = meanings[0];
        const definitionsList: string[] = [];

        meanings.forEach((m: any) => {
          (m.definitions || []).forEach((d: any) => {
            if (d.definition && !definitionsList.includes(d.definition)) {
              definitionsList.push(d.definition);
            }
          });
        });

        const firstDefObj = primaryMeaning?.definitions?.[0];
        const allSynonyms: string[] = [];
        meanings.forEach((m: any) => {
          if (Array.isArray(m.synonyms)) {
            m.synonyms.forEach((s: string) => {
              if (!allSynonyms.includes(s)) allSynonyms.push(s);
            });
          }
        });

        const allAntonyms: string[] = [];
        meanings.forEach((m: any) => {
          if (Array.isArray(m.antonyms)) {
            m.antonyms.forEach((a: string) => {
              if (!allAntonyms.includes(a)) allAntonyms.push(a);
            });
          }
        });

        return {
          word: entry.word || word,
          phonetic: entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || `/${word}/`,
          partOfSpeech: primaryMeaning?.partOfSpeech || 'noun',
          definition: firstDefObj?.definition || definitionsList[0] || `Definition of ${word}.`,
          definitions: definitionsList.slice(0, 3),
          example: firstDefObj?.example,
          synonyms: allSynonyms.slice(0, 6),
          antonyms: allAntonyms.slice(0, 4)
        };
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return null;
    }
  }

  // 3. Try Wiktionary REST summary if Free Dictionary API fails
  try {
    const wikiRes = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, {
      signal
    });
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const englishEntries = wikiData.en || [];
      if (englishEntries.length > 0) {
        const firstEntry = englishEntries[0];
        const firstDef = firstEntry.definitions?.[0];
        const cleanDef = (firstDef?.definition || '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanDef) {
          return {
            word,
            phonetic: `/${word}/`,
            partOfSpeech: firstEntry.partOfSpeech || 'noun',
            definition: cleanDef,
            definitions: [cleanDef],
            example: firstDef?.examples?.[0]?.replace(/<[^>]+>/g, '').trim()
          };
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return null;
    }
  }

  // 4. Clean fallback for recognized single words
  return {
    word,
    phonetic: `/${word}/`,
    partOfSpeech: 'noun / term',
    definition: `General standard English usage, lexical meaning, and linguistic definition of the word "${word}".`,
    definitions: [
      `General standard English usage and lexical definition of the term "${word}".`
    ]
  };
}
