import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { UserSettings } from "@/types";

interface SettingsSectionProps {
  settings: UserSettings;
  onChange: (s: UserSettings) => void;
}

export function SettingsSection({ settings, onChange }: SettingsSectionProps) {
  const from = new Date();
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setDate(to.getDate() + 7);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col gap-2">
        <Label className="px-1">Forecast Date</Label>
        <DatePicker
          value={settings.forecastDate}
          onChange={(d) => onChange({ ...settings, forecastDate: d })}
          minDate={from}
          maxDate={to}
        />
      </div>
    </Card>
  );
}
