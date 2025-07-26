import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as toGeoJSON from '@tmcw/togeojson';
// @ts-ignore - Ignore type issues with bbox
import bbox from '@turf/bbox';
import { GpxPoint, WeatherData, DailyWeatherData } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function processGpxFile(file: File | string): Promise<GpxPoint[]> {
  let text;
  if (typeof file === 'string') {
    // If file is a URL string, fetch it
    const response = await fetch(file);
    text = await response.text();
  } else {
    // If file is a File object, read it
    text = await file.text();
  }
  
  const parser = new DOMParser();
  const gpxDoc = parser.parseFromString(text, 'text/xml');
  const geoJson = toGeoJSON.gpx(gpxDoc);
  
  if (!geoJson.features.length) return [];
  
  // Extract coordinates and elevation from GeoJSON
  // @ts-ignore - GeoJSON type issues
  const track = geoJson.features[0].geometry.coordinates.map(
    ([lon, lat, ele]: number[]) => ({ lat, lon, ele })
  );
  
  // Calculate distance from start for each point
  let totalDistance = 0;
  const trackWithDistance = track.map((point: any, index: number) => {
    if (index === 0) {
      return { ...point, distance: 0 };
    }
    
    const prevPoint = track[index - 1];
    const distance = calculateDistance(prevPoint.lat, prevPoint.lon, point.lat, point.lon);
    totalDistance += distance;
    
    return { ...point, distance: totalDistance };
  });
  
  return trackWithDistance;
}

export function getTrackPoints(points: GpxPoint[]): GpxPoint[] {
  if (!points.length) return [];
  
  // If there are fewer than 10 points, return all of them
  if (points.length <= 10) return points;
  
  // Always include start and end points
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  
  // Find significant points (peaks and valleys) based on elevation
  const significantPoints: GpxPoint[] = findSignificantElevationPoints(points);
  
  // Combine and sort all the chosen points
  const sampledPoints = [
    startPoint,
    ...significantPoints,
    endPoint
  ].filter((point, index, self) => 
    // Remove duplicates
    index === self.findIndex(p => p.lat === point.lat && p.lon === point.lon)
  );
  
  // Sort by distance from start
  sampledPoints.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  
  // If we have more than 10 points, reduce to the 10 most important
  if (sampledPoints.length > 10) {
    // Always keep start and end
    const mustKeep = [sampledPoints[0], sampledPoints[sampledPoints.length - 1]];
    
    // Sort the rest by elevation importance and take top 8
    const middle = sampledPoints.slice(1, sampledPoints.length - 1)
      .sort((a, b) => Math.abs((b.ele || 0) - (startPoint.ele || 0)) - 
                      Math.abs((a.ele || 0) - (startPoint.ele || 0)))
      .slice(0, 8);
    
    // Combine and sort by distance again
    return [...mustKeep, ...middle]
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }
  
  return sampledPoints;
}

// Find significant elevation points (peaks and valleys)
function findSignificantElevationPoints(points: GpxPoint[]): GpxPoint[] {
  if (points.length < 3) return [];
  
  const significantPoints: GpxPoint[] = [];
  const ELEVATION_THRESHOLD = 50; // Minimum elevation change to be considered significant (in meters)
  
  let prevDirection = 0; // 0: neutral, 1: ascending, -1: descending
  let potentialPeak: GpxPoint | null = null;
  let potentialValley: GpxPoint | null = null;
  let lastSignificantEle = points[0].ele || 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prevPoint = points[i - 1];
    const currPoint = points[i];
    const nextPoint = points[i + 1];
    
    const prevEle = prevPoint.ele || 0;
    const currEle = currPoint.ele || 0;
    const nextEle = nextPoint.ele || 0;
    
    // Determine if we're ascending or descending
    const currentDirection = currEle > prevEle ? 1 : currEle < prevEle ? -1 : prevDirection;
    
    // Check for peak (higher than both neighbors)
    if (currEle > prevEle && currEle > nextEle) {
      // Found potential peak
      potentialPeak = currPoint;
      
      // Check if it's significant
      if (Math.abs(currEle - lastSignificantEle) >= ELEVATION_THRESHOLD) {
        significantPoints.push(currPoint);
        lastSignificantEle = currEle;
        potentialPeak = null;
      }
    }
    // Check for valley (lower than both neighbors)
    else if (currEle < prevEle && currEle < nextEle) {
      // Found potential valley
      potentialValley = currPoint;
      
      // Check if it's significant
      if (Math.abs(currEle - lastSignificantEle) >= ELEVATION_THRESHOLD) {
        significantPoints.push(currPoint);
        lastSignificantEle = currEle;
        potentialValley = null;
      }
    }
    
    // Direction change
    if (currentDirection !== prevDirection && prevDirection !== 0) {
      // Add last potential peak/valley if we changed direction
      if (prevDirection === 1 && potentialPeak && 
          Math.abs(potentialPeak.ele! - lastSignificantEle) >= ELEVATION_THRESHOLD) {
        significantPoints.push(potentialPeak);
        lastSignificantEle = potentialPeak.ele!;
      } 
      else if (prevDirection === -1 && potentialValley && 
              Math.abs(potentialValley.ele! - lastSignificantEle) >= ELEVATION_THRESHOLD) {
        significantPoints.push(potentialValley);
        lastSignificantEle = potentialValley.ele!;
      }
      
      potentialPeak = null;
      potentialValley = null;
    }
    
    prevDirection = currentDirection;
  }
  
  return significantPoints;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

export async function fetchWeather(
  lat: number,
  lon: number,
  dateTime: string,
  hourlyMargin = 0
): Promise<WeatherData> {
  const date = dateTime.split('T')[0];

  // Check cache using only location and date
  const cacheKey = `weather-${lat.toFixed(4)}-${lon.toFixed(4)}-${date}`;
  let daily = getWeatherFromCache(cacheKey);

  if (!daily) {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability&start_date=${date}&end_date=${date}&timezone=UTC`
    );
    const data = await response.json();
    daily = {
      time: data.hourly.time,
      temperature_2m: data.hourly.temperature_2m,
      precipitation_probability: data.hourly.precipitation_probability,
    };
    storeWeatherInCache(cacheKey, daily);
  }

  const times: string[] = daily.time;
  const temps: number[] = daily.temperature_2m;
  const precs: number[] = daily.precipitation_probability;

  const dt = new Date(dateTime);
  dt.setMinutes(0, 0, 0);
  const hourIso = dt.toISOString().slice(0, 13);
  const idx = times.findIndex((t) => t.startsWith(hourIso));

  const index = idx >= 0 ? idx : 0;
  const start = Math.max(0, index - hourlyMargin);
  const end = Math.min(times.length - 1, index + hourlyMargin);

  const rangeTemps = temps.slice(start, end + 1);
  const rangePrecs = precs.slice(start, end + 1);

  const temp = temps[index];
  const tempMin = Math.min(...rangeTemps);
  const tempMax = Math.max(...rangeTemps);
  const prec = Math.max(...rangePrecs);

  const weatherData = {
    temperature: temp,
    temperature_2m_max: tempMax,
    temperature_2m_min: tempMin,
    precipitation_probability_max: prec,
    time: dt.toISOString(),
  };

  return weatherData;
}

// Cache weather data in localStorage

export function storeWeatherInCache(key: string, data: DailyWeatherData): void {
  try {
    const weatherCache = getWeatherCache();
    
    weatherCache[key] = {
      data,
      timestamp: Date.now()
    };
    
    localStorage.setItem('weather-cache', JSON.stringify(weatherCache));
  } catch (error) {
    console.error('Error storing weather in cache:', error);
  }
}

// Get cached weather data if it exists and is not expired
export function getWeatherFromCache(key: string): DailyWeatherData | null {
  try {
    const weatherCache = getWeatherCache();
    const cached = weatherCache[key];
    
    if (cached) {
      const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
      const now = Date.now();
      
      if (now - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting weather from cache:', error);
    return null;
  }
}

// Get the entire weather cache
export function getWeatherCache(): Record<string, { data: DailyWeatherData; timestamp: number }> {
  try {
    const cached = localStorage.getItem('weather-cache');
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    console.error('Error parsing weather cache:', error);
    return {};
  }
}

// Save tracks to localStorage
export function saveTracks(tracks: any[]): void {
  try {
    localStorage.setItem('saved-tracks', JSON.stringify(tracks));
  } catch (error) {
    console.error('Error saving tracks:', error);
  }
}

// Load tracks from localStorage
export function loadTracks(): any[] {
  try {
    const saved = localStorage.getItem('saved-tracks');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading tracks:', error);
    return [];
  }
}

export function saveSettings(settings: import('../types').UserSettings): void {
  try {
    localStorage.setItem('user-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

export function loadSettings(): import('../types').UserSettings {
  try {
    const saved = localStorage.getItem('user-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        weatherStart: parsed.weatherStart || new Date().toISOString(),
        averageSpeed: parsed.averageSpeed ?? 18,
        hourlyMargin: parsed.hourlyMargin ?? 0,
      };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return { weatherStart: new Date().toISOString(), averageSpeed: 18, hourlyMargin: 0 };
}

export function calculateBounds(points: GpxPoint[]) {
  const coordinates = points.map(p => [p.lon, p.lat]);
  return bbox({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates
    }
  });
}
