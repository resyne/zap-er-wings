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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { media_id, account_id, message_id } = await req.json();

    if (!media_id || !account_id) {
      throw new Error('media_id and account_id are required');
    }

    // Get the WhatsApp account access token
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('access_token')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      throw new Error('WhatsApp account not found');
    }

    const accessToken = account.access_token;
    if (!accessToken) {
      throw new Error('WhatsApp access token not configured');
    }

    // Step 1: Get media URL from WhatsApp
    console.log(`Getting media URL for media_id: ${media_id}`);
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v18.0/${media_id}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!mediaInfoResponse.ok) {
      const errorText = await mediaInfoResponse.text();
      console.error('Error getting media info:', errorText);
      throw new Error(`Failed to get media info: ${mediaInfoResponse.status}`);
    }

    const mediaInfo = await mediaInfoResponse.json();
    const mediaDownloadUrl = mediaInfo.url;
    // Sanitize mime_type: remove any parameters and trim whitespace
    let mimeType = (mediaInfo.mime_type || 'application/octet-stream').split(';')[0].trim();
    // Validate mime type format
    if (!mimeType || !mimeType.includes('/')) {
      mimeType = 'application/octet-stream';
    }

    console.log(`Media URL obtained: ${mediaDownloadUrl}, mime_type: ${mimeType}`);

    // Step 2: Download the actual media file
    const mediaResponse = await fetch(mediaDownloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error('Error downloading media:', errorText);
      throw new Error(`Failed to download media: ${mediaResponse.status}`);
    }

    const mediaBuffer = await mediaResponse.arrayBuffer();
    console.log(`Downloaded media: ${mediaBuffer.byteLength} bytes`);

    // Step 3: Upload to Supabase storage
    // Determine file extension and folder based on mime type
    let fileExtension = 'bin';
    let folder = 'whatsapp-media';
    
    if (mimeType.includes('ogg')) { fileExtension = 'ogg'; folder = 'whatsapp-audio'; }
    else if (mimeType.includes('opus')) { fileExtension = 'ogg'; folder = 'whatsapp-audio'; }
    else if (mimeType.includes('mpeg') && mimeType.includes('audio')) { fileExtension = 'mp3'; folder = 'whatsapp-audio'; }
    else if (mimeType.includes('wav')) { fileExtension = 'wav'; folder = 'whatsapp-audio'; }
    else if (mimeType.includes('mp4') && mimeType.includes('video')) { fileExtension = 'mp4'; folder = 'whatsapp-video'; }
    else if (mimeType.includes('3gpp')) { fileExtension = '3gp'; folder = 'whatsapp-video'; }
    else if (mimeType.includes('mp4')) { fileExtension = 'mp4'; folder = 'whatsapp-video'; }
    else if (mimeType.includes('webm')) { fileExtension = 'webm'; folder = 'whatsapp-video'; }
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) { fileExtension = 'jpg'; folder = 'whatsapp-images'; }
    else if (mimeType.includes('png')) { fileExtension = 'png'; folder = 'whatsapp-images'; }
    else if (mimeType.includes('webp')) { fileExtension = 'webp'; folder = 'whatsapp-images'; }
    else if (mimeType.includes('pdf')) { fileExtension = 'pdf'; folder = 'whatsapp-documents'; }
    
    const fileName = `${folder}/${media_id}.${fileExtension}`;
    
    const uploadBytes = new Uint8Array(mediaBuffer);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, uploadBytes, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      throw new Error('Failed to upload media to storage');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    console.log(`Media uploaded to storage: ${publicUrl}`);

    // Optionally update the message with the new URL
    if (message_id) {
      await supabase
        .from('whatsapp_messages')
        .update({ 
          media_url: publicUrl,
          media_downloaded: true 
        })
        .eq('id', message_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        media_url: publicUrl,
        mime_type: mimeType,
        file_size: mediaBuffer.byteLength
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in whatsapp-download-media:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
