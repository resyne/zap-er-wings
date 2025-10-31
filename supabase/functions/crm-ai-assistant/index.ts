import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_leads",
      description: "Recupera la lista dei lead dal CRM. Puoi filtrare per status, pipeline, o cercare per nome azienda/contatto.",
      parameters: {
        type: "object",
        properties: {
          status: { 
            type: "string",
            enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
            description: "Filtra per stato del lead" 
          },
          pipeline: { 
            type: "string",
            description: "Filtra per pipeline (es: ZAPPER, VESUVIANO)" 
          },
          search: { 
            type: "string",
            description: "Cerca per nome azienda o contatto" 
          },
          limit: { 
            type: "number",
            description: "Numero massimo di risultati (default: 20)" 
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Crea un nuovo lead nel CRM",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nome azienda" },
          contact_name: { type: "string", description: "Nome contatto" },
          email: { type: "string", description: "Email" },
          phone: { type: "string", description: "Telefono" },
          status: { 
            type: "string",
            enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
            description: "Stato del lead" 
          },
          pipeline: { type: "string", description: "Pipeline (es: ZAPPER, VESUVIANO)" },
          value: { type: "number", description: "Valore stimato" },
          notes: { type: "string", description: "Note" }
        },
        required: ["company_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Aggiorna un lead esistente",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID del lead da aggiornare" },
          company_name: { type: "string", description: "Nome azienda" },
          contact_name: { type: "string", description: "Nome contatto" },
          email: { type: "string", description: "Email" },
          phone: { type: "string", description: "Telefono" },
          status: { 
            type: "string",
            enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
            description: "Stato del lead" 
          },
          pipeline: { type: "string", description: "Pipeline" },
          value: { type: "number", description: "Valore stimato" },
          notes: { type: "string", description: "Note" }
        },
        required: ["lead_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_customers",
      description: "Recupera la lista dei clienti. Puoi filtrare per stato attivo o cercare per nome.",
      parameters: {
        type: "object",
        properties: {
          active: { 
            type: "boolean",
            description: "Filtra per clienti attivi" 
          },
          search: { 
            type: "string",
            description: "Cerca per nome cliente o azienda" 
          },
          limit: { 
            type: "number",
            description: "Numero massimo di risultati (default: 20)" 
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_customer",
      description: "Crea un nuovo cliente",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome cliente" },
          company_name: { type: "string", description: "Ragione sociale" },
          email: { type: "string", description: "Email" },
          phone: { type: "string", description: "Telefono" },
          tax_id: { type: "string", description: "Partita IVA" },
          address: { type: "string", description: "Indirizzo" },
          city: { type: "string", description: "Città" },
          postal_code: { type: "string", description: "CAP" },
          province: { type: "string", description: "Provincia" },
          country: { type: "string", description: "Paese" },
          pec: { type: "string", description: "PEC" },
          sdi_code: { type: "string", description: "Codice SDI" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_offers",
      description: "Recupera la lista delle offerte. Puoi filtrare per status o cliente.",
      parameters: {
        type: "object",
        properties: {
          status: { 
            type: "string",
            enum: ["draft", "sent", "accepted", "rejected", "expired"],
            description: "Filtra per stato offerta" 
          },
          customer_id: { 
            type: "string",
            description: "ID del cliente" 
          },
          search: { 
            type: "string",
            description: "Cerca per titolo offerta" 
          },
          limit: { 
            type: "number",
            description: "Numero massimo di risultati (default: 20)" 
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_cost_drafts",
      description: "Recupera i preventivi costi (bozze). Puoi filtrare per status o cliente.",
      parameters: {
        type: "object",
        properties: {
          status: { 
            type: "string",
            enum: ["draft", "approved", "rejected"],
            description: "Filtra per stato bozza" 
          },
          customer_id: { 
            type: "string",
            description: "ID del cliente" 
          },
          search: { 
            type: "string",
            description: "Cerca per nome cliente o descrizione" 
          },
          limit: { 
            type: "number",
            description: "Numero massimo di risultati (default: 20)" 
          }
        }
      }
    }
  }
];

async function executeToolCall(toolName: string, args: any, supabase: any) {
  console.log(`Executing tool: ${toolName}`, args);
  
  try {
    switch (toolName) {
      case "get_leads": {
        let query = supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(args.limit || 20);
        
        if (args.status) query = query.eq('status', args.status);
        if (args.pipeline) query = query.eq('pipeline', args.pipeline);
        if (args.search) {
          query = query.or(`company_name.ilike.%${args.search}%,contact_name.ilike.%${args.search}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data, count: data.length };
      }
      
      case "create_lead": {
        const { data, error } = await supabase
          .from('leads')
          .insert([args])
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Lead creato con successo" };
      }
      
      case "update_lead": {
        const { lead_id, ...updateData } = args;
        const { data, error } = await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead_id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Lead aggiornato con successo" };
      }
      
      case "get_customers": {
        let query = supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(args.limit || 20);
        
        if (args.active !== undefined) query = query.eq('active', args.active);
        if (args.search) {
          query = query.or(`name.ilike.%${args.search}%,company_name.ilike.%${args.search}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data, count: data.length };
      }
      
      case "create_customer": {
        const { data, error } = await supabase
          .from('customers')
          .insert([args])
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Cliente creato con successo" };
      }
      
      case "get_offers": {
        let query = supabase
          .from('offers')
          .select('*, customer:customers(name, company_name)')
          .order('created_at', { ascending: false })
          .limit(args.limit || 20);
        
        if (args.status) query = query.eq('status', args.status);
        if (args.customer_id) query = query.eq('customer_id', args.customer_id);
        if (args.search) {
          query = query.ilike('title', `%${args.search}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data, count: data.length };
      }
      
      case "get_cost_drafts": {
        let query = supabase
          .from('customer_cost_drafts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(args.limit || 20);
        
        if (args.status) query = query.eq('status', args.status);
        if (args.customer_id) query = query.eq('customer_id', args.customer_id);
        if (args.search) {
          query = query.or(`customer_name.ilike.%${args.search}%,description.ilike.%${args.search}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data, count: data.length };
      }
      
      default:
        return { success: false, error: "Tool non riconosciuto" };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages array is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // System prompt
    const systemMessage = {
      role: "system",
      content: `Sei un assistente AI per il CRM di un'azienda. Hai accesso ai dati di:
- Lead: potenziali clienti nel funnel di vendita
- Clienti: clienti acquisiti con anagrafica completa
- Preventivi: bozze di costo per servizi/prodotti
- Offerte: proposte commerciali inviate ai clienti

Puoi leggere, creare e aggiornare questi dati. Quando ti viene chiesto di fare operazioni, usa gli strumenti a tua disposizione.
Rispondi sempre in italiano in modo professionale ma cordiale. Sii conciso ma completo.

Quando mostri dati, presentali in modo chiaro e strutturato. Se ci sono molti risultati, riassumi i più rilevanti.`
    };

    let conversationMessages = [systemMessage, ...messages];
    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 10;

    while (continueLoop && iterations < maxIterations) {
      iterations++;
      console.log(`Iteration ${iterations}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: conversationMessages,
          tools: tools,
          tool_choice: 'auto',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message;
      
      conversationMessages.push(assistantMessage);

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`Processing ${assistantMessage.tool_calls.length} tool calls`);
        
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`Calling function: ${functionName}`, functionArgs);
          
          const result = await executeToolCall(functionName, functionArgs, supabase);
          
          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      } else {
        continueLoop = false;
      }
    }

    const finalMessage = conversationMessages[conversationMessages.length - 1];

    return new Response(
      JSON.stringify({ 
        message: finalMessage.content,
        iterations: iterations
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in crm-ai-assistant function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
