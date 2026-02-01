import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const languageNames: Record<string, string> = {
  en: "English",
  es: "Spanish", 
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian"
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { step_id, subject, html_content, target_language } = await req.json();

    if (!subject || !html_content || !target_language) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subject, html_content, target_language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const targetLangName = languageNames[target_language] || target_language;

    // Translate subject
    const subjectResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a professional translator. Translate the following email subject to ${targetLangName}. Return ONLY the translated text, nothing else. Keep any placeholders like {{nome}}, {{cognome}}, {{azienda}}, {{linkconfiguratore}} unchanged.` 
          },
          { role: "user", content: subject }
        ],
      }),
    });

    if (!subjectResponse.ok) {
      if (subjectResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (subjectResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await subjectResponse.text();
      console.error("AI gateway error for subject:", subjectResponse.status, errorText);
      throw new Error(`AI gateway error: ${subjectResponse.status}`);
    }

    const subjectData = await subjectResponse.json();
    const translatedSubject = subjectData.choices?.[0]?.message?.content?.trim() || subject;

    // Translate HTML content
    const htmlResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a professional translator. Translate the following HTML email content to ${targetLangName}. 
IMPORTANT RULES:
1. Keep all HTML tags and structure exactly as they are
2. Only translate the visible text content
3. Keep any placeholders like {{nome}}, {{cognome}}, {{azienda}}, {{email}}, {{telefono}}, {{linkconfiguratore}} unchanged
4. Keep URLs, image sources, and other attributes unchanged
5. Return ONLY the translated HTML, nothing else - no markdown code blocks, no explanations` 
          },
          { role: "user", content: html_content }
        ],
      }),
    });

    if (!htmlResponse.ok) {
      if (htmlResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (htmlResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await htmlResponse.text();
      console.error("AI gateway error for HTML:", htmlResponse.status, errorText);
      throw new Error(`AI gateway error: ${htmlResponse.status}`);
    }

    const htmlData = await htmlResponse.json();
    let translatedHtml = htmlData.choices?.[0]?.message?.content?.trim() || html_content;
    
    // Clean up potential markdown code blocks
    if (translatedHtml.startsWith("```html")) {
      translatedHtml = translatedHtml.replace(/^```html\n?/, "").replace(/\n?```$/, "");
    } else if (translatedHtml.startsWith("```")) {
      translatedHtml = translatedHtml.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    // If step_id is provided, save the translation to database
    if (step_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Upsert translation
      const { error: upsertError } = await supabase
        .from("lead_automation_step_translations")
        .upsert({
          step_id,
          language_code: target_language,
          subject: translatedSubject,
          html_content: translatedHtml
        }, {
          onConflict: "step_id,language_code"
        });

      if (upsertError) {
        console.error("Error saving translation:", upsertError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        translated_subject: translatedSubject,
        translated_html: translatedHtml,
        language: target_language
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
