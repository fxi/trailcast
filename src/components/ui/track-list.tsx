import { useState } from "react";
import { ProcessedTrack } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Trash2, MapIcon, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateDistance } from "@/lib/utils";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TrackListProps {
  tracks: ProcessedTrack[];
  selectedTrackId?: string;
  onSelectTrack: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
}

export function TrackList({ 
  tracks, 
  selectedTrackId, 
  onSelectTrack, 
  onDeleteTrack 
}: TrackListProps) {
  const [trackToDelete, setTrackToDelete] = useState<string | null>(null);

  const handleDeleteClick = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTrackToDelete(trackId);
  };

  const confirmDelete = () => {
    if (trackToDelete) {
      onDeleteTrack(trackToDelete);
      setTrackToDelete(null);
    }
  };

  if (tracks.length === 0) {
    return (
      <Card className="h-[210px] flex flex-col items-center justify-center text-sm text-muted-foreground">
        <MapIcon className="h-12 w-12 mb-2 text-muted-foreground/50" />
        <p>No tracks loaded yet</p>
        <p className="text-xs mt-2">Upload GPX files to see your tracks here</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Your Tracks</h2>
        <Badge variant="outline">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      <ScrollArea className="h-[170px]">
        <div className="space-y-2">
          {tracks.map(track => {
            const isSelected = selectedTrackId === track.id;
            // Get distance from last point or calculate it from all points
            let distance = "?";
            if (track.points.length > 0) {
              const lastPoint = track.points[track.points.length - 1];
              if (lastPoint.distance) {
                distance = lastPoint.distance.toFixed(1);
              } else if (track.points.length > 1) {
                // Calculate total distance if not already available
                let totalDist = 0;
                for (let i = 1; i < track.points.length; i++) {
                  const prevPoint = track.points[i - 1];
                  const currPoint = track.points[i];
                  totalDist += calculateDistance(prevPoint.lat, prevPoint.lon, currPoint.lat, currPoint.lon);
                }
                distance = totalDist.toFixed(1);
              }
            }
            
            // Calculate min and max elevation
            const elevations = track.points.map(p => p.ele || 0).filter(e => e > 0);
            const minEle = elevations.length ? Math.min(...elevations) : 0;
            const maxEle = elevations.length ? Math.max(...elevations) : 0;
            const elevationGain = maxEle - minEle;
            
            return (
              <div 
                key={track.id}
                className={`p-3 border rounded-md cursor-pointer hover:bg-accent transition-colors ${
                  isSelected ? 'bg-accent border-primary' : ''
                }`}
                onClick={() => onSelectTrack(track.id)}
              >
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-medium">
                      {track.name || `Track ${tracks.findIndex(t => t.id === track.id) + 1}`}
                    </h3>
                    <div className="flex text-xs text-muted-foreground mt-1 space-x-3">
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" /> {distance} km
                      </span>
                      {elevations.length > 0 && (
                        <span className="flex items-center">
                          <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 18L12 14L16 18" />
                            <path d="M8 10L12 6L16 10" />
                          </svg>
                          {elevationGain.toFixed(0)} m
                        </span>
                      )}
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {track.createdAt ? formatDistanceToNow(new Date(track.createdAt), { addSuffix: true }) : 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <AlertDialog open={trackToDelete === track.id} onOpenChange={() => setTrackToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={(e) => handleDeleteClick(track.id, e)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the track.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}