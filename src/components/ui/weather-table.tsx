import { useRef } from 'react';
import { ProcessedTrack } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Button } from './button';
import { toPng } from 'html-to-image';

interface WeatherTableProps {
  track: ProcessedTrack | null;
}

export function WeatherTable({ track }: WeatherTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  const exportPng = async () => {
    if (!tableRef.current) return;
    const dataUrl = await toPng(tableRef.current);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'weather.png';
    link.click();
  };

  if (!track || !track.weatherData || !track.sampledPoints) {
    return (
      <div className="p-4 text-sm text-muted-foreground">No weather data available.</div>
    );
  }

  const arrow = (deg: number) => {
    const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
    const idx = Math.round(deg / 45) % 8;
    return arrows[idx];
  };

  return (
    <div className="p-4 space-y-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={exportPng}>Export PNG</Button>
      </div>
      <div ref={tableRef} className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Temp&nbsp;°C</TableHead>
              <TableHead>Wind</TableHead>
              <TableHead>Rain&nbsp;mm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {track.weatherData.map((w, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>{`${w.apparent_temperature_min.toFixed(0)}-${w.apparent_temperature_max.toFixed(0)}`}</TableCell>
                <TableCell>{`${w.wind_speed_10m_max.toFixed(0)} km/h ${arrow(w.wind_direction_10m_dominant)}`}</TableCell>
                <TableCell>{w.rain_sum.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
