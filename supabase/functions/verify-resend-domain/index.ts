import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface VerifyDomainRequest {
  emailId: string;
  domain: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'Resend API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { emailId, domain }: VerifyDomainRequest = await req.json();

    console.log('Verifying domain:', domain, 'for email ID:', emailId);

    // Check if domain already exists in Resend
    let domainId: string | null = null;
    let isVerified = false;

    try {
      // Get existing domains from Resend
      const domainsResponse = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        const existingDomain = domainsData.data?.find((d: any) => d.name === domain);
        
        if (existingDomain) {
          domainId = existingDomain.id;
          isVerified = existingDomain.status === 'verified';
          console.log('Found existing domain:', existingDomain);
        }
      }
    } catch (error) {
      console.error('Error checking existing domains:', error);
    }

    // If domain doesn't exist, create it
    if (!domainId) {
      try {
        const createResponse = await fetch('https://api.resend.com/domains', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: domain,
            region: 'us-east-1' // or eu-west-1 for Europe
          }),
        });

        if (createResponse.ok) {
          const createData = await createResponse.json();
          domainId = createData.id;
          isVerified = createData.status === 'verified';
          console.log('Created new domain:', createData);
        } else {
          const errorData = await createResponse.text();
          console.error('Error creating domain:', errorData);
        }
      } catch (error) {
        console.error('Error creating domain in Resend:', error);
      }
    }

    // Update sender email in database
    const { error: updateError } = await supabase
      .from('sender_emails')
      .update({
        is_verified: isVerified,
        resend_domain_id: domainId
      })
      .eq('id', emailId);

    if (updateError) {
      console.error('Error updating sender email:', updateError);
      throw updateError;
    }

    console.log('Domain verification result:', { domainId, verified: isVerified });

    return new Response(JSON.stringify({
      success: true,
      domainId,
      verified: isVerified,
      message: isVerified 
        ? 'Domain verified successfully' 
        : 'Domain added to Resend. Please configure DNS records to complete verification.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in verify-resend-domain function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to verify domain',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);