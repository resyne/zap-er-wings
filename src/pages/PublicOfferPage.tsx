import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PublicOfferPage() {
  const { code } = useParams<{ code: string }>();
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAndGenerateOffer();
  }, [code]);

  const loadAndGenerateOffer = async () => {
    if (!code) {
      setError("Codice offerta non valido");
      setLoading(false);
      return;
    }

    try {
      // Load offer with customer
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .select(`
          *,
          customers (*)
        `)
        .eq('unique_code', code)
        .single();

      if (offerError) throw offerError;
      
      if (!offer) {
        setError("Offerta non trovata");
        setLoading(false);
        return;
      }

      // Load offer items with product names
      const { data: offerItems } = await supabase
        .from('offer_items')
        .select(`
          *,
          products (name)
        `)
        .eq('offer_id', offer.id);

      // Load HTML template
      const template = offer.template || 'zapper';
      const templateResponse = await fetch(`/templates/offer-template-${template}.html`);
      let htmlTemplate = await templateResponse.text();

      // Replace placeholders with actual data
      const logoUrl = window.location.origin + '/images/logo-zapper.png';
      
      // Build products table
      const productsTableRows = (offerItems || []).map((item: any) => {
        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
        const total = subtotal - discount;
        
        return `
          <tr>
            <td>${item.products?.name || 'N/A'}</td>
            <td>${item.description || ''}</td>
            <td>${item.quantity}</td>
            <td>€ ${item.unit_price.toFixed(2)}</td>
            <td>${item.discount_percent || 0}%</td>
            <td>€ ${total.toFixed(2)}</td>
          </tr>
        `;
      }).join('');
      
      const productsTable = `
        <table>
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Descrizione</th>
              <th>Quantità</th>
              <th>Prezzo Unit.</th>
              <th>Sconto</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            ${productsTableRows}
          </tbody>
        </table>
      `;

      // Build includes grid
      const inclusoArray = (offer.incluso_fornitura || '').split('\n').filter((line: string) => line.trim());
      const inclusoGrid = inclusoArray.length > 0 ? inclusoArray.map((item: string) => `
        <div class="includes-item">
          <span class="includes-icon">✓</span>
          <span class="includes-text">${item.replace('✓', '').trim()}</span>
        </div>
      `).join('') : '<div class="includes-item"><span class="includes-text">Nessun elemento specificato</span></div>';

      // Calculate totals
      const totalImponibile = offer.amount || 0;
      const ivaRate = 0.22; // 22%
      const totalIva = totalImponibile * ivaRate;
      const totalLordo = totalImponibile + totalIva;

      // Replace all placeholders
      htmlTemplate = htmlTemplate
        .replace(/\{\{logo\}\}/g, logoUrl)
        .replace(/\{\{numero_offerta\}\}/g, offer.number || '')
        .replace(/\{\{data_offerta\}\}/g, new Date(offer.created_at).toLocaleDateString('it-IT'))
        .replace(/\{\{utente\}\}/g, 'Abbattitori Zapper')
        .replace(/\{\{cliente\.nome\}\}/g, offer.customers?.name || '')
        .replace(/\{\{cliente\.indirizzo\}\}/g, offer.customers?.address || '')
        .replace(/\{\{oggetto_offerta\}\}/g, offer.title || '')
        .replace(/\{\{tabella_prodotti\}\}/g, productsTable)
        .replace(/\{\{incluso_fornitura\}\}/g, inclusoGrid)
        .replace(/\{\{escluso_fornitura\}\}/g, offer.escluso_fornitura || '')
        .replace(/\{\{totale_imponibile\}\}/g, totalImponibile.toFixed(2))
        .replace(/\{\{totale_iva\}\}/g, totalIva.toFixed(2))
        .replace(/\{\{totale_lordo\}\}/g, totalLordo.toFixed(2))
        .replace(/\{\{validità_offerta\}\}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni')
        .replace(/\{\{tempi_consegna\}\}/g, '10-15 giorni lavorativi')
        .replace(/\{\{metodi_pagamento\}\}/g, offer.metodi_pagamento || '50% anticipo, 50% alla consegna')
        .replace(/\{\{timeline_produzione\}\}/g, offer.timeline_produzione || '7-10 gg')
        .replace(/\{\{timeline_consegna\}\}/g, offer.timeline_consegna || '2-3 gg')
        .replace(/\{\{timeline_installazione\}\}/g, offer.timeline_installazione || '1 gg');

      setHtmlContent(htmlTemplate);
    } catch (err) {
      console.error('Error loading offer:', err);
      setError("Errore nel caricamento dell'offerta");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Errore</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-white"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}