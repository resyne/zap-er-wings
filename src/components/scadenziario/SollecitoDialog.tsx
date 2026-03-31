import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mail, MessageSquare, Send, History, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Scadenza {
  id: string;
  fattura_id: string | null;
  tipo: "credito" | "debito";
  soggetto_nome: string | null;
  soggetto_id: string | null;
  data_scadenza: string;
  importo_totale: number;
  importo_residuo: number;
  invoice_number?: string;
  solleciti_count?: number;
}

interface SollecitoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scadenza: Scadenza | null;
}

const COORDINATE_BANCARIE = `CLIMATEL di ELEFANTE PASQUALE
IBAN: IT82 S030 6976 4511 0000 0003 441
Causale: Pagamento fattura N. {INVOICE_NUMBER}`;

const LIVELLO_LABELS: Record<number, { label: string; tono: string; color: string }> = {
  1: { label: "1° Sollecito", tono: "cortese", color: "bg-blue-100 text-blue-800 border-blue-300" },
  2: { label: "2° Sollecito", tono: "formale", color: "bg-amber-100 text-amber-800 border-amber-300" },
  3: { label: "3° Sollecito", tono: "ultimativo", color: "bg-red-100 text-red-800 border-red-300" },
};

function generateMessage(scadenza: Scadenza, livello: number): string {
  const nome = scadenza.soggetto_nome || "Gentile Cliente";
  const fattura = scadenza.invoice_number || "N/D";
  const importo = `€ ${Number(scadenza.importo_residuo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
  const scadenzaDate = format(parseISO(scadenza.data_scadenza), "dd/MM/yyyy");
  const coordinate = COORDINATE_BANCARIE.replace("{INVOICE_NUMBER}", fattura);

  if (livello === 1) {
    return `Gentile ${nome},

con la presente desideriamo ricordarLe che la fattura n. ${fattura} con scadenza ${scadenzaDate} risulta ancora non saldata per un importo residuo di ${importo}.

La preghiamo di voler provvedere al pagamento al più presto possibile utilizzando le seguenti coordinate:

${coordinate}

Qualora il pagamento fosse già stato effettuato, La preghiamo di voler inviare copia della disposizione di pagamento.

Cordiali saluti,
Abbattitori Zapper S.r.l.`;
  }

  if (livello === 2) {
    return `Gentile ${nome},

facciamo seguito alla nostra precedente comunicazione per segnalarLe che la fattura n. ${fattura} con scadenza ${scadenzaDate} risulta ancora insoluta per un importo di ${importo}.

La invitiamo cortesemente a regolarizzare la Sua posizione entro 7 giorni dalla ricezione del presente sollecito, effettuando il pagamento tramite:

${coordinate}

In assenza di riscontro, ci vedremo costretti a procedere con ulteriori azioni di recupero.

Distinti saluti,
Abbattitori Zapper S.r.l.`;
  }

  return `Gentile ${nome},

ULTIMO SOLLECITO - Nonostante le precedenti comunicazioni, la fattura n. ${fattura} con scadenza ${scadenzaDate} risulta ancora insoluta per un importo di ${importo}.

La informiamo che, in assenza di pagamento entro 5 giorni dalla presente, ci vedremo costretti ad affidare il recupero del credito ai nostri legali, con aggravio delle spese a Suo carico.

Per evitare ulteriori azioni, La preghiamo di effettuare il pagamento immediato tramite:

${coordinate}

Distinti saluti,
Abbattitori Zapper S.r.l.`;
}

export function SollecitoDialog({ open, onOpenChange, scadenza }: SollecitoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [canale, setCanale] = useState<string>("email");
  const [messaggio, setMessaggio] = useState("");
  const [sending, setSending] = useState(false);

  // Load existing solleciti for this scadenza
  const { data: solleciti } = useQuery({
    queryKey: ["solleciti", scadenza?.id],
    queryFn: async () => {
      if (!scadenza?.id) return [];
      const { data, error } = await supabase
        .from("solleciti")
        .select("*")
        .eq("scadenza_id", scadenza.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!scadenza?.id && open,
  });

  // Determine next livello
  const nextLivello = useMemo(() => {
    if (!solleciti || solleciti.length === 0) return 1;
    const maxLivello = Math.max(...solleciti.map((s: any) => s.livello || 1));
    return Math.min(maxLivello + 1, 3);
  }, [solleciti]);

  // Load customer email/phone
  const { data: customerInfo } = useQuery({
    queryKey: ["customer-contact", scadenza?.soggetto_id],
    queryFn: async () => {
      if (!scadenza?.soggetto_id) return null;
      const { data } = await supabase
        .from("customers")
        .select("email, phone, contact_name, contact_email, contact_phone")
        .eq("id", scadenza.soggetto_id)
        .single();
      return data;
    },
    enabled: !!scadenza?.soggetto_id && open,
  });

  // Generate message when scadenza or livello changes
  useEffect(() => {
    if (scadenza && open) {
      setMessaggio(generateMessage(scadenza, nextLivello));
    }
  }, [scadenza, nextLivello, open]);

  const sendSollecitoMutation = useMutation({
    mutationFn: async () => {
      if (!scadenza || !user) throw new Error("Dati mancanti");

      // Insert sollecito record
      const { error: insertError } = await supabase
        .from("solleciti")
        .insert({
          scadenza_id: scadenza.id,
          fattura_id: scadenza.fattura_id,
          livello: nextLivello,
          canale,
          soggetto_nome: scadenza.soggetto_nome,
          soggetto_email: (customerInfo as any)?.contact_email || customerInfo?.email || null,
          soggetto_telefono: (customerInfo as any)?.contact_phone || customerInfo?.phone || null,
          importo_residuo: scadenza.importo_residuo,
          invoice_number: scadenza.invoice_number || null,
          messaggio,
          stato: "inviato",
          inviato_da: user.id,
          email_sent: canale === "email" || canale === "entrambi",
          whatsapp_sent: canale === "whatsapp" || canale === "entrambi",
          manual_record: canale === "manuale",
        } as any);
      if (insertError) throw insertError;

      // Update scadenze count
      await supabase
        .from("scadenze")
        .update({
          solleciti_count: (scadenza.solleciti_count || 0) + 1,
          ultimo_sollecito_at: new Date().toISOString(),
        } as any)
        .eq("id", scadenza.id);

      if (canale !== "manuale") {
        // Try to send email if applicable
        const sollecitoEmail = (customerInfo as any)?.contact_email || customerInfo?.email;
      if ((canale === "email" || canale === "entrambi") && sollecitoEmail) {
        try {
          await supabase.functions.invoke("send-sollecito-email", {
            body: {
              recipient_email: sollecitoEmail,
              subject: `Sollecito pagamento fattura ${scadenza.invoice_number || ""}`,
              message: messaggio,
              livello: nextLivello,
              soggetto_nome: scadenza.soggetto_nome,
            },
          });
        } catch (e) {
          console.warn("Email sollecito non inviata:", e);
        }
      }

      // Try WhatsApp if applicable
      const sollecitoPhone = (customerInfo as any)?.contact_phone || customerInfo?.phone;
      if ((canale === "whatsapp" || canale === "entrambi") && sollecitoPhone) {
        try {
          await supabase.functions.invoke("send-whatsapp-sollecito", {
            body: {
              phone: sollecitoPhone,
              message: messaggio,
              livello: nextLivello,
              soggetto_nome: scadenza.soggetto_nome,
            },
          });
        } catch (e) {
          console.warn("WhatsApp sollecito non inviato:", e);
        }
      } // end canale !== "manuale"
    },
    onSuccess: () => {
      toast.success(`${LIVELLO_LABELS[nextLivello].label} inviato con successo`);
      queryClient.invalidateQueries({ queryKey: ["solleciti"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  if (!scadenza) return null;

  const fmtEuro = (n: number) => `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
  const livelloInfo = LIVELLO_LABELS[nextLivello];
  const sollecitoEmail = (customerInfo as any)?.contact_email || customerInfo?.email || null;
  const sollecitoPhone = (customerInfo as any)?.contact_phone || customerInfo?.phone || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Sollecito di Pagamento
            <Badge variant="outline" className={livelloInfo.color}>
              {livelloInfo.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Riepilogo scadenza */}
          <Card className="bg-muted/50">
            <CardContent className="py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Soggetto</span>
                <span className="font-medium">{scadenza.soggetto_nome || "N/D"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Fattura</span>
                <span className="font-mono font-medium">{scadenza.invoice_number || "N/D"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Scadenza</span>
                <span>{format(parseISO(scadenza.data_scadenza), "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Residuo da incassare</span>
                <span className="font-bold text-lg text-red-600">{fmtEuro(Number(scadenza.importo_residuo))}</span>
              </div>
            </CardContent>
          </Card>

          {/* Destinatario sollecito */}
          <Card className={!sollecitoEmail && !sollecitoPhone ? "border-amber-300 bg-amber-50/50" : "bg-muted/30"}>
            <CardContent className="py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Send className="h-3 w-3" /> Destinatario sollecito
              </p>
              {customerInfo ? (
                <div className="space-y-1.5">
                  {(customerInfo as any)?.contact_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs w-16">Referente:</span>
                      <span className="font-medium">{(customerInfo as any).contact_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-12">Email:</span>
                    {sollecitoEmail ? (
                      <span className="font-medium text-sm">{sollecitoEmail}</span>
                    ) : (
                      <span className="text-amber-600 text-xs italic">Non configurata</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-12">Tel:</span>
                    {sollecitoPhone ? (
                      <span className="font-medium text-sm">{sollecitoPhone}</span>
                    ) : (
                      <span className="text-amber-600 text-xs italic">Non configurato</span>
                    )}
                  </div>
                  {(!sollecitoEmail || !sollecitoPhone) && (
                    <div className="flex items-start gap-2 mt-1 pt-1.5 border-t border-amber-200 text-amber-700 text-[11px]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Aggiorna l'anagrafica clienti con {!sollecitoEmail && "email"}{!sollecitoEmail && !sollecitoPhone && " e "}{!sollecitoPhone && "telefono"} del referente per abilitare tutti i canali di invio.</span>
                    </div>
                  )}
                </div>
              ) : !scadenza.soggetto_id ? (
                <div className="flex items-center gap-2 text-amber-600 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Soggetto non collegato ad anagrafica clienti — collega prima di inviare un sollecito.
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Caricamento contatti...</div>
              )}
            </CardContent>
          </Card>

          {/* Canale di invio */}
          <div className="space-y-2">
            <Label>Canale di invio</Label>
            <Select value={canale} onValueChange={setCanale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manuale">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4" /> Manuale (telefonata, di persona, ecc.)
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email
                  </div>
                </SelectItem>
                <SelectItem value="whatsapp">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> WhatsApp
                  </div>
                </SelectItem>
                <SelectItem value="entrambi">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" /> Email + WhatsApp
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bozza messaggio */}
          <div className="space-y-2">
            <Label>Messaggio ({livelloInfo.tono})</Label>
            <Textarea
              value={messaggio}
              onChange={(e) => setMessaggio(e.target.value)}
              rows={12}
              className="font-mono text-xs"
            />
          </div>

          {/* Storico solleciti */}
          {solleciti && solleciti.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <History className="h-4 w-4" />
                Storico Solleciti ({solleciti.length})
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {solleciti.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-md border bg-background text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={LIVELLO_LABELS[s.livello]?.color || ""}>
                        {LIVELLO_LABELS[s.livello]?.label || `Livello ${s.livello}`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(s.created_at), "dd/MM/yyyy HH:mm", { locale: it })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.email_sent && <Badge variant="outline" className="text-[10px] gap-0.5"><Mail className="h-2.5 w-2.5" />Email</Badge>}
                      {s.whatsapp_sent && <Badge variant="outline" className="text-[10px] gap-0.5"><MessageSquare className="h-2.5 w-2.5" />WA</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            onClick={() => sendSollecitoMutation.mutate()}
            disabled={sendSollecitoMutation.isPending || !messaggio}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {sendSollecitoMutation.isPending ? "Invio in corso..." : `Invia ${livelloInfo.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
