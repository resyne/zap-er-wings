import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, Euro, Car, Loader2 } from "lucide-react";

interface Setting {
  id: string;
  setting_key: string;
  setting_value: number;
  description: string | null;
}

const settingLabels: Record<string, { label: string; icon: React.ElementType; suffix: string }> = {
  specialized_technician_hourly_rate: { label: "Tariffa oraria tecnico (Antonio/Stefano)", icon: Euro, suffix: "€/ora" },
  head_technician_hourly_rate: { label: "Tariffa oraria capo tecnico (Pasquale)", icon: Euro, suffix: "€/ora" },
  specialized_technician_km_rate: { label: "Rimborso km tecnico (Antonio/Stefano)", icon: Car, suffix: "€/km" },
  head_technician_km_rate: { label: "Rimborso km capo tecnico (Pasquale)", icon: Car, suffix: "€/km" },
};

export default function ServiceReportSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("service_report_settings")
        .select("*")
        .order("setting_key");

      if (error) throw error;
      setSettings(data || []);
      const values: Record<string, number> = {};
      (data || []).forEach(s => { values[s.setting_key] = s.setting_value; });
      setEditedValues(values);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({ title: "Errore", description: "Impossibile caricare le impostazioni", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const setting of settings) {
        const newValue = editedValues[setting.setting_key];
        if (newValue !== setting.setting_value) {
          const { error } = await supabase
            .from("service_report_settings")
            .update({ setting_value: newValue })
            .eq("id", setting.id);
          if (error) throw error;
        }
      }
      toast({ title: "Successo", description: "Impostazioni salvate correttamente" });
      loadSettings();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Errore", description: "Impossibile salvare le impostazioni", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings.some(s => editedValues[s.setting_key] !== s.setting_value);

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Impostazioni Rapporti di Intervento</h1>
        <p className="text-muted-foreground">
          Configura tariffe orarie, rimborsi chilometrici e altri parametri di fatturazione
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tariffe e Rimborsi
          </CardTitle>
          <CardDescription>
            Questi valori vengono utilizzati per il calcolo automatico degli importi nei rapporti di intervento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tariffe orarie */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Tariffe Orarie
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings
                .filter(s => s.setting_key.includes("hourly"))
                .map(s => {
                  const meta = settingLabels[s.setting_key] || { label: s.setting_key, icon: Euro, suffix: "€" };
                  return (
                    <div key={s.id} className="space-y-1.5">
                      <Label className="text-sm">{meta.label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editedValues[s.setting_key] ?? s.setting_value}
                          onChange={e => setEditedValues(prev => ({ ...prev, [s.setting_key]: parseFloat(e.target.value) || 0 }))}
                          className="pr-16"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{meta.suffix}</span>
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Rimborsi km */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Car className="h-4 w-4" />
              Rimborsi Chilometrici
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings
                .filter(s => s.setting_key.includes("km"))
                .map(s => {
                  const meta = settingLabels[s.setting_key] || { label: s.setting_key, icon: Car, suffix: "€/km" };
                  return (
                    <div key={s.id} className="space-y-1.5">
                      <Label className="text-sm">{meta.label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editedValues[s.setting_key] ?? s.setting_value}
                          onChange={e => setEditedValues(prev => ({ ...prev, [s.setting_key]: parseFloat(e.target.value) || 0 }))}
                          className="pr-16"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{meta.suffix}</span>
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">ℹ️ Come vengono usate queste impostazioni</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Le tariffe orarie vengono moltiplicate per le ore effettive di intervento (escluso il tragitto)</li>
              <li>I rimborsi km vengono calcolati in base ai chilometri percorsi indicati nel rapporto</li>
              <li>Le tariffe di Antonio e Stefano usano la tariffa "tecnico", Pasquale usa la tariffa "capo tecnico"</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salva Impostazioni
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
