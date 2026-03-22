import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, BarChart3, FileText, Wrench, Check, Eye, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  useManagementCommesse,
  useCreateManagementCommessa,
  useUpdateManagementCommessa,
  useDeleteManagementCommessa,
  useCommesseTotals,
  useManagementDataMap,
  useUpsertManagementData,
  getRiferimentoPeriodo,
  type ManagementCommessa,
} from "@/hooks/useManagementCommesse";

const emptyForm = {
  codice_commessa: "",
  cliente: "",
  descrizione: "",
  stato: "acquisita" as ManagementCommessa["stato"],
  data: new Date().toISOString().split("T")[0],
  ricavo: 0,
  costo_diretto_stimato: 0,
  note: "",
};

const statoColors: Record<string, string> = {
  acquisita: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_corso: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  chiusa: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  annullata: "bg-muted text-muted-foreground",
};

const statoLabels: Record<string, string> = {
  acquisita: "Acquisita",
  in_corso: "In Corso",
  chiusa: "Chiusa",
  annullata: "Annullata",
};

const fmt = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
};

const formatTime = (t: string | null) => {
  if (!t) return "-";
  return t;
};

// Fetch commesse with ALL fields
const useCommesseWithCustomer = () => {
  return useQuery({
    queryKey: ["gestione-commesse-reali"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commesse")
        .select("*, customers(name, company_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch service reports with ALL fields
const useServiceReportsGestione = () => {
  return useQuery({
    queryKey: ["gestione-service-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_reports")
        .select("*, customers(name, company_name)")
        .order("intervention_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const commessaStatusColors: Record<string, string> = {
  bozza: "bg-muted text-muted-foreground",
  confermata: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_lavorazione: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completata: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  archiviata: "bg-muted text-muted-foreground",
  annullata: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const reportStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  invoiced: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

// --- Detail row helper ---
const DetailRow = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className="flex justify-between items-start py-1.5">
    <span className="text-sm text-muted-foreground shrink-0">{label}</span>
    <span className={`text-sm font-medium text-right max-w-[60%] ${className || ""}`}>{value || "-"}</span>
  </div>
);

// --- Commessa Detail Dialog ---
const CommessaDetailDialog = ({ commessa, managementData, upsertMut }: { commessa: any; managementData?: ManagementCommessa; upsertMut: ReturnType<typeof useUpsertManagementData> }) => {
  const [open, setOpen] = useState(false);
  const [ricavo, setRicavo] = useState(Number(managementData?.ricavo || 0));
  const [costo, setCosto] = useState(Number(managementData?.costo_diretto_stimato || 0));
  const [dataCompetenza, setDataCompetenza] = useState(managementData?.data_competenza || "");
  const [dataFattura, setDataFattura] = useState(managementData?.data_fattura || "");
  const [numeroFattura, setNumeroFattura] = useState(managementData?.numero_fattura || "");
  const [editing, setEditing] = useState(false);

  const customerName = commessa.customers?.company_name || commessa.customers?.name || "-";
  const margine = ricavo - costo;
  const marginePct = ricavo > 0 ? (margine / ricavo) * 100 : 0;

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val) {
      setRicavo(Number(managementData?.ricavo || 0));
      setCosto(Number(managementData?.costo_diretto_stimato || 0));
      setDataCompetenza(managementData?.data_competenza || "");
      setDataFattura(managementData?.data_fattura || "");
      setNumeroFattura(managementData?.numero_fattura || "");
      setEditing(false);
    }
  };

  const handleSave = () => {
    upsertMut.mutate({
      commessa_id: commessa.id,
      codice_commessa: commessa.number,
      cliente: customerName,
      ricavo,
      costo_diretto_stimato: costo,
      data_competenza: dataCompetenza || null,
      data_fattura: dataFattura || null,
      numero_fattura: numeroFattura || null,
      existing_id: managementData?.id,
    }, { onSuccess: () => setEditing(false) });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Commessa {commessa.number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info generali */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Informazioni Generali</h4>
            <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
              <DetailRow label="Numero" value={commessa.number} />
              <DetailRow label="Titolo" value={commessa.title} />
              <DetailRow label="Cliente" value={customerName} />
              <DetailRow label="Tipo" value={commessa.type?.replace(/_/g, " ")} />
              <DetailRow label="Stato" value={
                <Badge className={commessaStatusColors[commessa.status] || "bg-muted text-muted-foreground"}>
                  {commessa.status?.replace(/_/g, " ")}
                </Badge>
              } />
              <DetailRow label="Priorità" value={commessa.priority || "-"} />
              <DetailRow label="Descrizione" value={commessa.description} />
              <DetailRow label="Data Creazione" value={formatDate(commessa.created_at)} />
              <DetailRow label="Scadenza" value={formatDate(commessa.deadline)} />
            </div>
          </div>

          {/* Dettagli tecnici */}
          {(commessa.article || commessa.diameter || commessa.smoke_inlet || commessa.intervention_type) && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Dettagli Tecnici</h4>
              <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
                {commessa.article && <DetailRow label="Articolo" value={commessa.article} />}
                {commessa.diameter && <DetailRow label="Diametro" value={commessa.diameter} />}
                {commessa.smoke_inlet && <DetailRow label="Ingresso fumi" value={commessa.smoke_inlet} />}
                {commessa.intervention_type && <DetailRow label="Tipo Intervento" value={commessa.intervention_type} />}
                {commessa.delivery_mode && <DetailRow label="Modalità Consegna" value={commessa.delivery_mode} />}
              </div>
            </div>
          )}

          {/* Spedizione */}
          {(commessa.shipping_address || commessa.shipping_city) && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Spedizione</h4>
              <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
                <DetailRow label="Indirizzo" value={commessa.shipping_address} />
                <DetailRow label="Città" value={[commessa.shipping_city, commessa.shipping_province, commessa.shipping_postal_code].filter(Boolean).join(", ")} />
                <DetailRow label="Paese" value={commessa.shipping_country} />
              </div>
            </div>
          )}

          {/* Pagamento */}
          {(commessa.payment_amount || commessa.payment_on_delivery || commessa.is_warranty) && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Pagamento</h4>
              <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
                {commessa.payment_amount != null && <DetailRow label="Importo" value={fmt(Number(commessa.payment_amount))} />}
                <DetailRow label="Pagamento alla consegna" value={commessa.payment_on_delivery ? "Sì" : "No"} />
                <DetailRow label="In garanzia" value={commessa.is_warranty ? "Sì" : "No"} />
              </div>
            </div>
          )}

          {/* Note */}
          {commessa.notes && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Note</h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{commessa.notes}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Dati Gestionali */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Dati Gestionali (Imponibile)</h4>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" />{managementData ? "Modifica" : "Compila"}
                </Button>
              )}
            </div>

            {editing ? (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Ricavo Imponibile (€)</Label>
                    <Input type="number" min={0} value={ricavo} onChange={e => setRicavo(Math.max(0, Number(e.target.value)))} />
                  </div>
                  <div>
                    <Label className="text-xs">Costo Diretto Stimato (€)</Label>
                    <Input type="number" min={0} value={costo} onChange={e => setCosto(Math.max(0, Number(e.target.value)))} />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground">Riferimento Periodo</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Data Competenza</Label>
                    <Input type="date" value={dataCompetenza} onChange={e => setDataCompetenza(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fattura</Label>
                    <Input type="date" value={dataFattura} onChange={e => setDataFattura(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">N° Fattura</Label>
                    <Input value={numeroFattura} onChange={e => setNumeroFattura(e.target.value)} placeholder="es. FV-2026-001" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                  <span className="text-sm font-medium">Margine</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${margine >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(margine)}</span>
                    <Badge variant={margine >= 0 ? "default" : "destructive"} className="text-xs">{marginePct.toFixed(1)}%</Badge>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Annulla</Button>
                  <Button size="sm" onClick={handleSave} disabled={upsertMut.isPending}>
                    <Save className="h-3 w-3 mr-1" />Salva
                  </Button>
                </div>
              </div>
            ) : managementData ? (
              <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
                <DetailRow label="Ricavo" value={fmt(Number(managementData.ricavo))} />
                <DetailRow label="Costo Diretto Stimato" value={fmt(Number(managementData.costo_diretto_stimato))} className="text-orange-600" />
                <DetailRow label="Margine" value={
                  <span className={Number(managementData.margine_calcolato) >= 0 ? "text-green-600" : "text-red-600"}>
                    {fmt(Number(managementData.margine_calcolato))}
                  </span>
                } />
                <DetailRow label="% Margine" value={
                  <Badge variant={Number(managementData.margine_calcolato) >= 0 ? "default" : "destructive"} className="text-xs">
                    {(Number(managementData.ricavo) > 0 ? (Number(managementData.margine_calcolato) / Number(managementData.ricavo) * 100) : 0).toFixed(1)}%
                  </Badge>
                } />
                {managementData.data_fattura && <DetailRow label="Data Fattura" value={formatDate(managementData.data_fattura)} />}
                {managementData.numero_fattura && <DetailRow label="N° Fattura" value={managementData.numero_fattura} />}
                {managementData.data_competenza && <DetailRow label="Data Competenza" value={formatDate(managementData.data_competenza)} />}
                <DetailRow label="Periodo Rif." value={
                  <Badge variant="outline" className="text-xs">{getRiferimentoPeriodo(managementData)}</Badge>
                } />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nessun dato gestionale inserito.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Service Report Detail Dialog ---
const ReportDetailDialog = ({ report, managementData, upsertMut }: { report: any; managementData?: ManagementCommessa; upsertMut: ReturnType<typeof useUpsertManagementData> }) => {
  const [open, setOpen] = useState(false);
  const [ricavo, setRicavo] = useState(Number(managementData?.ricavo || 0));
  const [costo, setCosto] = useState(Number(managementData?.costo_diretto_stimato || 0));
  const [dataCompetenza, setDataCompetenza] = useState(managementData?.data_competenza || "");
  const [dataFattura, setDataFattura] = useState(managementData?.data_fattura || report.invoice_date || "");
  const [numeroFattura, setNumeroFattura] = useState(managementData?.numero_fattura || report.invoice_number || "");
  const [editing, setEditing] = useState(false);

  const customerName = report.customers?.company_name || report.customers?.name || "-";
  const margine = ricavo - costo;
  const marginePct = ricavo > 0 ? (margine / ricavo) * 100 : 0;

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val) {
      setRicavo(Number(managementData?.ricavo || 0));
      setCosto(Number(managementData?.costo_diretto_stimato || 0));
      setDataCompetenza(managementData?.data_competenza || "");
      setDataFattura(managementData?.data_fattura || report.invoice_date || "");
      setNumeroFattura(managementData?.numero_fattura || report.invoice_number || "");
      setEditing(false);
    }
  };

  const handleSave = () => {
    upsertMut.mutate({
      service_report_id: report.id,
      codice_commessa: report.report_number || report.id.slice(0, 8),
      cliente: customerName,
      ricavo,
      costo_diretto_stimato: costo,
      data_competenza: dataCompetenza || null,
      data_fattura: dataFattura || null,
      numero_fattura: numeroFattura || null,
      existing_id: managementData?.id,
    }, { onSuccess: () => setEditing(false) });
  };

  const reportStatusLabel = (s: string) => {
    if (s === "completed") return "Completato";
    if (s === "draft") return "Bozza";
    if (s === "invoiced") return "Fatturato";
    return s;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Rapporto {report.report_number || "-"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info generali */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Informazioni Generali</h4>
            <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
              <DetailRow label="N° Rapporto" value={report.report_number} />
              <DetailRow label="Cliente" value={customerName} />
              <DetailRow label="Tipo Intervento" value={report.intervention_type} />
              <DetailRow label="Stato" value={
                <Badge className={reportStatusColors[report.status] || "bg-muted text-muted-foreground"}>
                  {reportStatusLabel(report.status)}
                </Badge>
              } />
              <DetailRow label="Data Intervento" value={formatDate(report.intervention_date)} />
              <DetailRow label="Orario Inizio" value={formatTime(report.start_time)} />
              <DetailRow label="Orario Fine" value={formatTime(report.end_time)} />
              <DetailRow label="Tecnico" value={report.technician_name} />
              <DetailRow label="N° Tecnici" value={report.technicians_count} />
              <DetailRow label="Descrizione" value={report.description} />
            </div>
          </div>

          {/* Lavoro eseguito */}
          {report.work_performed && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Lavoro Eseguito</h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{report.work_performed}</p>
              </div>
            </div>
          )}

          {/* Ore e km */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Dettagli Operativi</h4>
            <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
              <DetailRow label="Ore Capo Tecnico" value={report.head_technician_hours != null ? `${report.head_technician_hours}h` : "-"} />
              <DetailRow label="Ore Tecnico Specializzato" value={report.specialized_technician_hours != null ? `${report.specialized_technician_hours}h` : "-"} />
              <DetailRow label="Chilometri" value={report.kilometers != null ? `${report.kilometers} km` : "-"} />
              <DetailRow label="Materiali Utilizzati" value={report.materials_used} />
              <DetailRow label="In Garanzia" value={report.is_warranty ? "Sì" : "No"} />
              <DetailRow label="Contratto Manutenzione" value={report.is_maintenance_contract ? "Sì" : "No"} />
            </div>
          </div>

          {/* Importi */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Importi Documento</h4>
            <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
              <DetailRow label="Imponibile" value={report.amount != null ? fmt(Number(report.amount)) : "-"} />
              <DetailRow label="Aliquota IVA" value={report.vat_rate != null ? `${report.vat_rate}%` : "-"} />
              <DetailRow label="Totale" value={report.total_amount != null ? fmt(Number(report.total_amount)) : "-"} />
            </div>
          </div>

          {/* Pagamento */}
          {(report.payment_amount || report.payment_method || report.payment_status !== "pending") && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Pagamento</h4>
              <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
                <DetailRow label="Stato Pagamento" value={report.payment_status} />
                <DetailRow label="Importo Pagamento" value={report.payment_amount != null ? fmt(Number(report.payment_amount)) : "-"} />
                <DetailRow label="Metodo" value={report.payment_method} />
                <DetailRow label="Data Pagamento" value={formatDate(report.payment_date)} />
                {report.payment_notes && <DetailRow label="Note Pagamento" value={report.payment_notes} />}
              </div>
            </div>
          )}

          {/* Fatturazione */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Fatturazione</h4>
            <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
              <DetailRow label="Fatturato" value={report.invoiced ? "Sì" : "No"} />
              <DetailRow label="N° Fattura" value={report.invoice_number} />
              <DetailRow label="Data Fattura" value={formatDate(report.invoice_date)} />
              <DetailRow label="Non Contabilizzato" value={report.non_contabilizzato ? "Sì" : "No"} />
            </div>
          </div>

          {/* Note */}
          {report.notes && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Note</h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Dati Gestionali */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Dati Gestionali (Imponibile)</h4>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" />{managementData ? "Modifica" : "Compila"}
                </Button>
              )}
            </div>

            {editing ? (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Ricavo Imponibile (€)</Label>
                    <Input type="number" min={0} value={ricavo} onChange={e => setRicavo(Math.max(0, Number(e.target.value)))} />
                  </div>
                  <div>
                    <Label className="text-xs">Costo Diretto Stimato (€)</Label>
                    <Input type="number" min={0} value={costo} onChange={e => setCosto(Math.max(0, Number(e.target.value)))} />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground">Riferimento Periodo</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Data Competenza</Label>
                    <Input type="date" value={dataCompetenza} onChange={e => setDataCompetenza(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fattura</Label>
                    <Input type="date" value={dataFattura} onChange={e => setDataFattura(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">N° Fattura</Label>
                    <Input value={numeroFattura} onChange={e => setNumeroFattura(e.target.value)} placeholder="es. FV-2026-001" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                  <span className="text-sm font-medium">Margine</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${margine >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(margine)}</span>
                    <Badge variant={margine >= 0 ? "default" : "destructive"} className="text-xs">{marginePct.toFixed(1)}%</Badge>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Annulla</Button>
                  <Button size="sm" onClick={handleSave} disabled={upsertMut.isPending}>
                    <Save className="h-3 w-3 mr-1" />Salva
                  </Button>
                </div>
              </div>
            ) : managementData ? (
              <div className="bg-muted/30 rounded-lg p-3 space-y-0.5">
                <DetailRow label="Ricavo" value={fmt(Number(managementData.ricavo))} />
                <DetailRow label="Costo Diretto Stimato" value={fmt(Number(managementData.costo_diretto_stimato))} className="text-orange-600" />
                <DetailRow label="Margine" value={
                  <span className={Number(managementData.margine_calcolato) >= 0 ? "text-green-600" : "text-red-600"}>
                    {fmt(Number(managementData.margine_calcolato))}
                  </span>
                } />
                <DetailRow label="% Margine" value={
                  <Badge variant={Number(managementData.margine_calcolato) >= 0 ? "default" : "destructive"} className="text-xs">
                    {(Number(managementData.ricavo) > 0 ? (Number(managementData.margine_calcolato) / Number(managementData.ricavo) * 100) : 0).toFixed(1)}%
                  </Badge>
                } />
                {managementData.data_fattura && <DetailRow label="Data Fattura" value={formatDate(managementData.data_fattura)} />}
                {managementData.numero_fattura && <DetailRow label="N° Fattura" value={managementData.numero_fattura} />}
                {managementData.data_competenza && <DetailRow label="Data Competenza" value={formatDate(managementData.data_competenza)} />}
                <DetailRow label="Periodo Rif." value={
                  <Badge variant="outline" className="text-xs">{getRiferimentoPeriodo(managementData)}</Badge>
                } />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nessun dato gestionale inserito.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CommesseGestioneSection = () => {
  const { data: managementCommesse = [] } = useManagementCommesse();
  const { data: commesseReali = [] } = useCommesseWithCustomer();
  const { data: serviceReports = [] } = useServiceReportsGestione();
  const createMut = useCreateManagementCommessa();
  const updateMut = useUpdateManagementCommessa();
  const deleteMut = useDeleteManagementCommessa();
  const upsertMut = useUpsertManagementData();
  const totals = useCommesseTotals(managementCommesse);
  const { byCommessa, byReport } = useManagementDataMap(managementCommesse);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("ordini");

  const openNew = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: ManagementCommessa) => {
    setEditId(c.id);
    setForm({
      codice_commessa: c.codice_commessa,
      cliente: c.cliente,
      descrizione: c.descrizione || "",
      stato: c.stato,
      data: c.data,
      ricavo: c.ricavo,
      costo_diretto_stimato: c.costo_diretto_stimato,
      note: c.note || "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.codice_commessa || !form.cliente) return;
    if (editId) {
      updateMut.mutate({ id: editId, ...form }, { onSuccess: () => setOpen(false) });
    } else {
      createMut.mutate(form, { onSuccess: () => setOpen(false) });
    }
  };

  const marginePreview = form.ricavo - form.costo_diretto_stimato;
  const marginePctPreview = form.ricavo > 0 ? (marginePreview / form.ricavo) * 100 : 0;

  const commesseWithData = commesseReali.filter((c: any) => !!byCommessa[c.id]).length;
  const reportsWithData = serviceReports.filter((r: any) => !!byReport[r.id]).length;

  // Badge for management data status
  const mgmtBadge = (data?: ManagementCommessa) => {
    if (!data) return <Badge variant="outline" className="text-[10px]">Da compilare</Badge>;
    const m = Number(data.margine_calcolato);
    return (
      <Badge variant={m >= 0 ? "default" : "destructive"} className="text-[10px]">
        {fmt(m)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" />Commesse Totali</div>
            <div className="text-2xl font-bold">{commesseReali.length}</div>
            <p className="text-xs text-muted-foreground">{commesseWithData} con dati gestionali</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Wrench className="h-4 w-4" />Rapporti di Intervento</div>
            <div className="text-2xl font-bold">{serviceReports.length}</div>
            <p className="text-xs text-muted-foreground">{reportsWithData} con dati gestionali</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" />Ricavi Gestione</div>
            <div className="text-2xl font-bold">{fmt(totals.totaleRicavi)}</div>
            <p className="text-xs text-muted-foreground">Costi var.: {fmt(totals.totaleCostiDiretti)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />Margine Lordo</div>
            <div className={`text-2xl font-bold ${totals.totaleMargineLordo >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(totals.totaleMargineLordo)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Commesse & Rapporti di Intervento</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="ordini">
                Ordini / Commesse
                <Badge variant="secondary" className="ml-2 text-xs">{commesseReali.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="rapporti">
                Rapporti di Intervento
                <Badge variant="secondary" className="ml-2 text-xs">{serviceReports.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="gestione">
                Commesse Manuali
                <Badge variant="secondary" className="ml-2 text-xs">{managementCommesse.filter(c => !c.commessa_id && !c.service_report_id).length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Ordini / Commesse */}
            <TabsContent value="ordini">
              {commesseReali.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Nessuna commessa trovata nel sistema.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Margine</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commesseReali.map((c: any) => {
                        const customerName = c.customers?.company_name || c.customers?.name || "-";
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.number}</TableCell>
                            <TableCell>{customerName}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{c.title}</TableCell>
                            <TableCell>
                              <Badge className={commessaStatusColors[c.status] || "bg-muted text-muted-foreground"}>
                                {c.status?.replace(/_/g, " ") || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>{mgmtBadge(byCommessa[c.id])}</TableCell>
                            <TableCell>
                              <CommessaDetailDialog commessa={c} managementData={byCommessa[c.id]} upsertMut={upsertMut} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tab: Rapporti di Intervento */}
            <TabsContent value="rapporti">
              {serviceReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Nessun rapporto di intervento trovato.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Rapporto</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Margine</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceReports.map((r: any) => {
                        const customerName = r.customers?.company_name || r.customers?.name || "-";
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.report_number || "-"}</TableCell>
                            <TableCell>{formatDate(r.intervention_date)}</TableCell>
                            <TableCell>{customerName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">{r.intervention_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={reportStatusColors[r.status] || "bg-muted text-muted-foreground"}>
                                {r.status === "completed" ? "Completato" : r.status === "draft" ? "Bozza" : r.status === "invoiced" ? "Fatturato" : r.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{mgmtBadge(byReport[r.id])}</TableCell>
                            <TableCell>
                              <ReportDetailDialog report={r} managementData={byReport[r.id]} upsertMut={upsertMut} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tab: Commesse Gestione (manuale) */}
            <TabsContent value="gestione">
              <div className="flex justify-end mb-4">
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nuova Commessa</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{editId ? "Modifica Commessa" : "Nuova Commessa"}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Codice Commessa *</Label>
                          <Input value={form.codice_commessa} onChange={e => setForm(f => ({ ...f, codice_commessa: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Cliente *</Label>
                          <Input value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <Label>Descrizione</Label>
                        <Input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Stato</Label>
                          <Select value={form.stato} onValueChange={v => setForm(f => ({ ...f, stato: v as any }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="acquisita">Acquisita</SelectItem>
                              <SelectItem value="in_corso">In Corso</SelectItem>
                              <SelectItem value="chiusa">Chiusa</SelectItem>
                              <SelectItem value="annullata">Annullata</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Data</Label>
                          <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Ricavo Imponibile (€)</Label>
                          <Input type="number" min={0} value={form.ricavo} onChange={e => setForm(f => ({ ...f, ricavo: Math.max(0, Number(e.target.value)) }))} />
                        </div>
                        <div>
                          <Label>Costo Diretto Stimato (€)</Label>
                          <Input type="number" min={0} value={form.costo_diretto_stimato} onChange={e => setForm(f => ({ ...f, costo_diretto_stimato: Math.max(0, Number(e.target.value)) }))} />
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 flex justify-between items-center">
                        <span className="text-sm font-medium">Margine calcolato</span>
                        <div className="text-right">
                          <span className={`font-bold ${marginePreview >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(marginePreview)}</span>
                          <Badge variant={marginePreview >= 0 ? "default" : "destructive"} className="ml-2 text-xs">{marginePctPreview.toFixed(1)}%</Badge>
                        </div>
                      </div>
                      <div>
                        <Label>Note</Label>
                        <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} />
                      </div>
                      <Button onClick={save} disabled={!form.codice_commessa || !form.cliente || createMut.isPending || updateMut.isPending} className="w-full">
                        {editId ? "Salva Modifiche" : "Aggiungi Commessa"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {managementCommesse.filter(c => !c.commessa_id && !c.service_report_id).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Nessuna commessa manuale inserita. Clicca "Nuova Commessa" per iniziare.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codice</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Ricavo</TableHead>
                      <TableHead className="text-right">Costo Diretto</TableHead>
                      <TableHead className="text-right">Margine</TableHead>
                      <TableHead className="text-right">% Margine</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managementCommesse.filter(c => !c.commessa_id && !c.service_report_id).map(c => {
                      const margine = Number(c.margine_calcolato);
                      const pct = Number(c.ricavo) > 0 ? (margine / Number(c.ricavo)) * 100 : 0;
                      return (
                        <TableRow key={c.id} className={c.stato === "annullata" ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{c.codice_commessa}</TableCell>
                          <TableCell>{c.cliente}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{c.descrizione || "-"}</TableCell>
                          <TableCell><Badge className={statoColors[c.stato]}>{statoLabels[c.stato]}</Badge></TableCell>
                          <TableCell className="text-right">{fmt(Number(c.ricavo))}</TableCell>
                          <TableCell className="text-right text-orange-600">{fmt(Number(c.costo_diretto_stimato))}</TableCell>
                          <TableCell className={`text-right font-medium ${margine >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(margine)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={margine >= 0 ? "default" : "destructive"} className="text-xs">{pct.toFixed(1)}%</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommesseGestioneSection;
