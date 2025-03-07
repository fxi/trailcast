import { useState } from "react";
import { ProcessedTrack } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Trash2, MapIcon, Clock, Download, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateDistance } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
// Download feature will be implemented later
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
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Toggle selection for a track
  const toggleTrackSelection = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setSelectedTracks(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(trackId)) {
        newSelection.delete(trackId);
      } else {
        newSelection.add(trackId);
      }
      return newSelection;
    });
  };
  
  // Select or deselect all tracks
  const toggleSelectAll = () => {
    if (selectedTracks.size === tracks.length) {
      // If all are selected, clear selection
      setSelectedTracks(new Set());
    } else {
      // Otherwise select all
      setSelectedTracks(new Set(tracks.map(track => track.id)));
    }
  };
  
  // Handle delete action
  const handleDelete = () => {
    if (selectedTracks.size > 0) {
      setShowDeleteConfirm(true);
    }
  };
  
  // Confirm deletion of selected tracks
  const confirmDelete = () => {
    // Convert Set to Array and send all track IDs at once
    const trackIdsToDelete = Array.from(selectedTracks);
    onDeleteTrack(trackIdsToDelete);
    setSelectedTracks(new Set());
    setShowDeleteConfirm(false);
  };
  
  // Placeholder for the download feature
  const handleDownload = () => {
    alert("Export feature will be available in a future update. Stay tuned!");
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
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Your Tracks</h2>
          <Badge variant="outline">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </Badge>
          
          {selectedTracks.size > 0 && (
            <Badge variant="secondary" className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-1" />
              {selectedTracks.size} selected
            </Badge>
          )}
        </div>
        
        {/* Control buttons - always visible but disabled when no selection */}
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={handleDelete}
            disabled={selectedTracks.size === 0}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete selected</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={selectedTracks.size === 0}
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Download selected</span>
          </Button>
        </div>
      </div>
      
      {/* Track selection controls */}
      <div className="flex items-center mb-2 text-xs">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="select-all" 
            checked={selectedTracks.size === tracks.length && tracks.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <label htmlFor="select-all" className="cursor-pointer">
            {selectedTracks.size === tracks.length && tracks.length > 0 
              ? "Deselect all" 
              : "Select all"}
          </label>
        </div>
      </div>
      
      <ScrollArea className="h-[150px]">
        <div className="space-y-2">
          {tracks.map(track => {
            const isActiveTrack = selectedTrackId === track.id;
            const isChecked = selectedTracks.has(track.id);
            
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
                className={`p-3 border rounded-md hover:bg-accent transition-colors ${
                  isActiveTrack ? 'bg-accent border-primary' : ''
                } ${isChecked ? 'border-primary' : ''}`}
              >
                <div className="flex gap-3">
                  <Checkbox 
                    checked={isChecked}
                    onCheckedChange={() => 
                      setSelectedTracks(prev => {
                        const newSelection = new Set(prev);
                        if (newSelection.has(track.id)) {
                          newSelection.delete(track.id);
                        } else {
                          newSelection.add(track.id);
                        }
                        return newSelection;
                      })
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <div className="flex-1 cursor-pointer" onClick={() => onSelectTrack(track.id)}>
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
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTracks.size} tracks?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected {selectedTracks.size === 1 ? 'track' : 'tracks'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}