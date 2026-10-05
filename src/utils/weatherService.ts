// Comprehensive Weather Instant Answer Service with live Open-Meteo & offline global city cache

export interface DailyForecastItem {
  dayName: string;
  condition: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  tempMaxF: number;
  tempMinF: number;
  precipChance: number;
}

export interface WeatherData {
  city: string;
  country: string;
  tempC: number;
  tempF: number;
  feelsLikeC: number;
  feelsLikeF: number;
  condition: string;
  weatherCode: number;
  humidity: number;
  windSpeedKph: number;
  windSpeedMph: number;
  precipitationChance: number;
  uvIndex: number;
  localTime: string;
  forecast: DailyForecastItem[];
  isLive?: boolean;
}

// Weather code to condition & emoji / description
export function getWeatherConditionInfo(code: number): { condition: string; icon: string; bgGradient: string } {
  if (code === 0) {
    return { condition: 'Clear Sky', icon: '☀️', bgGradient: 'from-amber-500/20 to-orange-500/10' };
  } else if (code === 1 || code === 2) {
    return { condition: 'Partly Cloudy', icon: '⛅', bgGradient: 'from-blue-500/20 to-sky-400/10' };
  } else if (code === 3) {
    return { condition: 'Overcast', icon: '☁️', bgGradient: 'from-slate-500/20 to-slate-400/10' };
  } else if (code === 45 || code === 48) {
    return { condition: 'Foggy', icon: '🌫️', bgGradient: 'from-teal-500/20 to-slate-500/10' };
  } else if (code >= 51 && code <= 55) {
    return { condition: 'Drizzle', icon: '🌦️', bgGradient: 'from-cyan-500/20 to-blue-500/10' };
  } else if (code >= 61 && code <= 65) {
    return { condition: 'Rain Showers', icon: '🌧️', bgGradient: 'from-blue-600/20 to-indigo-500/10' };
  } else if (code >= 71 && code <= 77) {
    return { condition: 'Snow', icon: '❄️', bgGradient: 'from-sky-300/20 to-indigo-300/10' };
  } else if (code >= 80 && code <= 82) {
    return { condition: 'Heavy Rain', icon: '🌧️', bgGradient: 'from-blue-700/20 to-indigo-700/10' };
  } else if (code >= 95 && code <= 99) {
    return { condition: 'Thunderstorm', icon: '⛈️', bgGradient: 'from-purple-600/20 to-indigo-700/10' };
  }
  return { condition: 'Mild / Fair', icon: '🌤️', bgGradient: 'from-blue-500/20 to-sky-400/10' };
}

// Global Cities Offline Database
export const OFFLINE_WEATHER_DATA: Record<string, WeatherData> = {
  'new york': {
    city: 'New York',
    country: 'United States',
    tempC: 19,
    tempF: 66,
    feelsLikeC: 18,
    feelsLikeF: 64,
    condition: 'Partly Cloudy',
    weatherCode: 2,
    humidity: 58,
    windSpeedKph: 14,
    windSpeedMph: 9,
    precipitationChance: 15,
    uvIndex: 4,
    localTime: 'EDT (UTC-4)',
    forecast: [
      { dayName: 'Today', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 21, tempMinC: 14, tempMaxF: 70, tempMinF: 57, precipChance: 15 },
      { dayName: 'Tue', condition: 'Sunny', weatherCode: 0, tempMaxC: 23, tempMinC: 15, tempMaxF: 73, tempMinF: 59, precipChance: 5 },
      { dayName: 'Wed', condition: 'Rain Showers', weatherCode: 61, tempMaxC: 18, tempMinC: 13, tempMaxF: 64, tempMinF: 55, precipChance: 70 },
      { dayName: 'Thu', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 20, tempMinC: 12, tempMaxF: 68, tempMinF: 54, precipChance: 10 },
      { dayName: 'Fri', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 22, tempMinC: 14, tempMaxF: 72, tempMinF: 57, precipChance: 20 }
    ]
  },
  london: {
    city: 'London',
    country: 'United Kingdom',
    tempC: 16,
    tempF: 61,
    feelsLikeC: 15,
    feelsLikeF: 59,
    condition: 'Light Drizzle',
    weatherCode: 51,
    humidity: 78,
    windSpeedKph: 18,
    windSpeedMph: 11,
    precipitationChance: 45,
    uvIndex: 3,
    localTime: 'BST (UTC+1)',
    forecast: [
      { dayName: 'Today', condition: 'Light Drizzle', weatherCode: 51, tempMaxC: 17, tempMinC: 11, tempMaxF: 63, tempMinF: 52, precipChance: 45 },
      { dayName: 'Tue', condition: 'Overcast', weatherCode: 3, tempMaxC: 16, tempMinC: 10, tempMaxF: 61, tempMinF: 50, precipChance: 25 },
      { dayName: 'Wed', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 18, tempMinC: 12, tempMaxF: 64, tempMinF: 54, precipChance: 15 },
      { dayName: 'Thu', condition: 'Rain', weatherCode: 61, tempMaxC: 15, tempMinC: 9, tempMaxF: 59, tempMinF: 48, precipChance: 65 },
      { dayName: 'Fri', condition: 'Sunny', weatherCode: 0, tempMaxC: 19, tempMinC: 11, tempMaxF: 66, tempMinF: 52, precipChance: 10 }
    ]
  },
  tokyo: {
    city: 'Tokyo',
    country: 'Japan',
    tempC: 22,
    tempF: 72,
    feelsLikeC: 22,
    feelsLikeF: 72,
    condition: 'Clear Sky',
    weatherCode: 0,
    humidity: 52,
    windSpeedKph: 11,
    windSpeedMph: 7,
    precipitationChance: 0,
    uvIndex: 6,
    localTime: 'JST (UTC+9)',
    forecast: [
      { dayName: 'Today', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 24, tempMinC: 16, tempMaxF: 75, tempMinF: 61, precipChance: 0 },
      { dayName: 'Tue', condition: 'Sunny', weatherCode: 0, tempMaxC: 25, tempMinC: 17, tempMaxF: 77, tempMinF: 63, precipChance: 5 },
      { dayName: 'Wed', condition: 'Partly Cloudy', weatherCode: 1, tempMaxC: 23, tempMinC: 18, tempMaxF: 73, tempMinF: 64, precipChance: 20 },
      { dayName: 'Thu', condition: 'Rain Showers', weatherCode: 61, tempMaxC: 20, tempMinC: 15, tempMaxF: 68, tempMinF: 59, precipChance: 60 },
      { dayName: 'Fri', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 23, tempMinC: 16, tempMaxF: 73, tempMinF: 61, precipChance: 10 }
    ]
  },
  paris: {
    city: 'Paris',
    country: 'France',
    tempC: 18,
    tempF: 64,
    feelsLikeC: 17,
    feelsLikeF: 63,
    condition: 'Partly Cloudy',
    weatherCode: 2,
    humidity: 62,
    windSpeedKph: 13,
    windSpeedMph: 8,
    precipitationChance: 10,
    uvIndex: 4,
    localTime: 'CEST (UTC+2)',
    forecast: [
      { dayName: 'Today', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 20, tempMinC: 12, tempMaxF: 68, tempMinF: 54, precipChance: 10 },
      { dayName: 'Tue', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 22, tempMinC: 13, tempMaxF: 72, tempMinF: 55, precipChance: 5 },
      { dayName: 'Wed', condition: 'Overcast', weatherCode: 3, tempMaxC: 19, tempMinC: 14, tempMaxF: 66, tempMinF: 57, precipChance: 30 },
      { dayName: 'Thu', condition: 'Light Rain', weatherCode: 61, tempMaxC: 17, tempMinC: 11, tempMaxF: 63, tempMinF: 52, precipChance: 55 },
      { dayName: 'Fri', condition: 'Sunny', weatherCode: 0, tempMaxC: 21, tempMinC: 12, tempMaxF: 70, tempMinF: 54, precipChance: 5 }
    ]
  },
  'san francisco': {
    city: 'San Francisco',
    country: 'United States',
    tempC: 17,
    tempF: 63,
    feelsLikeC: 16,
    feelsLikeF: 61,
    condition: 'Sunny / Breeze',
    weatherCode: 0,
    humidity: 66,
    windSpeedKph: 21,
    windSpeedMph: 13,
    precipitationChance: 0,
    uvIndex: 5,
    localTime: 'PDT (UTC-7)',
    forecast: [
      { dayName: 'Today', condition: 'Sunny', weatherCode: 0, tempMaxC: 19, tempMinC: 12, tempMaxF: 66, tempMinF: 54, precipChance: 0 },
      { dayName: 'Tue', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 21, tempMinC: 13, tempMaxF: 70, tempMinF: 55, precipChance: 0 },
      { dayName: 'Wed', condition: 'Morning Fog', weatherCode: 45, tempMaxC: 18, tempMinC: 12, tempMaxF: 64, tempMinF: 54, precipChance: 5 },
      { dayName: 'Thu', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 18, tempMinC: 11, tempMaxF: 64, tempMinF: 52, precipChance: 10 },
      { dayName: 'Fri', condition: 'Sunny', weatherCode: 0, tempMaxC: 20, tempMinC: 13, tempMaxF: 68, tempMinF: 55, precipChance: 0 }
    ]
  },
  sydney: {
    city: 'Sydney',
    country: 'Australia',
    tempC: 21,
    tempF: 70,
    feelsLikeC: 21,
    feelsLikeF: 70,
    condition: 'Sunny',
    weatherCode: 0,
    humidity: 55,
    windSpeedKph: 16,
    windSpeedMph: 10,
    precipitationChance: 5,
    uvIndex: 7,
    localTime: 'AEST (UTC+10)',
    forecast: [
      { dayName: 'Today', condition: 'Sunny', weatherCode: 0, tempMaxC: 23, tempMinC: 15, tempMaxF: 73, tempMinF: 59, precipChance: 5 },
      { dayName: 'Tue', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 25, tempMinC: 16, tempMaxF: 77, tempMinF: 61, precipChance: 5 },
      { dayName: 'Wed', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 22, tempMinC: 16, tempMaxF: 72, tempMinF: 61, precipChance: 20 },
      { dayName: 'Thu', condition: 'Rain Showers', weatherCode: 61, tempMaxC: 20, tempMinC: 14, tempMaxF: 68, tempMinF: 57, precipChance: 60 },
      { dayName: 'Fri', condition: 'Sunny', weatherCode: 0, tempMaxC: 24, tempMinC: 15, tempMaxF: 75, tempMinF: 59, precipChance: 10 }
    ]
  },
  delhi: {
    city: 'Delhi',
    country: 'India',
    tempC: 31,
    tempF: 88,
    feelsLikeC: 34,
    feelsLikeF: 93,
    condition: 'Hazy Sun',
    weatherCode: 1,
    humidity: 48,
    windSpeedKph: 9,
    windSpeedMph: 6,
    precipitationChance: 0,
    uvIndex: 8,
    localTime: 'IST (UTC+5:30)',
    forecast: [
      { dayName: 'Today', condition: 'Hazy Sun', weatherCode: 1, tempMaxC: 33, tempMinC: 23, tempMaxF: 91, tempMinF: 73, precipChance: 0 },
      { dayName: 'Tue', condition: 'Sunny', weatherCode: 0, tempMaxC: 34, tempMinC: 24, tempMaxF: 93, tempMinF: 75, precipChance: 0 },
      { dayName: 'Wed', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 34, tempMinC: 24, tempMaxF: 93, tempMinF: 75, precipChance: 5 },
      { dayName: 'Thu', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 32, tempMinC: 23, tempMaxF: 90, tempMinF: 73, precipChance: 15 },
      { dayName: 'Fri', condition: 'Sunny', weatherCode: 0, tempMaxC: 33, tempMinC: 22, tempMaxF: 91, tempMinF: 72, precipChance: 0 }
    ]
  },
  berlin: {
    city: 'Berlin',
    country: 'Germany',
    tempC: 15,
    tempF: 59,
    feelsLikeC: 14,
    feelsLikeF: 57,
    condition: 'Partly Cloudy',
    weatherCode: 2,
    humidity: 64,
    windSpeedKph: 15,
    windSpeedMph: 9,
    precipitationChance: 20,
    uvIndex: 3,
    localTime: 'CEST (UTC+2)',
    forecast: [
      { dayName: 'Today', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 17, tempMinC: 9, tempMaxF: 63, tempMinF: 48, precipChance: 20 },
      { dayName: 'Tue', condition: 'Overcast', weatherCode: 3, tempMaxC: 16, tempMinC: 10, tempMaxF: 61, tempMinF: 50, precipChance: 35 },
      { dayName: 'Wed', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 18, tempMinC: 8, tempMaxF: 64, tempMinF: 46, precipChance: 10 },
      { dayName: 'Thu', condition: 'Sunny', weatherCode: 0, tempMaxC: 19, tempMinC: 10, tempMaxF: 66, tempMinF: 50, precipChance: 5 },
      { dayName: 'Fri', condition: 'Rain', weatherCode: 61, tempMaxC: 15, tempMinC: 9, tempMaxF: 59, tempMinF: 48, precipChance: 60 }
    ]
  },
  toronto: {
    city: 'Toronto',
    country: 'Canada',
    tempC: 17,
    tempF: 63,
    feelsLikeC: 16,
    feelsLikeF: 61,
    condition: 'Clear Sky',
    weatherCode: 0,
    humidity: 56,
    windSpeedKph: 16,
    windSpeedMph: 10,
    precipitationChance: 5,
    uvIndex: 4,
    localTime: 'EDT (UTC-4)',
    forecast: [
      { dayName: 'Today', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 19, tempMinC: 11, tempMaxF: 66, tempMinF: 52, precipChance: 5 },
      { dayName: 'Tue', condition: 'Partly Cloudy', weatherCode: 2, tempMaxC: 20, tempMinC: 13, tempMaxF: 68, tempMinF: 55, precipChance: 15 },
      { dayName: 'Wed', condition: 'Rain Showers', weatherCode: 61, tempMaxC: 16, tempMinC: 10, tempMaxF: 61, tempMinF: 50, precipChance: 70 },
      { dayName: 'Thu', condition: 'Sunny', weatherCode: 0, tempMaxC: 18, tempMinC: 9, tempMaxF: 64, tempMinF: 48, precipChance: 10 },
      { dayName: 'Fri', condition: 'Clear Sky', weatherCode: 0, tempMaxC: 21, tempMinC: 12, tempMaxF: 70, tempMinF: 54, precipChance: 5 }
    ]
  }
};

/**
 * Extracts city name from weather queries.
 * Returns null if the user has not finished writing or typed an incomplete prefix.
 */
export function parseWeatherQuery(rawQuery: string): { city: string } | null {
  // If user is actively typing and ends with a space (e.g. "weather ", "weather in "), they are not done!
  if (rawQuery.endsWith(' ')) {
    return null;
  }

  const clean = rawQuery
    .trim()
    .toLowerCase()
    .replace(/[?!.]+$/g, '')
    .trim();

  // Incomplete phrase check - user hasn't written the city yet
  if (/^(?:weather in|weather at|weather for|weather of|temperature in|temperature at|temperature for|forecast for|forecast in|forecast at)$/i.test(clean)) {
    return null;
  }

  const isValidCityName = (c: string): boolean => {
    const trimmed = c.trim();
    if (trimmed.length < 2) return false;
    const words = trimmed.split(/\s+/);
    // If the last word is a single letter (e.g. user typed "s" or "new y"), they are still writing!
    if (words[words.length - 1].length < 2) return false;
    // If first word is a preposition (e.g. "in", "at", "for"), it is not a city
    if (/^(?:the|a|an|in|at|for|of|to|is|on|by|today|todays|tomorrow|now)$/i.test(words[0])) {
      return false;
    }
    return true;
  };

  // Pattern 1: pure "weather" or "weather forecast" or "todays weather"
  // Only trigger if exactly the full query without trailing qualifiers
  if (/^(?:weather|weather forecast|forecast|todays weather)$/i.test(clean)) {
    return { city: 'New York' };
  }

  // Pattern 2: weather in/at/for/around <city>
  const p2 = clean.match(/^weather\s+(?:in|at|for|around|of)\s+([a-z\s\-]+)$/i);
  if (p2) {
    const city = p2[1].trim();
    if (isValidCityName(city)) {
      return { city };
    }
    return null; // Do not fall through to pattern 3 when user typed "weather in ..."
  }

  // Pattern 3: weather <city> (e.g. "weather tokyo", "weather paris")
  // Ensure the city part doesn't start with prepositions
  const p3 = clean.match(/^weather\s+([a-z\s\-]+)$/i);
  if (p3) {
    const city = p3[1].trim();
    if (isValidCityName(city) && !/^(?:in|at|for|around|the|of|forecast)\b/i.test(city)) {
      return { city };
    }
    return null;
  }

  // Pattern 4: <city> weather / <city> forecast
  const p4 = clean.match(/^([a-z\s\-]+)\s+(?:weather|weather forecast|forecast)$/i);
  if (p4 && isValidCityName(p4[1])) {
    return { city: p4[1].trim() };
  }

  // Pattern 5: temperature in/at/for <city>
  const p5 = clean.match(/^(?:what is the )?temperature\s+(?:in|at|for)\s+([a-z\s\-]+)$/i);
  if (p5 && isValidCityName(p5[1])) {
    return { city: p5[1].trim() };
  }

  return null;
}

/**
 * Fetches real weather data via Open-Meteo, with fallback to global offline city data
 */
export async function fetchCityWeather(cityQuery: string, signal?: AbortSignal): Promise<WeatherData | null> {
  const normCity = cityQuery.toLowerCase().trim();

  // City aliases normalization (e.g. "sf" -> "san francisco", "nyc" -> "new york")
  const cityKey =
    normCity === 'nyc' ? 'new york' :
    normCity === 'sf' ? 'san francisco' :
    normCity;

  // Check offline cache first for instant initial display
  const offlineMatch = OFFLINE_WEATHER_DATA[cityKey];

  try {
    // 1. Geocoding API lookup
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1&language=en&format=json`,
      { signal }
    );
    if (!geoRes.ok) return offlineMatch || null;
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return offlineMatch || null;
    }

    const targetLocation = geoData.results[0];
    const lat = targetLocation.latitude;
    const lon = targetLocation.longitude;
    const resolvedCity = targetLocation.name;
    const resolvedCountry = targetLocation.country || targetLocation.country_code || '';

    // 2. Open-Meteo Forecast API
    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`,
      { signal }
    );
    if (!forecastRes.ok) return offlineMatch || null;
    const forecastData = await forecastRes.json();

    const curr = forecastData.current;
    const daily = forecastData.daily;

    const tempC = Math.round(curr.temperature_2m);
    const tempF = Math.round((tempC * (9 / 5)) + 32);
    const feelsLikeC = Math.round(curr.apparent_temperature);
    const feelsLikeF = Math.round((feelsLikeC * (9 / 5)) + 32);
    const weatherCode = curr.weather_code || 0;
    const condInfo = getWeatherConditionInfo(weatherCode);

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const forecastItems: DailyForecastItem[] = [];

    if (daily && Array.isArray(daily.time)) {
      daily.time.slice(0, 5).forEach((dateStr: string, idx: number) => {
        const d = new Date(dateStr + 'T12:00:00');
        const dayLabel = idx === 0 ? 'Today' : weekdays[d.getDay()] || 'Day';
        const code = daily.weather_code[idx] || 0;
        const maxC = Math.round(daily.temperature_2m_max[idx] || tempC);
        const minC = Math.round(daily.temperature_2m_min[idx] || tempC - 5);
        const maxF = Math.round((maxC * (9 / 5)) + 32);
        const minF = Math.round((minC * (9 / 5)) + 32);
        const pChance = daily.precipitation_probability_max ? Math.round(daily.precipitation_probability_max[idx] || 0) : 0;

        forecastItems.push({
          dayName: dayLabel,
          condition: getWeatherConditionInfo(code).condition,
          weatherCode: code,
          tempMaxC: maxC,
          tempMinC: minC,
          tempMaxF: maxF,
          tempMinF: minF,
          precipChance: pChance
        });
      });
    }

    return {
      city: resolvedCity,
      country: resolvedCountry,
      tempC,
      tempF,
      feelsLikeC,
      feelsLikeF,
      condition: condInfo.condition,
      weatherCode,
      humidity: Math.round(curr.relative_humidity_2m || 50),
      windSpeedKph: Math.round(curr.wind_speed_10m || 10),
      windSpeedMph: Math.round((curr.wind_speed_10m || 10) * 0.621371),
      precipitationChance: forecastItems[0]?.precipChance || 0,
      uvIndex: 5,
      localTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      forecast: forecastItems,
      isLive: true
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return null;
    }
    return offlineMatch || null;
  }
}
