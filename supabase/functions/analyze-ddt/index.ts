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
Analizza l'immagine del DDT e estrai le seguenti informazioni DISTINTE:

1. INTESTAZIONE (in alto nel documento, è l'azienda che EMETTE il DDT):
   - intestazione_name: Nome/Ragione sociale dell'azienda emittente
   - intestazione_address: Indirizzo dell'azienda emittente
   - intestazione_vat: Partita IVA dell'azienda emittente

2. DESTINATARIO (a chi è destinata la merce, spesso indicato come "Destinatario" o "Cliente"):
   - destinatario_name: Nome/Ragione sociale del destinatario
   - destinatario_address: Indirizzo del destinatario
   - destinatario_vat: Partita IVA del destinatario

3. DESTINAZIONE (dove viene consegnata la merce, può essere diverso dal destinatario):
   - destinazione_address: Indirizzo di destinazione/consegna

4. DATI DDT:
   - ddt_number: Numero del DDT
   - ddt_date: Data del DDT in formato YYYY-MM-DD

5. ARTICOLI:
   - items: Lista degli articoli trasportati

6. notes: Causale del trasporto o note

IMPORTANTE: Intestazione e Destinatario sono due entità DIVERSE. L'intestazione è chi emette il documento (di solito in alto con logo), il destinatario è chi riceve la merce.

Se un campo non è leggibile o non presente, usa null.`;

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
                text: `Analizza questo DDT ed estrai i dati strutturati. Ricorda: INTESTAZIONE = chi emette il DDT (in alto), DESTINATARIO = chi riceve la merce, DESTINAZIONE = dove viene consegnata.`
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
              description: 'Estrae i dati strutturati dal DDT distinguendo intestazione, destinatario e destinazione',
              parameters: {
                type: 'object',
                properties: {
                  intestazione_name: { type: 'string', description: 'Nome azienda che EMETTE il DDT (in alto nel documento)' },
                  intestazione_address: { type: 'string', description: 'Indirizzo azienda emittente' },
                  intestazione_vat: { type: 'string', description: 'Partita IVA azienda emittente' },
                  destinatario_name: { type: 'string', description: 'Nome destinatario della merce' },
                  destinatario_address: { type: 'string', description: 'Indirizzo destinatario' },
                  destinatario_vat: { type: 'string', description: 'Partita IVA destinatario' },
                  destinazione_address: { type: 'string', description: 'Indirizzo di destinazione/consegna (può essere diverso dal destinatario)' },
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
                  notes: { type: 'string', description: 'Causale o note' }
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
