import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TranslateRequest {
  text: string;
  target_language: string; // 'it', 'en', 'es', 'fr', 'de', 'pt'
  source_language?: string; // optional - auto-detect if not provided
}

const languageNames: Record<string, string> = {
  it: "Italian",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese"
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, target_language, source_language }: TranslateRequest = await req.json();

    if (!text || !target_language) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: text, target_language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const targetLangName = languageNames[target_language] || target_language;
    const sourceLangName = source_language ? (languageNames[source_language] || source_language) : null;

    // Build the prompt
    let systemPrompt: string;
    if (sourceLangName) {
      systemPrompt = `You are a professional translator. Translate the following message from ${sourceLangName} to ${targetLangName}. 
Return ONLY the translated text, nothing else. No explanations, no quotes, just the translation.
Preserve emoji, formatting, and tone of the original message.`;
    } else {
      systemPrompt = `You are a professional translator. Detect the language of the following message and translate it to ${targetLangName}.
Return a JSON object with this structure:
{
  "detected_language": "language code (it, en, es, fr, de, pt, etc.)",
  "detected_language_name": "full language name",
  "translation": "the translated text"
}
Preserve emoji, formatting, and tone of the original message.`;
    }

    console.log(`Translating: "${text.substring(0, 50)}..." to ${targetLangName}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";

    // Parse the response
    if (source_language) {
      // Direct translation - just return the text
      return new Response(
        JSON.stringify({ 
          success: true,
          translation: content,
          source_language: source_language,
          target_language: target_language,
          original_text: text
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Auto-detect mode - parse JSON response
      try {
        // Clean up potential markdown code blocks
        if (content.startsWith("```json")) {
          content = content.replace(/^```json\n?/, "").replace(/\n?```$/, "");
        } else if (content.startsWith("```")) {
          content = content.replace(/^```\n?/, "").replace(/\n?```$/, "");
        }

        const parsed = JSON.parse(content);
        
        // Check if source and target are the same
        const detectedLang = parsed.detected_language?.toLowerCase();
        if (detectedLang === target_language) {
          return new Response(
            JSON.stringify({ 
              success: true,
              translation: text, // Return original text
              source_language: detectedLang,
              target_language: target_language,
              original_text: text,
              same_language: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            translation: parsed.translation,
            source_language: parsed.detected_language || "unknown",
            source_language_name: parsed.detected_language_name || "Unknown",
            target_language: target_language,
            original_text: text
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (parseError) {
        // If JSON parsing fails, assume it's just the translation
        console.warn("Failed to parse JSON response, using raw content as translation:", parseError);
        return new Response(
          JSON.stringify({ 
            success: true,
            translation: content,
            source_language: "unknown",
            target_language: target_language,
            original_text: text
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
