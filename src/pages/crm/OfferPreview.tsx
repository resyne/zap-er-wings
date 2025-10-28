import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function OfferPreview() {
  const { id } = useParams();
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOfferHTML = async () => {
      try {
        if (!id) return;

        // Fetch offer data - using any to avoid type issues with dynamic select
        const { data: offer, error }: any = await supabase
          .from('offers')
          .select(`
            *,
            customers(name, email, address, tax_id)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        // Load the HTML template
        const templateFile = offer.template === 'vesuviano' 
          ? 'offer-template-vesuviano.html'
          : offer.template === 'zapperpro'
          ? 'offer-template-zapperpro.html'
          : offer.template === 'zapper'
          ? 'offer-template-zapper.html'
          : 'offer-template-new.html';
          
        const response = await fetch(`/templates/${templateFile}`);
        let templateHtml = await response.text();

        // Get customer details
        const customer = offer.customers;

        // Replace logo placeholder with absolute URL
        const baseUrl = window.location.origin;
        const logoUrl = `${baseUrl}/images/logo-zapper.png`;
        templateHtml = templateHtml.replace(/{{logo}}/g, logoUrl);
        templateHtml = templateHtml.replace(/src="\/images\//g, `src="${baseUrl}/images/`);
        templateHtml = templateHtml.replace(/src='\/images\//g, `src='${baseUrl}/images/`);

        // Replace offer and customer placeholders
        templateHtml = templateHtml
          .replace(/{{numero_offerta}}/g, offer.number)
          .replace(/{{data_offerta}}/g, new Date(offer.created_at).toLocaleDateString('it-IT'))
          .replace(/{{oggetto}}/g, offer.title)
          .replace(/{{descrizione}}/g, offer.description || '')
          .replace(/{{cliente\.nome}}/g, customer?.name || offer.customer_name)
          .replace(/{{cliente\.indirizzo}}/g, customer?.address || '')
          .replace(/{{cliente\.codice_fiscale}}/g, customer?.tax_id || '')
          .replace(/{{validità_offerta}}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : 'Da definire')
          .replace(/{{tempi_consegna}}/g, offer.timeline_consegna || 'Da definire')
          .replace(/{{metodi_pagamento}}/g, offer.metodi_pagamento || offer.payment_terms || 'Da concordare')
          .replace(/{{incluso_fornitura}}/g, offer.incluso_fornitura || '')
          .replace(/{{escluso_fornitura}}/g, offer.escluso_fornitura || '');

        // For now, use placeholder for products table
        // You'll need to add logic to fetch actual products if they're stored separately
        const productsHtml = '<tr><td colspan="6">Vedere offerta completa nell\'ERP</td></tr>';
        templateHtml = templateHtml.replace(/{{tabella_prodotti}}/g, productsHtml);

        // Use the amount from the offer
        const total = offer.amount || 0;
        const subtotal = total / 1.22; // Assuming 22% IVA
        const totalVAT = total - subtotal;

        templateHtml = templateHtml
          .replace(/{{totale_imponibile}}/g, `€ ${subtotal.toFixed(2)}`)
          .replace(/{{totale_iva}}/g, `€ ${totalVAT.toFixed(2)}`)
          .replace(/{{totale_lordo}}/g, `€ ${total.toFixed(2)}`);

        // Handle timeline fields
        templateHtml = templateHtml
          .replace(/{{timeline_produzione}}/g, offer.timeline_produzione || 'Da definire')
          .replace(/{{timeline_consegna}}/g, offer.timeline_consegna || 'Da definire')
          .replace(/{{timeline_installazione}}/g, offer.timeline_installazione || 'Da definire');

        setHtmlContent(templateHtml);
        setLoading(false);

        // Auto-trigger print dialog after content loads
        setTimeout(() => {
          window.print();
        }, 1000);
      } catch (error) {
        console.error('Error loading offer:', error);
        setLoading(false);
      }
    };

    loadOfferHTML();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Caricamento offerta...</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
