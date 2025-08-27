import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CrmPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CRM Dashboard</h1>
        <p className="text-muted-foreground">
          Gestisci le relazioni con i clienti tramite Bigin CRM
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bigin CRM</CardTitle>
          <CardDescription>
            Sistema completo di gestione clienti e opportunità
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            src="https://bigin.zoho.eu/"
            className="w-full h-[800px] border-0 rounded-b-lg"
            title="Bigin CRM"
            allow="fullscreen"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CrmPage;