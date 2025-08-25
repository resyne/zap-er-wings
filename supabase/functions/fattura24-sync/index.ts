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

    console.log('Starting Fattura24 sync with API key configured:', !!fattura24ApiKey);

    // First, let's try a simple test API call to verify the connection
    const testResponse = await fetch('https://www.app.fattura24.com/api/v0.3/TestApi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: fattura24ApiKey,
      }),
    });

    console.log('Fattura24 test response status:', testResponse.status);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('Fattura24 test API error:', errorText);
      throw new Error(`Fattura24 API connection failed: ${testResponse.status} - ${errorText}`);
    }

    const testData = await testResponse.json();
    console.log('Fattura24 test response:', testData);

    // Now fetch customers from Fattura24
    console.log('Fetching customers from Fattura24...');
    
    const response = await fetch('https://www.app.fattura24.com/api/v0.3/GetCustomerList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: fattura24ApiKey,
      }),
    });

    console.log('GetCustomerList response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fattura24 GetCustomerList error:', errorText);
      throw new Error(`Fattura24 API error: ${response.status} - ${errorText}`);
    }

    const fattura24Data = await response.json();
    console.log('Fattura24 response structure:', JSON.stringify(fattura24Data, null, 2));

    // Handle different possible response structures
    let customers = [];
    if (fattura24Data.customers && Array.isArray(fattura24Data.customers)) {
      customers = fattura24Data.customers;
    } else if (Array.isArray(fattura24Data)) {
      customers = fattura24Data;
    } else if (fattura24Data.data && Array.isArray(fattura24Data.data)) {
      customers = fattura24Data.data;
    } else {
      console.log('No customers found in response or unexpected format');
      return new Response(JSON.stringify({
        success: true,
        imported: 0,
        total: 0,
        errors: [],
        message: 'Nessun cliente trovato in Fattura24 o formato risposta non riconosciuto'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const importedContacts = [];
    const errors = [];

    for (const customer of customers) {
      try {
        // Check if contact already exists by email or VAT
        let existingContact = null;
        if (customer.email) {
          const { data } = await supabase
            .from('crm_contacts')
            .select('id')
            .eq('email', customer.email)
            .maybeSingle();
          existingContact = data;
        }
        
        if (!existingContact && customer.vatNumber) {
          const { data } = await supabase
            .from('crm_contacts')
            .select('id')
            .eq('piva', customer.vatNumber)
            .maybeSingle();
          existingContact = data;
        }

        if (existingContact) {
          console.log(`Contact already exists: ${customer.email || customer.vatNumber}`);
          continue;
        }

        // Prepare contact data
        const contactData = {
          first_name: customer.name || '',
          last_name: customer.surname || '',
          email: customer.email || null,
          phone: customer.phone || null,
          company_name: customer.companyName || null,
          piva: customer.vatNumber || null,
          address: customer.address ? `${customer.address} ${customer.city || ''} ${customer.zipCode || ''}`.trim() : null,
          sdi_code: customer.sdiCode || null,
          pec: customer.pec || null,
          lead_source: 'fattura24',
        };

        // Insert contact
        const { data: newContact, error: insertError } = await supabase
          .from('crm_contacts')
          .insert(contactData)
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting contact:', insertError);
          errors.push(`Failed to import ${customer.email || customer.companyName}: ${insertError.message}`);
        } else {
          importedContacts.push(newContact);
          console.log(`Imported contact: ${newContact.id}`);
        }
      } catch (error) {
        console.error('Error processing customer:', error);
        errors.push(`Failed to process ${customer.email || customer.companyName}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      imported: importedContacts.length,
      total: customers.length,
      errors: errors,
      message: `Importati ${importedContacts.length} contatti su ${customers.length} totali da Fattura24`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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