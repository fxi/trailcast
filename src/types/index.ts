export interface WeatherData {
  /** Temperature at the selected time */
  temperature: number;
  /** Maximum temperature within the hourly margin */
  temperature_2m_max: number;
  /** Minimum temperature within the hourly margin */
  temperature_2m_min: number;
  precipitation_probability_max: number;
  time: string;
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
  /** Array of ISO timestamps */
  time: string[];
  /** Temperature forecast for each hour */
  temperature_2m: number[];
  /** Precipitation probability for each hour */
  precipitation_probability: number[];
}

export interface WeatherCache {
  [key: string]: {
    data: DailyWeatherData;
    timestamp: number;
  };
}

export interface UserSettings {
  weatherStart: string;
  averageSpeed: number;
  /** Number of hours before/after the selected time to include in the weather range */
  hourlyMargin: number;
}
