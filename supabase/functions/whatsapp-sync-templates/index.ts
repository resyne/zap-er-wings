import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_URL = "https://graph.facebook.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { account_id } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "Account not found", details: accountError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!account.waba_id || !account.access_token) {
      return new Response(
        JSON.stringify({ error: "Account missing WABA ID or access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch templates from Meta Graph API
    const templatesUrl = `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${account.waba_id}/message_templates?limit=100`;
    
    console.log("Fetching templates from:", templatesUrl);

    const response = await fetch(templatesUrl, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Meta API error:", data);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch templates from Meta", 
          details: data.error || data 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaTemplates = data.data || [];
    console.log(`Found ${metaTemplates.length} templates on Meta`);

    // Sync templates to our database
    const syncedTemplates = [];
    
    for (const template of metaTemplates) {
      const templateData = {
        account_id: account_id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        components: template.components,
        meta_template_id: template.id,
        updated_at: new Date().toISOString(),
      };

      // Upsert template
      const { data: upserted, error: upsertError } = await supabase
        .from("whatsapp_templates")
        .upsert(templateData, {
          onConflict: "account_id,name,language",
        })
        .select()
        .single();

      if (upsertError) {
        console.error("Error upserting template:", template.name, upsertError);
      } else {
        syncedTemplates.push(upserted);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        meta_templates_count: metaTemplates.length,
        synced_count: syncedTemplates.length,
        templates: metaTemplates.map(t => ({
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
