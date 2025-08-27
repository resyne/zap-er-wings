import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrimaNotaEntry {
  id: string;
  date: string;
  operator: string;
  workOrder: string;
  customer: string;
  location: string;
  type: string;
  status: string;
  description: string;
  notes: string;
}

export default function PrimaNotaPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<PrimaNotaEntry[]>([
    {
      id: "1",
      date: "2024-01-15",
      operator: "Mario Rossi",
      workOrder: "WO-2024-0001",
      customer: "ACME S.r.l.",
      location: "Milano - Via Roma 123",
      type: "manutenzione",
      status: "completato",
      description: "Intervento di manutenzione ordinaria sistema filtraggio",
      notes: "Sistema verificato e funzionante"
    },
    {
      id: "2",
      date: "2024-01-16",
      operator: "Luca Bianchi",
      workOrder: "WO-2024-0002",
      customer: "Tech Solutions S.p.A.",
      location: "Roma - Viale Europa 45",
      type: "riparazione",
      status: "in_corso",
      description: "Riparazione urgente guasto sistema",
      notes: "In attesa di ricambi"
    }
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<PrimaNotaEntry>>({
    type: "manutenzione",
    status: "pianificato"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEntry.operator || !newEntry.workOrder || !newEntry.customer || !newEntry.description) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    const entry: PrimaNotaEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      operator: newEntry.operator!,
      workOrder: newEntry.workOrder!,
      customer: newEntry.customer!,
      location: newEntry.location || "",
      type: newEntry.type!,
      status: newEntry.status!,
      description: newEntry.description!,
      notes: newEntry.notes || ""
    };

    setEntries([entry, ...entries]);
    setNewEntry({ type: "manutenzione", status: "pianificato" });
    setIsDialogOpen(false);
    
    toast({
      title: "Prima Nota creata",
      description: "Il rapporto di intervento è stato registrato con successo",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completato":
        return <Badge variant="default" className="bg-green-500">Completato</Badge>;
      case "in_corso":
        return <Badge variant="secondary">In Corso</Badge>;
      case "pianificato":
        return <Badge variant="outline">Pianificato</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "manutenzione":
        return <Badge variant="default">Manutenzione</Badge>;
      case "riparazione":
        return <Badge variant="destructive">Riparazione</Badge>;
      case "installazione":
        return <Badge variant="secondary">Installazione</Badge>;
      case "collaudo":
        return <Badge className="bg-blue-500">Collaudo</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prima Nota</h1>
          <p className="text-muted-foreground">
            Gestione rapporti di intervento e registrazione attività
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Rapporto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuovo Rapporto di Intervento</DialogTitle>
              <DialogDescription>
                Registra un nuovo intervento nella prima nota
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="operator">Operatore *</Label>
                  <Input
                    id="operator"
                    value={newEntry.operator || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, operator: e.target.value })}
                    placeholder="Nome operatore"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workOrder">Ordine di Lavoro *</Label>
                  <Input
                    id="workOrder"
                    value={newEntry.workOrder || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, workOrder: e.target.value })}
                    placeholder="WO-2024-XXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Cliente *</Label>
                  <Input
                    id="customer"
                    value={newEntry.customer || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, customer: e.target.value })}
                    placeholder="Nome cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Località</Label>
                  <Input
                    id="location"
                    value={newEntry.location || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, location: e.target.value })}
                    placeholder="Indirizzo intervento"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo Intervento</Label>
                  <Select value={newEntry.type} onValueChange={(value) => setNewEntry({ ...newEntry, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manutenzione">Manutenzione</SelectItem>
                      <SelectItem value="riparazione">Riparazione</SelectItem>
                      <SelectItem value="installazione">Installazione</SelectItem>
                      <SelectItem value="collaudo">Collaudo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Stato</Label>
                  <Select value={newEntry.status} onValueChange={(value) => setNewEntry({ ...newEntry, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pianificato">Pianificato</SelectItem>
                      <SelectItem value="in_corso">In Corso</SelectItem>
                      <SelectItem value="completato">Completato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione Intervento *</Label>
                <Textarea
                  id="description"
                  value={newEntry.description || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder="Descrizione dettagliata dell'intervento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={newEntry.notes || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  placeholder="Note aggiuntive"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit">Salva Rapporto</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Elenco Rapporti di Intervento
            </CardTitle>
            <CardDescription>
              Registro cronologico di tutti gli interventi effettuati
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Operatore</TableHead>
                  <TableHead>OdL</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Descrizione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      {entry.date}
                    </TableCell>
                    <TableCell className="flex items-center">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      {entry.operator}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {entry.workOrder}
                      </code>
                    </TableCell>
                    <TableCell>{entry.customer}</TableCell>
                    <TableCell>{getTypeBadge(entry.type)}</TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={entry.description}>
                        {entry.description}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}