import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalizza numero italiano rimuovendo prefissi internazionali e caratteri speciali
function normalizeItalianPhone(phone: string): string {
  if (!phone) return '';
  let normalized = phone.replace(/[\s\-\(\)\.\+]/g, '');
  if (normalized.startsWith('0039')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('39') && normalized.length > 10) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

// Find lead by phone number
async function findLeadByPhone(supabase: any, phoneNumber: string): Promise<{ id: string; matched_by: string } | null> {
  if (!phoneNumber || phoneNumber.length < 6) return null;
  
  const normalized = normalizeItalianPhone(phoneNumber);
  
  const searchPatterns: string[] = [];
  
  if (normalized.length >= 6) {
    const last6 = normalized.slice(-6);
    const last7 = normalized.slice(-7);
    const last8 = normalized.slice(-8);
    searchPatterns.push(last6);
    searchPatterns.push(last7);
    searchPatterns.push(last8);
    searchPatterns.push(normalized);
  }
  
  for (const pattern of searchPatterns) {
    if (!pattern || pattern.length < 6) continue;
    
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .filter('phone', 'ilike', `%${pattern}%`)
      .limit(1)
      .single();
    
    if (lead) {
      return { id: lead.id, matched_by: 'phone' };
    }
  }
  
  return null;
}

// Create a new lead from call when no match is found
async function createLeadFromCall(supabase: any, phoneNumber: string, callDate: string): Promise<{ id: string } | null> {
  try {
    const normalizedPhone = normalizeItalianPhone(phoneNumber);
    
    if (!normalizedPhone || normalizedPhone.length < 6) {
      console.log('Phone number too short to create lead:', phoneNumber);
      return null;
    }

    // Check duplicates
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .filter('phone', 'ilike', `%${normalizedPhone}%`)
      .limit(1)
      .single();

    if (existingLead) {
      return existingLead;
    }

    const randomCode = `CALL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        contact_name: `Lead ${randomCode}`,
        company_name: 'Da identificare',
        phone: phoneNumber,
        status: 'new',
        source: 'phone_call',
        notes: `Lead creato automaticamente da chiamata telefonica.\nCodice: ${randomCode}\nData chiamata: ${callDate}\nNumero: ${phoneNumber}`
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating lead from call:', error);
      return null;
    }

    console.log(`Created new lead: ${newLead.id} for phone ${phoneNumber}`);
    return newLead;
  } catch (error) {
    console.error('Error in createLeadFromCall:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional limit
    let limit = 100;
    try {
      const body = await req.json();
      if (body.limit) limit = Math.min(body.limit, 500);
    } catch {
      // Use default limit
    }

    // Find call records without lead_id that are inbound calls
    const { data: orphanedCalls, error: fetchError } = await supabase
      .from('call_records')
      .select('id, caller_number, called_number, call_date, direction')
      .is('lead_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch orphaned calls: ${fetchError.message}`);
    }

    console.log(`Found ${orphanedCalls?.length || 0} call records without lead_id`);

    const results = {
      total: orphanedCalls?.length || 0,
      matched: 0,
      created: 0,
      skipped: 0,
      errors: 0
    };

    for (const call of orphanedCalls || []) {
      try {
        // For inbound calls, the customer is the caller
        // For outbound calls, the customer is the called number
        // Skip internal extension numbers (3 digits or less)
        const customerPhone = call.direction === 'inbound' || call.direction === 'in'
          ? call.caller_number
          : call.called_number;

        // Skip if it's an internal extension (less than 6 digits after normalization)
        const normalizedPhone = normalizeItalianPhone(customerPhone);
        if (normalizedPhone.length < 6) {
          console.log(`Skipping internal extension: ${customerPhone}`);
          results.skipped++;
          continue;
        }

        // Try to find existing lead
        let leadMatch = await findLeadByPhone(supabase, customerPhone);

        if (leadMatch) {
          results.matched++;
        } else {
          // Create new lead
          const newLead = await createLeadFromCall(supabase, customerPhone, call.call_date);
          if (newLead) {
            leadMatch = { id: newLead.id, matched_by: 'auto_created' };
            results.created++;
          } else {
            results.skipped++;
            continue;
          }
        }

        // Update call record with lead_id
        const { error: updateError } = await supabase
          .from('call_records')
          .update({
            lead_id: leadMatch.id,
            matched_by: leadMatch.matched_by
          })
          .eq('id', call.id);

        if (updateError) {
          console.error(`Error updating call record ${call.id}:`, updateError);
          results.errors++;
        }

      } catch (error) {
        console.error(`Error processing call ${call.id}:`, error);
        results.errors++;
      }
    }

    console.log('Repair complete:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.total} call records: ${results.matched} matched to existing leads, ${results.created} new leads created, ${results.skipped} skipped, ${results.errors} errors`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in repair-call-record-leads:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
