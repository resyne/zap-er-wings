import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";

export default function SalesInvoicesPage() {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-4 sm:container sm:mx-auto sm:py-6 space-y-6 max-w-[1600px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Fatture di Vendita</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestione fatture emesse ai clienti
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuova Fattura
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <CardTitle className="text-lg mb-2">Nessuna fattura di vendita</CardTitle>
          <CardDescription>
            Le fatture di vendita verranno mostrate qui. Potrai collegare giustificativi operativi a ogni fattura.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
