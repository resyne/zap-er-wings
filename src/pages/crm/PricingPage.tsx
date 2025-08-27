import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pricing</h1>
        <p className="text-muted-foreground">Gestisci i prezzi e le strategie di pricing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Piano Base
              <Badge variant="outline">Popolare</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">€29<span className="text-lg text-muted-foreground">/mese</span></div>
            <ul className="space-y-2 text-sm">
              <li>• Fino a 100 contatti</li>
              <li>• 5 GB di storage</li>
              <li>• Email support</li>
              <li>• Dashboard base</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Piano Professional
              <Badge variant="default">Consigliato</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">€79<span className="text-lg text-muted-foreground">/mese</span></div>
            <ul className="space-y-2 text-sm">
              <li>• Contatti illimitati</li>
              <li>• 50 GB di storage</li>
              <li>• Support prioritario</li>
              <li>• Analytics avanzate</li>
              
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Piano Enterprise
              <Badge variant="secondary">Custom</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">€199<span className="text-lg text-muted-foreground">/mese</span></div>
            <ul className="space-y-2 text-sm">
              <li>• Tutto del Professional</li>
              <li>• Storage illimitato</li>
              <li>• Support 24/7</li>
              <li>• API personalizzate</li>
              <li>• Training dedicato</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Mensile</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€12,450</div>
            <p className="text-xs text-muted-foreground">+15% rispetto al mese scorso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abbonamenti Attivi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">145</div>
            <p className="text-xs text-muted-foreground">+8 nuovi questo mese</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Crescita</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+23%</div>
            <p className="text-xs text-muted-foreground">MRR growth rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.1%</div>
            <p className="text-xs text-muted-foreground">-0.5% vs mese scorso</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}