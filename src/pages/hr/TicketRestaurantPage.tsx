import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed } from "lucide-react";

export default function TicketRestaurantPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <UtensilsCrossed className="h-8 w-8" />
          Ticket Restaurant
        </h1>
        <p className="text-muted-foreground">
          Gestione buoni pasto - Accesso al portale TicketXTE
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portale TicketXTE</CardTitle>
          <CardDescription>
            Accesso al sistema di gestione ticket restaurant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[800px] rounded-lg border bg-muted/50">
            <iframe
              src="https://clienti.ticketxte.com"
              className="w-full h-full rounded-lg"
              title="TicketXTE Portal"
              sandbox="allow-same-origin allow-scripts allow-forms allow-top-navigation"
            />
          </div>
          
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Credenziali di accesso:</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><strong>Username:</strong> elefantes</p>
              <p><strong>Circuito:</strong> c7EX5</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}