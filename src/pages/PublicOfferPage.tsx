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
      
      // Build products table with improved styling
      const productsTableRows = (offerItems || []).map((item: any) => {
        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
        const total = subtotal - discount;
        
        // Extract product name and description
        // For manual items, the description contains: "ProductName\nDescription"
        // For catalog items, use products.name
        let productName = item.products?.name || '';
        let productDescription = item.description || '';
        
        if (!productName && item.description) {
          // This is a manual item, split the description
          const lines = item.description.split('\n');
          productName = lines[0] || 'N/A';
          productDescription = lines.slice(1).join('\n');
        }
        
        return `
          <tr>
            <td style="padding: 8px; font-size: 11px; color: #333; border-bottom: 1px solid #e9ecef;">${productName}</td>
            <td style="padding: 8px; font-size: 11px; color: #666; border-bottom: 1px solid #e9ecef;">${productDescription || '-'}</td>
            <td style="padding: 8px; font-size: 11px; color: #333; text-align: center; border-bottom: 1px solid #e9ecef;">${item.quantity}</td>
            <td style="padding: 8px; font-size: 11px; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">€ ${item.unit_price.toFixed(2)}</td>
            <td style="padding: 8px; font-size: 11px; color: #333; text-align: center; border-bottom: 1px solid #e9ecef;">${item.discount_percent || 0}%</td>
            <td style="padding: 8px; font-size: 11px; font-weight: bold; color: #38AC4F; text-align: right; border-bottom: 1px solid #e9ecef;">€ ${total.toFixed(2)}</td>
          </tr>
        `;
      }).join('');
      
      const productsTable = `
        <div class="table-wrapper">
          <table style="width: 100%; min-width: 600px; border-collapse: collapse; margin: 10px 0; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
            <thead>
              <tr style="background: #f9f9f9;">
                <th style="padding: 10px 8px; font-size: 11px; font-weight: bold; color: #666; text-align: left; border-bottom: 2px solid #e9ecef;">Prodotto</th>
                <th style="padding: 10px 8px; font-size: 11px; font-weight: bold; color: #666; text-align: left; border-bottom: 2px solid #e9ecef;">Descrizione</th>
                <th style="padding: 10px 8px; font-size: 11px; font-weight: bold; color: #666; text-align: center; border-bottom: 2px solid #e9ecef;">Qtà</th>
                <th style="padding: 10px 8px; font-size: 11px; font-weight: bold; color: #666; text-align: right; border-bottom: 2px solid #e9ecef;">Prezzo Unit.</th>
                <th style="padding: 10px 8px; font-size: 11px; font-weight: bold; color: #666; text-align: center; border-bottom: 2px solid #e9ecef;">Sconto</th>
                <th style="padding: 10px 8px; font-size: 11px; font-weight: bold; color: #666; text-align: right; border-bottom: 2px solid #e9ecef;">Totale</th>
              </tr>
            </thead>
            <tbody>
              ${productsTableRows}
            </tbody>
          </table>
        </div>
      `;

      // Build includes grid
      const inclusoArray = (offer.incluso_fornitura || '').split('\n').filter((line: string) => line.trim());
      const inclusoGrid = inclusoArray.length > 0 ? inclusoArray.map((item: string) => `
        <div class="includes-item">
          <span class="includes-icon">✓</span>
          <span class="includes-text">${item.replace('✓', '').trim()}</span>
        </div>
      `).join('') : '<div class="includes-item"><span class="includes-text">Nessun elemento specificato</span></div>';

      // Calculate totals from offer items
      const totalImponibile = (offerItems || []).reduce((sum: number, item: any) => {
        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
        return sum + (subtotal - discount);
      }, 0);
      
      const isReverseCharge = offer.reverse_charge === true;
      const ivaRate = 0.22; // 22%
      const totalIva = isReverseCharge ? 0 : totalImponibile * ivaRate;
      const totalLordo = totalImponibile + totalIva;
      
      // Format IVA display with reverse charge note
      const ivaDisplay = isReverseCharge 
        ? '0.00</div><div style="font-size: 9px; color: #dc3545; margin-top: 3px;">N6.7 - Inversione contabile' 
        : totalIva.toFixed(2);
      
      // Format IVA percentage display
      const ivaPercentDisplay = isReverseCharge ? '0%' : '22%';

      // Combine payment method and payment agreement
      const paymentInfo = [offer.payment_method, offer.payment_agreement]
        .filter(Boolean)
        .join(' - ');

      // Replace all placeholders
      htmlTemplate = htmlTemplate
        .replace(/\{\{logo\}\}/g, logoUrl)
        .replace(/\{\{numero_offerta\}\}/g, offer.number || '')
        .replace(/\{\{data_offerta\}\}/g, new Date(offer.created_at).toLocaleDateString('it-IT'))
        .replace(/\{\{utente\}\}/g, 'Abbattitori Zapper')
        // Cliente placeholders (with and without dots)
        .replace(/\{\{cliente\.nome\}\}/g, offer.customers?.name || offer.customer_name || '')
        .replace(/\{\{cliente_nome\}\}/g, offer.customers?.name || offer.customer_name || '')
        .replace(/\{\{cliente\.indirizzo\}\}/g, offer.customers?.address || '')
        .replace(/\{\{cliente_indirizzo\}\}/g, offer.customers?.address || '')
        .replace(/\{\{cliente\.piva\}\}/g, offer.customers?.tax_id || '')
        .replace(/\{\{cliente_piva\}\}/g, offer.customers?.tax_id || '')
        .replace(/\{\{cliente\.pec\}\}/g, offer.customers?.pec || '')
        .replace(/\{\{cliente_pec\}\}/g, offer.customers?.pec || '')
        .replace(/\{\{cliente\.sdi_code\}\}/g, offer.customers?.sdi_code || '')
        .replace(/\{\{cliente_sdi_code\}\}/g, offer.customers?.sdi_code || '')
        .replace(/\{\{cliente\.citta\}\}/g, offer.customers?.city || '')
        .replace(/\{\{cliente_citta\}\}/g, offer.customers?.city || '')
        .replace(/\{\{cliente\.paese\}\}/g, offer.customers?.country || '')
        .replace(/\{\{cliente_paese\}\}/g, offer.customers?.country || '')
        .replace(/\{\{cliente\.email\}\}/g, offer.customers?.email || '')
        .replace(/\{\{cliente_email\}\}/g, offer.customers?.email || '')
        .replace(/\{\{cliente\.telefono\}\}/g, offer.customers?.phone || '')
        .replace(/\{\{cliente_telefono\}\}/g, offer.customers?.phone || '')
        .replace(/\{\{cliente\.azienda\}\}/g, offer.customers?.company_name || '')
        .replace(/\{\{cliente_azienda\}\}/g, offer.customers?.company_name || '')
        .replace(/\{\{oggetto_offerta\}\}/g, offer.title || '')
        .replace(/\{\{tabella_prodotti\}\}/g, productsTable)
        .replace(/\{\{incluso_fornitura\}\}/g, inclusoGrid)
        .replace(/\{\{escluso_fornitura\}\}/g, offer.escluso_fornitura || '')
        .replace(/\{\{totale_imponibile\}\}/g, totalImponibile.toFixed(2))
        .replace(/\{\{totale_iva\}\}/g, ivaDisplay)
        .replace(/\{\{iva_percent\}\}/g, ivaPercentDisplay)
        .replace(/\{\{totale_lordo\}\}/g, totalLordo.toFixed(2))
        .replace(/\{\{validità_offerta\}\}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni')
        .replace(/\{\{validita_offerta\}\}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni')
        .replace(/\{\{tempi_consegna\}\}/g, offer.timeline_consegna || '')
        .replace(/\{\{metodi_pagamento\}\}/g, paymentInfo)
        .replace(/\{\{timeline_produzione\}\}/g, offer.timeline_produzione || '')
        .replace(/\{\{timeline_consegna\}\}/g, offer.timeline_consegna || '')
        .replace(/\{\{timeline_installazione\}\}/g, offer.timeline_installazione || '')
        .replace(/\{\{timeline_collaudo\}\}/g, offer.timeline_collaudo || '')
        .replace(/\{\{descrizione\}\}/g, offer.description || '')
        .replace(/\{\{firma_commerciale\}\}/g, 'Abbattitori Zapper')
        .replace(/\{\{payment_agreement\}\}/g, offer.payment_agreement || '')
        .replace(/\{\{sconto\}\}/g, (offer as any).discount || '');

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