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

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { call_record_id, recording_url } = await req.json();

    if (!call_record_id) {
      throw new Error('call_record_id is required');
    }

    if (!recording_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'No recording URL provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribing audio for call ${call_record_id} from ${recording_url}`);

    // Download the audio file from Supabase Storage
    let audioData: Uint8Array;
    
    if (recording_url.startsWith('http')) {
      // It's a full URL - download directly
      const response = await fetch(recording_url);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status}`);
      }
      audioData = new Uint8Array(await response.arrayBuffer());
    } else {
      // It's a storage path - download from Supabase
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .download(recording_url);
      
      if (error || !data) {
        throw new Error(`Failed to download from storage: ${error?.message}`);
      }
      audioData = new Uint8Array(await data.arrayBuffer());
    }

    console.log(`Downloaded audio file: ${audioData.length} bytes`);

    // Prepare form data for OpenAI Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model', 'whisper-1');
    formData.append('language', 'it'); // Italian
    formData.append('response_format', 'verbose_json');

    // Call OpenAI Whisper API
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

    console.log(`Transcription completed: ${transcription.substring(0, 200)}...`);

    // Update the call record with the transcription
    const { error: updateError } = await supabase
      .from('call_records')
      .update({
        transcription: transcription,
      })
      .eq('id', call_record_id);

    if (updateError) {
      console.error('Error updating transcription:', updateError);
      throw updateError;
    }

    // Now trigger AI analysis with the real transcription
    console.log('Triggering AI analysis with transcription...');
    
    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-call-record`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        call_record_id: call_record_id,
        transcription_text: transcription
      })
    });

    if (!analyzeResponse.ok) {
      console.error('AI analysis failed:', await analyzeResponse.text());
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcription: transcription,
        duration: whisperResult.duration,
        message: 'Audio transcribed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-call-audio:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
