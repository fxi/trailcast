import { Card } from "@/components/ui/card";
import { UserSettings } from "@/types";

interface SettingsSectionProps {
  settings: UserSettings;
  onChange: (s: UserSettings) => void;
}

export function SettingsSection({}: SettingsSectionProps) {
  return (
    <Card className="p-4 text-sm text-muted-foreground">No settings available</Card>
  );
}
