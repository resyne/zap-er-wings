import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const biginClientId = Deno.env.get('BIGIN_CLIENT_ID')!;
const biginClientSecret = Deno.env.get('BIGIN_CLIENT_SECRET')!;
const biginRefreshToken = Deno.env.get('BIGIN_REFRESH_TOKEN')!;

interface BiginAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface BiginContact {
  id: string;
  First_Name?: string;
  Last_Name?: string;
  Email?: string;
  Phone?: string;
  Mobile?: string;
  Account_Name?: { id: string; name: string };
  Title?: string;
  Lead_Source?: string;
}

interface BiginCompany {
  id: string;
  Account_Name?: string;
  Website?: string;
  Phone?: string;
  Email?: string;
  Industry?: string;
  Annual_Revenue?: number;
  Employees?: number;
  Billing_Street?: string;
  Shipping_Street?: string;
}

interface BiginDeal {
  id: string;
  Deal_Name?: string;
  Amount?: number;
  Stage?: string;
  Probability?: number;
  Contact_Name?: { id: string; name: string };
  Account_Name?: { id: string; name: string };
  Closing_Date?: string;
  Deal_Owner?: { id: string; name: string };
}

interface BiginNote {
  id: string;
  Note_Title?: string;
  Note_Content?: string;
  Parent_Id?: { id: string; module: string };
  Created_By?: { id: string; name: string };
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get Bigin access token using refresh token
async function getBiginAccessToken(): Promise<string> {
  console.log('Getting Bigin access token with refresh token...');
  
  if (!biginClientId || !biginRefreshToken) {
    throw new Error('Missing Bigin client credentials or refresh token');
  }

  const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: biginClientId,
    client_secret: biginClientSecret,
    refresh_token: biginRefreshToken,
  });

  console.log('Making OAuth request to Zoho...');
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OAuth error response:', errorText);
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const data: BiginAuthResponse = await response.json();
  console.log('Successfully obtained access token');
  return data.access_token;
}

// Sync contacts from Bigin
async function syncContacts(accessToken: string) {
  console.log('Syncing contacts from Bigin...');
  
  const response = await fetch('https://www.zohoapis.com/bigin/v1/Contacts', {
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API error response:', errorText);
    throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Bigin API response:', data);
  
  const contacts = data.data || [];
  console.log(`Found ${contacts.length} contacts from Bigin`);

  for (const contact of contacts) {
    const contactData = {
      bigin_id: contact.id,
      first_name: contact.First_Name || null,
      last_name: contact.Last_Name || null,
      email: contact.Email || null,
      phone: contact.Phone || null,
      mobile: contact.Mobile || null,
      job_title: contact.Title || null,
      lead_source: contact.Lead_Source || null,
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('crm_contacts')
      .upsert(contactData, { onConflict: 'bigin_id' });

    if (error) {
      console.error(`Error syncing contact ${contact.id}:`, error);
    } else {
      console.log(`Successfully synced contact: ${contact.First_Name} ${contact.Last_Name}`);
    }
  }

  console.log('Contacts sync completed');
}

// Sync companies from Bigin
async function syncCompanies(accessToken: string) {
  console.log('Syncing companies from Bigin...');
  
  const response = await fetch('https://www.zohoapis.com/bigin/v1/Accounts', {
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API error response:', errorText);
    throw new Error(`Failed to fetch accounts: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Bigin API response for companies:', data);
  
  const companies = data.data || [];
  console.log(`Found ${companies.length} companies from Bigin`);

  for (const company of companies) {
    const companyData = {
      bigin_id: company.id,
      name: company.Account_Name || 'Unknown',
      website: company.Website || null,
      phone: company.Phone || null,
      email: company.Email || null,
      industry: company.Industry || null,
      employees_count: company.Employees || null,
      annual_revenue: company.Annual_Revenue || null,
      billing_address: company.Billing_Street || null,
      shipping_address: company.Shipping_Street || null,
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('crm_companies')
      .upsert(companyData, { onConflict: 'bigin_id' });

    if (error) {
      console.error(`Error syncing company ${company.id}:`, error);
    } else {
      console.log(`Successfully synced company: ${company.Account_Name}`);
    }
  }

  console.log('Companies sync completed');
}

// Sync deals from Bigin
async function syncDeals(accessToken: string) {
  console.log('Syncing deals from Bigin...');
  
  const response = await fetch('https://www.zohoapis.com/bigin/v1/Deals', {
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API error response:', errorText);
    throw new Error(`Failed to fetch deals: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Bigin API response for deals:', data);
  
  const deals = data.data || [];
  console.log(`Found ${deals.length} deals from Bigin`);

  for (const deal of deals) {
    // Find contact and company IDs from our local database
    let contactId = null;
    let companyId = null;

    if (deal.Contact_Name?.id) {
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('bigin_id', deal.Contact_Name.id)
        .maybeSingle();
      contactId = contact?.id || null;
    }

    if (deal.Account_Name?.id) {
      const { data: company } = await supabase
        .from('crm_companies')
        .select('id')
        .eq('bigin_id', deal.Account_Name.id)
        .maybeSingle();
      companyId = company?.id || null;
    }

    const dealData = {
      bigin_id: deal.id,
      name: deal.Deal_Name || 'Unknown Deal',
      amount: deal.Amount || null,
      stage: deal.Stage || null,
      probability: deal.Probability || null,
      contact_id: contactId,
      company_id: companyId,
      expected_close_date: deal.Closing_Date ? new Date(deal.Closing_Date).toISOString().split('T')[0] : null,
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('crm_deals')
      .upsert(dealData, { onConflict: 'bigin_id' });

    if (error) {
      console.error(`Error syncing deal ${deal.id}:`, error);
    } else {
      console.log(`Successfully synced deal: ${deal.Deal_Name}`);
    }
  }

  console.log('Deals sync completed');
}

// Sync notes from Bigin
async function syncNotes(accessToken: string) {
  console.log('Syncing notes from Bigin...');
  
  const response = await fetch('https://www.zohoapis.com/bigin/v1/Notes', {
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API error response:', errorText);
    throw new Error(`Failed to fetch notes: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Bigin API response for notes:', data);
  
  const notes = data.data || [];
  console.log(`Found ${notes.length} notes from Bigin`);

  for (const note of notes) {
    // Find related record IDs from our local database
    let contactId = null;
    let companyId = null;
    let dealId = null;

    if (note.Parent_Id?.id) {
      if (note.Parent_Id.module === 'Contacts') {
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('id')
          .eq('bigin_id', note.Parent_Id.id)
          .maybeSingle();
        contactId = contact?.id || null;
      } else if (note.Parent_Id.module === 'Accounts') {
        const { data: company } = await supabase
          .from('crm_companies')
          .select('id')
          .eq('bigin_id', note.Parent_Id.id)
          .maybeSingle();
        companyId = company?.id || null;
      } else if (note.Parent_Id.module === 'Deals') {
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('bigin_id', note.Parent_Id.id)
          .maybeSingle();
        dealId = deal?.id || null;
      }
    }

    const noteData = {
      bigin_id: note.id,
      title: note.Note_Title || null,
      content: note.Note_Content || null,
      contact_id: contactId,
      company_id: companyId,
      deal_id: dealId,
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('crm_notes')
      .upsert(noteData, { onConflict: 'bigin_id' });

    if (error) {
      console.error(`Error syncing note ${note.id}:`, error);
    } else {
      console.log(`Successfully synced note: ${note.Note_Title}`);
    }
  }

  console.log('Notes sync completed');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    console.log(`Starting Bigin sync with action: ${action}`);

    const accessToken = await getBiginAccessToken();

    switch (action) {
      case 'sync_all':
        await syncCompanies(accessToken);
        await syncContacts(accessToken);
        await syncDeals(accessToken);
        await syncNotes(accessToken);
        break;
      case 'sync_contacts':
        await syncContacts(accessToken);
        break;
      case 'sync_companies':
        await syncCompanies(accessToken);
        break;
      case 'sync_deals':
        await syncDeals(accessToken);
        break;
      case 'sync_notes':
        await syncNotes(accessToken);
        break;
      default:
        throw new Error('Invalid action. Use: sync_all, sync_contacts, sync_companies, sync_deals, or sync_notes');
    }

    console.log('Bigin sync completed successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Sync completed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in bigin-sync function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});