
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Wrench, Users, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export default function SupportPage() {
  const supportSections = [
    {
      title: "Rapporti di Intervento",
      description: "Crea e gestisci rapporti di intervento tecnico con firme digitali",
      icon: FileText,
      href: "/support/service-reports",
      color: "text-blue-600"
    },
    {
      title: "Gestione Tecnici",
      description: "Gestisci il team di tecnici e le loro competenze",
      icon: Users,
      href: "/support/technicians",
      color: "text-green-600"
    },
    {
      title: "Attrezzature",
      description: "Gestisci strumenti e attrezzature per gli interventi",
      icon: Wrench,
      href: "/support/equipment",
      color: "text-orange-600"
    },
    {
      title: "Impostazioni",
      description: "Configurazioni per l'assistenza tecnica",
      icon: Settings,
      href: "/support/settings",
      color: "text-purple-600"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Assistenza Tecnica</h1>
        <p className="text-muted-foreground">
          Gestisci tutti gli aspetti dell'assistenza tecnica e degli interventi
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {supportSections.map((section) => (
          <Link key={section.href} to={section.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-border hover:border-primary/20">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <section.icon className={`w-8 h-8 ${section.color}`} />
                </div>
                <CardTitle className="text-lg text-card-foreground">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-center">
                  {section.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
