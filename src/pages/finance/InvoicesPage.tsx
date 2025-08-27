import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const InvoicesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fatture</h1>
        <p className="text-muted-foreground">
          Gestisci le tue fatture tramite Fattura24
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fattura24</CardTitle>
          <CardDescription>
            Gestione completa delle fatture elettroniche
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            src="https://www.fattura24.com/v3/"
            className="w-full h-[800px] border-0 rounded-b-lg"
            title="Fattura24"
            allow="fullscreen"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesPage;