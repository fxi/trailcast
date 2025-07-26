import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarTimePicker } from "@/components/ui/calendar-time-picker";
import { UserSettings } from "@/types";

interface SettingsSectionProps {
  settings: UserSettings;
  onChange: (s: UserSettings) => void;
}

export function SettingsSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <Card className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Start date &amp; time</label>
        <CalendarTimePicker
          value={settings.weatherStart}
          onChange={(v) => onChange({ ...settings, weatherStart: v })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Average speed (km/h)</label>
        <Input
          type="number"
          value={settings.averageSpeed}
          min={1}
          onChange={(e) =>
            onChange({ ...settings, averageSpeed: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Hourly margin (h)</label>
        <Input
          type="number"
          min={2}
          value={settings.hourlyMargin}
          onChange={(e) =>
            onChange({ ...settings, hourlyMargin: Math.max(2, parseInt(e.target.value) || 0) })
          }
        />
      </div>
    </Card>
  );
}
