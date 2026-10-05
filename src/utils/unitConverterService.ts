// Comprehensive & Highly Accurate Unit and Currency Converter Service

export type UnitCategory =
  | 'currency'
  | 'length'
  | 'mass'
  | 'temperature'
  | 'speed'
  | 'area'
  | 'volume'
  | 'digital'
  | 'time';

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  category: UnitCategory;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
  aliases: string[];
}

export interface ConversionResult {
  fromValue: number;
  fromUnit: UnitDefinition;
  toValue: number;
  toUnit: UnitDefinition;
  category: UnitCategory;
  formula: string;
  rateDescription: string;
  isCurrencyLive?: boolean;
}

// Baseline Accurate Currency Rates (Per 1 USD as Base) - Calibrated to current FX rates
export let CURRENCY_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 152.4,
  INR: 83.55,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.89,
  CNY: 7.23,
  NZD: 1.66,
  SGD: 1.35,
  HKD: 7.78,
  AED: 3.6725,
  SAR: 3.75,
  BRL: 5.46,
  MXN: 19.32,
  KRW: 1358.0,
  SEK: 10.45,
  NOK: 10.72,
  TRY: 34.2
};

// Async fetch for live daily FX rates
let fxFetchInitiated = false;
export async function refreshLiveFxRates(): Promise<boolean> {
  if (fxFetchInitiated) return false;
  fxFetchInitiated = true;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === 'object') {
        Object.keys(data.rates).forEach(code => {
          const val = Number(data.rates[code]);
          if (!isNaN(val) && val > 0) {
            CURRENCY_RATES[code.toUpperCase()] = val;
          }
        });
        return true;
      }
    }
  } catch (_) {}
  return false;
}

// Trigger initial FX background refresh
if (typeof window !== 'undefined') {
  setTimeout(() => {
    refreshLiveFxRates();
  }, 1000);
}

// ----------------------------------------------------------------------------
// Complete Unit Definitions with Exact Physics & Engineering Constants
// ----------------------------------------------------------------------------
export const UNITS_REGISTRY: UnitDefinition[] = [
  // Currencies (Base: USD)
  {
    id: 'usd',
    name: 'US Dollar',
    symbol: '$ USD',
    category: 'currency',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['usd', 'dollar', 'dollars', '$', 'us dollar', 'bucks']
  },
  {
    id: 'eur',
    name: 'Euro',
    symbol: '€ EUR',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.EUR || 0.92),
    fromBase: v => v * (CURRENCY_RATES.EUR || 0.92),
    aliases: ['eur', 'euro', 'euros', '€']
  },
  {
    id: 'gbp',
    name: 'British Pound',
    symbol: '£ GBP',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.GBP || 0.78),
    fromBase: v => v * (CURRENCY_RATES.GBP || 0.78),
    aliases: ['gbp', 'pound', 'pounds', '£', 'quid', 'british pound', 'sterling']
  },
  {
    id: 'inr',
    name: 'Indian Rupee',
    symbol: '₹ INR',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.INR || 83.55),
    fromBase: v => v * (CURRENCY_RATES.INR || 83.55),
    aliases: ['inr', 'rupee', 'rupees', '₹', 'rs', 'inr rupee']
  },
  {
    id: 'jpy',
    name: 'Japanese Yen',
    symbol: '¥ JPY',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.JPY || 152.4),
    fromBase: v => v * (CURRENCY_RATES.JPY || 152.4),
    aliases: ['jpy', 'yen', '¥', 'japanese yen']
  },
  {
    id: 'cad',
    name: 'Canadian Dollar',
    symbol: 'C$ CAD',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.CAD || 1.36),
    fromBase: v => v * (CURRENCY_RATES.CAD || 1.36),
    aliases: ['cad', 'canadian dollar', 'c$', 'cad dollar']
  },
  {
    id: 'aud',
    name: 'Australian Dollar',
    symbol: 'A$ AUD',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.AUD || 1.52),
    fromBase: v => v * (CURRENCY_RATES.AUD || 1.52),
    aliases: ['aud', 'australian dollar', 'a$', 'aussie dollar']
  },
  {
    id: 'chf',
    name: 'Swiss Franc',
    symbol: 'CHF',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.CHF || 0.89),
    fromBase: v => v * (CURRENCY_RATES.CHF || 0.89),
    aliases: ['chf', 'franc', 'francs', 'swiss franc']
  },
  {
    id: 'cny',
    name: 'Chinese Yuan',
    symbol: '¥ CNY',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.CNY || 7.23),
    fromBase: v => v * (CURRENCY_RATES.CNY || 7.23),
    aliases: ['cny', 'rmb', 'yuan', 'renminbi', 'chinese yuan']
  },
  {
    id: 'aed',
    name: 'UAE Dirham',
    symbol: 'AED',
    category: 'currency',
    toBase: v => v / (CURRENCY_RATES.AED || 3.6725),
    fromBase: v => v * (CURRENCY_RATES.AED || 3.6725),
    aliases: ['aed', 'dirham', 'dirhams', 'uae dirham']
  },

  // Length (Base: Meter)
  {
    id: 'meter',
    name: 'Meter',
    symbol: 'm',
    category: 'length',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['m', 'meter', 'meters', 'metre', 'metres']
  },
  {
    id: 'kilometer',
    name: 'Kilometer',
    symbol: 'km',
    category: 'length',
    toBase: v => v * 1000,
    fromBase: v => v / 1000,
    aliases: ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'klick', 'klicks']
  },
  {
    id: 'centimeter',
    name: 'Centimeter',
    symbol: 'cm',
    category: 'length',
    toBase: v => v * 0.01,
    fromBase: v => v * 100,
    aliases: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres']
  },
  {
    id: 'millimeter',
    name: 'Millimeter',
    symbol: 'mm',
    category: 'length',
    toBase: v => v * 0.001,
    fromBase: v => v * 1000,
    aliases: ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres']
  },
  {
    id: 'mile',
    name: 'Mile',
    symbol: 'mi',
    category: 'length',
    toBase: v => v * 1609.344, // exact international definition
    fromBase: v => v / 1609.344,
    aliases: ['mi', 'mile', 'miles']
  },
  {
    id: 'yard',
    name: 'Yard',
    symbol: 'yd',
    category: 'length',
    toBase: v => v * 0.9144, // exact international definition
    fromBase: v => v / 0.9144,
    aliases: ['yd', 'yard', 'yards']
  },
  {
    id: 'foot',
    name: 'Foot',
    symbol: 'ft',
    category: 'length',
    toBase: v => v * 0.3048, // exact international definition
    fromBase: v => v / 0.3048,
    aliases: ['ft', 'foot', 'feet', "'"]
  },
  {
    id: 'inch',
    name: 'Inch',
    symbol: 'in',
    category: 'length',
    toBase: v => v * 0.0254, // exact international definition
    fromBase: v => v / 0.0254,
    aliases: ['in', 'inch', 'inches', '"']
  },
  {
    id: 'nautical_mile',
    name: 'Nautical Mile',
    symbol: 'nmi',
    category: 'length',
    toBase: v => v * 1852, // exact definition
    fromBase: v => v / 1852,
    aliases: ['nmi', 'nm', 'nautical mile', 'nautical miles']
  },

  // Mass / Weight (Base: Kilogram)
  {
    id: 'kilogram',
    name: 'Kilogram',
    symbol: 'kg',
    category: 'mass',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['kg', 'kilogram', 'kilograms', 'kilo', 'kilos']
  },
  {
    id: 'gram',
    name: 'Gram',
    symbol: 'g',
    category: 'mass',
    toBase: v => v * 0.001,
    fromBase: v => v * 1000,
    aliases: ['g', 'gram', 'grams']
  },
  {
    id: 'milligram',
    name: 'Milligram',
    symbol: 'mg',
    category: 'mass',
    toBase: v => v * 0.000001,
    fromBase: v => v * 1000000,
    aliases: ['mg', 'milligram', 'milligrams']
  },
  {
    id: 'pound',
    name: 'Pound',
    symbol: 'lb',
    category: 'mass',
    toBase: v => v * 0.45359237, // exact international definition
    fromBase: v => v / 0.45359237,
    aliases: ['lb', 'lbs', 'pound', 'pounds']
  },
  {
    id: 'ounce',
    name: 'Ounce',
    symbol: 'oz',
    category: 'mass',
    toBase: v => v * 0.028349523125, // exact international definition
    fromBase: v => v / 0.028349523125,
    aliases: ['oz', 'ounce', 'ounces']
  },
  {
    id: 'metric_ton',
    name: 'Tonne (Metric Ton)',
    symbol: 't',
    category: 'mass',
    toBase: v => v * 1000,
    fromBase: v => v / 1000,
    aliases: ['t', 'tonne', 'tonnes', 'metric ton', 'metric tons']
  },
  {
    id: 'stone',
    name: 'Stone',
    symbol: 'st',
    category: 'mass',
    toBase: v => v * 6.35029318,
    fromBase: v => v / 6.35029318,
    aliases: ['st', 'stone', 'stones']
  },

  // Temperature (Base: Celsius)
  {
    id: 'celsius',
    name: 'Celsius',
    symbol: '°C',
    category: 'temperature',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['c', 'celsius', 'centigrade', '°c']
  },
  {
    id: 'fahrenheit',
    name: 'Fahrenheit',
    symbol: '°F',
    category: 'temperature',
    toBase: v => (v - 32) * (5 / 9),
    fromBase: v => (v * (9 / 5)) + 32,
    aliases: ['f', 'fahrenheit', '°f']
  },
  {
    id: 'kelvin',
    name: 'Kelvin',
    symbol: 'K',
    category: 'temperature',
    toBase: v => v - 273.15,
    fromBase: v => v + 273.15,
    aliases: ['k', 'kelvin']
  },

  // Speed (Base: Meters per second m/s)
  {
    id: 'mps',
    name: 'Meters per Second',
    symbol: 'm/s',
    category: 'speed',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['m/s', 'mps', 'meter per second', 'meters per second']
  },
  {
    id: 'kph',
    name: 'Kilometers per Hour',
    symbol: 'km/h',
    category: 'speed',
    toBase: v => v / 3.6,
    fromBase: v => v * 3.6,
    aliases: ['km/h', 'kph', 'kmh', 'kilometers per hour', 'kilometer per hour']
  },
  {
    id: 'mph',
    name: 'Miles per Hour',
    symbol: 'mph',
    category: 'speed',
    toBase: v => v * 0.44704,
    fromBase: v => v / 0.44704,
    aliases: ['mph', 'miles per hour', 'mile per hour']
  },
  {
    id: 'knot',
    name: 'Knot',
    symbol: 'kn',
    category: 'speed',
    toBase: v => v * 0.514444,
    fromBase: v => v / 0.514444,
    aliases: ['kn', 'knot', 'knots']
  },

  // Volume (Base: Liter)
  {
    id: 'liter',
    name: 'Liter',
    symbol: 'L',
    category: 'volume',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['l', 'liter', 'liters', 'litre', 'litres']
  },
  {
    id: 'milliliter',
    name: 'Milliliter',
    symbol: 'mL',
    category: 'volume',
    toBase: v => v * 0.001,
    fromBase: v => v * 1000,
    aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres']
  },
  {
    id: 'gallon',
    name: 'US Gallon',
    symbol: 'gal',
    category: 'volume',
    toBase: v => v * 3.785411784,
    fromBase: v => v / 3.785411784,
    aliases: ['gal', 'gallon', 'gallons']
  },
  {
    id: 'cup',
    name: 'Cup',
    symbol: 'cup',
    category: 'volume',
    toBase: v => v * 0.2365882365,
    fromBase: v => v / 0.2365882365,
    aliases: ['cup', 'cups']
  },
  {
    id: 'fluid_ounce',
    name: 'Fluid Ounce',
    symbol: 'fl oz',
    category: 'volume',
    toBase: v => v * 0.0295735295625,
    fromBase: v => v / 0.0295735295625,
    aliases: ['fl oz', 'floz', 'fluid ounce', 'fluid ounces']
  },

  // Area (Base: Square Meter)
  {
    id: 'sq_meter',
    name: 'Square Meter',
    symbol: 'm²',
    category: 'area',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['sq m', 'sqm', 'square meter', 'square meters', 'm2', 'm²']
  },
  {
    id: 'sq_kilometer',
    name: 'Square Kilometer',
    symbol: 'km²',
    category: 'area',
    toBase: v => v * 1000000,
    fromBase: v => v / 1000000,
    aliases: ['sq km', 'sqkm', 'square kilometer', 'square kilometers', 'km2', 'km²']
  },
  {
    id: 'sq_foot',
    name: 'Square Foot',
    symbol: 'sq ft',
    category: 'area',
    toBase: v => v * 0.09290304,
    fromBase: v => v / 0.09290304,
    aliases: ['sq ft', 'sqft', 'square foot', 'square feet', 'ft2', 'ft²']
  },
  {
    id: 'acre',
    name: 'Acre',
    symbol: 'ac',
    category: 'area',
    toBase: v => v * 4046.8564224,
    fromBase: v => v / 4046.8564224,
    aliases: ['acre', 'acres', 'ac']
  },
  {
    id: 'hectare',
    name: 'Hectare',
    symbol: 'ha',
    category: 'area',
    toBase: v => v * 10000,
    fromBase: v => v / 10000,
    aliases: ['hectare', 'hectares', 'ha']
  },

  // Digital Storage (Base: Megabytes MB)
  {
    id: 'mb',
    name: 'Megabyte',
    symbol: 'MB',
    category: 'digital',
    toBase: v => v,
    fromBase: v => v,
    aliases: ['mb', 'megabyte', 'megabytes']
  },
  {
    id: 'gb',
    name: 'Gigabyte',
    symbol: 'GB',
    category: 'digital',
    toBase: v => v * 1024,
    fromBase: v => v / 1024,
    aliases: ['gb', 'gigabyte', 'gigabytes']
  },
  {
    id: 'tb',
    name: 'Terabyte',
    symbol: 'TB',
    category: 'digital',
    toBase: v => v * 1048576,
    fromBase: v => v / 1048576,
    aliases: ['tb', 'terabyte', 'terabytes']
  },
  {
    id: 'kb',
    name: 'Kilobyte',
    symbol: 'KB',
    category: 'digital',
    toBase: v => v / 1024,
    fromBase: v => v * 1024,
    aliases: ['kb', 'kilobyte', 'kilobytes']
  }
];

// Helper map to quickly find unit definition
const ALIAS_MAP: Record<string, UnitDefinition> = {};
UNITS_REGISTRY.forEach(u => {
  u.aliases.forEach(a => {
    ALIAS_MAP[a.toLowerCase()] = u;
  });
});

/**
 * Finds a unit definition by unit alias string
 */
export function findUnitByAlias(alias: string): UnitDefinition | null {
  const clean = alias.trim().toLowerCase().replace(/[°]/g, '');
  return ALIAS_MAP[clean] || ALIAS_MAP[alias.trim().toLowerCase()] || null;
}

/**
 * Parses user conversion query with high flexibility
 */
export function parseUnitConversion(query: string): ConversionResult | null {
  let clean = query.trim().toLowerCase();

  // Strip leading words like "convert", "what is", "calculate"
  clean = clean.replace(/^(?:convert|what is|calculate|how many|how much)\s+/i, '');

  // Handle symbol prefix like "$100 to eur" or "€50 in usd"
  const prefixCurrency = clean.match(/^([$€£¥₹])\s*(\d+(?:\.\d+)?)\s*(?:to|in|into|=)\s*(.+)$/i);
  if (prefixCurrency) {
    const sym = prefixCurrency[1];
    const val = parseFloat(prefixCurrency[2]);
    const toStr = prefixCurrency[3].trim();
    const fromUnit = findUnitByAlias(sym);
    const toUnit = findUnitByAlias(toStr);
    if (fromUnit && toUnit && fromUnit.category === toUnit.category) {
      return executeConversion(val, fromUnit, toUnit);
    }
  }

  // Handle standard format: "<number> <fromUnit> to/in/into/= <toUnit>"
  // Example: "100 usd to eur", "10 km in miles", "50 c in f", "100 pounds to kg"
  const mainMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([a-z°$€£¥₹'"]+(?:\s+[a-z]+)?)\s*(?:to|in|into|=)\s*([a-z°$€£¥₹'"]+(?:\s+[a-z]+)?)$/i);
  if (mainMatch) {
    const val = parseFloat(mainMatch[1]);
    const fromStr = mainMatch[2].trim();
    const toStr = mainMatch[3].trim();
    const fromUnit = findUnitByAlias(fromStr);
    const toUnit = findUnitByAlias(toStr);
    if (fromUnit && toUnit && fromUnit.category === toUnit.category) {
      return executeConversion(val, fromUnit, toUnit);
    }
  }

  // Handle inverse phrasing: "how many <toUnit> in <number> <fromUnit>"
  const inverseMatch = clean.match(/^([a-z°$€£¥₹'"]+)\s+(?:in|are in|for)\s+(\d+(?:\.\d+)?)\s*([a-z°$€£¥₹'"]+)$/i);
  if (inverseMatch) {
    const toStr = inverseMatch[1].trim();
    const val = parseFloat(inverseMatch[2]);
    const fromStr = inverseMatch[3].trim();
    const fromUnit = findUnitByAlias(fromStr);
    const toUnit = findUnitByAlias(toStr);
    if (fromUnit && toUnit && fromUnit.category === toUnit.category) {
      return executeConversion(val, fromUnit, toUnit);
    }
  }

  return null;
}

/**
 * Calculates the exact conversion and prepares human-readable formulas
 */
export function executeConversion(
  fromVal: number,
  fromUnit: UnitDefinition,
  toUnit: UnitDefinition
): ConversionResult {
  const baseVal = fromUnit.toBase(fromVal);
  const targetVal = toUnit.fromBase(baseVal);

  // High precision rounding
  const rounded = Math.round(targetVal * 100000) / 100000;

  // Single unit reference rate
  const singleTarget = Math.round(toUnit.fromBase(fromUnit.toBase(1)) * 10000) / 10000;
  const rateDescription = `1 ${fromUnit.symbol} = ${singleTarget} ${toUnit.symbol}`;

  let formula = '';
  if (fromUnit.category === 'temperature') {
    if (fromUnit.id === 'celsius' && toUnit.id === 'fahrenheit') {
      formula = `(${fromVal}°C × 9/5) + 32 = ${rounded}°F`;
    } else if (fromUnit.id === 'fahrenheit' && toUnit.id === 'celsius') {
      formula = `(${fromVal}°F − 32) × 5/9 = ${rounded}°C`;
    } else if (fromUnit.id === 'celsius' && toUnit.id === 'kelvin') {
      formula = `${fromVal}°C + 273.15 = ${rounded}K`;
    } else if (fromUnit.id === 'fahrenheit' && toUnit.id === 'kelvin') {
      formula = `(${fromVal}°F − 32) × 5/9 + 273.15 = ${rounded}K`;
    }
  } else {
    formula = `Multiply value by ${singleTarget}`;
  }

  return {
    fromValue: fromVal,
    fromUnit,
    toValue: rounded,
    toUnit,
    category: fromUnit.category,
    formula,
    rateDescription,
    isCurrencyLive: fromUnit.category === 'currency'
  };
}
