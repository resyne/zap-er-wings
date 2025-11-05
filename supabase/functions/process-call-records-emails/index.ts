import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  id: string;
  subject: string;
  body_text: string;
  body_html: string;
  from_email: string;
  received_at: string;
  attachments?: any[];
}

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

    console.log('Starting to process call records from emails...');

    // Cerca email nella tabella 'emails' se esiste, altrimenti nella tabella 'mail_messages'
    let emails = [];
    
    // Prima prova con la tabella emails
    const { data: emailsData, error: emailsError } = await supabase
      .from('emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!emailsError && emailsData) {
      emails = emailsData;
      console.log(`Found ${emails.length} emails in 'emails' table`);
    } else {
      // Se fallisce, prova con mail_messages
      const { data: mailMessages, error: mailError } = await supabase
        .from('mail_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!mailError && mailMessages) {
        // Adatta il formato di mail_messages a quello di emails
        emails = mailMessages.map((msg: any) => ({
          id: msg.id,
          subject: msg.subject,
          body_text: msg.body_text,
          body_html: msg.body_html,
          from_email: msg.from_address,
          received_at: msg.created_at,
          attachments: msg.attachments
        }));
        console.log(`Found ${emails.length} emails in 'mail_messages' table`);
      } else {
        console.log('No emails found in any table');
      }
    }

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const email of emails || []) {
      try {
        // Log email details for debugging
        console.log('Processing email:', {
          id: email.id,
          subject: email.subject?.substring(0, 100),
          from: email.from_email,
          hasBodyText: !!email.body_text,
          hasBodyHtml: !!email.body_html
        });
        
        // Check if email contains call record data
        const callData = extractCallRecordData(email);
        
        if (!callData) {
          console.log('Email does not contain call record data, skipping');
          skippedCount++;
          continue;
        }

        console.log('Extracted call data:', callData);

        // Check if this call record already exists
        const { data: existingRecord } = await supabase
          .from('call_records')
          .select('id')
          .eq('unique_call_id', callData.unique_call_id)
          .single();

        if (existingRecord) {
          console.log(`Call record ${callData.unique_call_id} already exists, skipping`);
          skippedCount++;
          continue;
        }

        let recordingUrl = null;

        // Process MP3 attachment if present
        if (email.attachments && Array.isArray(email.attachments)) {
          for (const attachment of email.attachments) {
            if (attachment.filename?.toLowerCase().endsWith('.mp3') || 
                attachment.contentType?.includes('audio')) {
              
              console.log('Processing MP3 attachment:', attachment.filename);
              
              // Download attachment (assuming it's base64 encoded in the email data)
              if (attachment.content) {
                const fileName = `${callData.unique_call_id}.mp3`;
                const filePath = `${new Date(callData.call_date).getFullYear()}/${String(new Date(callData.call_date).getMonth() + 1).padStart(2, '0')}/${fileName}`;

                // Decode base64 if needed
                let fileContent = attachment.content;
                if (attachment.encoding === 'base64') {
                  fileContent = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));
                }

                const { error: uploadError } = await supabase.storage
                  .from('call-recordings')
                  .upload(filePath, fileContent, {
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
              break;
            }
          }
        }

        // Insert call record
        const { error: insertError } = await supabase
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
          });

        if (insertError) {
          console.error('Error inserting call record:', insertError);
          errorCount++;
        } else {
          console.log(`Successfully created call record for ${callData.unique_call_id}`);
          processedCount++;
        }

      } catch (error) {
        console.error('Error processing email:', email.id, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      total_emails: emails?.length || 0
    };

    console.log('Processing complete:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing call records:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractCallRecordData(email: EmailData): CallRecordData | null {
  const text = email.body_text || email.body_html || '';
  
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
