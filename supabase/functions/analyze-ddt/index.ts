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
Analizza l'immagine del DDT ed estrai le seguenti informazioni DISTINTE e SENZA CONFONDERLE:

1) INTESTAZIONE (in alto nel documento: azienda che EMETTE il DDT / fornitore quando il DDT è in entrata)
   - intestazione_name
   - intestazione_address
   - intestazione_vat

2) DESTINATARIO (a chi è destinata la merce; spesso "Destinatario" / "Cliente")
   - destinatario_name
   - destinatario_address
   - destinatario_vat

3) DESTINAZIONE (luogo di consegna; può essere diverso dal destinatario)
   - destinazione_address

4) DATI DDT
   - ddt_number
   - ddt_date (YYYY-MM-DD)

5) ARTICOLI
   - items: lista righe (description, quantity, unit)

6) notes: causale trasporto / note

REGOLA AZIENDA (IMPORTANTISSIMA): "CLIMATEL di Elefante Pasquale" è la NOSTRA azienda.
- Se il DESTINATARIO è (uguale o molto simile a) "CLIMATEL di Elefante Pasquale" → è un DDT FORNITORE / IN ENTRATA: il FORNITORE va preso dall'INTESTAZIONE.
- Se il DESTINATARIO è diverso → è un DDT CLIENTE / IN USCITA: il CLIENTE è il DESTINATARIO.

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
                text: `Analizza questo DDT ed estrai i dati strutturati.

Regole chiave:
- INTESTAZIONE = chi emette il DDT (in alto, spesso con logo)
- DESTINATARIO = chi riceve la merce
- DESTINAZIONE = dove viene consegnata
- "CLIMATEL di Elefante Pasquale" è la nostra azienda: se è il DESTINATARIO → DDT fornitore (fornitore = INTESTAZIONE); altrimenti → DDT cliente.`
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
                   ddt_tipo: {
                     type: 'string',
                     enum: ['fornitore', 'cliente'],
                     description: 'Classificazione: "fornitore" se il destinatario è CLIMATEL (DDT in entrata), altrimenti "cliente" (DDT in uscita)'
                   },
                   intestazione_name: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Nome azienda che EMETTE il DDT (in alto nel documento)' },
                   intestazione_address: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Indirizzo azienda emittente' },
                   intestazione_vat: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Partita IVA azienda emittente' },
                   destinatario_name: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Nome destinatario della merce' },
                   destinatario_address: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Indirizzo destinatario' },
                   destinatario_vat: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Partita IVA destinatario' },
                   destinazione_address: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Indirizzo di destinazione/consegna (può essere diverso dal destinatario)' },
                   ddt_number: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Numero DDT' },
                   ddt_date: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Data DDT in formato YYYY-MM-DD' },
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
                   notes: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Causale o note' }
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
