import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OfferItem {
  id: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number | null;
  total_price: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerId } = await req.json();

    if (!offerId) {
      throw new Error("Offer ID is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch offer data
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .single();

    if (offerError) throw offerError;

    // Fetch offer items
    const { data: offerItems, error: itemsError } = await supabase
      .from("offer_items")
      .select("*")
      .eq("offer_id", offerId);

    if (itemsError) throw itemsError;

    // Fetch customer
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", offer.customer_id)
      .maybeSingle();

    // Fetch template HTML from the correct domain
    const templateUrl = "https://927bac44-432a-46fc-b33f-adc680e49394.lovableproject.com/templates/offer-template-new.html";
    const templateResponse = await fetch(templateUrl);
    let templateHtml = await templateResponse.text();

    // Calculate totals
    const totaleImponibile = (offerItems as OfferItem[])?.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      return sum + itemTotal;
    }, 0) || 0;

    const totaleIva = totaleImponibile * 0.22;
    const totaleLordo = totaleImponibile + totaleIva;

    // Generate products table
    let tabellaHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #38AC4F;">
            <th style="padding: 10px; border: 1px solid #ddd; color: white; text-align: left;">Prodotto/Servizio</th>
            <th style="padding: 10px; border: 1px solid #ddd; color: white; text-align: center; width: 80px;">Q.tà</th>
            <th style="padding: 10px; border: 1px solid #ddd; color: white; text-align: right; width: 100px;">Prezzo</th>
            <th style="padding: 10px; border: 1px solid #ddd; color: white; text-align: right; width: 80px;">Sconto</th>
            <th style="padding: 10px; border: 1px solid #ddd; color: white; text-align: right; width: 100px;">Totale</th>
          </tr>
        </thead>
        <tbody>
    `;

    (offerItems as OfferItem[])?.forEach((item) => {
      const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      tabellaHtml += `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px; border: 1px solid #ddd;">${item.description || ''}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">€ ${item.unit_price.toFixed(2)}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${item.discount_percent || 0}%</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">€ ${itemTotal.toFixed(2)}</td>
        </tr>
      `;
    });

    tabellaHtml += '</tbody></table>';

    // Prepare includes/excludes
    const inclusoItems = offer.incluso_fornitura ? offer.incluso_fornitura.split('\n').filter(Boolean) : [];
    const inclusoHtml = inclusoItems.length > 0
      ? inclusoItems.map(item => `<div class="includes-item"><div style="color: #38AC4F; margin-right: 6px;">✓</div><div>${item}</div></div>`).join('\n')
      : '<div class="includes-item"><div style="color: #38AC4F; margin-right: 6px;">✓</div><div>Fornitura e installazione completa</div></div>';

    const esclusoText = offer.escluso_fornitura || 'Non sono inclusi lavori di muratura, predisposizioni elettriche o idrauliche, eventuali pratiche amministrative.';
    const esclusoTextFormatted = esclusoText.replace(/\n/g, '<br>');

    // Replace all placeholders
    templateHtml = templateHtml
      .replace(/{{numero_offerta}}/g, offer.number)
      .replace(/{{data_offerta}}/g, new Date(offer.created_at).toLocaleDateString('it-IT'))
      .replace(/{{cliente_nome}}/g, customer?.name || offer.customer_name)
      .replace(/{{oggetto_offerta}}/g, offer.title)
      .replace(/{{tabella_prodotti}}/g, tabellaHtml)
      .replace(/{{totale_imponibile}}/g, totaleImponibile.toFixed(2))
      .replace(/{{totale_iva}}/g, totaleIva.toFixed(2))
      .replace(/{{totale_lordo}}/g, totaleLordo.toFixed(2))
      .replace(/{{validita_offerta}}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni')
      .replace(/{{tempi_consegna}}/g, offer.timeline_consegna || 'Da concordare')
      .replace(/{{logo}}/g, 'https://927bac44-432a-46fc-b33f-adc680e49394.lovableproject.com/images/logo-zapper.png')
      .replace(/{{metodi_pagamento}}/g, offer.payment_agreement || '50% acconto - 50% a consegna')
      .replace(/{{incluso_fornitura}}/g, inclusoHtml)
      .replace(/{{escluso_fornitura}}/g, esclusoTextFormatted)
      .replace(/{{timeline_produzione}}/g, offer.timeline_produzione || '7-10 giorni lavorativi')
      .replace(/{{timeline_consegna}}/g, offer.timeline_consegna || '3-5 giorni lavorativi')
      .replace(/{{timeline_installazione}}/g, offer.timeline_installazione || '1 giorno');

    // Call PDFBolt API
    const pdfBoltApiKey = Deno.env.get("PDFBOLT_API_KEY");
    if (!pdfBoltApiKey) {
      throw new Error("PDFBOLT_API_KEY is not configured");
    }

    console.log("Calling PDFBolt API...");
    console.log("API Key present:", !!pdfBoltApiKey);
    console.log("API Key length:", pdfBoltApiKey?.length);
    
    const pdfResponse = await fetch("https://api.pdfbolt.com/v1/direct", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${pdfBoltApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: templateHtml,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: "15mm",
          right: "15mm",
          bottom: "15mm",
          left: "15mm"
        }
      }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error("PDFBolt API error:", errorText);
      throw new Error(`PDFBolt API error: ${pdfResponse.status} - ${errorText}`);
    }

    // Return PDF as base64
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      new Uint8Array(pdfBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    console.log("PDF generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        pdf: pdfBase64,
        filename: `Offerta_${offer.number}.pdf`,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-offer-pdf function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to generate PDF",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
