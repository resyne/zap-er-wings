import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Calendar, Building2, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { formatAmount } from "@/lib/formatAmount";

interface RFQ {
  id: string;
  number: string;
  title: string;
  supplier: string;
  requestDate: string;
  dueDate: string;
  status: "draft" | "sent" | "received" | "quoted" | "closed";
  totalItems: number;
  estimatedValue: number;
}

const RfqPage = () => {
  const { toast } = useToast();
  const { hideAmounts } = useHideAmounts();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const rfqs: RFQ[] = [
    {
      id: "1",
      number: "RFQ-2024-001",
      title: "Materiali per produzione Q1",
      supplier: "Acme Corporation",
      requestDate: "2024-01-15",
      dueDate: "2024-01-30",
      status: "quoted",
      totalItems: 15,
      estimatedValue: 25000
    },
    {
      id: "2",
      number: "RFQ-2024-002", 
      title: "Componenti elettronici",
      supplier: "Tech Solutions Ltd",
      requestDate: "2024-01-20",
      dueDate: "2024-02-05",
      status: "sent",
      totalItems: 8,
      estimatedValue: 18500
    },
    {
      id: "3",
      number: "RFQ-2024-003",
      title: "Servizi di manutenzione",
      supplier: "Global Supplies Inc",
      requestDate: "2024-01-25",
      dueDate: "2024-02-10",
      status: "draft",
      totalItems: 5,
      estimatedValue: 12000
    }
  ];

  const getStatusVariant = (status: RFQ['status']) => {
    switch (status) {
      case "draft": return "secondary";
      case "sent": return "default";
      case "received": return "outline";
      case "quoted": return "default";
      case "closed": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: RFQ['status']) => {
    switch (status) {
      case "draft": return "Bozza";
      case "sent": return "Inviata";
      case "received": return "Ricevuta";
      case "quoted": return "Quotata";
      case "closed": return "Chiusa";
      default: return status;
    }
  };

  const filteredRfqs = rfqs.filter(rfq =>
    rfq.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rfq.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rfq.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateRfq = () => {
    toast({
      title: "Funzione non implementata",
      description: "La creazione di nuove RFQ sarà implementata presto.",
    });
    setIsDialogOpen(false);
  };

  const handleViewRfq = (rfq: RFQ) => {
    toast({
      title: "Funzione non implementata",
      description: `Visualizzazione RFQ ${rfq.number} sarà implementata presto.`,
    });
  };

  const handleEditRfq = (rfq: RFQ) => {
    toast({
      title: "Funzione non implementata",
      description: `Modifica RFQ ${rfq.number} sarà implementata presto.`,
    });
  };

  const handleDeleteRfq = (rfq: RFQ) => {
    toast({
      title: "Funzione non implementata",
      description: `Eliminazione RFQ ${rfq.number} sarà implementata presto.`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Richieste di Quotazione</h1>
          <p className="text-muted-foreground">
            Gestisci le richieste di quotazione ai fornitori
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuova RFQ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea Nuova RFQ</DialogTitle>
              <DialogDescription>
                Inserisci i dati per la nuova richiesta di quotazione.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Form di creazione RFQ in fase di implementazione...
              </p>
              <Button onClick={handleCreateRfq} className="w-full">
                Crea RFQ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RFQ Attive</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rfqs.filter(r => r.status !== 'closed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              In corso
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Attesa di Risposta</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rfqs.filter(r => r.status === 'sent').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Inviate ai fornitori
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotazioni Ricevute</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rfqs.filter(r => r.status === 'quoted').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da valutare
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(rfqs.reduce((acc, r) => acc + r.estimatedValue, 0), hideAmounts)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valore stimato
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco RFQ</CardTitle>
          <CardDescription>
            Visualizza e gestisci tutte le richieste di quotazione
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca RFQ..."
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
                <TableHead>Titolo</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Articoli</TableHead>
                <TableHead>Valore</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRfqs.map((rfq) => (
                <TableRow key={rfq.id}>
                  <TableCell className="font-medium">{rfq.number}</TableCell>
                  <TableCell>{rfq.title}</TableCell>
                  <TableCell>{rfq.supplier}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">Richiesta: {new Date(rfq.requestDate).toLocaleDateString()}</div>
                      <div className="text-sm text-muted-foreground">Scadenza: {new Date(rfq.dueDate).toLocaleDateString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>{rfq.totalItems}</TableCell>
                  <TableCell>{formatAmount(rfq.estimatedValue, hideAmounts)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(rfq.status)}>
                      {getStatusLabel(rfq.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewRfq(rfq)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRfq(rfq)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRfq(rfq)}
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

export default RfqPage;