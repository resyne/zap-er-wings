
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

  const fattura24Quote = {
    apiKey: fattura24ApiKey,
    customerId: quoteData.customerId,
    description: quoteData.description || 'Preventivo',
    items: quoteData.items || [],
    validUntil: quoteData.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 giorni
    notes: quoteData.notes || ''
  };

  const response = await fetch('https://www.app.fattura24.com/api/v0.3/SaveQuote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fattura24Quote),
  });

  console.log('Fattura24 SaveQuote response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Fattura24 SaveQuote error:', errorText);
    throw new Error(`Failed to create quote in Fattura24: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Fattura24 SaveQuote result:', result);

  return new Response(JSON.stringify({
    success: true,
    fattura24Response: result,
    message: 'Preventivo creato con successo in Fattura24'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
