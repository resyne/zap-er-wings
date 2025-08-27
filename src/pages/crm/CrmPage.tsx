import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Users, Target, Building2, FileText } from "lucide-react";

const CrmPage = () => {
  const handleOpenBigin = () => {
    window.open('https://bigin.zoho.eu/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CRM Dashboard</h1>
        <p className="text-muted-foreground">
          Gestisci le relazioni con i clienti tramite Bigin CRM
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bigin CRM
            </CardTitle>
            <CardDescription>
              Accedi al sistema completo di gestione clienti e opportunità
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bigin CRM di Zoho offre strumenti avanzati per la gestione dei lead, 
              opportunità, contatti e pipeline di vendita.
            </p>
            <Button onClick={handleOpenBigin} className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Apri Bigin CRM
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Funzionalità Integrate
            </CardTitle>
            <CardDescription>
              Gestisci direttamente da questa piattaforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span>Gestione Clienti</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>Ordini di Vendita</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>Database Clienti Unificato</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nota sulla Connessione</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Per motivi di sicurezza, Zoho Bigin non permette l'integrazione diretta in iframe. 
            Utilizza il pulsante qui sopra per accedere al CRM in una nuova scheda del browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrmPage;