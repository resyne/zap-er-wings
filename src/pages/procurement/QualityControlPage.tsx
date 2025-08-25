import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Shield, CheckCircle, XCircle, AlertTriangle, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QualityCheck {
  id: string;
  number: string;
  receiptNumber: string;
  supplier: string;
  inspector: string;
  checkDate: string;
  status: "pending" | "passed" | "failed" | "conditional";
  itemsChecked: number;
  itemsPassed: number;
  itemsFailed: number;
  notes?: string;
  severity: "low" | "medium" | "high";
}

const QualityControlPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const qualityChecks: QualityCheck[] = [
    {
      id: "1",
      number: "QC-2024-001",
      receiptNumber: "REC-2024-001",
      supplier: "Acme Corporation",
      inspector: "Mario Rossi",
      checkDate: "2024-02-11",
      status: "passed",
      itemsChecked: 25,
      itemsPassed: 25,
      itemsFailed: 0,
      notes: "Tutti gli articoli conformi alle specifiche",
      severity: "low"
    },
    {
      id: "2",
      number: "QC-2024-002",
      receiptNumber: "REC-2024-002",
      supplier: "Tech Solutions Ltd",
      inspector: "Giulia Bianchi",
      checkDate: "2024-02-13",
      status: "conditional",
      itemsChecked: 8,
      itemsPassed: 6,
      itemsFailed: 2,
      notes: "2 componenti con difetti minori, utilizzabili con limitazioni",
      severity: "medium"
    },
    {
      id: "3",
      number: "QC-2024-003",
      receiptNumber: "REC-2024-003",
      supplier: "Global Supplies Inc",
      inspector: "Luca Verdi",
      checkDate: "2024-02-16",
      status: "failed",
      itemsChecked: 8,
      itemsPassed: 5,
      itemsFailed: 3,
      notes: "3 articoli non conformi, da restituire al fornitore",
      severity: "high"
    },
    {
      id: "4",
      number: "QC-2024-004",
      receiptNumber: "REC-2024-004",
      supplier: "Industrial Parts Co",
      inspector: "Anna Neri",
      checkDate: "2024-02-19",
      status: "pending",
      itemsChecked: 0,
      itemsPassed: 0,
      itemsFailed: 0,
      notes: "Controllo in corso",
      severity: "low"
    }
  ];

  const getStatusVariant = (status: QualityCheck['status']) => {
    switch (status) {
      case "pending": return "outline";
      case "passed": return "default";
      case "failed": return "destructive";
      case "conditional": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: QualityCheck['status']) => {
    switch (status) {
      case "pending": return "In Corso";
      case "passed": return "Approvato";
      case "failed": return "Respinto";
      case "conditional": return "Condizionale";
      default: return status;
    }
  };

  const getStatusIcon = (status: QualityCheck['status']) => {
    switch (status) {
      case "passed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "conditional": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Shield className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityVariant = (severity: QualityCheck['severity']) => {
    switch (severity) {
      case "low": return "outline";
      case "medium": return "secondary";
      case "high": return "destructive";
      default: return "outline";
    }
  };

  const filteredChecks = qualityChecks.filter(check =>
    check.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    check.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    check.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    check.inspector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateCheck = () => {
    toast({
      title: "Funzione non implementata",
      description: "La creazione di nuovi controlli qualità sarà implementata presto.",
    });
    setIsDialogOpen(false);
  };

  const handleViewCheck = (check: QualityCheck) => {
    toast({
      title: "Funzione non implementata",
      description: `Visualizzazione controllo ${check.number} sarà implementata presto.`,
    });
  };

  const handleEditCheck = (check: QualityCheck) => {
    toast({
      title: "Funzione non implementata",
      description: `Modifica controllo ${check.number} sarà implementata presto.`,
    });
  };

  const handleDeleteCheck = (check: QualityCheck) => {
    toast({
      title: "Funzione non implementata",
      description: `Eliminazione controllo ${check.number} sarà implementata presto.`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controllo Qualità</h1>
          <p className="text-muted-foreground">
            Gestisci i controlli qualità sui ricevimenti
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Controllo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Avvia Nuovo Controllo Qualità</DialogTitle>
              <DialogDescription>
                Inserisci i dati per il nuovo controllo qualità.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Form di creazione controllo in fase di implementazione...
              </p>
              <Button onClick={handleCreateCheck} className="w-full">
                Avvia Controllo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Controlli Approvati</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qualityChecks.filter(c => c.status === 'passed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Questo mese
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Controlli Respinti</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qualityChecks.filter(c => c.status === 'failed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da gestire
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Corso</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qualityChecks.filter(c => c.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da completare
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Conformità</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                (qualityChecks.reduce((acc, c) => acc + c.itemsPassed, 0) / 
                 qualityChecks.reduce((acc, c) => acc + c.itemsChecked, 0)) * 100
              )}%
            </div>
            <p className="text-xs text-muted-foreground">
              Articoli conformi
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Controlli</CardTitle>
          <CardDescription>
            Visualizza e gestisci tutti i controlli qualità
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca controlli..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Ricevuta</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Ispettore</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Risultati</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Severità</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChecks.map((check) => (
                <TableRow key={check.id}>
                  <TableCell className="font-medium">{check.number}</TableCell>
                  <TableCell>{check.receiptNumber}</TableCell>
                  <TableCell>{check.supplier}</TableCell>
                  <TableCell>{check.inspector}</TableCell>
                  <TableCell>{new Date(check.checkDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-sm">{check.itemsPassed} approvati</span>
                      </div>
                      {check.itemsFailed > 0 && (
                        <div className="flex items-center space-x-1">
                          <XCircle className="h-3 w-3 text-red-500" />
                          <span className="text-sm">{check.itemsFailed} respinti</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(check.status)}
                      <Badge variant={getStatusVariant(check.status)}>
                        {getStatusLabel(check.status)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityVariant(check.severity)}>
                      {check.severity.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewCheck(check)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCheck(check)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCheck(check)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityControlPage;