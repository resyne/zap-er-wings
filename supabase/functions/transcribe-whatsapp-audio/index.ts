import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { audio_url, message_id, source_language } = await req.json();

    if (!audio_url) {
      throw new Error('audio_url is required');
    }

    console.log(`Transcribing audio from: ${audio_url}`);

    // Download the audio file
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioData = new Uint8Array(audioBuffer);
    console.log(`Downloaded audio: ${audioData.length} bytes`);

    // Prepare form data for OpenAI Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioData], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'recording.ogg');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    // Don't specify language to let Whisper auto-detect

    // Call OpenAI Whisper API
    console.log('Calling Whisper API...');
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', whisperResponse.status, errorText);
      throw new Error(`Whisper API error: ${whisperResponse.status}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text || '';
    const detectedLanguage = whisperResult.language || 'unknown';

    console.log(`Transcription completed (lang: ${detectedLanguage}): ${transcription.substring(0, 100)}...`);

    // Translate to Italian if not already Italian
    let translatedText = transcription;
    let needsTranslation = detectedLanguage !== 'it' && detectedLanguage !== 'italian';

    if (needsTranslation && transcription && LOVABLE_API_KEY) {
      console.log('Translating to Italian...');
      
      const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: "Sei un traduttore professionale. Traduci il seguente testo in italiano. Restituisci SOLO il testo tradotto, senza spiegazioni o formattazioni aggiuntive." 
            },
            { role: "user", content: transcription }
          ],
        }),
      });

      if (translateResponse.ok) {
        const translateData = await translateResponse.json();
        translatedText = translateData.choices?.[0]?.message?.content?.trim() || transcription;
        console.log(`Translation: ${translatedText.substring(0, 100)}...`);
      } else {
        console.error('Translation failed:', await translateResponse.text());
      }
    }

    // Update the message with transcription if message_id is provided
    if (message_id) {
      await supabase
        .from('whatsapp_messages')
        .update({ 
          transcription: transcription,
          transcription_translated: needsTranslation ? translatedText : null,
          transcription_language: detectedLanguage
        })
        .eq('id', message_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcription: transcription,
        translated_text: needsTranslation ? translatedText : null,
        detected_language: detectedLanguage,
        duration: whisperResult.duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-whatsapp-audio:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
