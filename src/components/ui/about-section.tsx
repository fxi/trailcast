import { Card } from "@/components/ui/card";

export function AboutSection() {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">About GPX Weather Explorer</h2>
      </div>
      
      <div className="text-sm space-y-3 h-[170px] overflow-y-auto">
        <p>
          GPX Weather Explorer is an interactive tool for visualizing GPS tracks with integrated
          weather data. Upload GPX files to explore your routes on a topographic map.
        </p>
        
        <h3 className="font-medium mt-3">Features:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Upload and visualize GPX tracks on interactive maps</li>
          <li>Automatically fetch weather data for key points along your route</li>
          <li>View elevation profiles with interactive cursor</li>
          <li>Store your tracks locally for easy access</li>
          <li>Weather data is cached for 12 hours to minimize API calls</li>
        </ul>
        
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          <p>
            Maps powered by <a href="https://maptiler.com/" className="underline" target="_blank" rel="noopener noreferrer">MapTiler</a> 
            and <a href="https://maplibre.org/" className="underline" target="_blank" rel="noopener noreferrer">MapLibre GL</a>. 
            Weather data from <a href="https://open-meteo.com/" className="underline" target="_blank" rel="noopener noreferrer">Open-Meteo</a>.
          </p>
          <p className="mt-1">
            © {new Date().getFullYear()} GPX Weather Explorer
          </p>
        </div>
      </div>
    </Card>
  );
}