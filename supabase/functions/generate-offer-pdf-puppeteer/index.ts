import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerId } = await req.json();
    
    if (!offerId) {
      throw new Error('Offer ID is required');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch offer data
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        *,
        customer:customers(*),
        offer_items(*)
      `)
      .eq('id', offerId)
      .single();

    if (offerError) throw offerError;

    // Load HTML template
    const templatePath = `${Deno.cwd()}/public/templates/offer-template-new.html`;
    let htmlContent = await Deno.readTextFile(templatePath);

    // Replace placeholders
    const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT');
    const formatCurrency = (amount: number) => amount.toFixed(2).replace('.', ',');

    // Calculate totals
    const totaleImponibile = offer.offer_items.reduce((sum: number, item: any) => {
      const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      return sum + itemTotal;
    }, 0);
    const totaleIva = totaleImponibile * 0.22;
    const totaleLordo = totaleImponibile + totaleIva;

    // Generate product table
    let productTable = '<table><thead><tr><th>Descrizione</th><th>Q.tà</th><th>Prezzo Unitario</th><th>Sconto</th><th>Totale</th></tr></thead><tbody>';
    
    offer.offer_items.forEach((item: any) => {
      const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      productTable += `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>€ ${formatCurrency(item.unit_price)}</td>
          <td>${item.discount_percent || 0}%</td>
          <td>€ ${formatCurrency(itemTotal)}</td>
        </tr>
      `;
    });
    productTable += '</tbody></table>';

    // Parse incluso_fornitura to create grid items
    let inclusoHtml = '';
    if (offer.incluso_fornitura) {
      const items = offer.incluso_fornitura.split('\n').filter((line: string) => line.trim());
      items.forEach((item: string) => {
        inclusoHtml += `
          <div class="includes-item">
            <div class="includes-icon">✓</div>
            <div class="includes-text">${item}</div>
          </div>
        `;
      });
    }

    // Replace all placeholders
    htmlContent = htmlContent
      .replace(/{{logo}}/g, 'https://abbattitorizapper.it/wp-content/uploads/2024/01/logo-zapper.png')
      .replace(/{{numero_offerta}}/g, offer.number || '')
      .replace(/{{data_offerta}}/g, formatDate(offer.created_at))
      .replace(/{{utente}}/g, offer.created_by || 'Sistema')
      .replace(/{{cliente\.nome}}/g, offer.customer?.name || '')
      .replace(/{{cliente\.indirizzo}}/g, offer.customer?.address || '')
      .replace(/{{oggetto_offerta}}/g, offer.title || '')
      .replace(/{{tabella_prodotti}}/g, productTable)
      .replace(/{{incluso_fornitura}}/g, inclusoHtml)
      .replace(/{{escluso_fornitura}}/g, offer.escluso_fornitura || 'N/A')
      .replace(/{{totale_imponibile}}/g, formatCurrency(totaleImponibile))
      .replace(/{{totale_iva}}/g, formatCurrency(totaleIva))
      .replace(/{{totale_lordo}}/g, formatCurrency(totaleLordo))
      .replace(/{{validità_offerta}}/g, offer.valid_until ? formatDate(offer.valid_until) : '30 giorni')
      .replace(/{{tempi_consegna}}/g, offer.timeline_consegna || 'Da concordare')
      .replace(/{{metodi_pagamento}}/g, offer.payment_agreement || '50% acconto - 50% a consegna')
      .replace(/{{timeline_produzione}}/g, offer.timeline_produzione || 'N/A')
      .replace(/{{timeline_consegna}}/g, offer.timeline_consegna || 'N/A')
      .replace(/{{timeline_installazione}}/g, offer.timeline_installazione || 'N/A');

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    await browser.close();

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Offerta_${offer.number}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
