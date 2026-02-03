import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const TARGET_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
];

interface TemplateComponents {
  header?: { type?: string; text?: string; format?: string };
  body?: { text: string };
  footer?: { text?: string };
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  if (!text || text.trim() === "") return text;
  
  console.log(`Translating text to ${targetLanguage}: "${text.substring(0, 50)}..."`);
  
  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text from Italian to ${targetLanguage}. 
CRITICAL RULES:
- You MUST translate ALL the text to ${targetLanguage}
- Keep all variables like {{1}}, {{2}}, etc. EXACTLY as they are - do not translate or modify them
- Keep emojis as they are
- Maintain the same tone and style
- Only output the translated text, nothing else
- Do not add quotes or explanations
- Do NOT keep any Italian words in the output - everything must be in ${targetLanguage}`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI translation error: ${response.status} - ${errorText}`);
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  const translatedText = data.choices?.[0]?.message?.content?.trim();
  
  if (!translatedText) {
    console.error(`Translation returned empty result for ${targetLanguage}`);
    throw new Error(`Translation returned empty result`);
  }
  
  // Validate that translation actually happened (check if first word changed for non-variable text)
  const originalFirstWord = text.trim().split(/\s+/)[0]?.replace(/[^\w]/g, '').toLowerCase();
  const translatedFirstWord = translatedText.trim().split(/\s+/)[0]?.replace(/[^\w]/g, '').toLowerCase();
  
  if (originalFirstWord && translatedFirstWord && 
      originalFirstWord === translatedFirstWord && 
      !originalFirstWord.startsWith('{{')) {
    console.warn(`Translation may have failed - first word unchanged: "${originalFirstWord}". Retrying...`);
    // Retry once with more explicit instruction
    const retryResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Translate this Italian text to ${targetLanguage}. Output ONLY the ${targetLanguage} translation. Keep {{1}}, {{2}} variables unchanged.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.5,
      }),
    });
    
    if (retryResponse.ok) {
      const retryData = await retryResponse.json();
      const retryText = retryData.choices?.[0]?.message?.content?.trim();
      if (retryText) {
        console.log(`Retry translation successful: "${retryText.substring(0, 50)}..."`);
        return retryText;
      }
    }
  }
  
  console.log(`Translation successful: "${translatedText.substring(0, 50)}..."`);
  return translatedText;
}

async function translateComponents(
  components: TemplateComponents,
  targetLanguage: string
): Promise<TemplateComponents> {
  const translated: TemplateComponents = {};

  // Translate header text if present
  if (components.header?.text) {
    translated.header = {
      ...components.header,
      text: await translateText(components.header.text, targetLanguage),
    };
  } else if (components.header) {
    translated.header = components.header;
  }

  // Translate body text
  if (components.body?.text) {
    translated.body = {
      text: await translateText(components.body.text, targetLanguage),
    };
  }

  // Translate footer text if present
  if (components.footer?.text) {
    translated.footer = {
      text: await translateText(components.footer.text, targetLanguage),
    };
  }

  // Translate button texts
  if (components.buttons && components.buttons.length > 0) {
    translated.buttons = await Promise.all(
      components.buttons.map(async (btn) => ({
        ...btn,
        text: await translateText(btn.text, targetLanguage),
      }))
    );
  }

  return translated;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    // Get the original template
    const { data: template, error: templateError } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: "Template not found", details: templateError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting translation for template: ${template.name} (${template.language})`);

    // Parse components
    let components: TemplateComponents = {};
    if (Array.isArray(template.components)) {
      for (const comp of template.components) {
        const compType = comp.type?.toUpperCase();
        if (compType === "HEADER") {
          components.header = { type: comp.format || "TEXT", text: comp.text };
        } else if (compType === "BODY") {
          components.body = { text: comp.text };
        } else if (compType === "FOOTER") {
          components.footer = { text: comp.text };
        } else if (compType === "BUTTONS") {
          components.buttons = comp.buttons;
        }
      }
    } else if (template.components && typeof template.components === "object") {
      components = template.components as TemplateComponents;
    }

    const results: Array<{ language: string; success: boolean; templateId?: string; error?: string }> = [];

    // Translate to each target language
    for (const lang of TARGET_LANGUAGES) {
      // Skip if original is already in this language
      if (template.language === lang.code) {
        console.log(`Skipping ${lang.name} - same as original`);
        continue;
      }

      // Check if translation already exists
      const { data: existing } = await supabase
        .from("whatsapp_templates")
        .select("id")
        .eq("account_id", template.account_id)
        .eq("name", template.name)
        .eq("language", lang.code)
        .single();

      if (existing) {
        console.log(`Translation already exists for ${lang.name}`);
        results.push({ language: lang.code, success: true, templateId: existing.id });
        continue;
      }

      try {
        console.log(`Translating to ${lang.name}...`);
        const translatedComponents = await translateComponents(components, lang.name);

        // Rebuild components array format for storage
        const componentsArray: Array<Record<string, unknown>> = [];
        
        if (translatedComponents.header?.text) {
          componentsArray.push({
            type: "HEADER",
            format: translatedComponents.header.type || "TEXT",
            text: translatedComponents.header.text,
          });
        } else if (translatedComponents.header) {
          componentsArray.push({
            type: "HEADER",
            format: translatedComponents.header.type || translatedComponents.header.format,
          });
        }

        if (translatedComponents.body?.text) {
          componentsArray.push({
            type: "BODY",
            text: translatedComponents.body.text,
          });
        }

        if (translatedComponents.footer?.text) {
          componentsArray.push({
            type: "FOOTER",
            text: translatedComponents.footer.text,
          });
        }

        if (translatedComponents.buttons && translatedComponents.buttons.length > 0) {
          componentsArray.push({
            type: "BUTTONS",
            buttons: translatedComponents.buttons,
          });
        }

        // Insert the translated template
        const { data: newTemplate, error: insertError } = await supabase
          .from("whatsapp_templates")
          .insert({
            account_id: template.account_id,
            name: template.name,
            language: lang.code,
            category: template.category,
            components: componentsArray,
            status: "DRAFT",
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting ${lang.name} template:`, insertError);
          results.push({ language: lang.code, success: false, error: insertError.message });
        } else {
          console.log(`Successfully created ${lang.name} template: ${newTemplate.id}`);
          results.push({ language: lang.code, success: true, templateId: newTemplate.id });
        }
      } catch (translationError) {
        console.error(`Translation error for ${lang.name}:`, translationError);
        results.push({ 
          language: lang.code, 
          success: false, 
          error: translationError instanceof Error ? translationError.message : "Unknown error" 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Translation completed",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    
    if (error instanceof Error && error.message.includes("Rate limit")) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
