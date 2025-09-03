import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

const ProjectsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const projects = [
    {
      id: "1",
      code: "PRJ-001",
      customerName: "Cliente A SpA",
      machineModel: "Modello A",
      projectType: "machine",
      status: "active",
      startDate: "2024-01-15",
      estimatedRevenue: 45000,
      actualRevenue: 35000,
      estimatedCosts: 30000,
      actualCosts: 28000,
      margin: 25.0,
    },
    {
      id: "2", 
      code: "PRJ-005",
      customerName: "Cliente B Srl",
      machineModel: "Modello B",
      projectType: "installation",
      status: "active",
      startDate: "2024-02-01",
      estimatedRevenue: 28000,
      actualRevenue: 28000,
      estimatedCosts: 22000,
      actualCosts: 21600,
      margin: 22.8,
    },
    {
      id: "3",
      code: "PRJ-012",
      customerName: "Cliente C Ltd",
      machineModel: "Modello C",
      projectType: "service",
      status: "completed",
      startDate: "2024-01-10",
      estimatedRevenue: 15000,
      actualRevenue: 16500,
      estimatedCosts: 13500,
      actualCosts: 13500,
      margin: 18.2,
    },
    {
      id: "4",
      code: "PRJ-008",
      customerName: "Cliente D SA",
      machineModel: "Modello A",
      projectType: "machine",
      status: "active",
      startDate: "2024-03-01",
      estimatedRevenue: 50000,
      actualRevenue: 25000,
      estimatedCosts: 35000,
      actualCosts: 21250,
      margin: 15.1,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "machine": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "installation": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "service": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalActiveProjects = projects.filter(p => p.status === "active").length;
  const totalRevenue = projects.reduce((sum, p) => sum + p.actualRevenue, 0);
  const totalCosts = projects.reduce((sum, p) => sum + p.actualCosts, 0);
  const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestione Commesse</h1>
        <p className="text-muted-foreground">
          Gestione e monitoraggio delle commesse attive
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commesse Attive</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveProjects}</div>
            <p className="text-xs text-muted-foreground">
              Progetti in corso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ricavi Totali</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€ {totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Da tutte le commesse
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costi Totali</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€ {totalCosts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Costi sostenuti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margine Medio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Margine complessivo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Elenco Commesse</CardTitle>
              <CardDescription>
                Tutte le commesse con dettagli economici
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuova Commessa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nuova Commessa</DialogTitle>
                  <DialogDescription>
                    Crea una nuova commessa per tracciare ricavi e costi
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="customer">Cliente</Label>
                    <Input id="customer" placeholder="Nome cliente" />
                  </div>
                  <div>
                    <Label htmlFor="machine-model">Modello Macchina</Label>
                    <Input id="machine-model" placeholder="Modello macchina" />
                  </div>
                  <div>
                    <Label htmlFor="project-type">Tipo Commessa</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="machine">Macchina</SelectItem>
                        <SelectItem value="installation">Installazione</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="estimated-revenue">Ricavo Stimato (€)</Label>
                    <Input id="estimated-revenue" type="number" placeholder="0" />
                  </div>
                  <Button className="w-full">Crea Commessa</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per codice o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtra per stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attive</SelectItem>
                <SelectItem value="completed">Completate</SelectItem>
                <SelectItem value="cancelled">Annullate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Ricavo Attuale</TableHead>
                  <TableHead className="text-right">Costi Attuali</TableHead>
                  <TableHead className="text-right">Margine %</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.customerName}</div>
                        <div className="text-sm text-muted-foreground">{project.machineModel}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(project.projectType)}>
                        {project.projectType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">€ {project.actualRevenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">€ {project.actualCosts.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${project.margin > 20 ? 'text-green-600' : project.margin > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {project.margin.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsPage;