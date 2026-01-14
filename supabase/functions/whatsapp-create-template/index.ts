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

    const { template_id } = await req.json();

    if (!template_id) {
      return new Response(
        JSON.stringify({ error: "template_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get template from database
    const { data: template, error: templateError } = await supabase
      .from("whatsapp_templates")
      .select("*, whatsapp_accounts(*)")
      .eq("id", template_id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: "Template not found", details: templateError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = template.whatsapp_accounts;
    if (!account || !account.waba_id || !account.access_token) {
      return new Response(
        JSON.stringify({ error: "Account missing WABA ID or access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build template components for Meta API
    const components = [];

    // Add BODY component
    if (template.components?.body) {
      components.push({
        type: "BODY",
        text: template.components.body.text,
      });
    }

    // Build the request payload for Meta
    const payload = {
      name: template.name,
      language: template.language,
      category: template.category,
      components: components,
    };

    console.log("Creating template on Meta:", JSON.stringify(payload, null, 2));

    // Call Meta Graph API to create template
    const createUrl = `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${account.waba_id}/message_templates`;
    
    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Meta API error:", data);
      
      // Update template status to failed
      await supabase
        .from("whatsapp_templates")
        .update({ 
          status: "FAILED",
          rejection_reason: data.error?.message || JSON.stringify(data.error),
          updated_at: new Date().toISOString()
        })
        .eq("id", template_id);

      return new Response(
        JSON.stringify({ 
          error: "Failed to create template on Meta", 
          details: data.error || data 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Template created on Meta:", data);

    // Update template in database with Meta ID and status
    const { error: updateError } = await supabase
      .from("whatsapp_templates")
      .update({
        meta_template_id: data.id,
        status: data.status || "PENDING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", template_id);

    if (updateError) {
      console.error("Error updating template:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meta_template_id: data.id,
        status: data.status,
        message: "Template inviato a Meta per approvazione"
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
