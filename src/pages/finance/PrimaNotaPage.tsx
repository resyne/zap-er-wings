import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Filter, BookOpen, Calendar as CalendarIcon, Euro, FileText, CreditCard, CheckCircle, XCircle, User, Repeat, Clock, Edit, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  tipoMovimento: "incasso" | "acquisto";
  importo: number;
  metodoPagamento: string;
  descrizione: string;
  note: string;
  registrato: boolean;
  monitorare: boolean;
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
  monitorare: boolean;
  note?: string;
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
  "Servizio",
  "Altro"
].filter(item => item.trim() !== "");

const metodiPagamento = [
  "Contanti",
  "Bonifico",
  "Carta di credito",
  "Carta di debito", 
  "American Express",
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
  const [movimenti, setMovimenti] = useState<MovimentoContabile[]>([]);
  const [abbonamenti, setAbbonamenti] = useState<AbbonamentoRicorrente[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("movimenti");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAbbonamentoDialogOpen, setIsAbbonamentoDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [filtroTesto, setFiltroTesto] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("all");
  const [nuovoMovimento, setNuovoMovimento] = useState<Partial<MovimentoContabile>>({
    metodoPagamento: "Bonifico"
  });
  const [causalePersonalizzata, setCausalePersonalizzata] = useState("");
  const [allegati, setAllegati] = useState<File[]>([]);
  const [nuovoAbbonamento, setNuovoAbbonamento] = useState<Partial<AbbonamentoRicorrente>>({
    frequenza: "mensile",
    metodoPagamento: "Bonifico",
    attivo: true
  });
  const [movimentoInModifica, setMovimentoInModifica] = useState<MovimentoContabile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [abbonamentoInModifica, setAbbonamentoInModifica] = useState<AbbonamentoRicorrente | null>(null);
  const [isEditAbbonamentoDialogOpen, setIsEditAbbonamentoDialogOpen] = useState(false);

  // Load data from database
  const loadMovimenti = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('financial_movements')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const movimentiFormatted = data?.map(movement => ({
        id: movement.id,
        data: movement.date,
        numeroRegistrazione: movement.registration_number,
        causale: movement.causale,
        tipoMovimento: movement.movement_type as "incasso" | "acquisto",
        importo: Number(movement.amount),
        metodoPagamento: movement.payment_method,
        descrizione: movement.description || "",
        note: movement.notes || "",
        registrato: movement.registered,
        monitorare: movement.monitor || false,
        utenteRiportante: movement.reporting_user
      })) || [];

      setMovimenti(movimentiFormatted);
    } catch (error) {
      console.error('Errore caricamento movimenti:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei movimenti",
        variant: "destructive",
      });
    }
  };

  const loadAbbonamenti = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('recurring_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const abbonamentiFormatted = data?.map(subscription => ({
        id: subscription.id,
        nome: subscription.name,
        importo: Number(subscription.amount),
        frequenza: subscription.frequency as "mensile" | "trimestrale" | "semestrale" | "annuale",
        prossimoPagamento: subscription.next_payment,
        causale: subscription.causale,
        metodoPagamento: subscription.payment_method,
        attivo: subscription.active,
        monitorare: subscription.monitor || false,
        note: subscription.notes || ""
      })) || [];

      setAbbonamenti(abbonamentiFormatted);
    } catch (error) {
      console.error('Errore caricamento abbonamenti:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli abbonamenti",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setLoading(true);
        await Promise.all([loadMovimenti(), loadAbbonamenti()]);
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const generaNumeroRegistrazione = async () => {
    const anno = new Date().getFullYear();
    // Get count of movements for this year
    const { count } = await supabase
      .from('financial_movements')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .gte('date', `${anno}-01-01`)
      .lte('date', `${anno}-12-31`);
    
    const ultimoNumero = (count || 0) + 1;
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
    
    if (!nuovoMovimento.causale || !nuovoMovimento.tipoMovimento || !nuovoMovimento.importo || !user) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    if (nuovoMovimento.causale === "Altro" && !causalePersonalizzata.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci la descrizione della causale personalizzata",
        variant: "destructive",
      });
      return;
    }

    try {
      const causaleFinale = nuovoMovimento.causale === "Altro" ? causalePersonalizzata : nuovoMovimento.causale;
      const numeroRegistrazione = await generaNumeroRegistrazione();
      const dataMovimento = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      
      // Insert into database
      const { data: newMovement, error } = await supabase
        .from('financial_movements')
        .insert({
          user_id: user.id,
          date: dataMovimento,
          registration_number: numeroRegistrazione,
          causale: causaleFinale!,
          movement_type: nuovoMovimento.tipoMovimento!,
          amount: Number(nuovoMovimento.importo),
          payment_method: nuovoMovimento.metodoPagamento!,
          description: nuovoMovimento.descrizione || "",
          notes: nuovoMovimento.note || "",
          registered: false,
          monitor: nuovoMovimento.monitorare ?? true,
          reporting_user: user?.user_metadata?.first_name && user?.user_metadata?.last_name 
            ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}` 
            : user?.email || "Utente sconosciuto",
          attachments: []
        })
        .select()
        .single();

      if (error) throw error;

      // Upload files if any
      if (allegati.length > 0 && newMovement) {
        await uploadFiles(allegati, newMovement.id);
        toast({
          title: "File caricati",
          description: `${allegati.length} file allegati caricati con successo`,
        });
      }

      // Reload data
      await loadMovimenti();
      
      setNuovoMovimento({ metodoPagamento: "Bonifico", causale: "" });
      setCausalePersonalizzata("");
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
        description: "Errore durante il salvataggio del movimento. Riprova.",
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

  const handleAbbonamentoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuovoAbbonamento.nome || !nuovoAbbonamento.importo || !nuovoAbbonamento.frequenza || !user) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    try {
      // Crea l'abbonamento
      const { data: abbonamentoData, error: abbonamentoError } = await supabase
        .from('recurring_subscriptions')
        .insert({
          user_id: user.id,
          name: nuovoAbbonamento.nome!,
          amount: Number(nuovoAbbonamento.importo),
          frequency: nuovoAbbonamento.frequenza!,
          next_payment: nuovoAbbonamento.prossimoPagamento || format(new Date(), 'yyyy-MM-dd'),
          causale: nuovoAbbonamento.causale || "Altro",
          payment_method: nuovoAbbonamento.metodoPagamento!,
          active: nuovoAbbonamento.attivo!,
          monitor: nuovoAbbonamento.monitorare ?? true,
          notes: nuovoAbbonamento.note || ""
        })
        .select()
        .single();

      if (abbonamentoError) throw abbonamentoError;

      // Crea automaticamente il movimento in prima nota per oggi
      const numeroRegistrazione = await generaNumeroRegistrazione();
      const dataOggi = format(new Date(), 'yyyy-MM-dd');
      
      const { error: movimentoError } = await supabase
        .from('financial_movements')
        .insert({
          user_id: user.id,
          date: dataOggi,
          registration_number: numeroRegistrazione,
          causale: nuovoAbbonamento.causale || "Abbonamento ricorrente",
          movement_type: "acquisto",
          amount: Number(nuovoAbbonamento.importo),
          payment_method: nuovoAbbonamento.metodoPagamento!,
          description: `Abbonamento: ${nuovoAbbonamento.nome}`,
          notes: `Movimento automatico per abbonamento ricorrente - Frequenza: ${nuovoAbbonamento.frequenza}`,
          registered: false,
          monitor: true,
          reporting_user: user?.user_metadata?.first_name && user?.user_metadata?.last_name 
            ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}` 
            : user?.email || "Sistema automatico",
          attachments: []
        });

      if (movimentoError) {
        console.error('Errore creazione movimento:', movimentoError);
        // Non blocchiamo l'abbonamento se il movimento fallisce, ma avvisiamo l'utente
        toast({
          title: "Abbonamento creato",
          description: "Abbonamento creato, ma errore nella creazione del movimento contabile. Puoi crearlo manualmente.",
          variant: "destructive",
        });
      }

      // Reload data
      await Promise.all([loadAbbonamenti(), loadMovimenti()]);
      
      setNuovoAbbonamento({ 
        frequenza: "mensile",
        metodoPagamento: "Bonifico",
        attivo: true
      });
      setIsAbbonamentoDialogOpen(false);
      
      toast({
        title: "Abbonamento aggiunto",
        description: "L'abbonamento ricorrente è stato aggiunto e il movimento contabile creato automaticamente",
      });
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      toast({
        title: "Errore",
        description: "Errore durante il salvataggio dell'abbonamento. Riprova.",
        variant: "destructive",
      });
    }
  };

  const toggleRegistrato = async (id: string) => {
    try {
      const movimento = movimenti.find(m => m.id === id);
      if (!movimento) return;

      const { error } = await supabase
        .from('financial_movements')
        .update({ registered: !movimento.registrato })
        .eq('id', id);

      if (error) throw error;

      // Reload data
      await loadMovimenti();
      
      toast({
        title: "Stato aggiornato",
        description: `Movimento ${movimento.registrato ? 'non registrato' : 'registrato'}`,
      });
    } catch (error) {
      console.error('Errore aggiornamento stato:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };

  const toggleMonitorare = async (id: string) => {
    try {
      const movimento = movimenti.find(m => m.id === id);
      if (!movimento) return;

      const { error } = await supabase
        .from('financial_movements')
        .update({ monitor: !movimento.monitorare })
        .eq('id', id);

      if (error) throw error;

      // Reload data
      await loadMovimenti();
      
      toast({
        title: "Monitoraggio aggiornato",
        description: `Movimento ${movimento.monitorare ? 'non da monitorare' : 'da monitorare'}`,
      });
    } catch (error) {
      console.error('Errore aggiornamento monitoraggio:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento del monitoraggio",
        variant: "destructive",
      });
    }
  };

  const toggleMonitorareAbbonamento = async (id: string) => {
    try {
      const abbonamento = abbonamenti.find(a => a.id === id);
      if (!abbonamento) return;

      const { error } = await supabase
        .from('recurring_subscriptions')
        .update({ monitor: !abbonamento.monitorare })
        .eq('id', id);

      if (error) throw error;

      // Reload data
      await loadAbbonamenti();
      
      toast({
        title: "Monitoraggio aggiornato",
        description: `Abbonamento ${abbonamento.monitorare ? 'non da monitorare' : 'da monitorare'}`,
      });
    } catch (error) {
      console.error('Errore aggiornamento controllo:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento del controllo",
        variant: "destructive",
      });
    }
  };

  const handleModificaMovimento = (movimento: MovimentoContabile) => {
    setMovimentoInModifica(movimento);
    setSelectedDate(new Date(movimento.data));
    setCausalePersonalizzata(movimento.causale && !causaliPredefinite.includes(movimento.causale) ? movimento.causale : "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!movimentoInModifica || !user) return;

    const causaleFinale = movimentoInModifica.causale === "Altro" ? causalePersonalizzata : movimentoInModifica.causale;

    if (movimentoInModifica.causale === "Altro" && !causalePersonalizzata.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci la descrizione della causale personalizzata",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataMovimento = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : movimentoInModifica.data;
      
      const { error } = await supabase
        .from('financial_movements')
        .update({
          date: dataMovimento,
          causale: causaleFinale!,
          movement_type: movimentoInModifica.tipoMovimento,
          amount: Number(movimentoInModifica.importo),
          payment_method: movimentoInModifica.metodoPagamento,
          description: movimentoInModifica.descrizione || "",
          notes: movimentoInModifica.note || "",
          monitor: movimentoInModifica.monitorare
        })
        .eq('id', movimentoInModifica.id);

      if (error) throw error;

      // Reload data
      await loadMovimenti();
      
      setMovimentoInModifica(null);
      setCausalePersonalizzata("");
      setSelectedDate(undefined);
      setIsEditDialogOpen(false);
      
      toast({
        title: "Movimento aggiornato",
        description: "Il movimento contabile è stato aggiornato con successo",
      });
    } catch (error) {
      console.error('Errore durante l\'aggiornamento:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento del movimento. Riprova.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMovimento = async (movimento: MovimentoContabile) => {
    try {
      const { error } = await supabase
        .from('financial_movements')
        .delete()
        .eq('id', movimento.id);

      if (error) throw error;

      // Reload data
      await loadMovimenti();
      
      toast({
        title: "Movimento eliminato",
        description: "Il movimento contabile è stato eliminato con successo",
      });
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione del movimento. Riprova.",
        variant: "destructive",
      });
    }
  };

  const handleModificaAbbonamento = (abbonamento: AbbonamentoRicorrente) => {
    setAbbonamentoInModifica(abbonamento);
    setIsEditAbbonamentoDialogOpen(true);
  };

  const handleUpdateAbbonamento = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!abbonamentoInModifica || !user) return;

    try {
      const { error } = await supabase
        .from('recurring_subscriptions')
        .update({
          name: abbonamentoInModifica.nome,
          amount: Number(abbonamentoInModifica.importo),
          frequency: abbonamentoInModifica.frequenza,
          next_payment: abbonamentoInModifica.prossimoPagamento,
          causale: abbonamentoInModifica.causale,
          payment_method: abbonamentoInModifica.metodoPagamento,
          active: abbonamentoInModifica.attivo,
          monitor: abbonamentoInModifica.monitorare,
          notes: abbonamentoInModifica.note || ""
        })
        .eq('id', abbonamentoInModifica.id);

      if (error) throw error;

      // Reload data
      await loadAbbonamenti();
      
      setAbbonamentoInModifica(null);
      setIsEditAbbonamentoDialogOpen(false);
      
      toast({
        title: "Abbonamento aggiornato",
        description: "L'abbonamento è stato aggiornato con successo",
      });
    } catch (error) {
      console.error('Errore durante l\'aggiornamento:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dell'abbonamento. Riprova.",
        variant: "destructive",
      });
    }
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
      case "American Express":
        return <Badge variant="outline" className="border-blue-500 text-blue-700">💳 {metodo}</Badge>;
      case "Carta di debito":
      default:
        return <Badge variant="outline">{metodo}</Badge>;
    }
  };

  // Calcola totali abbonamenti
  const calcolaTotaliAbbonamenti = () => {
    const abbonamentiAttivi = abbonamenti.filter(a => a.attivo);
    
    const totaleMensile = abbonamentiAttivi.reduce((total, abbonamento) => {
      let importoMensile = 0;
      switch (abbonamento.frequenza) {
        case 'mensile':
          importoMensile = abbonamento.importo;
          break;
        case 'trimestrale':
          importoMensile = abbonamento.importo / 3;
          break;
        case 'semestrale':
          importoMensile = abbonamento.importo / 6;
          break;
        case 'annuale':
          importoMensile = abbonamento.importo / 12;
          break;
      }
      return total + importoMensile;
    }, 0);

    const totaleAnnuale = totaleMensile * 12;

    return { totaleMensile, totaleAnnuale };
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-8">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Caricamento dati...</p>
          </div>
        </div>
      </div>
    );
  }

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
                         value="Generato automaticamente"
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

                  {nuovoMovimento.causale === "Altro" && (
                    <div className="space-y-2">
                      <Label htmlFor="causalePersonalizzata">Descrivi la causale *</Label>
                      <Input
                        id="causalePersonalizzata"
                        value={causalePersonalizzata}
                        onChange={(e) => setCausalePersonalizzata(e.target.value)}
                        placeholder="Inserisci la causale personalizzata"
                      />
                    </div>
                  )}

                   <div className="space-y-2">
                     <Label htmlFor="tipoMovimento">Tipo Movimento *</Label>
                     <Select value={nuovoMovimento.tipoMovimento} onValueChange={(value) => setNuovoMovimento({ ...nuovoMovimento, tipoMovimento: value as "incasso" | "acquisto" })}>
                       <SelectTrigger>
                         <SelectValue placeholder="Seleziona tipo movimento" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="incasso">Incasso</SelectItem>
                         <SelectItem value="acquisto">Acquisto</SelectItem>
                       </SelectContent>
                     </Select>
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

                   <div className="flex items-center space-x-2">
                     <Checkbox
                       id="monitorare"
                       checked={nuovoMovimento.monitorare ?? true}
                       onCheckedChange={(checked) => setNuovoMovimento({ ...nuovoMovimento, monitorare: checked as boolean })}
                     />
                     <Label htmlFor="monitorare">Richiede monitoraggio</Label>
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

            {/* Dialog per Modifica Movimento */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Modifica Movimento</DialogTitle>
                  <DialogDescription>
                    Modifica i dettagli del movimento contabile
                  </DialogDescription>
                </DialogHeader>
                {movimentoInModifica && (
                  <form onSubmit={handleUpdateMovimento} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dataEdit">Data Operazione *</Label>
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
                        <Label htmlFor="numeroEdit">Numero Registrazione</Label>
                         <Input
                           id="numeroEdit"
                           value={movimentoInModifica.numeroRegistrazione}
                           disabled
                           className="bg-muted"
                         />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="causaleEdit">Causale *</Label>
                      <Select value={movimentoInModifica.causale} onValueChange={(value) => setMovimentoInModifica({ ...movimentoInModifica, causale: value })}>
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

                    {movimentoInModifica.causale === "Altro" && (
                      <div className="space-y-2">
                        <Label htmlFor="causalePersonalizzataEdit">Descrivi la causale *</Label>
                        <Input
                          id="causalePersonalizzataEdit"
                          value={causalePersonalizzata}
                          onChange={(e) => setCausalePersonalizzata(e.target.value)}
                          placeholder="Inserisci la causale personalizzata"
                        />
                      </div>
                    )}

                     <div className="space-y-2">
                       <Label htmlFor="tipoMovimentoEdit">Tipo Movimento *</Label>
                       <Select value={movimentoInModifica.tipoMovimento} onValueChange={(value) => setMovimentoInModifica({ ...movimentoInModifica, tipoMovimento: value as "incasso" | "acquisto" })}>
                         <SelectTrigger>
                           <SelectValue placeholder="Seleziona tipo movimento" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="incasso">Incasso</SelectItem>
                           <SelectItem value="acquisto">Acquisto</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="importoEdit">Importo (€) *</Label>
                        <Input
                          id="importoEdit"
                          type="number"
                          step="0.01"
                          value={movimentoInModifica.importo || ""}
                          onChange={(e) => setMovimentoInModifica({ ...movimentoInModifica, importo: Number(e.target.value) })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metodoEdit">Metodo di Pagamento</Label>
                        <Select value={movimentoInModifica.metodoPagamento} onValueChange={(value) => setMovimentoInModifica({ ...movimentoInModifica, metodoPagamento: value })}>
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
                      <Label htmlFor="descrizioneEdit">Descrizione</Label>
                      <Input
                        id="descrizioneEdit"
                        value={movimentoInModifica.descrizione || ""}
                        onChange={(e) => setMovimentoInModifica({ ...movimentoInModifica, descrizione: e.target.value })}
                        placeholder="Descrizione del movimento"
                      />
                    </div>

                     <div className="space-y-2">
                       <Label htmlFor="noteEdit">Note</Label>
                       <Textarea
                         id="noteEdit"
                         value={movimentoInModifica.note || ""}
                         onChange={(e) => setMovimentoInModifica({ ...movimentoInModifica, note: e.target.value })}
                         placeholder="Note aggiuntive"
                       />
                     </div>

                     <div className="flex items-center space-x-2">
                       <Checkbox
                         id="monitorareEdit"
                         checked={movimentoInModifica.monitorare ?? true}
                         onCheckedChange={(checked) => setMovimentoInModifica({ ...movimentoInModifica, monitorare: checked as boolean })}
                       />
                       <Label htmlFor="monitorareEdit">Richiede monitoraggio</Label>
                     </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button type="submit">Aggiorna Movimento</Button>
                    </div>
                  </form>
                )}
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
                     <TableHead>Registrato</TableHead>
                     <TableHead>Data</TableHead>
                     <TableHead>N. Registr.</TableHead>
                     <TableHead>Causale</TableHead>
                     <TableHead>Tipo</TableHead>
                     <TableHead className="text-right">Importo</TableHead>
                     <TableHead>Metodo</TableHead>
                     <TableHead>Utente</TableHead>
                     <TableHead>Descrizione</TableHead>
                     <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentiFiltrati.map((movimento) => (
                    <TableRow key={movimento.id} className={movimento.monitorare ? "bg-red-50 border-red-200" : ""}>
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
                       <TableCell>
                         <Badge variant={movimento.tipoMovimento === "incasso" ? "default" : "secondary"}>
                           {movimento.tipoMovimento === "incasso" ? "💰 Incasso" : "🛒 Acquisto"}
                         </Badge>
                       </TableCell>
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
                       <TableCell>
                         <div className="flex items-center space-x-2">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleModificaMovimento(movimento)}
                           >
                             <Edit className="h-4 w-4" />
                           </Button>
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 className="text-destructive hover:text-destructive"
                               >
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   Sei sicuro di voler eliminare questo movimento contabile?
                                   <br />
                                   <strong>Numero:</strong> {movimento.numeroRegistrazione}
                                   <br />
                                   <strong>Causale:</strong> {movimento.causale}
                                   <br />
                                   <strong>Importo:</strong> € {movimento.importo.toFixed(2)}
                                   <br />
                                   Questa azione non può essere annullata.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Annulla</AlertDialogCancel>
                                 <AlertDialogAction
                                   onClick={() => handleDeleteMovimento(movimento)}
                                   className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                 >
                                   Elimina
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         </div>
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

                   <div className="space-y-2">
                     <Label htmlFor="noteAbb">Note</Label>
                     <Textarea
                       id="noteAbb"
                       value={nuovoAbbonamento.note || ""}
                       onChange={(e) => setNuovoAbbonamento({ ...nuovoAbbonamento, note: e.target.value })}
                       placeholder="Note aggiuntive sull'abbonamento"
                     />
                   </div>

                   <div className="flex items-center space-x-2">
                     <Checkbox
                       id="monitorareAbb"
                       checked={nuovoAbbonamento.monitorare ?? true}
                       onCheckedChange={(checked) => setNuovoAbbonamento({ ...nuovoAbbonamento, monitorare: checked as boolean })}
                     />
                     <Label htmlFor="monitorareAbb">Richiede monitoraggio</Label>
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

            {/* Dialog per Modifica Abbonamento */}
            <Dialog open={isEditAbbonamentoDialogOpen} onOpenChange={setIsEditAbbonamentoDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Modifica Abbonamento</DialogTitle>
                  <DialogDescription>
                    Modifica i dettagli dell'abbonamento ricorrente
                  </DialogDescription>
                </DialogHeader>
                {abbonamentoInModifica && (
                  <form onSubmit={handleUpdateAbbonamento} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nomeEdit">Nome Abbonamento *</Label>
                        <Input
                          id="nomeEdit"
                          value={abbonamentoInModifica.nome || ""}
                          onChange={(e) => setAbbonamentoInModifica({ ...abbonamentoInModifica, nome: e.target.value })}
                          placeholder="es. Office 365, Assicurazione..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="importoAbbEdit">Importo (€) *</Label>
                        <Input
                          id="importoAbbEdit"
                          type="number"
                          step="0.01"
                          value={abbonamentoInModifica.importo || ""}
                          onChange={(e) => setAbbonamentoInModifica({ ...abbonamentoInModifica, importo: Number(e.target.value) })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="frequenzaEdit">Frequenza *</Label>
                        <Select value={abbonamentoInModifica.frequenza} onValueChange={(value) => setAbbonamentoInModifica({ ...abbonamentoInModifica, frequenza: value as AbbonamentoRicorrente["frequenza"] })}>
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
                        <Label htmlFor="prossimoPagamentoEdit">Prossimo Pagamento</Label>
                        <Input
                          id="prossimoPagamentoEdit"
                          type="date"
                          value={abbonamentoInModifica.prossimoPagamento || ""}
                          onChange={(e) => setAbbonamentoInModifica({ ...abbonamentoInModifica, prossimoPagamento: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="causaleAbbEdit">Causale</Label>
                        <Select value={abbonamentoInModifica.causale} onValueChange={(value) => setAbbonamentoInModifica({ ...abbonamentoInModifica, causale: value })}>
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
                        <Label htmlFor="metodoAbbEdit">Metodo di Pagamento</Label>
                        <Select value={abbonamentoInModifica.metodoPagamento} onValueChange={(value) => setAbbonamentoInModifica({ ...abbonamentoInModifica, metodoPagamento: value })}>
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
                       <Label htmlFor="noteAbbEdit">Note</Label>
                       <Textarea
                         id="noteAbbEdit"
                         value={abbonamentoInModifica.note || ""}
                         onChange={(e) => setAbbonamentoInModifica({ ...abbonamentoInModifica, note: e.target.value })}
                         placeholder="Note aggiuntive sull'abbonamento"
                       />
                     </div>

                     <div className="flex items-center space-x-2">
                       <Checkbox
                         id="monitorareAbbEdit"
                         checked={abbonamentoInModifica.monitorare ?? true}
                         onCheckedChange={(checked) => setAbbonamentoInModifica({ ...abbonamentoInModifica, monitorare: checked as boolean })}
                       />
                       <Label htmlFor="monitorareAbbEdit">Richiede monitoraggio</Label>
                     </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsEditAbbonamentoDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button type="submit">Aggiorna Abbonamento</Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Elenco Abbonamenti */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Repeat className="mr-2 h-5 w-5" />
                Abbonamenti Attivi ({abbonamenti.filter(a => a.attivo).length})
              </CardTitle>
              <CardDescription>
                Gestione abbonamenti e pagamenti ricorrenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Frequenza</TableHead>
                    <TableHead>Prossimo Pagamento</TableHead>
                    <TableHead>Causale</TableHead>
                    <TableHead>Metodo</TableHead>
                     <TableHead>Stato</TableHead>
                     <TableHead>Note</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {abbonamenti.map((abbonamento) => (
                     <TableRow key={abbonamento.id} className={abbonamento.monitorare ? "bg-red-50 border-red-200" : ""}>
                       <TableCell className="font-medium">{abbonamento.nome}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <Euro className="mr-1 h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{abbonamento.importo.toFixed(2)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getFrequenzaBadge(abbonamento.frequenza)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          {format(new Date(abbonamento.prossimoPagamento), "dd/MM/yyyy", { locale: it })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{abbonamento.causale}</Badge>
                      </TableCell>
                      <TableCell>{getMetodoPagamentoBadge(abbonamento.metodoPagamento)}</TableCell>
                       <TableCell>
                         <Badge variant={abbonamento.attivo ? "default" : "secondary"}>
                           {abbonamento.attivo ? "Attivo" : "Inattivo"}
                         </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                         <div className="truncate" title={abbonamento.note}>
                           {abbonamento.note || "-"}
                         </div>
                       </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleModificaAbbonamento(abbonamento)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Totali Abbonamenti */}
              {abbonamenti.length > 0 && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center">
                    <Euro className="mr-2 h-4 w-4" />
                    Riepilogo Costi Abbonamenti
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center p-3 bg-background rounded border">
                      <span className="text-sm font-medium">Totale Mensile:</span>
                      <span className="font-bold text-lg">€ {calcolaTotaliAbbonamenti().totaleMensile.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-background rounded border">
                      <span className="text-sm font-medium">Totale Annuale:</span>
                      <span className="font-bold text-lg">€ {calcolaTotaliAbbonamenti().totaleAnnuale.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
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