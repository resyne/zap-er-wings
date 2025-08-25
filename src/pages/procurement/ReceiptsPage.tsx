import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Package, Calendar, CheckCircle, AlertCircle, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Receipt {
  id: string;
  number: string;
  poNumber: string;
  supplier: string;
  receiptDate: string;
  status: "pending" | "partial" | "complete" | "damaged";
  itemsReceived: number;
  itemsExpected: number;
  totalValue: number;
  notes?: string;
}

const ReceiptsPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const receipts: Receipt[] = [
    {
      id: "1",
      number: "REC-2024-001",
      poNumber: "PO-2024-001",
      supplier: "Acme Corporation",
      receiptDate: "2024-02-10",
      status: "complete",
      itemsReceived: 25,
      itemsExpected: 25,
      totalValue: 45000,
      notes: "Tutti gli articoli ricevuti in perfette condizioni"
    },
    {
      id: "2",
      number: "REC-2024-002",
      poNumber: "PO-2024-002",
      supplier: "Tech Solutions Ltd",
      receiptDate: "2024-02-12",
      status: "partial",
      itemsReceived: 8,
      itemsExpected: 12,
      totalValue: 19000,
      notes: "4 articoli mancanti, prevista consegna la prossima settimana"
    },
    {
      id: "3",
      number: "REC-2024-003",
      poNumber: "PO-2024-003",
      supplier: "Global Supplies Inc",
      receiptDate: "2024-02-15",
      status: "damaged",
      itemsReceived: 8,
      itemsExpected: 8,
      totalValue: 15200,
      notes: "2 articoli danneggiati durante il trasporto"
    },
    {
      id: "4",
      number: "REC-2024-004",
      poNumber: "PO-2024-005",
      supplier: "Industrial Parts Co",
      receiptDate: "2024-02-18",
      status: "pending",
      itemsReceived: 0,
      itemsExpected: 15,
      totalValue: 0,
      notes: "In attesa di ricezione"
    }
  ];

  const getStatusVariant = (status: Receipt['status']) => {
    switch (status) {
      case "pending": return "outline";
      case "partial": return "destructive";
      case "complete": return "default";
      case "damaged": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: Receipt['status']) => {
    switch (status) {
      case "pending": return "In Attesa";
      case "partial": return "Parziale";
      case "complete": return "Completo";
      case "damaged": return "Danneggiato";
      default: return status;
    }
  };

  const getStatusIcon = (status: Receipt['status']) => {
    switch (status) {
      case "complete": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "partial": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "damaged": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredReceipts = receipts.filter(receipt =>
    receipt.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateReceipt = () => {
    toast({
      title: "Funzione non implementata",
      description: "La creazione di nuove ricevute sarà implementata presto.",
    });
    setIsDialogOpen(false);
  };

  const handleViewReceipt = (receipt: Receipt) => {
    toast({
      title: "Funzione non implementata",
      description: `Visualizzazione ricevuta ${receipt.number} sarà implementata presto.`,
    });
  };

  const handleEditReceipt = (receipt: Receipt) => {
    toast({
      title: "Funzione non implementata",
      description: `Modifica ricevuta ${receipt.number} sarà implementata presto.`,
    });
  };

  const handleDeleteReceipt = (receipt: Receipt) => {
    toast({
      title: "Funzione non implementata",
      description: `Eliminazione ricevuta ${receipt.number} sarà implementata presto.`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ricevute di Acquisto</h1>
          <p className="text-muted-foreground">
            Gestisci le ricevute e i ricevimenti merce
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuova Ricevuta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registra Nuovo Ricevimento</DialogTitle>
              <DialogDescription>
                Inserisci i dati per il nuovo ricevimento merce.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Form di registrazione ricevimento in fase di implementazione...
              </p>
              <Button onClick={handleCreateReceipt} className="w-full">
                Registra Ricevimento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ricevimenti Completi</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {receipts.filter(r => r.status === 'complete').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Questo mese
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ricevimenti Parziali</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {receipts.filter(r => r.status === 'partial').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da completare
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Attesa</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {receipts.filter(r => r.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da ricevere
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Ricevuto</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{receipts.filter(r => r.status !== 'pending').reduce((acc, r) => acc + r.totalValue, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Questo mese
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Ricevute</CardTitle>
          <CardDescription>
            Visualizza e gestisci tutte le ricevute di acquisto
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca ricevute..."
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
                <TableHead>Ordine</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Articoli</TableHead>
                <TableHead>Valore</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">{receipt.number}</TableCell>
                  <TableCell>{receipt.poNumber}</TableCell>
                  <TableCell>{receipt.supplier}</TableCell>
                  <TableCell>{new Date(receipt.receiptDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(receipt.status)}
                      <span>{receipt.itemsReceived}/{receipt.itemsExpected}</span>
                    </div>
                  </TableCell>
                  <TableCell>€{receipt.totalValue.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(receipt.status)}>
                      {getStatusLabel(receipt.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewReceipt(receipt)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditReceipt(receipt)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReceipt(receipt)}
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

export default ReceiptsPage;