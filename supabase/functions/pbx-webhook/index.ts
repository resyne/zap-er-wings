import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      // Check if request is multipart/form-data (for MP3 file)
      const contentType = req.headers.get('content-type') || '';
      
      let callerNumber, calledNumber, service, callDate, callTime, duration, uniqueCallId;
      let recordingFile: File | null = null;

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        
        callerNumber = formData.get('caller_number')?.toString() || '';
        calledNumber = formData.get('called_number')?.toString() || '';
        service = formData.get('service')?.toString() || '';
        callDate = formData.get('call_date')?.toString() || '';
        callTime = formData.get('call_time')?.toString() || '';
        duration = formData.get('duration')?.toString() || '';
        uniqueCallId = formData.get('unique_call_id')?.toString() || '';
        recordingFile = formData.get('recording') as File | null;
      } else {
        // JSON format
        const body = await req.json();
        callerNumber = body.caller_number;
        calledNumber = body.called_number;
        service = body.service;
        callDate = body.call_date;
        callTime = body.call_time;
        duration = body.duration;
        uniqueCallId = body.unique_call_id;
      }

      console.log('Received call record:', {
        callerNumber,
        calledNumber,
        service,
        callDate,
        callTime,
        duration,
        uniqueCallId,
        hasRecording: !!recordingFile
      });

      let recordingUrl = null;

      // Upload recording if provided
      if (recordingFile) {
        const fileName = `${uniqueCallId}.mp3`;
        const filePath = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('call-recordings')
          .upload(filePath, recordingFile, {
            contentType: 'audio/mpeg',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading recording:', uploadError);
        } else {
          recordingUrl = filePath;
          console.log('Recording uploaded:', filePath);
        }
      }

      // Insert call record into database
      const { data, error } = await supabase
        .from('call_records')
        .insert({
          caller_number: callerNumber,
          called_number: calledNumber,
          service: service,
          call_date: callDate,
          call_time: callTime,
          duration_seconds: parseFloat(duration),
          unique_call_id: uniqueCallId,
          recording_url: recordingUrl
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting call record:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message: 'PBX Webhook Endpoint',
          usage: 'POST call records with fields: caller_number, called_number, service, call_date, call_time, duration, unique_call_id, recording (optional MP3 file)',
          endpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/pbx-webhook`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
