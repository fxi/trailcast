import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Cloud, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeProvider } from '@/components/theme-provider';
import { GpxPoint, ProcessedTrack } from '@/types';
import { TrackProfile } from '@/components/ui/track-profile';
import { TrackList } from '@/components/ui/track-list';
import { AboutSection } from '@/components/ui/about-section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Info, List, BarChart2 } from "lucide-react";
import {
  processGpxFile,
  getTrackPoints,
  fetchWeather,
  calculateBounds,
  loadTracks,
  saveTracks
} from '@/lib/utils';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const cursorMarker = useRef<maplibregl.Marker | null>(null);
  const [tracks, setTracks] = useState<ProcessedTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<ProcessedTrack | null>(null);
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [loading, setLoading] = useState(false);
  
  // Load saved tracks from localStorage when the app starts
  useEffect(() => {
    const savedTracks = loadTracks();
    if (savedTracks.length > 0) {
      // Ensure all tracks have required timestamp fields
      const now = Date.now();
      const validatedTracks = savedTracks.map(track => ({
        ...track,
        createdAt: track.createdAt || now,
        updatedAt: track.updatedAt || now
      }));
      setTracks(validatedTracks);
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/topo-v2/style.json?key=r0T8W9TTH8XCCGoLL9gE',
      center: [0, 0],
      zoom: 1,
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setLoading(true);
    try {
      const timestamp = Date.now();
      
      const newTracks = await Promise.all(
        Array.from(files).map(async (file) => {
          const points = await processGpxFile(file);
          
          // Get key elevation points (peaks, valleys, etc.)
          const keyPoints = getTrackPoints(points);
          
          // Limit to 10 points for weather API calls
          const sampledPoints = keyPoints.length > 10 
            ? [
                keyPoints[0], // Always include start
                ...keyPoints.slice(1, keyPoints.length - 1).slice(0, 8), // Take up to 8 middle points
                keyPoints[keyPoints.length - 1] // Always include end
              ]
            : keyPoints;
          
          // Fetch weather data for each sampled point
          const weatherData = await Promise.all(
            sampledPoints.map(point => fetchWeather(point.lat, point.lon))
          );

          return {
            id: crypto.randomUUID(),
            name: file.name.replace(/.gpx$/i, ''),
            createdAt: timestamp,
            updatedAt: timestamp,
            points,
            sampledPoints,
            weatherData,
            weatherFetchedAt: timestamp
          };
        })
      );

      const updatedTracks = [...tracks, ...newTracks];
      setTracks(updatedTracks);
      
      // Save to localStorage
      saveTracks(updatedTracks);

      // If we have new tracks, select the first one and switch to profile tab
      if (newTracks.length > 0) {
        setSelectedTrack(newTracks[0]);
        setActiveTab("profile");
      }

      const allPoints = newTracks.flatMap(track => track.points);
      if (allPoints.length && map.current) {
        const bounds = calculateBounds(allPoints);
        map.current.fitBounds(
          [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
          { padding: 50, duration: 2000 }
        );
      }
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      
      const updatedTracks = await Promise.all(
        tracks.map(async (track) => {
          // Check if weather data needs refresh (older than 12 hours)
          const needsRefresh = !track.weatherFetchedAt || 
            (timestamp - track.weatherFetchedAt > 12 * 60 * 60 * 1000);
            
          if (!needsRefresh) {
            return track; // Skip if weather data is fresh enough
          }
          
          // Use the existing sampledPoints if available, or generate them
          const sampledPoints = track.sampledPoints || getTrackPoints(track.points);
          
          // Limit to 10 points for weather API calls
          const weatherPoints = sampledPoints.length > 10 
            ? [
                sampledPoints[0], // Always include start
                ...sampledPoints.slice(1, sampledPoints.length - 1).slice(0, 8), // Take up to 8 middle points
                sampledPoints[sampledPoints.length - 1] // Always include end
              ]
            : sampledPoints;

          const weatherData = await Promise.all(
            weatherPoints.map(point => fetchWeather(point.lat, point.lon))
          );

          return {
            ...track,
            sampledPoints: weatherPoints, // Store the points we actually used
            weatherData,
            weatherFetchedAt: timestamp,
            updatedAt: timestamp
          };
        })
      );

      setTracks(updatedTracks);
      
      // Update selected track if needed
      if (selectedTrack) {
        const updatedSelectedTrack = updatedTracks.find(t => t.id === selectedTrack.id);
        if (updatedSelectedTrack) {
          setSelectedTrack(updatedSelectedTrack);
        }
      }
      
      // Save to localStorage
      saveTracks(updatedTracks);
    } catch (error) {
      console.error('Error refreshing weather:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    // Clear tracks from state and localStorage
    setTracks([]);
    setSelectedTrack(null);
    saveTracks([]);
    
    // Remove cursor marker if it exists
    if (cursorMarker.current) {
      cursorMarker.current.remove();
      cursorMarker.current = null;
    }
    
    if (map.current) {
      try {
        // Make sure the map style is fully loaded
        const style = map.current.getStyle();
        if (style && style.sources) {
          // Remove all sprites and layers
          const existingSources = style.sources;
          Object.keys(existingSources).forEach(sourceId => {
            if (sourceId.startsWith('track-') || sourceId.startsWith('weather-')) {
              try {
                // First remove any layers using this source
                const layers = style.layers || [];
                layers.forEach(layer => {
                  if ('source' in layer && layer.source === sourceId) {
                    map.current?.removeLayer(layer.id);
                  }
                });
                // Then remove the source
                map.current?.removeSource(sourceId);
              } catch (e) {
                console.error(`Error removing source ${sourceId}:`, e);
              }
            }
          });
        }
        
        // Reset the map view
        map.current.flyTo({ center: [0, 0], zoom: 1 });
      } catch (error) {
        console.error("Error clearing map:", error);
        // As a fallback, just reset the view
        map.current.flyTo({ center: [0, 0], zoom: 1 });
      }
    }
  };
  
  // Handle deleting a single track
  const handleDeleteTrack = (trackId: string) => {
    const updatedTracks = tracks.filter(t => t.id !== trackId);
    setTracks(updatedTracks);
    saveTracks(updatedTracks);
    
    // If we deleted the selected track, clear it
    if (selectedTrack?.id === trackId) {
      setSelectedTrack(null);
    }
  };

  // Handle cursor position changes from the profile view
  const handleCursorChange = (point: GpxPoint | null) => {
    // Remove existing cursor marker
    if (cursorMarker.current) {
      cursorMarker.current.remove();
      cursorMarker.current = null;
    }
    
    // If we have a point, create a new marker
    if (point && map.current) {
      // Create a cursor marker element
      const el = document.createElement('div');
      el.className = 'cursor-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#ff0000';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      
      // Create and add the marker
      cursorMarker.current = new maplibregl.Marker({
        element: el
      })
        .setLngLat([point.lon, point.lat])
        .addTo(map.current);
      
      // Pan map to cursor position
      map.current.panTo([point.lon, point.lat], { duration: 100 });
    }
  };
  
  // Handle track selection
  const handleTrackClick = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      setSelectedTrack(track);
      
      // Fit map to track bounds
      if (map.current) {
        const bounds = calculateBounds(track.points);
        map.current.fitBounds(
          [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
          { padding: 50, duration: 1000 }
        );
      }
    }
  };

  useEffect(() => {
    if (!map.current || !tracks.length) return;

    // Render function to apply tracks to the map
    const renderTracks = () => {
      try {
        // Clean up existing layers and sources
        const style = map.current?.getStyle();
        if (style && style.sources) {
          const existingSources = style.sources;
          Object.keys(existingSources).forEach(sourceId => {
            if (sourceId.startsWith('track-') || sourceId.startsWith('weather-')) {
              try {
                const layers = style.layers || [];
                layers.forEach(layer => {
                  if ('source' in layer && layer.source === sourceId) {
                    map.current?.removeLayer(layer.id);
                  }
                });
                
                const trackIdInSource = sourceId.split('-')[1];
                const isCurrentTrack = tracks.some(t => t.id === trackIdInSource);
                if (!isCurrentTrack) {
                  map.current?.removeSource(sourceId);
                }
              } catch (e) {
                console.error(`Error cleaning up source ${sourceId}:`, e);
              }
            }
          });
        }

        // Add each track
        tracks.forEach((track, trackIndex) => {
          try {
            const isSelected = selectedTrack?.id === track.id;
            const trackSourceId = `track-${track.id}`;
            const trackLayerId = `track-line-${track.id}`;

            // Remove if exists
            if (map.current?.getSource(trackSourceId)) {
              map.current.removeLayer(trackLayerId);
              map.current.removeSource(trackSourceId);
            }

            // Add track line
            map.current?.addSource(trackSourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: track.points.map(p => [p.lon, p.lat])
                }
              }
            });

            map.current?.addLayer({
              id: trackLayerId,
              type: 'line',
              source: trackSourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': [
                  'match',
                  ['%', trackIndex, 5],
                  0, '#FF6B6B',
                  1, '#4ECDC4',
                  2, '#45B7D1',
                  3, '#96CEB4',
                  4, '#FFEEAD',
                  '#FF6B6B'
                ],
                'line-width': isSelected ? 6 : 4,
                'line-opacity': isSelected ? 1 : 0.7
              }
            });
            
            // Add interaction handlers
            map.current?.on('click', trackLayerId, function() {
              handleTrackClick(track.id);
            });
            
            map.current?.on('mouseenter', trackLayerId, function() {
              if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            
            map.current?.on('mouseleave', trackLayerId, function() {
              if (map.current) map.current.getCanvas().style.cursor = '';
            });

            // Add weather data points
            const sampledPoints = track.sampledPoints || [];
            if (track.weatherData && track.weatherData.length === sampledPoints.length) {
              try {
                const weatherSourceId = `weather-${track.id}`;
                const weatherSpriteId = `weather-sprite-${track.id}`;
                const weatherLabelId = `weather-label-${track.id}`;
                
                // Create weather point data
                const weatherPointsData = {
                  type: 'FeatureCollection',
                  features: sampledPoints.map((point, idx) => {
                    const weather = track.weatherData![idx];
                    return {
                      type: 'Feature',
                      geometry: {
                        type: 'Point',
                        coordinates: [point.lon, point.lat]
                      },
                      properties: {
                        temperature_min: weather.temperature_2m_min.toFixed(1),
                        temperature_max: weather.temperature_2m_max.toFixed(1),
                        precipitation: weather.precipitation_probability_max,
                        trackIndex: trackIndex
                      }
                    };
                  })
                };

                // Remove if exists
                if (map.current?.getSource(weatherSourceId)) {
                  if (map.current.getLayer(weatherLabelId)) {
                    map.current.removeLayer(weatherLabelId);
                  }
                  if (map.current.getLayer(weatherSpriteId)) {
                    map.current.removeLayer(weatherSpriteId);
                  }
                  map.current.removeSource(weatherSourceId);
                }
                
                // Add source and layers
                map.current?.addSource(weatherSourceId, {
                  type: 'geojson',
                  data: weatherPointsData
                });

                // Add sprite circles
                map.current?.addLayer({
                  id: weatherSpriteId,
                  type: 'circle',
                  source: weatherSourceId,
                  paint: {
                    'circle-radius': 8,
                    'circle-color': [
                      'match',
                      ['%', ['get', 'trackIndex'], 5],
                      0, '#FF6B6B',
                      1, '#4ECDC4',
                      2, '#45B7D1',
                      3, '#96CEB4',
                      4, '#FFEEAD',
                      '#FF6B6B'
                    ],
                    'circle-opacity': 0.7,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                  }
                });

                // Add text labels
                map.current?.addLayer({
                  id: weatherLabelId,
                  type: 'symbol',
                  source: weatherSourceId,
                  layout: {
                    'text-field': [
                      'concat',
                      ['get', 'temperature_min'], '-', ['get', 'temperature_max'], '°C\n',
                      ['get', 'precipitation'], '% rain'
                    ],
                    'text-font': ['Open Sans Regular'],
                    'text-size': 12,
                    'text-anchor': 'top',
                    'text-offset': [0, 1]
                  },
                  paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1
                  }
                });
              } catch (error) {
                console.error(`Error adding weather data for track ${track.id}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error adding track ${track.id}:`, error);
          }
        });
      } catch (error) {
        console.error("Error rendering tracks:", error);
      }
    };

    // Check if map style is loaded and render tracks
    if (map.current.isStyleLoaded()) {
      renderTracks();
    } else {
      // Wait for map style to load before rendering
      const waitForMapStyle = () => {
        if (!map.current) return;
        
        if (map.current.isStyleLoaded()) {
          renderTracks();
        } else {
          setTimeout(waitForMapStyle, 100);
        }
      };
      
      waitForMapStyle();
    }
    
    // No need for cleanup, the map layer removal will also remove the event listeners
    return () => {};
  }, [tracks, selectedTrack]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background text-foreground">
        <div className="fixed top-4 left-4 right-4 z-10 flex gap-2">
          <Button
            variant="secondary"
            className="relative overflow-hidden"
            disabled={loading}
          >
            <input
              type="file"
              multiple
              accept=".gpx"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-4 h-4 mr-2" />
            Upload GPX
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || !tracks.length}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={handleClear}
            disabled={loading || !tracks.length}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <div className="ml-auto flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
            <Cloud className="w-4 h-4" />
            <span className="text-sm font-medium">
              {tracks.length} track{tracks.length !== 1 ? 's' : ''} loaded
            </span>
          </div>
        </div>
        
        <div
          ref={mapContainer}
          className="w-full h-[calc(100vh-350px)]"
        />
        
        {/* Bottom panel with tabs */}
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-background h-[350px] border-t">
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="px-4 h-full flex flex-col"
          >
            <TabsList className="w-full justify-start mb-2 mt-2">
              <TabsTrigger value="profile" className="flex items-center gap-1">
                <BarChart2 className="w-4 h-4" />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="tracks" className="flex items-center gap-1">
                <List className="w-4 h-4" />
                <span>Tracks</span>
                {tracks.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {tracks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="about" className="flex items-center gap-1">
                <Info className="w-4 h-4" />
                <span>About</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden">
              <TabsContent value="profile" className="m-0 h-full">
                <TrackProfile 
                  track={selectedTrack} 
                  onCursorChange={handleCursorChange} 
                />
              </TabsContent>
              
              <TabsContent value="tracks" className="m-0 h-full">
                <TrackList 
                  tracks={tracks}
                  selectedTrackId={selectedTrack?.id}
                  onSelectTrack={(id) => {
                    const track = tracks.find(t => t.id === id);
                    if (track) {
                      setSelectedTrack(track);
                      setActiveTab("profile");
                    }
                  }}
                  onDeleteTrack={handleDeleteTrack}
                />
              </TabsContent>
              
              <TabsContent value="about" className="m-0 h-full">
                <AboutSection />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
