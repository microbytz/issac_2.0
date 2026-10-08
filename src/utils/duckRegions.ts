export interface SearchRegion {
  code: string;
  name: string;
  flag: string;
  lang: string;
  ddgKl: string;
  domainBoosts: string[];
}

export const SEARCH_REGIONS: SearchRegion[] = [
  {
    code: 'all',
    name: 'All Regions',
    flag: '🌐',
    lang: 'all',
    ddgKl: 'wt-wt',
    domainBoosts: []
  },
  {
    code: 'us',
    name: 'United States',
    flag: '🇺🇸',
    lang: 'en',
    ddgKl: 'us-en',
    domainBoosts: ['.gov', '.edu', '.com', '.us']
  },
  {
    code: 'uk',
    name: 'United Kingdom',
    flag: '🇬🇧',
    lang: 'en',
    ddgKl: 'uk-en',
    domainBoosts: ['.uk', '.co.uk', '.gov.uk', '.ac.uk', '.org.uk']
  },
  {
    code: 'de',
    name: 'Germany',
    flag: '🇩🇪',
    lang: 'de',
    ddgKl: 'de-de',
    domainBoosts: ['.de']
  },
  {
    code: 'fr',
    name: 'France',
    flag: '🇫🇷',
    lang: 'fr',
    ddgKl: 'fr-fr',
    domainBoosts: ['.fr', '.gouv.fr']
  },
  {
    code: 'jp',
    name: 'Japan',
    flag: '🇯🇵',
    lang: 'ja',
    ddgKl: 'jp-jp',
    domainBoosts: ['.jp', '.co.jp', '.ac.jp', '.go.jp']
  },
  {
    code: 'ca',
    name: 'Canada',
    flag: '🇨🇦',
    lang: 'en',
    ddgKl: 'ca-en',
    domainBoosts: ['.ca', '.gc.ca']
  },
  {
    code: 'au',
    name: 'Australia',
    flag: '🇦🇺',
    lang: 'en',
    ddgKl: 'au-en',
    domainBoosts: ['.au', '.com.au', '.gov.au', '.edu.au']
  },
  {
    code: 'in',
    name: 'India',
    flag: '🇮🇳',
    lang: 'en',
    ddgKl: 'in-en',
    domainBoosts: ['.in', '.co.in', '.gov.in', '.nic.in']
  },
  {
    code: 'es',
    name: 'Spain',
    flag: '🇪🇸',
    lang: 'es',
    ddgKl: 'es-es',
    domainBoosts: ['.es']
  },
  {
    code: 'it',
    name: 'Italy',
    flag: '🇮🇹',
    lang: 'it',
    ddgKl: 'it-it',
    domainBoosts: ['.it', '.gov.it']
  },
  {
    code: 'nl',
    name: 'Netherlands',
    flag: '🇳🇱',
    lang: 'nl',
    ddgKl: 'nl-nl',
    domainBoosts: ['.nl']
  },
  {
    code: 'br',
    name: 'Brazil',
    flag: '🇧🇷',
    lang: 'pt',
    ddgKl: 'br-pt',
    domainBoosts: ['.br', '.com.br', '.gov.br']
  }
];

export function getRegionByCode(code: string): SearchRegion {
  return SEARCH_REGIONS.find(r => r.code === code) || SEARCH_REGIONS[0];
}
