import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, ExternalLink } from "lucide-react";

export default function TicketRestaurantPage() {
  const handleOpenPortal = () => {
    window.open("https://acquista.edenred.it/ticketrestaurant/eshop?icmp=cta_header#/scegli-tipologia", "_blank", "noopener,noreferrer");
  };

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
        <CardContent className="space-y-6">
          <div className="text-center">
            <Button 
              onClick={handleOpenPortal}
              size="lg"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-5 w-5" />
              Apri Portale TicketXTE
            </Button>
          </div>
          
          <div className="p-4 bg-muted/50 rounded-lg">
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