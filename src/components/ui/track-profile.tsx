import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Card } from "@/components/ui/card";
import { GpxPoint, ProcessedTrack } from "@/types";

interface TrackProfileProps {
  track: ProcessedTrack | null;
  onCursorChange?: (point: GpxPoint | null) => void;
}

export function TrackProfile({ track, onCursorChange }: TrackProfileProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<Array<{distance: number; elevation: number; original: GpxPoint}>>([]);
  const [currentElevation, setCurrentElevation] = useState<number | null>(null);
  
  useEffect(() => {
    if (!track) {
      setProfileData([]);
      setCurrentElevation(null);
      return;
    }
    
    // Prepare data for chart with distance and elevation
    const data = track.points.map(point => ({
      distance: point.distance ?? 0,
      elevation: point.ele ?? 0,
      original: point
    }));
    
    setProfileData(data);
  }, [track]);

  const handleMouseMove = (data: any) => {
    if (data.activeTooltipIndex !== undefined) {
      setActivePointIndex(data.activeTooltipIndex);
      
      if (profileData[data.activeTooltipIndex]) {
        setCurrentElevation(profileData[data.activeTooltipIndex].elevation);
        
        if (onCursorChange) {
          onCursorChange(profileData[data.activeTooltipIndex].original);
        }
      }
    }
  };

  const handleMouseLeave = () => {
    setActivePointIndex(null);
    setCurrentElevation(null);
    if (onCursorChange) {
      onCursorChange(null);
    }
  };

  if (!track || profileData.length === 0) {
    return (
      <Card className="h-[210px] flex items-center justify-center text-sm text-muted-foreground">
        Select a track to view elevation profile
      </Card>
    );
  }

  const minElevation = Math.min(...profileData.map(d => d.elevation));
  const maxElevation = Math.max(...profileData.map(d => d.elevation));
  const totalDistance = profileData.length > 0 ? profileData[profileData.length - 1].distance : 0;

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Elevation Profile</h2>
        <div className="text-sm text-muted-foreground">
          <span className="mr-4">Distance: {totalDistance.toFixed(1)} km</span>
          <span>Elevation gain: {(maxElevation - minElevation).toFixed(0)} m</span>
          {currentElevation !== null && (
            <span className="ml-4">Current: {currentElevation.toFixed(0)} m</span>
          )}
        </div>
      </div>
      
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={profileData}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="distance" 
              tickFormatter={(value) => value.toFixed(1)}
            />
            <YAxis 
              domain={[minElevation * 0.9, maxElevation * 1.1]}
              tickFormatter={(value) => value.toFixed(0)}
            />
            <Area 
              type="monotone" 
              dataKey="elevation" 
              stroke="#8884d8" 
              fill="#8884d8" 
              fillOpacity={0.6}
              activeDot={{ 
                r: 6, 
                fill: '#ff0000',
                strokeWidth: 2,
                stroke: '#ffffff'
              }}
            />
            {activePointIndex !== null && (
              <CartesianGrid 
                verticalPoints={[profileData[activePointIndex].distance]} 
                stroke="#ff0000" 
                strokeDasharray="3 3" 
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}