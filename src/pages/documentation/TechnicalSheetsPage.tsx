import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, Snowflake } from "lucide-react";
import { Link } from "react-router-dom";

export default function TechnicalSheetsPage() {
  const categories = [
    {
      title: "Forni",
      description: "Schede tecniche per forni professionali",
      icon: ChefHat,
      href: "/docs/technical-sheets/ovens",
      color: "text-red-600"
    },
    {
      title: "Abbattitori",
      description: "Schede tecniche per abbattitori di temperatura",
      icon: Snowflake,
      href: "/docs/technical-sheets/blast-chillers",
      color: "text-blue-600"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Schede Tecniche</h1>
        <p className="text-muted-foreground">
          Documentazione tecnica dettagliata per tutti i prodotti
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((category) => (
          <Link key={category.href} to={category.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-border hover:border-primary/20">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <category.icon className={`w-10 h-10 ${category.color}`} />
                </div>
                <CardTitle className="text-xl text-card-foreground">{category.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-center">
                  {category.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}