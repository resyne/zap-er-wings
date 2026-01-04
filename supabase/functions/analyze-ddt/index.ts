import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, direction } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing DDT document:', imageUrl);
    console.log('Direction:', direction);

    const systemPrompt = `Sei un assistente specializzato nell'analisi di Documenti di Trasporto (DDT) italiani.
Analizza l'immagine del DDT e estrai le seguenti informazioni in formato JSON:

1. counterpart_name: Nome dell'azienda ${direction === 'IN' ? 'mittente (fornitore)' : 'destinataria (cliente)'}
2. counterpart_address: Indirizzo completo ${direction === 'IN' ? 'del fornitore' : 'del cliente'}
3. counterpart_vat: Partita IVA ${direction === 'IN' ? 'del fornitore' : 'del cliente'} (se presente)
4. ddt_number: Numero del DDT
5. ddt_date: Data del DDT in formato YYYY-MM-DD
6. items: Array di oggetti con:
   - description: Descrizione dell'articolo/materiale
   - quantity: Quantità numerica
   - unit: Unità di misura (pz, kg, m, etc.)
7. notes: Eventuali note o causale del trasporto

Se un campo non è leggibile o non presente, usa null.
Rispondi SOLO con il JSON valido, senza testo aggiuntivo.`;

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
            content: [
              {
                type: 'text',
                text: `Analizza questo DDT (direzione: ${direction === 'IN' ? 'merce ricevuta' : 'merce consegnata'}) ed estrai i dati strutturati.`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
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
                  counterpart_name: { type: 'string', description: 'Nome azienda controparte' },
                  counterpart_address: { type: 'string', description: 'Indirizzo controparte' },
                  counterpart_vat: { type: 'string', description: 'Partita IVA controparte' },
                  ddt_number: { type: 'string', description: 'Numero DDT' },
                  ddt_date: { type: 'string', description: 'Data DDT in formato YYYY-MM-DD' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        quantity: { type: 'number' },
                        unit: { type: 'string' }
                      },
                      required: ['description', 'quantity']
                    }
                  },
                  notes: { type: 'string', description: 'Note o causale' }
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
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted, please add funds' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_ddt_data') {
      // Try to parse from content if no tool call
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          return new Response(
            JSON.stringify({ success: true, data: parsed }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch {
          console.error('Failed to parse AI response as JSON');
        }
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract DDT data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted DDT data:', extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing DDT:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
