import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallAnalysisResult {
  transcription: string;
  summary: string;
  sentiment: 'positivo' | 'neutro' | 'negativo';
  actions: {
    action: string;
    priority: 'alta' | 'media' | 'bassa';
    deadline?: string;
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { call_record_id, recording_url, transcription_text } = await req.json();

    if (!call_record_id) {
      throw new Error('call_record_id is required');
    }

    // Se abbiamo già una trascrizione, usala direttamente
    let transcription = transcription_text || '';

    // Se non abbiamo trascrizione ma abbiamo URL della registrazione, 
    // chiediamo all'AI di trascrivere (simulazione - in produzione useremmo un servizio STT)
    if (!transcription && recording_url) {
      // Per ora usiamo un placeholder - in produzione useresti un servizio di trascrizione
      transcription = "Trascrizione non disponibile - registrazione audio presente";
    }

    // Se abbiamo trascrizione o testo da analizzare, procedi con AI
    if (transcription) {
      console.log('Analyzing call with AI...');

      const systemPrompt = `Sei un assistente AI specializzato nell'analisi delle chiamate commerciali e di supporto tecnico.
Analizza la trascrizione della chiamata e fornisci:
1. Un riassunto conciso (max 3 frasi) dei punti principali discussi
2. Il sentiment generale della conversazione (positivo, neutro, negativo)
3. Le azioni/follow-up da intraprendere identificate nella chiamata

Rispondi SEMPRE usando la funzione 'analyze_call' con i risultati strutturati.`;

      const userPrompt = `Analizza questa trascrizione di una chiamata:

${transcription}

Fornisci: riassunto, sentiment, e lista di azioni con priorità.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'analyze_call',
              description: 'Analizza una chiamata e restituisce riassunto, sentiment e azioni',
              parameters: {
                type: 'object',
                properties: {
                  summary: {
                    type: 'string',
                    description: 'Riassunto conciso della chiamata (max 3 frasi)'
                  },
                  sentiment: {
                    type: 'string',
                    enum: ['positivo', 'neutro', 'negativo'],
                    description: 'Sentiment generale della conversazione'
                  },
                  actions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        action: { type: 'string', description: 'Descrizione dell\'azione' },
                        priority: { 
                          type: 'string', 
                          enum: ['alta', 'media', 'bassa'],
                          description: 'Priorità dell\'azione'
                        },
                        deadline: { 
                          type: 'string', 
                          description: 'Eventuale scadenza suggerita (opzionale)'
                        }
                      },
                      required: ['action', 'priority']
                    },
                    description: 'Lista di azioni/follow-up da intraprendere'
                  }
                },
                required: ['summary', 'sentiment', 'actions']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'analyze_call' } }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiResult = await response.json();
      console.log('AI Response:', JSON.stringify(aiResult));

      // Estrai i risultati dalla tool call
      let analysis: CallAnalysisResult = {
        transcription: transcription,
        summary: '',
        sentiment: 'neutro',
        actions: []
      };

      if (aiResult.choices?.[0]?.message?.tool_calls?.[0]) {
        const toolCall = aiResult.choices[0].message.tool_calls[0];
        if (toolCall.function?.arguments) {
          const args = JSON.parse(toolCall.function.arguments);
          analysis.summary = args.summary || '';
          analysis.sentiment = args.sentiment || 'neutro';
          analysis.actions = args.actions || [];
        }
      }

      // Aggiorna il record della chiamata con i risultati dell'analisi
      const { error: updateError } = await supabase
        .from('call_records')
        .update({
          transcription: analysis.transcription,
          ai_summary: analysis.summary,
          ai_sentiment: analysis.sentiment,
          ai_actions: analysis.actions,
          ai_processed_at: new Date().toISOString()
        })
        .eq('id', call_record_id);

      if (updateError) {
        console.error('Error updating call record:', updateError);
        throw updateError;
      }

      // Cerca e collega il lead in base al numero di telefono
      await matchAndLinkLead(supabase, call_record_id);

      // Mappa l'interno all'operatore
      await mapExtensionToOperator(supabase, call_record_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          analysis,
          message: 'Chiamata analizzata con successo'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Nessuna trascrizione disponibile per l\'analisi'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-call-record:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Normalizza numero italiano rimuovendo prefissi internazionali e caratteri speciali
function normalizeItalianPhone(phone: string): string {
  if (!phone) return '';
  // Rimuovi spazi, trattini, parentesi, punti
  let normalized = phone.replace(/[\s\-\(\)\.\+]/g, '');
  // Rimuovi prefisso internazionale italiano (39, 0039)
  if (normalized.startsWith('0039')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('39') && normalized.length > 10) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

// Funzione per cercare e collegare il lead in base al numero di telefono
async function matchAndLinkLead(supabase: any, callRecordId: string) {
  try {
    // Ottieni i dettagli della chiamata
    const { data: callRecord, error: callError } = await supabase
      .from('call_records')
      .select('caller_number, called_number, direction')
      .eq('id', callRecordId)
      .single();

    if (callError || !callRecord) {
      console.log('Call record not found for lead matching');
      return;
    }

    // Il numero del cliente dipende dalla direzione
    const customerNumber = callRecord.direction === 'inbound' 
      ? callRecord.caller_number 
      : callRecord.called_number;

    // Normalizza il numero per gestire varianti italiane
    const normalized = normalizeItalianPhone(customerNumber);
    
    // Genera pattern di ricerca con varie combinazioni
    const searchPatterns: string[] = [];
    if (normalized.length >= 6) {
      searchPatterns.push(normalized);
      searchPatterns.push(normalized.slice(-10)); // Ultimi 10 digit
      searchPatterns.push(normalized.slice(-9));  // Ultimi 9 digit (mobile IT senza prefisso)
    }

    console.log(`Searching lead for call ${callRecordId} with patterns:`, searchPatterns.slice(0, 3));

    // Cerca il lead con numero corrispondente - prova ogni pattern
    for (const pattern of searchPatterns) {
      if (!pattern || pattern.length < 6) continue;
      
      const { data: leads, error: leadError } = await supabase
        .from('leads')
        .select('id, phone')
        .or(`phone.ilike.%${pattern}%,mobile.ilike.%${pattern}%`)
        .limit(1);

      if (leadError) {
        console.error('Error searching leads:', leadError);
        continue;
      }

      if (leads && leads.length > 0) {
        // Collega al lead trovato
        const { error: updateError } = await supabase
          .from('call_records')
          .update({ 
            lead_id: leads[0].id,
            matched_by: 'phone_number_auto'
          })
          .eq('id', callRecordId);

        if (updateError) {
          console.error('Error linking call to lead:', updateError);
        } else {
          console.log(`Call ${callRecordId} linked to lead ${leads[0].id} via pattern: ${pattern}`);
        }
        return; // Match trovato, esci
      }
    }
    
    console.log(`No lead found for call ${callRecordId}`);
  } catch (error) {
    console.error('Error in matchAndLinkLead:', error);
  }
}

// Funzione per mappare l'interno telefonico all'operatore
async function mapExtensionToOperator(supabase: any, callRecordId: string) {
  try {
    // Ottieni i dettagli della chiamata
    const { data: callRecord, error: callError } = await supabase
      .from('call_records')
      .select('extension_number, service')
      .eq('id', callRecordId)
      .single();

    if (callError || !callRecord) {
      console.log('Call record not found for extension mapping');
      return;
    }

    // L'interno potrebbe essere nel campo extension_number o estratto dal service
    let extensionNumber = callRecord.extension_number;
    
    // Se non c'è extension_number, prova a estrarlo dal service
    if (!extensionNumber && callRecord.service) {
      // Pattern comune: "interno 101" o "ext. 101"
      const match = callRecord.service.match(/(?:interno|ext\.?|internal)\s*(\d+)/i);
      if (match) {
        extensionNumber = match[1];
      }
    }

    if (!extensionNumber) {
      return;
    }

    // Cerca la mappatura dell'interno
    const { data: extension, error: extError } = await supabase
      .from('phone_extensions')
      .select('user_id, operator_name')
      .eq('extension_number', extensionNumber)
      .eq('is_active', true)
      .single();

    if (extError || !extension) {
      console.log(`No mapping found for extension ${extensionNumber}`);
      return;
    }

    // Aggiorna il record della chiamata con l'operatore
    const { error: updateError } = await supabase
      .from('call_records')
      .update({ 
        operator_id: extension.user_id,
        operator_name: extension.operator_name,
        extension_number: extensionNumber
      })
      .eq('id', callRecordId);

    if (updateError) {
      console.error('Error mapping extension to operator:', updateError);
    } else {
      console.log(`Call ${callRecordId} mapped to operator ${extension.operator_name}`);
    }
  } catch (error) {
    console.error('Error in mapExtensionToOperator:', error);
  }
}
