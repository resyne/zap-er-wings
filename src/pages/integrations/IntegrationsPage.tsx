import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";

export default function IntegrationsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Integrazioni</h1>
        <p className="text-muted-foreground">
          Gestisci le integrazioni esterne e i servizi collegati
        </p>
      </div>
      
      <IntegrationsSettings />
    </div>
  );
}