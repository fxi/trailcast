export interface WeatherData {
  temperature_2m_max: number;
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

export interface WeatherCache {
  [key: string]: {
    data: WeatherData;
    timestamp: number;
  };
}