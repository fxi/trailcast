import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        <Input
          type="datetime-local"
          value={settings.weatherStart.slice(0,16)}
          onChange={(e) =>
            onChange({ ...settings, weatherStart: e.target.value })
          }
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
    </Card>
  );
}
