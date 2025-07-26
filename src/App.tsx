import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Cloud, RefreshCw, Trash2, Upload, ChevronUp, ChevronDown, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeProvider } from '@/components/theme-provider';
import { GpxPoint, ProcessedTrack, UserSettings } from '@/types';
import { TrackProfile } from '@/components/ui/track-profile';
import { TrackList } from '@/components/ui/track-list';
import { AboutSection } from '@/components/ui/about-section';
import { SettingsSection } from '@/components/ui/settings-section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Info, List, BarChart2, Settings as SettingsIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  processGpxFile,
  getTrackPoints,
  fetchWeather,
  calculateBounds,
  loadTracks,
  saveTracks,
  loadSettings,
  saveSettings
} from '@/lib/utils';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const cursorMarker = useRef<maplibregl.Marker | null>(null);
  const [tracks, setTracks] = useState<ProcessedTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<ProcessedTrack | null>(null);
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showDemoDialog, setShowDemoDialog] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(loadSettings());

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
      
      // Zoom to the extent of all tracks
      if (map.current) {
        const allPoints = validatedTracks.flatMap(track => track.points);
        if (allPoints.length) {
          const bounds = calculateBounds(allPoints);
          map.current.fitBounds(
            [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
            { padding: 50, duration: 1000 }
          );
        }
      }
    } else {
      // If no tracks, show demo data dialog
      setShowDemoDialog(true);
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

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!tracks.length) return;

    const refresh = async () => {
      setLoading(true);
      try {
        const timestamp = Date.now();
        const updated = await Promise.all(
          tracks.map(async (track) => {
            const sampledPoints = track.sampledPoints || getTrackPoints(track.points);
            const weatherPoints = sampledPoints.length > 10
              ? [sampledPoints[0], ...sampledPoints.slice(1, sampledPoints.length - 1).slice(0, 8), sampledPoints[sampledPoints.length - 1]]
              : sampledPoints;

            const weatherData = await Promise.all(
              weatherPoints.map(pt => fetchWeather(pt.lat, pt.lon, settings.weatherStart))
            );

            return {
              ...track,
              sampledPoints: weatherPoints,
              weatherData,
              weatherFetchedAt: timestamp,
              updatedAt: timestamp
            };
          })
        );
        setTracks(updated);
        saveTracks(updated);

        if (selectedTrack) {
          const updatedSelected = updated.find(t => t.id === selectedTrack.id);
          if (updatedSelected) setSelectedTrack(updatedSelected);
        }
      } finally {
        setLoading(false);
      }
    };

    refresh();
  }, [settings.weatherStart]);

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
            sampledPoints.map(point => fetchWeather(point.lat, point.lon, settings.weatherStart))
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
            weatherPoints.map(point => fetchWeather(point.lat, point.lon, settings.weatherStart))
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
  
  // Handle deleting one or multiple tracks
  const handleDeleteTrack = (trackId: string | string[]) => {
    // Handle either a single track ID or an array of track IDs
    const trackIdsToDelete = Array.isArray(trackId) ? trackId : [trackId];
    
    const updatedTracks = tracks.filter(t => !trackIdsToDelete.includes(t.id));
    setTracks(updatedTracks);
    saveTracks(updatedTracks);
    
    // If we deleted the selected track, clear it
    if (selectedTrack && trackIdsToDelete.includes(selectedTrack.id)) {
      setSelectedTrack(null);
    }
    
    // Clean up map layers for each deleted track
    if (map.current) {
      trackIdsToDelete.forEach(id => {
        try {
          const trackSourceId = `track-${id}`;
          const trackLayerId = `track-line-${id}`;
          const weatherSourceId = `weather-${id}`;
          const weatherSpriteId = `weather-sprite-${id}`;
          const weatherLabelId = `weather-label-${id}`;
          
          // Remove weather layers if they exist
          if (map.current?.getLayer(weatherLabelId)) {
            map.current.removeLayer(weatherLabelId);
          }
          if (map.current?.getLayer(weatherSpriteId)) {
            map.current.removeLayer(weatherSpriteId);
          }
          if (map.current?.getSource(weatherSourceId)) {
            map.current.removeSource(weatherSourceId);
          }
          
          // Remove track layer if it exists
          if (map.current?.getLayer(trackLayerId)) {
            map.current.removeLayer(trackLayerId);
          }
          if (map.current?.getSource(trackSourceId)) {
            map.current.removeSource(trackSourceId);
          }
        } catch (error) {
          console.error(`Error cleaning up map layers for track ${id}:`, error);
        }
      });
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
                const startTs = new Date(settings.weatherStart).getTime();
                const weatherPointsData = {
                  type: 'FeatureCollection',
                  features: sampledPoints.map((point, idx) => {
                    const weather = track.weatherData![idx];
                    const hours = (point.distance || 0) / settings.averageSpeed;
                    const arr = new Date(startTs + hours * 3600 * 1000);
                    const labelTime = arr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                        arrival: labelTime,
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
                      ['get', 'arrival'], '\n',
                      ['get', 'temperature_min'], '-', ['get', 'temperature_max'], '°C\n',
                      ['get', 'precipitation'], '% rain'
                    ],
                    'text-font': ['Open Sans Regular'],
                    'text-size': 14,
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
  }, [tracks, selectedTrack, settings]);

  // Handle loading demo GPX data
  const loadDemoData = async () => {
    setLoading(true);
    try {
      // Always use the BASE_URL from Vite
      const base = import.meta.env.BASE_URL || '/';
      
      const files = [
        `${base}gpx/1.LZ_Lanzarote_-_GGgravel.gpx`,
        `${base}gpx/2.FV_Fuerteventura_-_GGgravel.gpx`,
        `${base}gpx/3.GC_GranCanaria_-_GGgravel.gpx`,
        `${base}gpx/4.TF_Tenerife_-_GGgravel.gpx`,
        `${base}gpx/5.EH_El_Hierro_-_GGgravel.gpx`
      ];
      
      const timestamp = Date.now();
      
      const newTracks = await Promise.all(
        files.map(async (file) => {
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
            sampledPoints.map(point => fetchWeather(point.lat, point.lon, settings.weatherStart))
          );

          // Extract file name without extension and path
          const name = file.split('/').pop()?.replace(/.gpx$/i, '') || file;

          return {
            id: crypto.randomUUID(),
            name,
            createdAt: timestamp,
            updatedAt: timestamp,
            points,
            sampledPoints,
            weatherData,
            weatherFetchedAt: timestamp
          };
        })
      );

      setTracks(newTracks);
      saveTracks(newTracks);

      // Select the first track
      if (newTracks.length > 0) {
        setSelectedTrack(newTracks[0]);
        setActiveTab("profile");
      }

      // Zoom to all tracks
      if (map.current) {
        const allPoints = newTracks.flatMap(track => track.points);
        if (allPoints.length) {
          const bounds = calculateBounds(allPoints);
          map.current.fitBounds(
            [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
            { padding: 50, duration: 2000 }
          );
        }
      }
    } catch (error) {
      console.error('Error loading demo data:', error);
    } finally {
      setLoading(false);
      setShowDemoDialog(false);
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background text-foreground">
        <AlertDialog open={showDemoDialog} onOpenChange={setShowDemoDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Welcome to TrailCast!</AlertDialogTitle>
              <AlertDialogDescription>
                Would you like to load a set of demo GPX tracks from the Canary Islands to explore the app's features?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No, thanks</AlertDialogCancel>
              <AlertDialogAction onClick={loadDemoData}>Load Demo Data</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="fixed top-4 left-4 right-4 z-10 flex gap-2">
          <Button
            variant="secondary"
            className="relative overflow-hidden md:flex hidden"
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
            className="relative overflow-hidden md:hidden flex"
            disabled={loading}
          >
            <input
              type="file"
              multiple
              accept=".gpx"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || !tracks.length}
            className="md:flex hidden"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || !tracks.length}
            className="md:hidden flex"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="secondary"
            onClick={handleClear}
            disabled={loading || !tracks.length}
            className="md:flex hidden"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button
            variant="secondary"
            onClick={handleClear}
            disabled={loading || !tracks.length}
            className="md:hidden flex"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          
          {/* Zoom to all tracks button */}
          <Button
            variant="secondary"
            onClick={() => {
              if (map.current && tracks.length > 0) {
                const allPoints = tracks.flatMap(track => track.points);
                if (allPoints.length) {
                  const bounds = calculateBounds(allPoints);
                  map.current.fitBounds(
                    [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
                    { padding: 50, duration: 1000 }
                  );
                }
              }
            }}
            disabled={loading || !tracks.length}
            className="md:flex hidden"
          >
            <ZoomIn className="w-4 h-4 mr-2" />
            Zoom All
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => {
              if (map.current && tracks.length > 0) {
                const allPoints = tracks.flatMap(track => track.points);
                if (allPoints.length) {
                  const bounds = calculateBounds(allPoints);
                  map.current.fitBounds(
                    [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
                    { padding: 50, duration: 1000 }
                  );
                }
              }
            }}
            disabled={loading || !tracks.length}
            className="md:hidden flex"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          
          <div className="ml-auto flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
            <Cloud className="w-4 h-4" />
            <span className="text-sm font-medium md:inline hidden">
              {tracks.length} track{tracks.length !== 1 ? 's' : ''} loaded
            </span>
            <span className="text-sm font-medium md:hidden inline">
              {tracks.length}
            </span>
          </div>
        </div>
        
        <div
          ref={mapContainer}
          className={`w-full ${panelOpen ? 'h-[calc(100vh-350px)]' : 'h-screen'}`}
        />
        
        {/* Bottom panel with tabs */}
        <Collapsible 
          open={panelOpen} 
          onOpenChange={setPanelOpen} 
          className="fixed bottom-0 left-0 right-0 z-10"
        >
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute -top-8 right-4 bg-background border border-t border-x z-10"
            >
              {panelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="bg-background h-[350px] border-t">
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="px-4 h-full flex flex-col"
            >
            <div className="flex justify-between items-center mb-2 mt-2">
              <TabsList className="justify-start">
                <TabsTrigger value="profile" className="flex items-center gap-1">
                  <BarChart2 className="w-4 h-4" />
                  <span className="md:inline hidden">Profile</span>
                </TabsTrigger>
                <TabsTrigger value="tracks" className="flex items-center gap-1">
                  <List className="w-4 h-4" />
                  <span className="md:inline hidden">Tracks</span>
                  {tracks.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {tracks.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-1">
                  <SettingsIcon className="w-4 h-4" />
                  <span className="md:inline hidden">Settings</span>
                </TabsTrigger>
                <TabsTrigger value="about" className="flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  <span className="md:inline hidden">About</span>
                </TabsTrigger>
              </TabsList>
              
              {tracks.length > 0 && selectedTrack?.weatherData && (
                <div className="text-xs text-muted-foreground mr-2">
                  Weather data from: {new Date(selectedTrack.weatherFetchedAt || Date.now()).toLocaleDateString()}
                </div>
              )}
            </div>
            
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

              <TabsContent value="settings" className="m-0 h-full">
                <SettingsSection settings={settings} onChange={setSettings} />
              </TabsContent>

              <TabsContent value="about" className="m-0 h-full">
                <AboutSection />
              </TabsContent>
            </div>
          </Tabs>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ThemeProvider>
  );
}

export default App;
