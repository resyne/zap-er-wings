import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ShieldCheck, BookOpen, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

export default function DocumentationPage() {
  const documentationSections = [
    {
      title: "Schede Tecniche",
      description: "Documentazione tecnica per forni e abbattitori",
      icon: FileText,
      href: "/docs/technical-sheets",
      color: "text-blue-600"
    },
    {
      title: "Dichiarazioni di Conformità",
      description: "Certificazioni e dichiarazioni di conformità",
      icon: ShieldCheck,
      href: "/docs/compliance",
      color: "text-green-600"
    },
    {
      title: "Manuali Uso e Manutenzione",
      description: "Manuali operativi e di manutenzione",
      icon: BookOpen,
      href: "/docs/manuals",
      color: "text-purple-600"
    },
    {
      title: "Listini",
      description: "Listini prezzi e cataloghi",
      icon: DollarSign,
      href: "/docs/price-lists",
      color: "text-orange-600"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Documentazione</h1>
        <p className="text-muted-foreground">
          Accesso centralizzato a tutta la documentazione tecnica e commerciale
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {documentationSections.map((section) => (
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