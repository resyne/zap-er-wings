import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import ZapierIntegration from "@/components/leads/ZapierIntegration";

export function IntegrationsSettings() {
  return (
    <div className="space-y-6">
      {/* Zapier Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Integrazione Zapier
          </CardTitle>
          <CardDescription>
            Configura l'integrazione con Zapier per automatizzare i flussi di lavoro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZapierIntegration />
        </CardContent>
      </Card>
    </div>
  );
}