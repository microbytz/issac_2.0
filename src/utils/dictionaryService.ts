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
  },
  epiphany: {
    word: 'epiphany',
    phonetic: '/ɪˈpɪf.ən.i/',
    partOfSpeech: 'noun',
    definition: 'A moment of sudden and great revelation or realization.',
    definitions: [
      'A moment of sudden and profound understanding or insight.',
      'A manifestation of a divine or supernatural being.'
    ],
    example: 'While debugging the code, she had a sudden epiphany that solved the race condition.',
    synonyms: ['revelation', 'insight', 'illumination', 'awakening', 'realization'],
    antonyms: []
  },
  nostalgia: {
    word: 'nostalgia',
    phonetic: '/nɒsˈtæl.dʒə/',
    partOfSpeech: 'noun',
    definition: 'A sentimental longing or wistful affection for the past, typically for a period or place with happy personal associations.',
    definitions: [
      'A sentimental yearning for the happiness of a former place or time.',
      'Something that evokes nostalgic feelings.'
    ],
    example: 'Listening to 90s music filled him with fond nostalgia for his childhood.',
    synonyms: ['reminiscence', 'longing', 'wistfulness', 'yearning', 'homesickness'],
    antonyms: []
  },
  catharsis: {
    word: 'catharsis',
    phonetic: '/kəˈθɑː.sɪs/',
    partOfSpeech: 'noun',
    definition: 'The process of releasing, and thereby providing relief from, strong or repressed emotions.',
    definitions: [
      'The purging of the emotions or relieving of emotional tensions, especially through art or music.',
      'In psychology, emotional release through recollection of unconscious conflict.'
    ],
    example: 'Writing poetry provided a powerful catharsis after a difficult and stressful week.',
    synonyms: ['purging', 'release', 'cleansing', 'relief', 'liberation'],
    antonyms: ['repression', 'suppression']
  },
  empathy: {
    word: 'empathy',
    phonetic: '/ˈɛm.pə.θi/',
    partOfSpeech: 'noun',
    definition: 'The ability to understand and share the feelings of another.',
    definitions: [
      'The psychological capacity to understand or feel what another person is experiencing from within their frame of reference.',
      'Vicarious experiencing of the feelings, thoughts, or attitudes of another.'
    ],
    example: 'A great leader listens with genuine empathy to the concerns of their team.',
    synonyms: ['compassion', 'understanding', 'sensitivity', 'fellow feeling', 'sympathy'],
    antonyms: ['indifference', 'apathy', 'callousness']
  },
  lucid: {
    word: 'lucid',
    phonetic: '/ˈluː.sɪd/',
    partOfSpeech: 'adjective',
    definition: 'Expressed clearly; easy to understand; showing ability to think clearly.',
    definitions: [
      'Expressed clearly; easy to understand; intelligible.',
      'Having full use of one\'s faculties; clearheaded.',
      'Shining or luminous.'
    ],
    example: 'The professor gave a remarkably lucid explanation of quantum entanglement.',
    synonyms: ['clear', 'coherent', 'comprehensible', 'transparent', 'intelligible'],
    antonyms: ['obscure', 'confusing', 'vague', 'murky']
  },
  ambiguous: {
    word: 'ambiguous',
    phonetic: '/æmˈbɪɡ.ju.əs/',
    partOfSpeech: 'adjective',
    definition: 'Open to more than one interpretation; having a double meaning.',
    definitions: [
      'Open to or having several possible meanings or interpretations.',
      'Of doubtful or uncertain nature; dubious; indistinct.'
    ],
    example: 'The politician\'s ambiguous statement left voters confused about his true intentions.',
    synonyms: ['equivocal', 'unclear', 'vague', 'uncertain', 'cryptic'],
    antonyms: ['unambiguous', 'clear', 'definite', 'explicit']
  },
  candid: {
    word: 'candid',
    phonetic: '/ˈkæn.dɪd/',
    partOfSpeech: 'adjective',
    definition: 'Truthful and straightforward; frank; informal or unposed.',
    definitions: [
      'Frank; outspoken; open and sincere in speech or expression.',
      'Informal or unposed, as a photograph.'
    ],
    example: 'I appreciated her candid feedback during the peer review session.',
    synonyms: ['frank', 'honest', 'forthright', 'sincere', 'unvarnished'],
    antonyms: ['secretive', 'guarded', 'insincere', 'evasive']
  },
  benevolent: {
    word: 'benevolent',
    phonetic: '/bəˈnɛv.əl.ənt/',
    partOfSpeech: 'adjective',
    definition: 'Well meaning and kindly; serving a charitable rather than a profit-making purpose.',
    definitions: [
      'Characterized by or expressing goodwill or kindly feelings.',
      'Desiring to help others; charitable.'
    ],
    example: 'The benevolent benefactor donated millions to fund scientific research.',
    synonyms: ['kind', 'generous', 'altruistic', 'magnanimous', 'philanthropic'],
    antonyms: ['malevolent', 'unkind', 'spiteful', 'malicious']
  },
  metaphor: {
    word: 'metaphor',
    phonetic: '/ˈmɛt.ə.fɔːr/',
    partOfSpeech: 'noun',
    definition: 'A figure of speech in which a word or phrase is applied to an object or action to which it is not literally applicable.',
    definitions: [
      'A figure of speech comparing two distinct things directly without using "like" or "as".',
      'Something regarded as representative or symbolic of something else.'
    ],
    example: 'The phrase "time is a thief" is a classic literary metaphor.',
    synonyms: ['figure of speech', 'analogy', 'symbol', 'allegory', 'emblem'],
    antonyms: []
  },
  irony: {
    word: 'irony',
    phonetic: '/ˈaɪ.rə.ni/',
    partOfSpeech: 'noun',
    definition: 'The expression of one\'s meaning by using language that normally signifies the opposite, typically for humorous or emphatic effect.',
    definitions: [
      'The use of words conveying a meaning that is the opposite of its literal meaning.',
      'A state of affairs or an event that seems deliberately contrary to what one expects.'
    ],
    example: 'The irony was that the fire station caught fire while the firefighters were out.',
    synonyms: ['sarcasm', 'paradox', 'incongruity', 'satire', 'mockery'],
    antonyms: ['sincerity', 'literalness']
  },
  solitude: {
    word: 'solitude',
    phonetic: '/ˈsɒl.ɪ.tjuːd/',
    partOfSpeech: 'noun',
    definition: 'The state or situation of being alone, especially when peaceful and pleasant.',
    definitions: [
      'The state of being alone, especially when finding peace or quiet.',
      'A lonely, sequestered, or secluded place.'
    ],
    example: 'She retreated to the mountains to enjoy the peaceful solitude and finish her novel.',
    synonyms: ['isolation', 'seclusion', 'peace and quiet', 'loneliness', 'privacy'],
    antonyms: ['company', 'society', 'crowd']
  },
  melancholy: {
    word: 'melancholy',
    phonetic: '/ˈmɛl.ən.kɒl.i/',
    partOfSpeech: 'noun',
    definition: 'A feeling of pensive sadness, typically with no obvious cause.',
    definitions: [
      'A gloomy state of mind, especially when habitual or prolonged; depression.',
      'Sober thoughtfulness; pensiveness.'
    ],
    example: 'The rainy autumn afternoon cast a gentle melancholy over the quiet streets.',
    synonyms: ['sadness', 'sorrow', 'pensiveness', 'gloom', 'dejection'],
    antonyms: ['happiness', 'cheerfulness', 'joy']
  },
  petrichor: {
    word: 'petrichor',
    phonetic: '/ˈpɛt.rɪ.kɔːr/',
    partOfSpeech: 'noun',
    definition: 'A pleasant smell that frequently accompanies the first rain after a long period of warm, dry weather.',
    definitions: [
      'A distinctive scent produced when rain falls on dry soil or warm earth.',
      'The earthy aroma caused by geosmin and plant oils released by rain droplets.'
    ],
    example: 'Stepping outside after the summer thunderstorm, the air was rich with petrichor.',
    synonyms: ['earthy scent', 'rain aroma'],
    antonyms: []
  },
  quixotic: {
    word: 'quixotic',
    phonetic: '/kwɪkˈsɒt.ɪk/',
    partOfSpeech: 'adjective',
    definition: 'Exceedingly idealistic; unrealistic and impractical.',
    definitions: [
      'Extravagantly chivalrous or romantic; visionary, impractical, or impracticable.',
      'Like Don Quixote in pursuing romantic ideals.'
    ],
    example: 'Launching a competitor to global tech monopolies seemed like a quixotic quest.',
    synonyms: ['idealistic', 'impractical', 'romantic', 'visionary', 'unrealistic'],
    antonyms: ['practical', 'pragmatic', 'realistic']
  },
  syntax: {
    word: 'syntax',
    phonetic: '/ˈsɪn.tæks/',
    partOfSpeech: 'noun',
    definition: 'The arrangement of words and phrases to create well-formed sentences in a language, or rules governing the structure of programming statements.',
    definitions: [
      'The study of the rules for the formation of grammatical sentences in a language.',
      'In computer science, the rules governing the structure of valid statements in a programming language.'
    ],
    example: 'A single missing semicolon caused a syntax error in the JavaScript code.',
    synonyms: ['grammar', 'structure', 'rules', 'order', 'organization'],
    antonyms: []
  },
  semantics: {
    word: 'semantics',
    phonetic: '/sɪˈmæn.tɪks/',
    partOfSpeech: 'noun',
    definition: 'The branch of linguistics and logic concerned with meaning, or the interpretation of symbols and programming constructs.',
    definitions: [
      'The study of meaning in language, including the relationships of words, phrases, and symbols.',
      'In computing, the fundamental meaning or operational behavior of code statements.'
    ],
    example: 'HTML5 semantic elements clarify the structure and semantics of a document for screen readers.',
    synonyms: ['meaning', 'signification', 'interpretation', 'connotation'],
    antonyms: []
  },
  synchronous: {
    word: 'synchronous',
    phonetic: '/ˈsɪŋ.krə.nəs/',
    partOfSpeech: 'adjective',
    definition: 'Existing or occurring at the same time; executing in sequence where operations wait for prior tasks to complete.',
    definitions: [
      'Occurring or existing at the same time or rate.',
      'In computing, recurring with a regular or predictable time interval, or executing sequentially.'
    ],
    example: 'Synchronous network requests block user interface interactions until the response arrives.',
    synonyms: ['simultaneous', 'concurrent', 'coincident', 'synchronized'],
    antonyms: ['asynchronous', 'independent']
  },
  asynchronous: {
    word: 'asynchronous',
    phonetic: '/eɪˈsɪŋ.krə.nəs/',
    partOfSpeech: 'adjective',
    definition: 'Not occurring at the same time; in computing, executing operations in the background without blocking the main execution thread.',
    definitions: [
      'Not occurring at the same time or rate.',
      'In computing, operations executed independently of the main program flow, allowing non-blocking I/O.'
    ],
    example: 'Using async/await in JavaScript allows asynchronous file downloads without freezing the browser.',
    synonyms: ['non-blocking', 'independent', 'decoupled', 'concurrent'],
    antonyms: ['synchronous', 'blocking']
  },
  latency: {
    word: 'latency',
    phonetic: '/ˈleɪ.tən.si/',
    partOfSpeech: 'noun',
    definition: 'The time that elapses between a stimulus and the response to it, or delay in data transmission over a network.',
    definitions: [
      'The state of being latent, hidden, or dormant.',
      'In computer networks, the round-trip delay time taken for data packets to reach their destination.'
    ],
    example: 'Edge computing minimizes latency by processing requests geographically closer to users.',
    synonyms: ['delay', 'lag', 'turnaround time', 'pause', 'dormancy'],
    antonyms: ['instantaneity', 'promptness']
  },
  concurrency: {
    word: 'concurrency',
    phonetic: '/kənˈkʌr.ən.si/',
    partOfSpeech: 'noun',
    definition: 'The ability of different parts or units of a program, algorithm, or problem to be executed out-of-order or in partial order without affecting the final outcome.',
    definitions: [
      'Agreement, concurrence, or simultaneous occurrence.',
      'In computing, the execution of multiple instruction sequences simultaneously.'
    ],
    example: 'Go and Elixir are renowned for handling massive network concurrency with lightweight threads.',
    synonyms: ['simultaneity', 'coexistence', 'parallelism', 'multitasking'],
    antonyms: ['serialism', 'sequence']
  },
  galaxy: {
    word: 'galaxy',
    phonetic: '/ˈɡæl.ək.si/',
    partOfSpeech: 'noun',
    definition: 'A system of millions or billions of stars, together with gas and dust, held together by gravitational attraction.',
    definitions: [
      'A gravitationally bound system of stars, stellar remnants, interstellar gas, dust, and dark matter.',
      'An immense or dazzling assembly of brilliant people or remarkable things.'
    ],
    example: 'The James Webb Space Telescope captures galaxies that formed shortly after the Big Bang.',
    synonyms: ['star system', 'cosmos', 'universe', 'constellation', 'cluster'],
    antonyms: []
  },
  microchip: {
    word: 'microchip',
    phonetic: '/ˈmaɪ.kroʊ.tʃɪp/',
    partOfSpeech: 'noun',
    definition: 'A tiny wafer of semiconducting material used to make an integrated circuit containing microscopic electronic components.',
    definitions: [
      'A tiny wafer of semiconducting material used to make an integrated circuit.',
      'A miniature electronic device used for computing, storage, or wireless tagging.'
    ],
    example: 'Advanced microchips with nanometer architecture power modern artificial intelligence models.',
    synonyms: ['integrated circuit', 'silicon chip', 'processor', 'semiconductor'],
    antonyms: []
  },
  architecture: {
    word: 'architecture',
    phonetic: '/ˈɑːr.kɪ.tɛk.tʃər/',
    partOfSpeech: 'noun',
    definition: 'The art or practice of designing and constructing buildings, structures, or complex software systems.',
    definitions: [
      'The art and science of designing buildings and civil structures.',
      'The conceptual structure and overall logical organization of a computer system or software network.'
    ],
    example: 'The city skyline features a blend of modern neoclassical and cyberpunk architecture.',
    synonyms: ['structural design', 'construction', 'framework', 'engineering', 'composition'],
    antonyms: []
  },
  robotics: {
    word: 'robotics',
    phonetic: '/roʊˈbɑː.tɪks/',
    partOfSpeech: 'noun',
    definition: 'The branch of technology and science that deals with the design, construction, operation, and application of robots.',
    definitions: [
      'The interdisciplinary engineering branch focused on autonomous and semi-autonomous robots.',
      'The application of automated mechanical agents in manufacturing, healthcare, and space exploration.'
    ],
    example: 'Breakthroughs in robotics and neural control enable dexterous bionic prosthetics.',
    synonyms: ['automation', 'cybernetics', 'artificial intelligence', 'mechanization'],
    antonyms: []
  },
  camera: {
    word: 'camera',
    phonetic: '/ˈkæm.rə/',
    partOfSpeech: 'noun',
    definition: 'An optical instrument used for recording visual images, photographs, film, or video signals.',
    definitions: [
      'A device for recording visual images in the form of photographs, film, or digital sensor data.',
      'In 3D graphics, a mathematical viewpoint from which a scene is rendered.'
    ],
    example: 'The high-resolution camera captured intricate details of the night sky with low sensor noise.',
    synonyms: ['photographic device', 'sensor', 'lens', 'camcorder', 'viewfinder'],
    antonyms: []
  },
  telescope: {
    word: 'telescope',
    phonetic: '/ˈtɛl.ɪ.skoʊp/',
    partOfSpeech: 'noun',
    definition: 'An optical instrument designed to make distant objects appear nearer, containing an arrangement of lenses or curved mirrors.',
    definitions: [
      'An instrument designed to collect and magnify electromagnetic radiation from celestial bodies.',
      'To slide or cause to slide within each other in sections, like concentric tubes.'
    ],
    example: 'Space telescopes orbiting outside the Earth’s atmosphere provide crystal-clear cosmic views.',
    synonyms: ['spyglass', 'optical instrument', 'magnifier', 'refractor', 'reflector'],
    antonyms: []
  },
  circuit: {
    word: 'circuit',
    phonetic: '/ˈsɜːr.kɪt/',
    partOfSpeech: 'noun',
    definition: 'A roughly circular line, route, or movement that starts and finishes at the same place; an electrical loop or network.',
    definitions: [
      'A complete closed loop or pathway through which an electric current flows.',
      'A regular journey around a particular territory for official duties or sports competition.'
    ],
    example: 'Printed circuit boards route high-speed signals between memory and processor components.',
    synonyms: ['network', 'loop', 'pathway', 'wiring', 'channel'],
    antonyms: []
  },
  semiconductor: {
    word: 'semiconductor',
    phonetic: '/ˌsɛm.i.kənˈdʌk.tər/',
    partOfSpeech: 'noun',
    definition: 'A solid substance that has a conductivity between that of an insulator and that of most metals, essential in microelectronics.',
    definitions: [
      'A solid material such as silicon whose electrical conductivity can be controlled by doping or electric fields.',
      'Components made of semiconductor materials, such as diodes and transistors.'
    ],
    example: 'Silicon remains the foundational semiconductor enabling the global digital revolution.',
    synonyms: ['silicon', 'transistor', 'solid-state device', 'chip'],
    antonyms: []
  },
  optics: {
    word: 'optics',
    phonetic: '/ˈɑːp.tɪks/',
    partOfSpeech: 'noun',
    definition: 'The scientific study of the behavior and properties of light, including its interactions with matter and optical instruments.',
    definitions: [
      'The branch of physics that studies the behavior and properties of light.',
      'The optical elements or lenses of an instrument collectively.'
    ],
    example: 'Precision glass optics ensure zero chromatic aberration in astronomical imaging.',
    synonyms: ['photonics', 'optical physics', 'lens system'],
    antonyms: []
  },
  lens: {
    word: 'lens',
    phonetic: '/lɛnz/',
    partOfSpeech: 'noun',
    definition: 'A transparent optical device with curved surfaces that refracts light to converge or diverge beam paths and form images.',
    definitions: [
      'A piece of glass or clear substance with curved sides for concentrating or dispersing light rays.',
      'The transparent structure behind the iris in the eye that focuses light on the retina.'
    ],
    example: 'A wide-aperture lens creates beautiful depth of field with creamy bokeh backgrounds.',
    synonyms: ['optic', 'eyepiece', 'objective', 'magnifier'],
    antonyms: []
  },
  image: {
    word: 'image',
    phonetic: '/ˈɪm.ɪdʒ/',
    partOfSpeech: 'noun',
    definition: 'A representation of the external form of a person or thing in art, photography, or digital pixel matrices.',
    definitions: [
      'A representation of the external form of a person or thing in art or photography.',
      'An optical appearance produced by reflection from a mirror, refraction through a lens, or on a display screen.'
    ],
    example: 'The digital image contains millions of pixels encoding color and luminance across the visual spectrum.',
    synonyms: ['picture', 'photograph', 'likeness', 'representation', 'visual'],
    antonyms: []
  },
  universe: {
    word: 'universe',
    phonetic: '/ˈjuː.nɪ.vɜːrs/',
    partOfSpeech: 'noun',
    definition: 'All existing matter, space, and energy considered as a whole; the cosmos.',
    definitions: [
      'All existing space and matter considered as a whole; the cosmos.',
      'A particular sphere of activity, experience, or knowledge.'
    ],
    example: 'Cosmologists observe that the universe continues to expand at an accelerating rate.',
    synonyms: ['cosmos', 'creation', 'macrocosm', 'space', 'totality'],
    antonyms: []
  },
  skyscraper: {
    word: 'skyscraper',
    phonetic: '/ˈskaɪˌskreɪ.pər/',
    partOfSpeech: 'noun',
    definition: 'A very tall building of many stories, typically exceeding 150 meters (492 ft) in height.',
    definitions: [
      'A very tall continuously habitable building with multiple floors.',
      'A prominent high-rise structure defining a modern urban metropolis skyline.'
    ],
    example: 'The iconic skyscraper features tuned mass dampers to counteract hurricane-force winds.',
    synonyms: ['high-rise', 'tower', 'edifice', 'monolith'],
    antonyms: []
  }
};

// In-memory runtime session cache for instantaneous retrieval
export const DICTIONARY_SESSION_CACHE = new Map<string, DictionaryEntry>();

/**
 * Synchronously checks if a word is immediately available in offline dictionary or cache.
 * Returns in 0ms!
 */
export function getImmediateDictionaryEntry(word: string): DictionaryEntry | null {
  const norm = word.trim().toLowerCase();
  if (OFFLINE_DICTIONARY[norm]) {
    return OFFLINE_DICTIONARY[norm];
  }
  if (DICTIONARY_SESSION_CACHE.has(norm)) {
    return DICTIONARY_SESSION_CACHE.get(norm)!;
  }
  return null;
}

/**
 * Extracts candidate words suitable for dictionary lookup from a visual search query or filename
 */
export function extractVisualCandidateWords(rawQuery: string): string[] {
  const clean = (rawQuery || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean
    .split(/\s+/)
    .filter(t => t.length >= 3 && !/^(?:visual|search|similar|image|photo|the|and|for|with|about|what|jpg|png|webp|svg)$/i.test(t));
  
  // Return unique candidate words, prioritizing those with immediate dictionary definitions
  const unique = Array.from(new Set(tokens));
  unique.sort((a, b) => {
    const aInDict = OFFLINE_DICTIONARY[a] ? 1 : 0;
    const bInDict = OFFLINE_DICTIONARY[b] ? 1 : 0;
    return bInDict - aInDict;
  });
  return unique.slice(0, 5);
}

/**
 * Extracts a target dictionary word from a wide range of user search phrases.
 * Returns null if the user has not finished writing or typed an incomplete prefix.
 * Supports visual search mode where candidate keywords from image context are recognized.
 */
export function extractDictionaryQuery(rawQuery: string, isVisualSearch: boolean = false): string | null {
  if (!rawQuery) {
    if (isVisualSearch) return 'image';
    return null;
  }

  // If the query ends with space and NOT visual search, user is actively typing
  if (!isVisualSearch && rawQuery.endsWith(' ')) {
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
    const trimmed = w.trim().toLowerCase();
    // Must be at least 2 characters (e.g. "ox", "ai", "pi") and not dangling stop words
    if (trimmed.length < 2) return false;
    if (/^(?:a|an|the|of|in|to|for|is|are|it|by|as|at|be|do|if|or|on|and|with|about|similar|visual|search)$/i.test(trimmed)) {
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

  // Pattern 5: Exact match in offline dictionary or session cache
  if (OFFLINE_DICTIONARY[clean] && isValidTargetWord(clean)) {
    return clean;
  }

  // Pattern 6: Visual search context extraction
  if (isVisualSearch) {
    const tokens = clean
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => isValidTargetWord(t));

    // First check if any token is directly present in OFFLINE_DICTIONARY
    for (const token of tokens) {
      if (OFFLINE_DICTIONARY[token]) {
        return token;
      }
    }

    // Otherwise pick the most informative keyword token
    if (tokens.length > 0) {
      const sorted = [...tokens].sort((a, b) => b.length - a.length);
      return sorted[0];
    }

    return 'image';
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

        const resultEntry: DictionaryEntry = {
          word: entry.word || word,
          phonetic: entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || `/${word}/`,
          partOfSpeech: primaryMeaning?.partOfSpeech || 'noun',
          definition: firstDefObj?.definition || definitionsList[0] || `Definition of ${word}.`,
          definitions: definitionsList.slice(0, 3),
          example: firstDefObj?.example,
          synonyms: allSynonyms.slice(0, 6),
          antonyms: allAntonyms.slice(0, 4)
        };
        DICTIONARY_SESSION_CACHE.set(word, resultEntry);
        return resultEntry;
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
