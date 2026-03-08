import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings, Save } from "lucide-react";
import { toast } from "sonner";

interface Setting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
}

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("hr_attendance_settings").select("*").order("setting_key");
    setSettings((data || []) as unknown as Setting[]);
    setLoading(false);
  };

  const updateSetting = async (key: string, value: any) => {
    await supabase.from("hr_attendance_settings").update({ setting_value: value } as any).eq("setting_key", key);
    toast.success("Impostazione aggiornata");
    fetchSettings();
  };

  const getSetting = (key: string) => settings.find((s) => s.setting_key === key);

  const overtimeThreshold = getSetting("overtime_threshold_daily");
  const nightStart = getSetting("night_overtime_start");
  const nightEnd = getSetting("night_overtime_end");
  const mandatoryBreak = getSetting("mandatory_break_threshold");
  const longBreak = getSetting("anomaly_long_break_minutes");
  const gpsRequired = getSetting("gps_required");
  const selfieRequired = getSetting("selfie_required");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" />Impostazioni Presenze</h1>
        <p className="text-muted-foreground">Configura regole HR e policy aziendali</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overtime Settings */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Straordinari</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {overtimeThreshold && (
              <div>
                <Label>Soglia giornaliera (minuti)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    defaultValue={overtimeThreshold.setting_value.minutes}
                    onBlur={(e) => updateSetting("overtime_threshold_daily", { minutes: parseInt(e.target.value) || 480 })}
                  />
                  <span className="text-sm text-muted-foreground self-center">= {Math.floor((overtimeThreshold.setting_value.minutes || 480) / 60)}h</span>
                </div>
              </div>
            )}
            {nightStart && (
              <div>
                <Label>Inizio notturno</Label>
                <Input
                  type="time"
                  defaultValue={nightStart.setting_value.time}
                  onBlur={(e) => updateSetting("night_overtime_start", { time: e.target.value })}
                />
              </div>
            )}
            {nightEnd && (
              <div>
                <Label>Fine notturno</Label>
                <Input
                  type="time"
                  defaultValue={nightEnd.setting_value.time}
                  onBlur={(e) => updateSetting("night_overtime_end", { time: e.target.value })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Break Settings */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Pause</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mandatoryBreak && (
              <>
                <div>
                  <Label>Pausa obbligatoria dopo (minuti di lavoro)</Label>
                  <Input
                    type="number"
                    defaultValue={mandatoryBreak.setting_value.work_minutes}
                    onBlur={(e) => updateSetting("mandatory_break_threshold", { ...mandatoryBreak.setting_value, work_minutes: parseInt(e.target.value) || 360 })}
                  />
                </div>
                <div>
                  <Label>Durata pausa obbligatoria (minuti)</Label>
                  <Input
                    type="number"
                    defaultValue={mandatoryBreak.setting_value.break_minutes}
                    onBlur={(e) => updateSetting("mandatory_break_threshold", { ...mandatoryBreak.setting_value, break_minutes: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </>
            )}
            {longBreak && (
              <div>
                <Label>Anomalia pausa lunga (minuti)</Label>
                <Input
                  type="number"
                  defaultValue={longBreak.setting_value.minutes}
                  onBlur={(e) => updateSetting("anomaly_long_break_minutes", { minutes: parseInt(e.target.value) || 90 })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Sicurezza & Anti-frode</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {gpsRequired && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>GPS obbligatorio</Label>
                  <p className="text-xs text-muted-foreground">Richiedi posizione GPS per ogni timbratura</p>
                </div>
                <Switch
                  checked={gpsRequired.setting_value.enabled}
                  onCheckedChange={(v) => updateSetting("gps_required", { enabled: v })}
                />
              </div>
            )}
            {selfieRequired && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Selfie obbligatorio</Label>
                  <p className="text-xs text-muted-foreground">Richiedi foto selfie per la timbratura</p>
                </div>
                <Switch
                  checked={selfieRequired.setting_value.enabled}
                  onCheckedChange={(v) => updateSetting("selfie_required", { enabled: v })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
