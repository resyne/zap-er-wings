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

    // Sanitize access token - remove any whitespace, newlines, or invalid HTTP header characters
    // Only allow ASCII printable characters (32-126), excluding control chars
    const rawToken = account.access_token?.toString() || '';
    const accessToken = rawToken.replace(/[^\x20-\x7E]/g, '').trim();
    
    console.log("Token length:", rawToken.length, "Sanitized length:", accessToken.length);
    
    if (!accessToken || accessToken.length < 50) {
      return new Response(
        JSON.stringify({ error: "Access token is invalid or too short after sanitization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper: Upload media to Meta via Resumable Upload API and get a handle
    const uploadMediaToMeta = async (mediaUrl: string, fileType: string): Promise<string> => {
      console.log(`Uploading media to Meta from URL: ${mediaUrl}`);
      
      // Step 0: Get the App ID from the access token
      const appResponse = await fetch(`${GRAPH_API_URL}/${GRAPH_API_VERSION}/app`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const appData = await appResponse.json();
      if (!appData.id) {
        throw new Error(`Could not get App ID from token: ${JSON.stringify(appData.error || appData)}`);
      }
      const appId = appData.id;
      console.log(`Got App ID: ${appId}`);
      
      // Step 1: Download the file
      const fileResponse = await fetch(mediaUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file from ${mediaUrl}: ${fileResponse.status}`);
      }
      const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
      const fileLength = fileBytes.length;
      console.log(`Downloaded file: ${fileLength} bytes, type: ${fileType}`);
      
      // Step 2: Create upload session
      const sessionResponse = await fetch(
        `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${appId}/uploads`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_length: fileLength,
            file_type: fileType,
            file_name: "template-header-file",
          }),
        }
      );
      const sessionData = await sessionResponse.json();
      if (!sessionData.id) {
        throw new Error(`Failed to create upload session: ${JSON.stringify(sessionData.error || sessionData)}`);
      }
      const uploadSessionId = sessionData.id;
      console.log(`Created upload session: ${uploadSessionId}`);
      
      // Step 3: Upload the file bytes
      const uploadResponse = await fetch(
        `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${uploadSessionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `OAuth ${accessToken}`,
            file_offset: "0",
            "Content-Type": "application/octet-stream",
          },
          body: fileBytes,
        }
      );
      const uploadData = await uploadResponse.json();
      if (!uploadData.h) {
        throw new Error(`Failed to upload file: ${JSON.stringify(uploadData.error || uploadData)}`);
      }
      console.log(`Got upload handle: ${uploadData.h.substring(0, 30)}...`);
      return uploadData.h;
    };

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
    const components: Record<string, unknown>[] = [];

    // Normalize components - handle both array format and object format
    let normalizedComponents: { header?: { type?: string; text?: string; format?: string }; body?: { text: string }; footer?: { text?: string }; buttons?: { type: string; text: string; url?: string; phone_number?: string }[] } = {};
    
    if (Array.isArray(template.components)) {
      // Array format from DB: [{type: "BODY", text: ...}, {type: "BUTTONS", buttons: [...]}]
      for (const comp of template.components) {
        const compType = comp.type?.toUpperCase();
        if (compType === "HEADER") {
          normalizedComponents.header = { type: comp.format || "TEXT", text: comp.text };
        } else if (compType === "BODY") {
          normalizedComponents.body = { text: comp.text };
        } else if (compType === "FOOTER") {
          normalizedComponents.footer = { text: comp.text };
        } else if (compType === "BUTTONS") {
          normalizedComponents.buttons = comp.buttons;
        }
      }
    } else if (template.components && typeof template.components === "object") {
      // Object format: { body: { text: ... }, buttons: [...] }
      normalizedComponents = template.components;
    }

    // Add HEADER component if present
    if (normalizedComponents.header?.text || 
        ["DOCUMENT", "IMAGE", "VIDEO"].includes(normalizedComponents.header?.type?.toUpperCase() || "")) {
      const headerType = normalizedComponents.header?.type?.toUpperCase() || "TEXT";
      
      if (headerType === "TEXT" && normalizedComponents.header?.text) {
        const { processedText, exampleValues } = processVariables(normalizedComponents.header.text);
        
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
        const mediaUrl = template.header_media_url;
        if (!mediaUrl) {
          return new Response(
            JSON.stringify({ error: "URL immagine header mancante. Carica un'immagine prima di inviare il template." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const handle = await uploadMediaToMeta(mediaUrl, "image/jpeg");
        components.push({
          type: "HEADER",
          format: "IMAGE",
          example: { header_handle: [handle] }
        });
      } else if (headerType === "VIDEO") {
        const mediaUrl = template.header_media_url;
        if (!mediaUrl) {
          return new Response(
            JSON.stringify({ error: "URL video header mancante. Carica un video prima di inviare il template." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const handle = await uploadMediaToMeta(mediaUrl, "video/mp4");
        components.push({
          type: "HEADER",
          format: "VIDEO",
          example: { header_handle: [handle] }
        });
      } else if (headerType === "DOCUMENT") {
        const mediaUrl = template.header_media_url;
        if (!mediaUrl) {
          return new Response(
            JSON.stringify({ error: "URL documento header mancante. Carica un PDF prima di inviare il template." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const handle = await uploadMediaToMeta(mediaUrl, "application/pdf");
        components.push({
          type: "HEADER",
          format: "DOCUMENT",
          example: { header_handle: [handle] }
        });
      }
    }

    // Add BODY component
    if (normalizedComponents.body?.text) {
      const { processedText, exampleValues } = processVariables(normalizedComponents.body.text);
      
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
    if (normalizedComponents.footer?.text) {
      components.push({
        type: "FOOTER",
        text: normalizedComponents.footer.text
      });
    }

    // Add BUTTONS component if present
    if (normalizedComponents.buttons && normalizedComponents.buttons.length > 0) {
      // Validate button text length (Meta limit is 25 characters)
      const MAX_BUTTON_TEXT_LENGTH = 25;
      for (const btn of normalizedComponents.buttons) {
        if (btn.text && btn.text.length > MAX_BUTTON_TEXT_LENGTH) {
          return new Response(
            JSON.stringify({ 
              error: `Il testo del pulsante "${btn.text}" supera il limite di ${MAX_BUTTON_TEXT_LENGTH} caratteri (${btn.text.length} caratteri). Modifica il template per accorciare il testo del pulsante.`
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const buttons = normalizedComponents.buttons.map((btn) => {
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
        Authorization: `Bearer ${accessToken}`,
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
