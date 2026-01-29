import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mappatura prefissi -> paesi
const prefixMap: { [key: string]: string } = {
  '+39': 'Italia',
  '+34': 'Spagna',
  '+44': 'UK',
  '+33': 'Francia',
  '0039': 'Italia',
  '0034': 'Spagna',
  '0044': 'UK',
  '0033': 'Francia',
};

function detectCountryFromPhone(phone: string): string | null {
  if (!phone) return null;
  
  // Rimuovi spazi e caratteri non numerici tranne il +
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  for (const [prefix, country] of Object.entries(prefixMap)) {
    if (cleanPhone.startsWith(prefix)) {
      return country;
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Recupera tutti i lead con telefono
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('id, phone, country')
      .not('phone', 'is', null)
      .neq('phone', '');

    if (fetchError) throw fetchError;

    let updatedCount = 0;
    const updates: { id: string; oldCountry: string | null; newCountry: string }[] = [];

    for (const lead of leads || []) {
      const detectedCountry = detectCountryFromPhone(lead.phone);
      
      if (detectedCountry && detectedCountry !== lead.country) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ country: detectedCountry })
          .eq('id', lead.id);

        if (!updateError) {
          updatedCount++;
          updates.push({
            id: lead.id,
            oldCountry: lead.country,
            newCountry: detectedCountry
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Aggiornati ${updatedCount} lead`,
        updatedCount,
        updates
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating leads country:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
