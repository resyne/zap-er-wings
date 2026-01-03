import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Link2,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface MovimentoFinanziario {
  id: string;
  data_movimento: string;
  importo: number;
  direzione: "entrata" | "uscita";
  metodo_pagamento: "banca" | "cassa" | "carta";
  soggetto_tipo: string | null;
  soggetto_id: string | null;
  soggetto_nome: string | null;
  allegato_url: string | null;
  allegato_nome: string | null;
  riferimento: string | null;
  descrizione: string | null;
  tipo_allocazione: string | null;
  scadenza_id: string | null;
  fattura_id: string | null;
  centro_costo_id: string | null;
  centro_ricavo_id: string | null;
  conto_id: string | null;
  prima_nota_id: string | null;
  stato: "grezzo" | "da_verificare" | "da_classificare" | "allocato" | "contabilizzato";
  created_by: string | null;
  created_at: string;
  note_cfo: string | null;
}

const statoConfig = {
  grezzo: { label: "Grezzo", color: "bg-gray-500", icon: Clock },
  da_verificare: { label: "Da Verificare", color: "bg-yellow-500", icon: AlertCircle },
  da_classificare: { label: "Da Classificare", color: "bg-orange-500", icon: AlertCircle },
  allocato: { label: "Allocato", color: "bg-blue-500", icon: Link2 },
  contabilizzato: { label: "Contabilizzato", color: "bg-green-500", icon: CheckCircle },
};

export default function MovimentiFinanziariPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStato, setFilterStato] = useState<string>("all");
  const [filterDirezione, setFilterDirezione] = useState<string>("all");

  // Fetch movimenti finanziari
  const { data: movimenti = [], isLoading } = useQuery({
    queryKey: ["movimenti-finanziari"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_finanziari")
        .select("*")
        .order("data_movimento", { ascending: false });
      
      if (error) throw error;
      return data as MovimentoFinanziario[];
    },
  });

  // Filter movimenti
  const filteredMovimenti = movimenti.filter((m) => {
    const matchesSearch = 
      (m.soggetto_nome?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (m.riferimento?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (m.descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesStato = filterStato === "all" || m.stato === filterStato;
    const matchesDirezione = filterDirezione === "all" || m.direzione === filterDirezione;
    
    return matchesSearch && matchesStato && matchesDirezione;
  });

  // Stats
  const stats = {
    totale: movimenti.length,
    daClassificare: movimenti.filter((m) => m.stato === "grezzo" || m.stato === "da_verificare" || m.stato === "da_classificare").length,
    allocati: movimenti.filter((m) => m.stato === "allocato").length,
    contabilizzati: movimenti.filter((m) => m.stato === "contabilizzato").length,
    entrate: movimenti.filter((m) => m.direzione === "entrata").reduce((sum, m) => sum + Number(m.importo), 0),
    uscite: movimenti.filter((m) => m.direzione === "uscita").reduce((sum, m) => sum + Number(m.importo), 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handleGoToClassification = () => {
    navigate("/management-control-2/classification");
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Movimenti Finanziari</h1>
          <p className="text-muted-foreground">
            Gestione incassi, pagamenti, anticipi e rimborsi
          </p>
        </div>
        {stats.daClassificare > 0 && (
          <Button onClick={handleGoToClassification}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Vai a Classificazione Eventi ({stats.daClassificare})
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Da Classificare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.daClassificare}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Allocati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.allocati}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contabilizzati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.contabilizzati}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Entrate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.entrate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Uscite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.uscite)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per soggetto, riferimento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStato} onValueChange={setFilterStato}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="grezzo">Grezzo</SelectItem>
                <SelectItem value="da_verificare">Da Verificare</SelectItem>
                <SelectItem value="da_classificare">Da Classificare</SelectItem>
                <SelectItem value="allocato">Allocato</SelectItem>
                <SelectItem value="contabilizzato">Contabilizzato</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDirezione} onValueChange={setFilterDirezione}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Direzione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="entrata">Entrate</SelectItem>
                <SelectItem value="uscita">Uscite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Caricamento...
            </div>
          ) : filteredMovimenti.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun movimento trovato
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Direzione</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Soggetto</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Allegato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovimenti.map((movimento) => {
                  const statoInfo = statoConfig[movimento.stato];
                  const StatoIcon = statoInfo.icon;
                  
                  return (
                    <TableRow key={movimento.id}>
                      <TableCell>
                        {format(new Date(movimento.data_movimento), "dd/MM/yyyy", { locale: it })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {movimento.direzione === "entrata" ? (
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={movimento.direzione === "entrata" ? "text-green-600" : "text-red-600"}>
                            {movimento.direzione === "entrata" ? "Entrata" : "Uscita"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(movimento.importo))}
                      </TableCell>
                      <TableCell className="capitalize">
                        {movimento.metodo_pagamento}
                      </TableCell>
                      <TableCell>
                        {movimento.soggetto_nome || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {movimento.descrizione || movimento.riferimento || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statoInfo.color} text-white`}>
                          <StatoIcon className="h-3 w-3 mr-1" />
                          {statoInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {movimento.allegato_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(movimento.allegato_url!, "_blank")}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
