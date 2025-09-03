import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Calendar } from "lucide-react";

const ManagementControlPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Controllo di Gestione</h1>
        <p className="text-muted-foreground">
          Dashboard CEO - Panoramica economico-finanziaria
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ricavi Mese</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€ 125.400</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12% vs mese precedente
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margine Lordo</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +2% vs target
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EBITDA</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€ 28.500</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 flex items-center">
                <TrendingDown className="h-3 w-3 mr-1" />
                -5% vs budget
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Disponibile</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€ 85.200</div>
            <p className="text-xs text-muted-foreground">
              Liquidità aziendale
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ricavi per Modello (Ultimi 3 Mesi)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Modello A</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                  <span className="text-sm">€ 45k</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Modello B</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                  <span className="text-sm">€ 36k</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Modello C</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '40%' }}></div>
                  </div>
                  <span className="text-sm">€ 24k</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aging Crediti vs Debiti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Crediti 0-30gg</span>
                  <span>€ 45.000</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Crediti 31-60gg</span>
                  <span>€ 18.000</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Crediti &gt;90gg</span>
                  <span>€ 12.000</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: '15%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commesse e Service Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Commesse (Margine)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { code: "PRJ-001", customer: "Cliente A", margin: 25.5, status: "active" },
                { code: "PRJ-005", customer: "Cliente B", margin: 22.8, status: "active" },
                { code: "PRJ-012", customer: "Cliente C", margin: 18.2, status: "completed" },
                { code: "PRJ-008", customer: "Cliente D", margin: 15.1, status: "active" },
                { code: "PRJ-003", customer: "Cliente E", margin: 12.9, status: "active" },
              ].map((project) => (
                <div key={project.code} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{project.code}</span>
                      <Badge variant={project.status === "active" ? "default" : "secondary"}>
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{project.customer}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">+{project.margin}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service & Manutenzione</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Contratti Attivi</span>
                </div>
                <span className="font-medium">48</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Ricavi Ricorrenti</span>
                </div>
                <span className="font-medium">€ 12.400/mese</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Rinnovi prossimi 60gg</span>
                </div>
                <span className="font-medium text-orange-600">7</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span>Alert & Scostamenti</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Crediti scaduti &gt;90gg</p>
                <p className="text-sm text-red-600 dark:text-red-300">€ 12.000 da Cliente XYZ</p>
              </div>
              <Badge variant="destructive">Critico</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">Scostamento Budget OPEX</p>
                <p className="text-sm text-orange-600 dark:text-orange-300">+15% rispetto al budget mensile</p>
              </div>
              <Badge variant="secondary">Warning</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Righe senza Centro di Costo</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-300">5 fatture fornitori non allocate</p>
              </div>
              <Badge variant="outline">Info</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagementControlPage;