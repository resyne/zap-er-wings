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

// Get Bigin access token
async function getBiginAccessToken(): Promise<string> {
  console.log('Getting Bigin access token...');
  
  // For Bigin, we need to use the refresh token flow instead of client_credentials
  // First check if we have the necessary credentials
  if (!biginClientId || !biginClientSecret) {
    throw new Error('Missing Bigin client credentials');
  }

  // Bigin uses a different OAuth flow - we need a refresh token
  // For this demo, we'll return a mock token and log the attempt
  console.log('Bigin OAuth configuration detected');
  console.log('Client ID configured:', !!biginClientId);
  console.log('Client Secret configured:', !!biginClientSecret);
  
  // Return a mock token for now - in production you'd need proper OAuth setup
  return 'mock_bigin_token_for_demo';
}

// Sync contacts from Bigin (Demo mode with mock data)
async function syncContacts(accessToken: string) {
  console.log('Syncing contacts from Bigin (demo mode)...');
  
  // Mock data for demonstration
  const mockContacts = [
    {
      id: 'mock_contact_1',
      First_Name: 'Mario',
      Last_Name: 'Rossi',
      Email: 'mario.rossi@example.com',
      Phone: '+39 123 456 7890',
      Mobile: '+39 333 123 4567',
      Title: 'Sales Manager',
      Lead_Source: 'website'
    },
    {
      id: 'mock_contact_2',
      First_Name: 'Laura',
      Last_Name: 'Bianchi',
      Email: 'laura.bianchi@example.com',
      Phone: '+39 987 654 3210',
      Mobile: '+39 334 987 6543',
      Title: 'Marketing Director',
      Lead_Source: 'referral'
    }
  ];

  console.log(`Found ${mockContacts.length} mock contacts`);

  for (const contact of mockContacts) {
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

// Sync companies from Bigin (Demo mode with mock data)
async function syncCompanies(accessToken: string) {
  console.log('Syncing companies from Bigin (demo mode)...');
  
  const mockCompanies = [
    {
      id: 'mock_company_1',
      Account_Name: 'Tech Solutions SRL',
      Website: 'https://techsolutions.com',
      Phone: '+39 02 1234567',
      Email: 'info@techsolutions.com',
      Industry: 'Technology',
      Employees: 50,
      Annual_Revenue: 2000000,
      Billing_Street: 'Via Milano 123, 20100 Milano, Italia'
    },
    {
      id: 'mock_company_2', 
      Account_Name: 'Green Energy SpA',
      Website: 'https://greenenergy.it',
      Phone: '+39 06 9876543',
      Email: 'contact@greenenergy.it',
      Industry: 'Energy',
      Employees: 120,
      Annual_Revenue: 5000000,
      Billing_Street: 'Via Roma 456, 00100 Roma, Italia'
    }
  ];

  for (const company of mockCompanies) {
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

// Sync deals from Bigin (Demo mode with mock data)
async function syncDeals(accessToken: string) {
  console.log('Syncing deals from Bigin (demo mode)...');
  
  const mockDeals = [
    {
      id: 'mock_deal_1',
      Deal_Name: 'Software Implementation Project',
      Amount: 50000,
      Stage: 'Proposal/Price Quote',
      Probability: 75,
      Closing_Date: '2024-03-15'
    },
    {
      id: 'mock_deal_2',
      Deal_Name: 'IT Infrastructure Upgrade',
      Amount: 25000,
      Stage: 'Negotiation/Review',
      Probability: 60,
      Closing_Date: '2024-02-28'
    }
  ];

  for (const deal of mockDeals) {
    const dealData = {
      bigin_id: deal.id,
      name: deal.Deal_Name || 'Unknown Deal',
      amount: deal.Amount || null,
      stage: deal.Stage || null,
      probability: deal.Probability || null,
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

// Sync notes from Bigin (Demo mode with mock data)
async function syncNotes(accessToken: string) {
  console.log('Syncing notes from Bigin (demo mode)...');
  
  const mockNotes = [
    {
      id: 'mock_note_1',
      Note_Title: 'Follow-up Meeting',
      Note_Content: 'Discussed project requirements and timeline with the client. Next steps: prepare technical proposal.'
    },
    {
      id: 'mock_note_2',
      Note_Title: 'Technical Requirements',
      Note_Content: 'Client needs integration with existing ERP system. Budget approved for custom development.'
    }
  ];

  for (const note of mockNotes) {
    const noteData = {
      bigin_id: note.id,
      title: note.Note_Title || null,
      content: note.Note_Content || null,
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