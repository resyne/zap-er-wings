import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Scheduled partner communication job started - DISABLED');

    // AUTOMATIC EMAIL SENDING DISABLED
    // This function is now disabled to prevent automatic newsletter sending
    // Use the CRM Newsletter page to manually manage email campaigns
    
    console.log('Scheduled partner communication job completed - NO ACTIONS TAKEN');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled communications sent successfully',
        timestamp: now.toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in scheduled-partner-communication:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

// Helper function to call the send-partner-emails function
async function callSendEmailFunction(emailData: any, specificEmails?: string[]) {
  try {
    const response = await supabase.functions.invoke('send-partner-emails', {
      body: emailData
    });
    
    if (response.error) {
      throw response.error;
    }
    
    console.log('Email function called successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error calling send-partner-emails function:', error);
    throw error;
  }
}

serve(handler);