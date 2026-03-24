import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchFileAsBase64(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  // Check size limit (20MB)
  if (bytes.length > 20 * 1024 * 1024) {
    throw new Error('File troppo grande (max 20MB)');
  }
  
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  // Detect mime type
  let mimeType = 'application/pdf';
  if (fileUrl.match(/\.(jpg|jpeg)$/i)) mimeType = 'image/jpeg';
  else if (fileUrl.match(/\.png$/i)) mimeType = 'image/png';
  else if (fileUrl.match(/\.webp$/i)) mimeType = 'image/webp';
  else if (fileUrl.match(/\.pdf$/i)) mimeType = 'application/pdf';
  
  return { base64, mimeType };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, excelText, direction } = await req.json();
    
    if (!imageUrl && !excelText) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image URL or Excel text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Sei un assistente specializzato nell'analisi di Documenti di Trasporto (DDT) italiani.
Analizza il documento DDT ed estrai le seguenti informazioni DISTINTE:

1) INTESTAZIONE (in alto: azienda che EMETTE il DDT)
   - intestazione_name, intestazione_address, intestazione_vat

2) DESTINATARIO (a chi è destinata la merce)
   - destinatario_name, destinatario_address, destinatario_vat

3) DESTINAZIONE (luogo di consegna)
   - destinazione_address

4) DATI DDT: ddt_number, ddt_date (YYYY-MM-DD)

5) ARTICOLI: items (description, quantity, unit)

6) notes: causale trasporto / note

REGOLA: "CLIMATEL di Elefante Pasquale" è la NOSTRA azienda.
- Se DESTINATARIO è CLIMATEL → DDT fornitore (inbound): fornitore = INTESTAZIONE
- Altrimenti → DDT cliente (outbound): cliente = DESTINATARIO

Se un campo non è leggibile, usa null.`;

    let userContent: any;

    if (excelText) {
      // Excel/CSV: send as text
      console.log('Analyzing DDT from Excel text, length:', excelText.length);
      userContent = [
        { type: 'text', text: `Analizza questi dati estratti da un file Excel/CSV di un DDT ed estrai i dati strutturati:\n\n${excelText}` }
      ];
    } else {
      // Image/PDF: download and convert to base64
      console.log('Analyzing DDT document:', imageUrl);
      const { base64, mimeType } = await fetchFileAsBase64(imageUrl);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      console.log('File converted to base64, mimeType:', mimeType, 'size:', base64.length);
      userContent = [
        { type: 'text', text: 'Analizza questo DDT ed estrai i dati strutturati.' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: userContent
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_ddt_data',
              description: 'Estrae i dati strutturati dal DDT',
              parameters: {
                type: 'object',
                properties: {
                  ddt_tipo: { type: 'string', enum: ['fornitore', 'cliente'] },
                  intestazione_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  intestazione_address: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  intestazione_vat: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  destinatario_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  destinatario_address: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  destinatario_vat: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  destinazione_address: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  ddt_number: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  ddt_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        quantity: { type: 'number' },
                        unit: { anyOf: [{ type: 'string' }, { type: 'null' }] }
                      },
                      required: ['description', 'quantity']
                    }
                  },
                  notes: { anyOf: [{ type: 'string' }, { type: 'null' }] }
                },
                required: ['items']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_ddt_data' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit superato, riprova tra poco' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Crediti AI esauriti' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Analisi AI fallita' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== 'extract_ddt_data') {
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          return new Response(
            JSON.stringify({ success: true, data: parsed }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch { /* fall through */ }
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Impossibile estrarre i dati dal DDT' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted DDT data:', JSON.stringify(extractedData));

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing DDT:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Errore sconosciuto' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
