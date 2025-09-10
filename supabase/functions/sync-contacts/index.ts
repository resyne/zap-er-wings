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

    // 1. Sincronizza contatti dalle liste email
    console.log("Sincronizzando contatti dalle liste email...");
    const { data: emailListContacts, error: emailError } = await supabaseClient
      .from('email_list_contacts')
      .select(`
        email,
        first_name,
        last_name,
        company,
        email_lists!inner(name)
      `);

    if (!emailError && emailListContacts) {
      for (const contact of emailListContacts) {
        if (contact.email) {
          const listName = contact.email_lists?.name || 'Lista Email';
          syncedContacts.push({
            email: contact.email.toLowerCase(),
            first_name: contact.first_name,
            last_name: contact.last_name,
            company_name: contact.company,
            tags: [listName],
            lead_source: 'Lista Email'
          });
          stats.emailLists++;
        }
      }
    }

    // 2. Sincronizza lead
    console.log("Sincronizzando lead...");
    const { data: leads, error: leadsError } = await supabaseClient
      .from('leads')
      .select('*');

    if (!leadsError && leads) {
      for (const lead of leads) {
        if (lead.email) {
          const tags = ['Lead'];
          if (lead.pipeline) tags.push(lead.pipeline);
          if (lead.status) tags.push(lead.status);

          syncedContacts.push({
            email: lead.email.toLowerCase(),
            first_name: lead.contact_name?.split(' ')[0],
            last_name: lead.contact_name?.split(' ').slice(1).join(' '),
            company_name: lead.company_name,
            phone: lead.phone,
            tags: tags,
            lead_source: lead.source || 'Lead'
          });
          stats.leads++;
        }
      }
    }

    // 3. Sincronizza partner
    console.log("Sincronizzando partner...");
    const { data: partners, error: partnersError } = await supabaseClient
      .from('partners')
      .select('*');

    if (!partnersError && partners) {
      for (const partner of partners) {
        if (partner.email) {
          const tags = ['Partner'];
          if (partner.partner_type) tags.push(partner.partner_type);
          if (partner.acquisition_status) tags.push(partner.acquisition_status);
          if (partner.region) tags.push(partner.region);

          syncedContacts.push({
            email: partner.email.toLowerCase(),
            first_name: partner.contact_name?.split(' ')[0],
            last_name: partner.contact_name?.split(' ').slice(1).join(' '),
            company_name: partner.company_name,
            phone: partner.phone,
            mobile: partner.mobile,
            tags: tags,
            lead_source: 'Partner'
          });
          stats.partners++;
        }
      }
    }

    // 4. Rimuovi duplicati e unisci i tag
    console.log("Rimuovendo duplicati e unendo i tag...");
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

    // 5. Inserisci o aggiorna i contatti in crm_contacts
    console.log(`Inserendo ${uniqueContacts.length} contatti unici in CRM...`);
    
    if (uniqueContacts.length > 0) {
      const { data, error: insertError } = await supabaseClient
        .from('crm_contacts')
        .upsert(uniqueContacts, { 
          onConflict: 'email',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('Errore inserimento contatti:', insertError);
        throw insertError;
      }
    }

    // 6. Log dell'attività
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

    console.log("Sincronizzazione completata:", stats);

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
    console.error("Errore durante la sincronizzazione:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
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