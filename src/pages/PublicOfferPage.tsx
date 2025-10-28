import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, Euro, Building2, Mail, Phone, MapPin } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Offer {
  id: string;
  number: string;
  customer_name: string;
  title: string;
  description?: string;
  amount: number;
  status: string;
  created_at: string;
  valid_until?: string;
  payment_terms?: string;
  timeline_produzione?: string;
  timeline_consegna?: string;
  timeline_installazione?: string;
  timeline_collaudo?: string;
  incluso_fornitura?: string;
  escluso_fornitura?: string;
  metodi_pagamento?: string;
  payment_method?: string;
  payment_agreement?: string;
}

interface Customer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
}

export default function PublicOfferPage() {
  const { code } = useParams<{ code: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadOffer();
  }, [code]);

  const loadOffer = async () => {
    try {
      setLoading(true);
      
      // Fetch offer by unique_code
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('*, customers(name, email, phone, address, tax_id)')
        .eq('unique_code', code)
        .single();

      if (offerError || !offerData) {
        setError(true);
        return;
      }

      setOffer(offerData);
      
      // Get customer details
      if (offerData.customers) {
        setCustomer(offerData.customers as any);
      }
      
    } catch (err) {
      console.error('Error loading offer:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      richiesta_offerta: { label: "Richiesta", variant: "outline" },
      offerta_pronta: { label: "Pronta", variant: "default" },
      offerta_inviata: { label: "Inviata", variant: "secondary" },
      negoziazione: { label: "Negoziazione", variant: "default" },
      accettata: { label: "Accettata", variant: "default" },
      rifiutata: { label: "Rifiutata", variant: "destructive" }
    };
    
    const { label, variant } = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento offerta...</p>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Offerta Non Trovata</CardTitle>
            <CardDescription>
              Il codice offerta inserito non è valido o l'offerta non esiste più.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Offerta Commerciale</h1>
          <p className="text-muted-foreground">www.erp.abbattitorizapper.it</p>
        </div>

        {/* Main offer card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{offer.title}</CardTitle>
                <CardDescription className="mt-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Offerta N. {offer.number}
                  </div>
                </CardDescription>
              </div>
              {getStatusBadge(offer.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer info */}
            {customer && (
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Cliente
                </h3>
                <div className="bg-muted/50 p-4 rounded-lg space-y-1">
                  <p className="font-medium">{customer.name}</p>
                  {customer.email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {customer.email}
                    </p>
                  )}
                  {customer.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {customer.phone}
                    </p>
                  )}
                  {customer.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {customer.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Description */}
            {offer.description && (
              <div className="space-y-2">
                <h3 className="font-semibold">Descrizione</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{offer.description}</p>
              </div>
            )}

            {/* Amount */}
            <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-lg">
              <Euro className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Importo Offerta</p>
                <p className="text-2xl font-bold">€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data Creazione
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(offer.created_at), 'dd MMMM yyyy', { locale: it })}
                </p>
              </div>
              {offer.valid_until && (
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Valida Fino al
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(offer.valid_until), 'dd MMMM yyyy', { locale: it })}
                  </p>
                </div>
              )}
            </div>

            {/* Payment terms */}
            {offer.payment_terms && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold">Condizioni di Pagamento</h3>
                  <p className="text-muted-foreground">{offer.payment_terms}</p>
                </div>
              </>
            )}

            {/* Timelines */}
            {(offer.timeline_produzione || offer.timeline_consegna || offer.timeline_installazione || offer.timeline_collaudo) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold">Tempistiche</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {offer.timeline_produzione && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Produzione</p>
                        <p className="text-sm text-muted-foreground">{offer.timeline_produzione}</p>
                      </div>
                    )}
                    {offer.timeline_consegna && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Consegna</p>
                        <p className="text-sm text-muted-foreground">{offer.timeline_consegna}</p>
                      </div>
                    )}
                    {offer.timeline_installazione && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Installazione</p>
                        <p className="text-sm text-muted-foreground">{offer.timeline_installazione}</p>
                      </div>
                    )}
                    {offer.timeline_collaudo && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Collaudo</p>
                        <p className="text-sm text-muted-foreground">{offer.timeline_collaudo}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Included/Excluded */}
            {(offer.incluso_fornitura || offer.escluso_fornitura) && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {offer.incluso_fornitura && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Incluso nella Fornitura</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{offer.incluso_fornitura}</p>
                    </div>
                  )}
                  {offer.escluso_fornitura && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Escluso dalla Fornitura</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{offer.escluso_fornitura}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Questo documento è stato generato automaticamente</p>
          <p>Per maggiori informazioni contattare il nostro ufficio commerciale</p>
        </div>
      </div>
    </div>
  );
}