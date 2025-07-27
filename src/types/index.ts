export interface WeatherData {
  /** ISO date for the forecast */
  time: string;
  /** Maximum apparent temperature for the day */
  apparent_temperature_max: number;
  /** Minimum apparent temperature for the day */
  apparent_temperature_min: number;
  /** Maximum wind speed */
  wind_speed_10m_max: number;
  /** Dominant wind direction in degrees */
  wind_direction_10m_dominant: number;
  /** Total rain for the day */
  rain_sum: number;
}

export interface GpxPoint {
  lat: number;
  lon: number;
  ele?: number; // Elevation in meters
  time?: string;
  distance?: number; // Distance from start in kilometers
}

export interface ProcessedTrack {
  id: string;
  name?: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  points: GpxPoint[];
  sampledPoints?: GpxPoint[];
  weatherData?: WeatherData[];
  weatherFetchedAt?: number; // timestamp when weather was last fetched
}

export interface DailyWeatherData {
  /** Array with a single ISO date */
  time: string[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
  rain_sum: number[];
}

export interface WeatherCache {
  [key: string]: {
    data: DailyWeatherData;
    timestamp: number;
  };
}

export interface UserSettings {
  // Intentionally left blank for future preferences
}
