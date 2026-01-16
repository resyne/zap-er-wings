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

    // Helper function to generate example value based on variable content
    const generateExample = (varContent: string, index: number): string => {
      const lowerContent = varContent.toLowerCase();
      
      if (lowerContent.includes("name") || lowerContent.includes("nome")) {
        return "Mario Rossi";
      } else if (lowerContent.includes("email")) {
        return "email@example.com";
      } else if (lowerContent.includes("phone") || lowerContent.includes("telefono")) {
        return "+39123456789";
      } else if (lowerContent.includes("date") || lowerContent.includes("data")) {
        return "01/01/2025";
      } else if (lowerContent.includes("amount") || lowerContent.includes("importo") || lowerContent.includes("prezzo")) {
        return "100€";
      } else if (lowerContent.includes("link") || lowerContent.includes("url")) {
        return "https://example.com/link";
      } else if (/^\d+$/.test(varContent)) {
        const exampleMap = ["Mario Rossi", "email@example.com", "https://example.com/link", "+39123456789", "01/01/2025"];
        return exampleMap[index % exampleMap.length];
      } else {
        return `[${varContent}]`;
      }
    };

    // Helper function to process text and extract/remap variables
    const processVariables = (text: string): { processedText: string; exampleValues: string[] } => {
      const varRegex = /\{\{([^}]+)\}\}/g;
      const matches = [...text.matchAll(varRegex)];
      const uniqueVars: string[] = [];
      
      for (const match of matches) {
        if (!uniqueVars.includes(match[0])) {
          uniqueVars.push(match[0]);
        }
      }
      
      const varMapping: Record<string, string> = {};
      const exampleValues: string[] = [];
      
      uniqueVars.forEach((fullVar, index) => {
        const varContent = fullVar.replace(/\{\{|\}\}/g, "").trim();
        const positionalVar = `{{${index + 1}}}`;
        
        if (fullVar !== positionalVar) {
          varMapping[fullVar] = positionalVar;
        }
        
        exampleValues.push(generateExample(varContent, index));
      });
      
      let processedText = text;
      for (const [original, positional] of Object.entries(varMapping)) {
        processedText = processedText.split(original).join(positional);
      }
      
      return { processedText, exampleValues };
    };

    // Build template components for Meta API
    const components = [];

    // Add HEADER component if present
    if (template.components?.header) {
      const headerType = template.components.header.type?.toUpperCase() || "TEXT";
      
      if (headerType === "TEXT" && template.components.header.text) {
        const { processedText, exampleValues } = processVariables(template.components.header.text);
        
        const headerComponent: Record<string, unknown> = {
          type: "HEADER",
          format: "TEXT",
          text: processedText,
        };
        
        if (exampleValues.length > 0) {
          headerComponent.example = {
            header_text: exampleValues
          };
        }
        
        components.push(headerComponent);
      } else if (headerType === "IMAGE") {
        components.push({
          type: "HEADER",
          format: "IMAGE",
          example: {
            header_handle: ["https://example.com/image.jpg"]
          }
        });
      } else if (headerType === "VIDEO") {
        components.push({
          type: "HEADER",
          format: "VIDEO",
          example: {
            header_handle: ["https://example.com/video.mp4"]
          }
        });
      } else if (headerType === "DOCUMENT") {
        components.push({
          type: "HEADER",
          format: "DOCUMENT",
          example: {
            header_handle: ["https://example.com/document.pdf"]
          }
        });
      }
    }

    // Add BODY component
    if (template.components?.body) {
      const { processedText, exampleValues } = processVariables(template.components.body.text || "");
      
      const bodyComponent: Record<string, unknown> = {
        type: "BODY",
        text: processedText,
      };
      
      if (exampleValues.length > 0) {
        bodyComponent.example = {
          body_text: [exampleValues]
        };
      }
      
      components.push(bodyComponent);
    }

    // Add FOOTER component if present
    if (template.components?.footer?.text) {
      components.push({
        type: "FOOTER",
        text: template.components.footer.text
      });
    }

    // Add BUTTONS component if present
    if (template.components?.buttons && template.components.buttons.length > 0) {
      const buttons = template.components.buttons.map((btn: { type: string; text: string; url?: string; phone_number?: string }) => {
        if (btn.type === "URL") {
          return {
            type: "URL",
            text: btn.text,
            url: btn.url || "https://example.com"
          };
        } else if (btn.type === "PHONE_NUMBER") {
          return {
            type: "PHONE_NUMBER",
            text: btn.text,
            phone_number: btn.phone_number || "+391234567890"
          };
        } else {
          return {
            type: "QUICK_REPLY",
            text: btn.text
          };
        }
      });
      
      components.push({
        type: "BUTTONS",
        buttons: buttons
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
