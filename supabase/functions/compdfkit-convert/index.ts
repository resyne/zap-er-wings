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
    const secretKey = Deno.env.get('COMPDFKIT_SECRET_KEY');

    if (!publicKey || !secretKey) {
      throw new Error('ComPDFKit API keys not configured');
    }

    console.log('Starting ComPDFKit HTML to PDF conversion...');

    // Step 1: Get access token
    console.log('Step 1: Getting access token...');
    const authResponse = await fetch('https://api.compdf.com/server/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey,
        secretKey,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('Auth error:', errorText);
      throw new Error(`Authentication failed: ${errorText}`);
    }

    const authData = await authResponse.json();
    const accessToken = authData.data.access_token;
    console.log('Access token obtained successfully');

    // Step 2: Create task for HTML to PDF conversion
    console.log('Step 2: Creating conversion task...');
    const createTaskResponse = await fetch('https://api.compdf.com/server/v1/task/html2pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: 'italian',
        parameter: {
          pageSize: 'A4',
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        }
      }),
    });

    if (!createTaskResponse.ok) {
      const errorText = await createTaskResponse.text();
      console.error('Task creation error:', errorText);
      throw new Error(`Task creation failed: ${errorText}`);
    }

    const taskData = await createTaskResponse.json();
    const taskId = taskData.data.taskId;
    console.log('Task created with ID:', taskId);

    // Step 3: Upload HTML file
    console.log('Step 3: Uploading HTML file...');
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const formData = new FormData();
    formData.append('file', htmlBlob, filename);

    const uploadResponse = await fetch(`https://api.compdf.com/server/v1/file/upload?taskId=${taskId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload error:', errorText);
      throw new Error(`File upload failed: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('File uploaded successfully:', uploadData);

    // Step 4: Execute task
    console.log('Step 4: Executing task...');
    const executeResponse = await fetch(`https://api.compdf.com/server/v1/task/execute?taskId=${taskId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error('Execute error:', errorText);
      throw new Error(`Task execution failed: ${errorText}`);
    }

    console.log('Task executed successfully');

    // Step 5: Poll for task completion
    console.log('Step 5: Waiting for task completion...');
    let taskInfo: any = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds maximum wait time

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://api.compdf.com/server/v1/task/status?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('Status check error:', errorText);
        throw new Error(`Status check failed: ${errorText}`);
      }

      taskInfo = await statusResponse.json();
      console.log('Task status:', taskInfo.data.status);

      if (taskInfo.data.status === 'TaskFinish') {
        console.log('Task completed successfully');
        break;
      } else if (taskInfo.data.status === 'TaskFailed') {
        throw new Error('Task failed during processing');
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Task timeout - took too long to complete');
    }

    // Step 6: Download the PDF
    console.log('Step 6: Downloading PDF...');
    const fileKey = taskInfo.data.fileList[0].fileKey;
    const downloadResponse = await fetch(`https://api.compdf.com/server/v1/file/download?fileKey=${fileKey}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error('Download error:', errorText);
      throw new Error(`PDF download failed: ${errorText}`);
    }

    const pdfBlob = await downloadResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

    console.log('PDF generated successfully, size:', pdfArrayBuffer.byteLength, 'bytes');

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
