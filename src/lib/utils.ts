import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as toGeoJSON from '@tmcw/togeojson';
// @ts-ignore - Ignore type issues with bbox
import bbox from '@turf/bbox';
import { GpxPoint, WeatherData, DailyWeatherData, ProcessedTrack } from '@/types';
import { jsPDF } from 'jspdf';

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
  date: string = new Date().toISOString().split('T')[0]
): Promise<WeatherData> {

  const cacheKey = `weather-${lat.toFixed(4)}-${lon.toFixed(4)}-${date}`;
  let daily = getWeatherFromCache(cacheKey);

  if (!daily) {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=apparent_temperature_max,apparent_temperature_min,wind_speed_10m_max,wind_direction_10m_dominant,rain_sum&timezone=auto`
    );
    const data = await response.json();
    daily = {
      time: data.daily.time,
      apparent_temperature_max: data.daily.apparent_temperature_max,
      apparent_temperature_min: data.daily.apparent_temperature_min,
      wind_speed_10m_max: data.daily.wind_speed_10m_max,
      wind_direction_10m_dominant: data.daily.wind_direction_10m_dominant,
      rain_sum: data.daily.rain_sum,
    };
    storeWeatherInCache(cacheKey, daily);
  }

  const weatherData = {
    time: daily.time[0],
    apparent_temperature_max: daily.apparent_temperature_max[0],
    apparent_temperature_min: daily.apparent_temperature_min[0],
    wind_speed_10m_max: daily.wind_speed_10m_max[0],
    wind_direction_10m_dominant: daily.wind_direction_10m_dominant[0],
    rain_sum: daily.rain_sum[0],
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

// Clear the entire weather cache
export function clearWeatherCache(): void {
  try {
    localStorage.removeItem('weather-cache');
  } catch (error) {
    console.error('Error clearing weather cache:', error);
  }
}

// Save tracks to localStorage
export function saveTracks(tracks: ProcessedTrack[]): void {
  try {
    localStorage.setItem('saved-tracks', JSON.stringify(tracks));
  } catch (error) {
    console.error('Error saving tracks:', error);
  }
}

// Load tracks from localStorage
export function loadTracks(): ProcessedTrack[] {
  try {
    const saved = localStorage.getItem('saved-tracks');
    return saved ? JSON.parse(saved) as ProcessedTrack[] : [];
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
  const defaults = { forecastDate: new Date().toISOString().split('T')[0] };
  try {
    const saved = localStorage.getItem('user-settings');
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return defaults as import('../types').UserSettings;
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

export function exportWeatherPdf(
  track: ProcessedTrack,
  title: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(12);

  let y = 80;
  track.sampledPoints?.forEach((point, idx) => {
    const weather = track.weatherData?.[idx];
    if (!weather) return;
    const altitude = point.ele != null ? `${point.ele.toFixed(0)} m` : 'N/A';
    const rain = `${weather.rain_sum.toFixed(1)} mm`;
    const temp = `${weather.apparent_temperature_min.toFixed(1)}-${weather.apparent_temperature_max.toFixed(1)}°C`;
    const wind = `${weather.wind_speed_10m_max.toFixed(0)} km/h`;

    doc.text(`Alt: ${altitude}`, 40, y);
    doc.text(`Wind: ${wind}`, 140, y);
    doc.text(`Rain: ${rain}`, 240, y);
    doc.text(`Temp: ${temp}`, 340, y);
    y += 20;
    if (y > 780) {
      doc.addPage();
      y = 40;
    }
  });

  doc.save(`${title}.pdf`);
}

export function windArrow(deg: number): string {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const idx = Math.round(deg / 45) % 8;
  return arrows[idx];
}
