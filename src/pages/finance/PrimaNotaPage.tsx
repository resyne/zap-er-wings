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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Filter, BookOpen, Calendar as CalendarIcon, Euro, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MovimentoContabile {
  id: string;
  data: string;
  numeroRegistrazione: string;
  causale: string;
  contoDare: string;
  contoAvere: string;
  importo: number;
  metodoPagamento: string;
  descrizione: string;
  note: string;
}

const causaliPredefinite = [
  "Incasso fattura",
  "Pagamento fornitore", 
  "Spesa carburante",
  "Spesa materiali",
  "Bonifico ricevuto",
  "Bonifico inviato",
  "Pagamento stipendi",
  "Tasse e imposte",
  "Utenze",
  "Consulenze",
  "Altro"
];

const metodiPagamento = [
  "Contanti",
  "Bonifico",
  "Carta di credito",
  "Carta di debito", 
  "Assegno",
  "PayPal",
  "Altro"
];

const pianoConti = [
  "1010 - Cassa",
  "1020 - Banca c/c",
  "1030 - Crediti vs clienti",
  "2010 - Debiti vs fornitori",
  "4010 - Ricavi vendite",
  "5010 - Acquisti merci",
  "5020 - Spese generali",
  "5030 - Spese carburante",
  "5040 - Consulenze",
  "6010 - Costi del personale"
];

export default function PrimaNotaPage() {
  const { toast } = useToast();
  const [movimenti, setMovimenti] = useState<MovimentoContabile[]>([
    {
      id: "1",
      data: "2024-01-15",
      numeroRegistrazione: "PN-2024-001",
      causale: "Incasso fattura",
      contoDare: "1020 - Banca c/c",
      contoAvere: "4010 - Ricavi vendite",
      importo: 1250.00,
      metodoPagamento: "Bonifico",
      descrizione: "Incasso fattura FT001/2024",
      note: "Cliente ACME S.r.l."
    },
    {
      id: "2", 
      data: "2024-01-16",
      numeroRegistrazione: "PN-2024-002",
      causale: "Pagamento fornitore",
      contoDare: "2010 - Debiti vs fornitori",
      contoAvere: "1020 - Banca c/c",
      importo: 850.00,
      metodoPagamento: "Bonifico",
      descrizione: "Pagamento fattura FOR123",
      note: "Fornitore XYZ S.p.A."
    }
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [filtroTesto, setFiltroTesto] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("all");
  const [nuovoMovimento, setNuovoMovimento] = useState<Partial<MovimentoContabile>>({
    metodoPagamento: "Bonifico"
  });

  const generaNumeroRegistrazione = () => {
    const anno = new Date().getFullYear();
    const ultimoNumero = movimenti.length + 1;
    return `PN-${anno}-${ultimoNumero.toString().padStart(3, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuovoMovimento.causale || !nuovoMovimento.contoDare || !nuovoMovimento.contoAvere || !nuovoMovimento.importo) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    const movimento: MovimentoContabile = {
      id: Date.now().toString(),
      data: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      numeroRegistrazione: generaNumeroRegistrazione(),
      causale: nuovoMovimento.causale!,
      contoDare: nuovoMovimento.contoDare!,
      contoAvere: nuovoMovimento.contoAvere!,
      importo: Number(nuovoMovimento.importo),
      metodoPagamento: nuovoMovimento.metodoPagamento!,
      descrizione: nuovoMovimento.descrizione || "",
      note: nuovoMovimento.note || ""
    };

    setMovimenti([movimento, ...movimenti]);
    setNuovoMovimento({ metodoPagamento: "Bonifico" });
    setSelectedDate(undefined);
    setIsDialogOpen(false);
    
    toast({
      title: "Movimento registrato",
      description: "Il movimento contabile è stato registrato con successo",
    });
  };

  const movimentiFiltrati = movimenti.filter(movimento => {
    const testoMatch = filtroTesto === "" || 
      movimento.causale.toLowerCase().includes(filtroTesto.toLowerCase()) ||
      movimento.descrizione.toLowerCase().includes(filtroTesto.toLowerCase()) ||
      movimento.numeroRegistrazione.toLowerCase().includes(filtroTesto.toLowerCase());
    
    const metodoMatch = filtroMetodo === "" || filtroMetodo === "all" || movimento.metodoPagamento === filtroMetodo;
    
    return testoMatch && metodoMatch;
  });

  const getMetodoPagamentoBadge = (metodo: string) => {
    switch (metodo) {
      case "Contanti":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">💰 {metodo}</Badge>;
      case "Bonifico":
        return <Badge variant="default">🏦 {metodo}</Badge>;
      case "Carta di credito":
      case "Carta di debito":
        return <Badge variant="outline" className="border-blue-500 text-blue-700">💳 {metodo}</Badge>;
      default:
        return <Badge variant="outline">{metodo}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prima Nota</h1>
          <p className="text-muted-foreground">
            Registro cronologico dei movimenti contabili
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Movimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registra Nuovo Movimento</DialogTitle>
              <DialogDescription>
                Inserisci i dettagli del movimento contabile
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data Operazione *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: it }) : <span>Seleziona data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero">Numero Registrazione</Label>
                  <Input
                    id="numero"
                    value={generaNumeroRegistrazione()}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="causale">Causale *</Label>
                <Select value={nuovoMovimento.causale} onValueChange={(value) => setNuovoMovimento({ ...nuovoMovimento, causale: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona causale" />
                  </SelectTrigger>
                  <SelectContent>
                    {causaliPredefinite.map((causale) => (
                      <SelectItem key={causale} value={causale}>{causale}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contoDare">Conto Dare *</Label>
                  <Select value={nuovoMovimento.contoDare} onValueChange={(value) => setNuovoMovimento({ ...nuovoMovimento, contoDare: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona conto" />
                    </SelectTrigger>
                    <SelectContent>
                      {pianoConti.map((conto) => (
                        <SelectItem key={conto} value={conto}>{conto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contoAvere">Conto Avere *</Label>
                  <Select value={nuovoMovimento.contoAvere} onValueChange={(value) => setNuovoMovimento({ ...nuovoMovimento, contoAvere: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona conto" />
                    </SelectTrigger>
                    <SelectContent>
                      {pianoConti.map((conto) => (
                        <SelectItem key={conto} value={conto}>{conto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="importo">Importo (€) *</Label>
                  <Input
                    id="importo"
                    type="number"
                    step="0.01"
                    value={nuovoMovimento.importo || ""}
                    onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, importo: Number(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metodo">Metodo di Pagamento</Label>
                  <Select value={nuovoMovimento.metodoPagamento} onValueChange={(value) => setNuovoMovimento({ ...nuovoMovimento, metodoPagamento: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metodiPagamento.map((metodo) => (
                        <SelectItem key={metodo} value={metodo}>{metodo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descrizione">Descrizione</Label>
                <Input
                  id="descrizione"
                  value={nuovoMovimento.descrizione || ""}
                  onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, descrizione: e.target.value })}
                  placeholder="Descrizione del movimento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={nuovoMovimento.note || ""}
                  onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, note: e.target.value })}
                  placeholder="Note aggiuntive"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit">Registra Movimento</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtri */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filtri e Ricerca
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Ricerca Testuale</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Cerca per causale, descrizione, numero..."
                  value={filtroTesto}
                  onChange={(e) => setFiltroTesto(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtroMetodo">Metodo di Pagamento</Label>
              <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti i metodi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i metodi</SelectItem>
                  {metodiPagamento.map((metodo) => (
                    <SelectItem key={metodo} value={metodo}>{metodo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => { setFiltroTesto(""); setFiltroMetodo("all"); }} className="w-full">
                Pulisci Filtri
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Elenco Movimenti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="mr-2 h-5 w-5" />
            Elenco Movimenti ({movimentiFiltrati.length})
          </CardTitle>
          <CardDescription>
            Registro cronologico di tutti i movimenti contabili
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>N. Registr.</TableHead>
                <TableHead>Causale</TableHead>
                <TableHead>Conto Dare</TableHead>
                <TableHead>Conto Avere</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead>Descrizione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentiFiltrati.map((movimento) => (
                <TableRow key={movimento.id}>
                  <TableCell className="flex items-center">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(new Date(movimento.data), "dd/MM/yyyy", { locale: it })}
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {movimento.numeroRegistrazione}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{movimento.causale}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{movimento.contoDare}</TableCell>
                  <TableCell className="font-mono text-sm">{movimento.contoAvere}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <Euro className="mr-1 h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{movimento.importo.toFixed(2)}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getMetodoPagamentoBadge(movimento.metodoPagamento)}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={movimento.descrizione}>
                      {movimento.descrizione}
                    </div>
                    {movimento.note && (
                      <div className="text-xs text-muted-foreground truncate" title={movimento.note}>
                        {movimento.note}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {movimentiFiltrati.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4" />
              <p>Nessun movimento trovato con i filtri applicati</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}