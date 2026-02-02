import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pipeline, limit = 50 } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch leads with activities and offers
    let query = supabase
      .from("leads")
      .select(`
        id, company_name, contact_name, email, phone, value, status, pipeline, country, city,
        priority, notes, next_activity_type, next_activity_date, next_activity_notes,
        created_at, updated_at, configurator_status, configurator_opened, configurator_has_quote,
        configurator_quote_price, custom_fields, archived
      `)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (pipeline && pipeline !== "all") {
      query = query.eq("pipeline", pipeline);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          analysis: { 
            summary: "Nessun lead trovato per l'analisi.",
            urgentLeads: [],
            suggestions: []
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch related data
    const leadIds = leads.map(l => l.id);
    
    const { data: activities } = await supabase
      .from("lead_activities")
      .select("lead_id, activity_type, activity_date, status")
      .in("lead_id", leadIds)
      .order("activity_date", { ascending: false });

    const { data: offers } = await supabase
      .from("offers")
      .select("lead_id, status, amount, created_at")
      .in("lead_id", leadIds);

    const { data: messages } = await supabase
      .from("whatsapp_conversations")
      .select("lead_id, last_message_at, unread_count")
      .in("lead_id", leadIds);

    // Prepare lead summaries for AI
    const leadSummaries = leads.map(lead => {
      const leadActivities = activities?.filter(a => a.lead_id === lead.id) || [];
      const leadOffers = offers?.filter(o => o.lead_id === lead.id) || [];
      const leadMessages = messages?.filter(m => m.lead_id === lead.id) || [];
      
      const daysSinceCreation = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceUpdate = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: lead.id,
        nome: lead.company_name,
        contatto: lead.contact_name,
        valore: lead.value,
        stato: lead.status,
        priorita: lead.priority,
        paese: lead.country,
        giorniDallaCreazione: daysSinceCreation,
        giorniDallUltimoAggiornamento: daysSinceUpdate,
        prossimaAttivita: lead.next_activity_type,
        dataAttivita: lead.next_activity_date,
        configuratore: {
          aperto: lead.configurator_opened,
          stato: lead.configurator_status,
          haPreventivo: lead.configurator_has_quote,
          prezzoPreventivo: lead.configurator_quote_price
        },
        numeroOfferte: leadOffers.length,
        offertePendenti: leadOffers.filter(o => o.status === 'pending' || o.status === 'sent').length,
        messaggiNonLetti: leadMessages.reduce((sum, m) => sum + (m.unread_count || 0), 0),
        attivitaRecenti: leadActivities.slice(0, 3).map(a => ({
          tipo: a.activity_type,
          data: a.activity_date,
          stato: a.status
        })),
        note: lead.notes?.substring(0, 200)
      };
    });

    console.log(`Analyzing ${leadSummaries.length} leads for pipeline: ${pipeline || 'all'}`);

    // Call Lovable AI for analysis
    const systemPrompt = `Sei un esperto analista CRM per un'azienda che vende abbattitori di fuliggine (Zapper), forni (Vesuviano) e macchinari industriali.

Il tuo compito è analizzare i lead e identificare:
1. I lead PIÙ URGENTI da lavorare (max 10)
2. L'AZIONE SPECIFICA da compiere per ciascuno
3. Suggerimenti strategici generali

CRITERI DI URGENZA (in ordine di priorità):
- Lead HOT con alto valore che non vengono contattati da giorni
- Lead che hanno aperto il configuratore ma non hanno completato
- Lead con offerte inviate ma senza risposta
- Lead con messaggi WhatsApp non letti
- Lead nuovi con alto valore non ancora qualificati
- Lead in trattativa fermi da tempo

Per ogni lead urgente, suggerisci un'AZIONE CONCRETA come:
- "Chiamare per follow-up offerta"
- "Inviare reminder WhatsApp configuratore"  
- "Preparare offerta personalizzata"
- "Qualificare con telefonata"
- "Inviare nuova proposta commerciale"

Rispondi SEMPRE in italiano.`;

    const userPrompt = `Analizza questi ${leadSummaries.length} lead e identifica quelli più urgenti da lavorare.

DATI LEAD:
${JSON.stringify(leadSummaries, null, 2)}

Rispondi con un JSON valido con questa struttura:
{
  "summary": "Breve riassunto della situazione (2-3 frasi)",
  "urgentLeads": [
    {
      "leadId": "uuid del lead",
      "leadName": "nome del lead",
      "urgencyScore": 1-10,
      "urgencyReason": "Motivo dell'urgenza",
      "suggestedAction": "Azione specifica da compiere",
      "actionType": "call|whatsapp|email|offer|meeting"
    }
  ],
  "suggestions": [
    "Suggerimento strategico 1",
    "Suggerimento strategico 2"
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit superato. Riprova tra qualche secondo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Contatta l'amministratore." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI Response:", content);

    // Parse JSON from response
    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      analysis = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback response
      analysis = {
        summary: "Analisi completata. Controlla i lead con priorità HOT e le trattative in corso.",
        urgentLeads: leads
          .filter(l => l.priority === 'hot' || l.status === 'negotiation')
          .slice(0, 5)
          .map(l => ({
            leadId: l.id,
            leadName: l.company_name,
            urgencyScore: l.priority === 'hot' ? 8 : 6,
            urgencyReason: l.priority === 'hot' ? 'Lead priorità alta' : 'In fase di trattativa',
            suggestedAction: 'Verificare stato e contattare',
            actionType: 'call'
          })),
        suggestions: [
          "Focalizzati sui lead HOT non contattati di recente",
          "Segui i lead che hanno aperto il configuratore"
        ]
      };
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-leads-priority:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
