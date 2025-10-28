import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertRequest {
  html: string;
  filename: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { html, filename }: ConvertRequest = await req.json();
    
    const publicKey = Deno.env.get('COMPDFKIT_PUBLIC_KEY');

    if (!publicKey) {
      throw new Error('ComPDFKit API key not configured');
    }

    console.log('Starting ComPDFKit HTML to PDF conversion using v2 API...');

    // Create FormData with HTML file
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const formData = new FormData();
    formData.append('file', htmlBlob, filename);
    formData.append('language', 'italian');
    
    // Single API call to convert HTML to PDF (v2 API)
    console.log('Converting HTML to PDF...');
    const convertResponse = await fetch('https://api-server.compdf.com/server/v2/process/html/pdf', {
      method: 'POST',
      headers: {
        'x-api-key': publicKey,
        'Accept': '*/*',
      },
      body: formData,
    });

    if (!convertResponse.ok) {
      const errorText = await convertResponse.text();
      console.error('Conversion error:', errorText);
      throw new Error(`HTML to PDF conversion failed: ${errorText}`);
    }

    // Parse JSON response to get download URL
    const responseData = await convertResponse.json();
    console.log('Conversion response:', JSON.stringify(responseData, null, 2));

    if (responseData.code !== '200') {
      throw new Error(`API returned error code: ${responseData.code}, message: ${responseData.msg}`);
    }

    if (!responseData.data?.fileInfoDTOList?.[0]?.downloadUrl) {
      throw new Error('No download URL in response');
    }

    const downloadUrl = responseData.data.fileInfoDTOList[0].downloadUrl;
    console.log('Downloading PDF from:', downloadUrl);

    // Download the converted PDF
    const pdfResponse = await fetch(downloadUrl);
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF from ${downloadUrl}`);
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

    console.log('PDF downloaded successfully, size:', pdfArrayBuffer.byteLength, 'bytes');

    return new Response(
      JSON.stringify({ 
        success: true,
        pdf: pdfBase64,
        size: pdfArrayBuffer.byteLength
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );

  } catch (error: any) {
    console.error('Error in compdfkit-convert function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
});
