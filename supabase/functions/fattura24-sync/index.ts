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

    // Fetch customers from Fattura24
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

    if (!response.ok) {
      throw new Error(`Fattura24 API error: ${response.status} ${response.statusText}`);
    }

    const fattura24Data = await response.json();
    console.log('Fattura24 response:', fattura24Data);

    if (!fattura24Data.customers || !Array.isArray(fattura24Data.customers)) {
      throw new Error('Invalid response from Fattura24 API');
    }

    const customers = fattura24Data.customers;
    const importedContacts = [];
    const errors = [];

    for (const customer of customers) {
      try {
        // Check if contact already exists by email or VAT
        const { data: existingContact } = await supabase
          .from('crm_contacts')
          .select('id')
          .or(`email.eq.${customer.email || ''},piva.eq.${customer.vatNumber || ''}`)
          .single();

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