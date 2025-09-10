import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactToSync {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  tags: string[];
  lead_source?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Avvio sincronizzazione contatti...");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let syncedContacts: ContactToSync[] = [];
    let stats = {
      emailLists: 0,
      leads: 0,
      partners: 0,
      total: 0,
      duplicates: 0
    };

    console.log("📧 Sincronizzando contatti dalle liste email...");
    try {
      // Prima prendiamo tutte le liste email
      const { data: emailLists, error: listsError } = await supabaseClient
        .from('email_lists')
        .select('id, name');
        
      if (listsError) {
        console.error("❌ Errore nel recuperare le liste email:", listsError);
      } else {
        // Poi prendiamo tutti i contatti delle liste
        const { data: emailListContacts, error: emailError } = await supabaseClient
          .from('email_list_contacts')
          .select('*');

        if (!emailError && emailListContacts && emailLists) {
          for (const contact of emailListContacts) {
            if (contact.email && contact.email.trim()) {
              // Trova il nome della lista
              const emailList = emailLists.find(list => list.id === contact.email_list_id);
              const listName = emailList ? emailList.name : 'Lista Email';
              
              syncedContacts.push({
                email: contact.email.toLowerCase().trim(),
                first_name: contact.first_name || '',
                last_name: contact.last_name || '',
                company_name: contact.company || '',
                tags: [listName],
                lead_source: 'Lista Email'
              });
              stats.emailLists++;
            }
          }
          console.log(`✅ ${stats.emailLists} contatti dalle liste email`);
        } else if (emailError) {
          console.error("❌ Errore sincronizzazione liste email:", emailError);
        }
      }
    } catch (error) {
      console.log("⚠️ Tabelle email non trovate, saltando...");
    }

    console.log("🎯 Sincronizzando lead...");
    try {
      const { data: leads, error: leadsError } = await supabaseClient
        .from('leads')
        .select('*');

      if (!leadsError && leads) {
        for (const lead of leads) {
          if (lead.email && lead.email.trim()) {
            const tags = ['Lead'];
            if (lead.pipeline) tags.push(lead.pipeline);
            if (lead.status) tags.push(lead.status);

            syncedContacts.push({
              email: lead.email.toLowerCase().trim(),
              first_name: lead.contact_name?.split(' ')[0] || '',
              last_name: lead.contact_name?.split(' ').slice(1).join(' ') || '',
              company_name: lead.company_name || '',
              phone: lead.phone || '',
              tags: tags,
              lead_source: lead.source || 'Lead'
            });
            stats.leads++;
          }
        }
        console.log(`✅ ${stats.leads} lead sincronizzati`);
      } else if (leadsError) {
        console.error("❌ Errore sincronizzazione lead:", leadsError);
      }
    } catch (error) {
      console.log("⚠️ Tabella leads non trovata, saltando...");
    }

    console.log("🤝 Sincronizzando partner...");
    try {
      const { data: partners, error: partnersError } = await supabaseClient
        .from('partners')
        .select('*');

      if (!partnersError && partners) {
        for (const partner of partners) {
          if (partner.email && partner.email.trim()) {
            const tags = ['Partner'];
            if (partner.partner_type) tags.push(partner.partner_type);
            if (partner.acquisition_status) tags.push(partner.acquisition_status);
            if (partner.region) tags.push(partner.region);

            syncedContacts.push({
              email: partner.email.toLowerCase().trim(),
              first_name: partner.contact_name?.split(' ')[0] || '',
              last_name: partner.contact_name?.split(' ').slice(1).join(' ') || '',
              company_name: partner.company_name || '',
              phone: partner.phone || '',
              mobile: partner.mobile || '',
              tags: tags,
              lead_source: 'Partner'
            });
            stats.partners++;
          }
        }
        console.log(`✅ ${stats.partners} partner sincronizzati`);
      } else if (partnersError) {
        console.error("❌ Errore sincronizzazione partner:", partnersError);
      }
    } catch (error) {
      console.log("⚠️ Tabella partners non trovata, saltando...");
    }

    console.log("🔄 Rimuovendo duplicati e unendo i tag...");
    const contactsMap = new Map<string, ContactToSync>();

    for (const contact of syncedContacts) {
      const email = contact.email.toLowerCase();
      if (contactsMap.has(email)) {
        // Unisci i tag e aggiorna le informazioni
        const existing = contactsMap.get(email)!;
        existing.tags = [...new Set([...existing.tags, ...contact.tags])];
        
        // Aggiorna i campi vuoti con nuove informazioni
        if (!existing.first_name && contact.first_name) existing.first_name = contact.first_name;
        if (!existing.last_name && contact.last_name) existing.last_name = contact.last_name;
        if (!existing.company_name && contact.company_name) existing.company_name = contact.company_name;
        if (!existing.phone && contact.phone) existing.phone = contact.phone;
        if (!existing.mobile && contact.mobile) existing.mobile = contact.mobile;
        if (!existing.job_title && contact.job_title) existing.job_title = contact.job_title;
        
        stats.duplicates++;
      } else {
        contactsMap.set(email, contact);
      }
    }

    const uniqueContacts = Array.from(contactsMap.values());
    stats.total = uniqueContacts.length;

    console.log(`💾 Inserendo ${uniqueContacts.length} contatti unici in CRM...`);
    
    if (uniqueContacts.length > 0) {
      const { data, error: insertError } = await supabaseClient
        .from('crm_contacts')
        .insert(uniqueContacts)
        .select();

      if (insertError) {
        console.error('❌ Errore inserimento contatti:', insertError);
        throw insertError;
      }
      console.log("✅ Contatti inseriti con successo!");
    }

    // Log dell'attività
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'crm_contacts',
        action: 'sync',
        new_values: {
          stats: stats,
          syncedAt: new Date().toISOString()
        }
      });

    console.log("🎉 Sincronizzazione completata:", stats);

    return new Response(JSON.stringify({
      success: true,
      message: "Sincronizzazione contatti completata con successo",
      stats: stats
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("💥 Errore durante la sincronizzazione:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
};

serve(handler);