
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fattura24ApiKey = Deno.env.get('FATTURA24_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!fattura24ApiKey) {
      throw new Error('FATTURA24_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, data } = body;

    console.log('Fattura24 action:', action, 'with data:', data);

    switch (action) {
      case 'createCustomer':
        return await createCustomer(data);
      case 'createQuote':
        return await createQuote(data);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

  } catch (error) {
    console.error('Error in fattura24-sync function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createCustomer(customerData: any) {
  console.log('Creating customer in Fattura24:', customerData);

  const fattura24Customer = {
    apiKey: fattura24ApiKey,
    name: customerData.first_name || '',
    surname: customerData.last_name || '',
    companyName: customerData.company_name || '',
    email: customerData.email || '',
    phone: customerData.phone || '',
    address: customerData.address || '',
    vatNumber: customerData.piva || '',
    sdiCode: customerData.sdi_code || '',
    pec: customerData.pec || ''
  };

  const response = await fetch('https://www.app.fattura24.com/api/v0.3/SaveCustomer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fattura24Customer),
  });

  console.log('Fattura24 SaveCustomer response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Fattura24 SaveCustomer error:', errorText);
    throw new Error(`Failed to create customer in Fattura24: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Fattura24 SaveCustomer result:', result);

  return new Response(JSON.stringify({
    success: true,
    fattura24Response: result,
    message: 'Cliente creato con successo in Fattura24'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createQuote(quoteData: any) {
  console.log('Creating quote in Fattura24:', quoteData);

  // Costruisci XML secondo la specifica Fattura24
  const xml = `<Fattura24>
    <Document>
      <DocumentType>C</DocumentType>
      <CustomerName>${quoteData.customerName || ''}</CustomerName>
      <CustomerAddress>${quoteData.customerAddress || ''}</CustomerAddress>
      <CustomerPostcode>${quoteData.customerPostcode || ''}</CustomerPostcode>
      <CustomerCity>${quoteData.customerCity || ''}</CustomerCity>
      <CustomerProvince>${quoteData.customerProvince || ''}</CustomerProvince>
      <CustomerCountry>${quoteData.customerCountry || ''}</CustomerCountry>
      <CustomerFiscalCode>${quoteData.customerFiscalCode || ''}</CustomerFiscalCode>
      <CustomerVatCode>${quoteData.customerVatCode || ''}</CustomerVatCode>
      <CustomerCellPhone>${quoteData.customerPhone || ''}</CustomerCellPhone>
      <CustomerEmail>${quoteData.customerEmail || ''}</CustomerEmail>
      <DeliveryName>${quoteData.deliveryName || quoteData.customerName || ''}</DeliveryName>
      <DeliveryAddress>${quoteData.deliveryAddress || quoteData.customerAddress || ''}</DeliveryAddress>
      <DeliveryPostcode>${quoteData.deliveryPostcode || quoteData.customerPostcode || ''}</DeliveryPostcode>
      <DeliveryCity>${quoteData.deliveryCity || quoteData.customerCity || ''}</DeliveryCity>
      <DeliveryProvince>${quoteData.deliveryProvince || quoteData.customerProvince || ''}</DeliveryProvince>
      <DeliveryCountry>${quoteData.deliveryCountry || quoteData.customerCountry || ''}</DeliveryCountry>
      <Object>${quoteData.object || 'Preventivo'}</Object>
      <TotalWithoutTax>${quoteData.totalWithoutTax || '0.00'}</TotalWithoutTax>
      <PaymentMethodName>${quoteData.paymentMethodName || ''}</PaymentMethodName>
      <PaymentMethodDescription>${quoteData.paymentMethodDescription || ''}</PaymentMethodDescription>
      <VatAmount>${quoteData.vatAmount || '0.00'}</VatAmount>
      <Total>${quoteData.total || '0.00'}</Total>
      <FootNotes>${quoteData.footNotes || ''}</FootNotes>
      <SendEmail>${quoteData.sendEmail || 'false'}</SendEmail>
      ${quoteData.date ? `<Date>${quoteData.date}</Date>` : ''}
      ${quoteData.number ? `<Number>${quoteData.number}</Number>` : ''}
      <Rows>
        ${(quoteData.items || []).map((item: any) => `
          <Row>
            <Code>${item.code || ''}</Code>
            <Description>${item.description || ''}</Description>
            <Qty>${item.quantity || '1'}</Qty>
            <Um>${item.unit || ''}</Um>
            <Price>${item.price || '0.00'}</Price>
            <Discounts>${item.discounts || '0'}</Discounts>
            <VatCode>${item.vatCode || '22'}</VatCode>
            <VatDescription>${item.vatDescription || '22%'}</VatDescription>
          </Row>
        `).join('')}
      </Rows>
    </Document>
  </Fattura24>`;

  const formData = new URLSearchParams();
  formData.append('apiKey', fattura24ApiKey);
  formData.append('xml', xml);

  const response = await fetch('https://www.app.fattura24.com/api/v0.3/SaveDocument', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  console.log('Fattura24 SaveDocument response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Fattura24 SaveDocument error:', errorText);
    throw new Error(`Failed to create document in Fattura24: ${response.status} - ${errorText}`);
  }

  const result = await response.text();
  console.log('Fattura24 SaveDocument result:', result);

  return new Response(JSON.stringify({
    success: true,
    fattura24Response: result,
    message: 'Preventivo creato con successo in Fattura24'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
