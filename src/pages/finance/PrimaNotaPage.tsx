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
import { Plus, Search, Filter, BookOpen, Calendar as CalendarIcon, Euro, FileText, CreditCard, CheckCircle, XCircle, User, Repeat, Clock } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FileUpload } from "@/components/ui/file-upload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  registrato: boolean;
  utenteRiportante: string;
}

interface AbbonamentoRicorrente {
  id: string;
  nome: string;
  importo: number;
  frequenza: "mensile" | "trimestrale" | "semestrale" | "annuale";
  prossimoPagamento: string;
  causale: string;
  metodoPagamento: string;
  attivo: boolean;
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
].filter(item => item.trim() !== "");

const metodiPagamento = [
  "Contanti",
  "Bonifico",
  "Carta di credito",
  "Carta di debito", 
  "Assegno",
  "PayPal",
  "Altro"
].filter(item => item.trim() !== "");

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
].filter(item => item.trim() !== "");

export default function PrimaNotaPage() {
  const { toast } = useToast();
  const { user } = useAuth();
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
      note: "Cliente ACME S.r.l.",
      registrato: true,
      utenteRiportante: "Mario Rossi"
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
      note: "Fornitore XYZ S.p.A.",
      registrato: false,
      utenteRiportante: "Anna Bianchi"
    }
  ]);

  const [abbonamenti, setAbbonamenti] = useState<AbbonamentoRicorrente[]>([
    {
      id: "1",
      nome: "Office 365",
      importo: 12.50,
      frequenza: "mensile",
      prossimoPagamento: "2024-02-15",
      causale: "Spese generali",
      metodoPagamento: "Carta di credito",
      attivo: true
    },
    {
      id: "2",
      nome: "Assicurazione responsabilità civile",
      importo: 450.00,
      frequenza: "annuale",
      prossimoPagamento: "2024-06-30",
      causale: "Tasse e imposte",
      metodoPagamento: "Bonifico",
      attivo: true
    }
  ]);

  const [activeTab, setActiveTab] = useState("movimenti");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAbbonamentoDialogOpen, setIsAbbonamentoDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [filtroTesto, setFiltroTesto] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("all");
  const [nuovoMovimento, setNuovoMovimento] = useState<Partial<MovimentoContabile>>({
    metodoPagamento: "Bonifico"
  });
  const [allegati, setAllegati] = useState<File[]>([]);
  const [nuovoAbbonamento, setNuovoAbbonamento] = useState<Partial<AbbonamentoRicorrente>>({
    frequenza: "mensile",
    metodoPagamento: "Bonifico",
    attivo: true
  });

  const generaNumeroRegistrazione = () => {
    const anno = new Date().getFullYear();
    const ultimoNumero = movimenti.length + 1;
    return `PN-${anno}-${ultimoNumero.toString().padStart(3, '0')}`;
  };

  const uploadFiles = async (files: File[], movimentoId: string) => {
    if (!user || files.length === 0) return [];

    const uploadPromises = files.map(async (file) => {
      const fileName = `${user.id}/${movimentoId}/${file.name}`;
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, file);

      if (error) {
        console.error('Errore upload file:', error);
        throw error;
      }

      return data.path;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuovoMovimento.causale || !nuovoMovimento.contoDare || !nuovoMovimento.contoAvere || !nuovoMovimento.importo) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    const movimentoId = Date.now().toString();

    try {
      // Upload files if any
      if (allegati.length > 0) {
        await uploadFiles(allegati, movimentoId);
        toast({
          title: "File caricati",
          description: `${allegati.length} file allegati caricati con successo`,
        });
      }

      const movimento: MovimentoContabile = {
        id: movimentoId,
        data: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        numeroRegistrazione: generaNumeroRegistrazione(),
        causale: nuovoMovimento.causale!,
        contoDare: nuovoMovimento.contoDare!,
        contoAvere: nuovoMovimento.contoAvere!,
        importo: Number(nuovoMovimento.importo),
        metodoPagamento: nuovoMovimento.metodoPagamento!,
        descrizione: nuovoMovimento.descrizione || "",
        note: nuovoMovimento.note || "",
        registrato: false,
        utenteRiportante: user?.user_metadata?.first_name && user?.user_metadata?.last_name 
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}` 
          : user?.email || "Utente sconosciuto"
      };

      setMovimenti([movimento, ...movimenti]);
      setNuovoMovimento({ metodoPagamento: "Bonifico" });
      setSelectedDate(undefined);
      setAllegati([]);
      setIsDialogOpen(false);
      
      toast({
        title: "Movimento registrato",
        description: "Il movimento contabile è stato registrato con successo",
      });
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento dei file. Riprova.",
        variant: "destructive",
      });
    }
  };

  const movimentiFiltrati = movimenti.filter(movimento => {
    const testoMatch = filtroTesto === "" || 
      movimento.causale.toLowerCase().includes(filtroTesto.toLowerCase()) ||
      movimento.descrizione.toLowerCase().includes(filtroTesto.toLowerCase()) ||
      movimento.numeroRegistrazione.toLowerCase().includes(filtroTesto.toLowerCase());
    
    const metodoMatch = filtroMetodo === "" || filtroMetodo === "all" || movimento.metodoPagamento === filtroMetodo;
    
    return testoMatch && metodoMatch;
  });

  const handleAbbonamentoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuovoAbbonamento.nome || !nuovoAbbonamento.importo || !nuovoAbbonamento.frequenza) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    const abbonamento: AbbonamentoRicorrente = {
      id: Date.now().toString(),
      nome: nuovoAbbonamento.nome!,
      importo: Number(nuovoAbbonamento.importo),
      frequenza: nuovoAbbonamento.frequenza!,
      prossimoPagamento: nuovoAbbonamento.prossimoPagamento || format(new Date(), 'yyyy-MM-dd'),
      causale: nuovoAbbonamento.causale || "Altro",
      metodoPagamento: nuovoAbbonamento.metodoPagamento!,
      attivo: nuovoAbbonamento.attivo!
    };

    setAbbonamenti([abbonamento, ...abbonamenti]);
    setNuovoAbbonamento({ 
      frequenza: "mensile",
      metodoPagamento: "Bonifico",
      attivo: true
    });
    setIsAbbonamentoDialogOpen(false);
    
    toast({
      title: "Abbonamento aggiunto",
      description: "L'abbonamento ricorrente è stato aggiunto con successo",
    });
  };

  const toggleRegistrato = (id: string) => {
    setMovimenti(movimenti.map(movimento => 
      movimento.id === id 
        ? { ...movimento, registrato: !movimento.registrato }
        : movimento
    ));
  };

  const getFrequenzaBadge = (frequenza: string) => {
    const colors = {
      mensile: "bg-blue-100 text-blue-800",
      trimestrale: "bg-green-100 text-green-800", 
      semestrale: "bg-yellow-100 text-yellow-800",
      annuale: "bg-purple-100 text-purple-800"
    };
    return <Badge variant="outline" className={colors[frequenza as keyof typeof colors]}>
      <Clock className="mr-1 h-3 w-3" />
      {frequenza}
    </Badge>;
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Gestione Finanziaria</h1>
          <p className="text-muted-foreground">
            Prima Nota e Abbonamenti Ricorrenti
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={activeTab === "movimenti" ? "default" : "outline"}
            onClick={() => setActiveTab("movimenti")}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Prima Nota
          </Button>
          <Button
            variant={activeTab === "abbonamenti" ? "default" : "outline"}
            onClick={() => setActiveTab("abbonamenti")}
          >
            <Repeat className="mr-2 h-4 w-4" />
            Abbonamenti
          </Button>
        </div>
      </div>
      {activeTab === "movimenti" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Movimenti Contabili</h2>
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
                          <SelectItem key={causale} value={causale || "default-causale"}>{causale}</SelectItem>
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
                            <SelectItem key={conto} value={conto || "default-conto"}>{conto}</SelectItem>
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
                            <SelectItem key={conto} value={conto || "default-conto"}>{conto}</SelectItem>
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
                            <SelectItem key={metodo} value={metodo || "default-metodo"}>{metodo}</SelectItem>
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

                  <div className="space-y-2">
                    <Label>Allegati</Label>
                    <FileUpload
                      value={allegati}
                      onChange={setAllegati}
                      maxFiles={5}
                      acceptedFileTypes={["image/jpeg", "image/png", "image/webp", "application/pdf"]}
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
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>N. Registr.</TableHead>
                    <TableHead>Causale</TableHead>
                    <TableHead>Conto Dare</TableHead>
                    <TableHead>Conto Avere</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Metodo</TableHead>
                    <TableHead>Utente</TableHead>
                    <TableHead>Descrizione</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentiFiltrati.map((movimento) => (
                    <TableRow key={movimento.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRegistrato(movimento.id)}
                          className="p-1"
                        >
                          {movimento.registrato ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </Button>
                      </TableCell>
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
                      <TableCell>
                        <div className="flex items-center">
                          <User className="mr-1 h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{movimento.utenteRiportante}</span>
                        </div>
                      </TableCell>
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
        </>
      )}

      {activeTab === "abbonamenti" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Abbonamenti Ricorrenti</h2>
            <Dialog open={isAbbonamentoDialogOpen} onOpenChange={setIsAbbonamentoDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Abbonamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Aggiungi Abbonamento Ricorrente</DialogTitle>
                  <DialogDescription>
                    Inserisci i dettagli dell'abbonamento o pagamento ricorrente
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAbbonamentoSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome Abbonamento *</Label>
                      <Input
                        id="nome"
                        value={nuovoAbbonamento.nome || ""}
                        onChange={(e) => setNuovoAbbonamento({ ...nuovoAbbonamento, nome: e.target.value })}
                        placeholder="es. Office 365, Assicurazione..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="importoAbb">Importo (€) *</Label>
                      <Input
                        id="importoAbb"
                        type="number"
                        step="0.01"
                        value={nuovoAbbonamento.importo || ""}
                        onChange={(e) => setNuovoAbbonamento({ ...nuovoAbbonamento, importo: Number(e.target.value) })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="frequenza">Frequenza *</Label>
                      <Select value={nuovoAbbonamento.frequenza} onValueChange={(value) => setNuovoAbbonamento({ ...nuovoAbbonamento, frequenza: value as AbbonamentoRicorrente["frequenza"] })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona frequenza" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensile">Mensile</SelectItem>
                          <SelectItem value="trimestrale">Trimestrale</SelectItem>
                          <SelectItem value="semestrale">Semestrale</SelectItem>
                          <SelectItem value="annuale">Annuale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prossimoPagamento">Prossimo Pagamento</Label>
                      <Input
                        id="prossimoPagamento"
                        type="date"
                        value={nuovoAbbonamento.prossimoPagamento || ""}
                        onChange={(e) => setNuovoAbbonamento({ ...nuovoAbbonamento, prossimoPagamento: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="causaleAbb">Causale</Label>
                      <Select value={nuovoAbbonamento.causale} onValueChange={(value) => setNuovoAbbonamento({ ...nuovoAbbonamento, causale: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona causale" />
                        </SelectTrigger>
                        <SelectContent>
                          {causaliPredefinite.map((causale) => (
                            <SelectItem key={causale} value={causale || "default-causale"}>{causale}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metodoAbb">Metodo di Pagamento</Label>
                      <Select value={nuovoAbbonamento.metodoPagamento} onValueChange={(value) => setNuovoAbbonamento({ ...nuovoAbbonamento, metodoPagamento: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {metodiPagamento.map((metodo) => (
                            <SelectItem key={metodo} value={metodo || "default-metodo"}>{metodo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsAbbonamentoDialogOpen(false)}>
                      Annulla
                    </Button>
                    <Button type="submit">Aggiungi Abbonamento</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Repeat className="mr-2 h-5 w-5" />
                Abbonamenti Attivi ({abbonamenti.filter(a => a.attivo).length})
              </CardTitle>
              <CardDescription>
                Gestisci i tuoi pagamenti ricorrenti e abbonamenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Frequenza</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Metodo</TableHead>
                    <TableHead>Prossimo Pagamento</TableHead>
                    <TableHead>Causale</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abbonamenti.map((abbonamento) => (
                    <TableRow key={abbonamento.id}>
                      <TableCell className="font-medium">{abbonamento.nome}</TableCell>
                      <TableCell>{getFrequenzaBadge(abbonamento.frequenza)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <Euro className="mr-1 h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{abbonamento.importo.toFixed(2)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getMetodoPagamentoBadge(abbonamento.metodoPagamento)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          {format(new Date(abbonamento.prossimoPagamento), "dd/MM/yyyy", { locale: it })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{abbonamento.causale}</Badge>
                      </TableCell>
                      <TableCell>
                        {abbonamento.attivo ? (
                          <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                        ) : (
                          <Badge variant="secondary">Sospeso</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {abbonamenti.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Repeat className="mx-auto h-12 w-12 mb-4" />
                  <p>Nessun abbonamento configurato</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}