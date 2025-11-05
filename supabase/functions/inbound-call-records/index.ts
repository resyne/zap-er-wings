import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallRecordData {
  caller_number: string;
  called_number: string;
  service: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  unique_call_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the incoming email from Supabase Inbound Email
    const emailData = await req.json();
    
    console.log('Received inbound email:', {
      from: emailData.from,
      subject: emailData.subject,
      date: emailData.date
    });

    // Extract text content
    const emailText = emailData.text || emailData.html || '';
    
    // Extract call record data from email body
    const callData = extractCallRecordData(emailText);
    
    if (!callData) {
      console.log('No call record data found in email');
      return new Response(
        JSON.stringify({ success: true, message: 'Email received but no call data found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted call data:', callData);

    // Check if this call record already exists
    const { data: existingRecord } = await supabase
      .from('call_records')
      .select('id')
      .eq('unique_call_id', callData.unique_call_id)
      .single();

    if (existingRecord) {
      console.log(`Call record ${callData.unique_call_id} already exists`);
      return new Response(
        JSON.stringify({ success: true, message: 'Call record already exists' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let recordingUrl = null;

    // Process MP3 attachments if present
    if (emailData.attachments && Array.isArray(emailData.attachments)) {
      for (const attachment of emailData.attachments) {
        const filename = attachment.filename?.toLowerCase() || '';
        const contentType = attachment.contentType?.toLowerCase() || '';
        
        if (filename.endsWith('.mp3') || contentType.includes('audio')) {
          console.log('Processing MP3 attachment:', attachment.filename);
          
          try {
            // Decode base64 attachment content
            const fileContent = attachment.content;
            const decodedContent = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));
            
            const fileName = `${callData.unique_call_id}.mp3`;
            const callDateObj = parseCallDate(callData.call_date);
            const filePath = `${callDateObj.getFullYear()}/${String(callDateObj.getMonth() + 1).padStart(2, '0')}/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('call-recordings')
              .upload(filePath, decodedContent, {
                contentType: 'audio/mpeg',
                upsert: false
              });

            if (uploadError) {
              console.error('Error uploading recording:', uploadError);
            } else {
              recordingUrl = filePath;
              console.log('Recording uploaded:', filePath);
            }
          } catch (error) {
            console.error('Error processing attachment:', error);
          }
          break;
        }
      }
    }

    // Insert call record
    const { data, error: insertError } = await supabase
      .from('call_records')
      .insert({
        caller_number: callData.caller_number,
        called_number: callData.called_number,
        service: callData.service,
        call_date: callData.call_date,
        call_time: callData.call_time,
        duration_seconds: callData.duration_seconds,
        unique_call_id: callData.unique_call_id,
        recording_url: recordingUrl
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting call record:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully created call record for ${callData.unique_call_id}`);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing inbound email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractCallRecordData(text: string): CallRecordData | null {
  // Try to extract call data from email body
  // Looking for patterns like:
  // Numero Chiamante: 200
  // Numero Chiamato: +393737738900
  // Servizio: Chiamate_OUT
  // Data: 05-11-2025
  // Ora: 12-13-38
  // Durata: 534.78 Secondi
  // ID Univoco Chiamata: 1762341218.189124

  const callerMatch = text.match(/Numero Chiamante:\s*(.+)/i);
  const calledMatch = text.match(/Numero Chiamato:\s*(.+)/i);
  const serviceMatch = text.match(/Servizio:\s*(.+)/i);
  const dateMatch = text.match(/Data:\s*(.+)/i);
  const timeMatch = text.match(/Ora:\s*(.+)/i);
  const durationMatch = text.match(/Durata:\s*([\d.]+)\s*Secondi/i);
  const idMatch = text.match(/ID Univoco Chiamata:\s*(.+)/i);

  // Must have at least the unique ID to be considered a call record email
  if (!idMatch) {
    return null;
  }

  const callerNumber = callerMatch?.[1]?.trim() || '';
  const calledNumber = calledMatch?.[1]?.trim() || '';
  const service = serviceMatch?.[1]?.trim() || '';
  const callDate = dateMatch?.[1]?.trim() || '';
  const callTime = timeMatch?.[1]?.trim() || '';
  const duration = parseFloat(durationMatch?.[1] || '0');
  const uniqueCallId = idMatch[1].trim();

  // Validate we have minimum required fields
  if (!uniqueCallId) {
    return null;
  }

  return {
    caller_number: callerNumber,
    called_number: calledNumber,
    service: service,
    call_date: callDate,
    call_time: callTime,
    duration_seconds: duration,
    unique_call_id: uniqueCallId
  };
}

function parseCallDate(dateString: string): Date {
  // Parse date in format DD-MM-YYYY or similar
  const parts = dateString.split(/[-\/]/);
  if (parts.length === 3) {
    // Assume DD-MM-YYYY
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    return new Date(year, month, day);
  }
  return new Date();
}
