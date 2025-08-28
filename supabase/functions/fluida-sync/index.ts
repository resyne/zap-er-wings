import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FluidaContract {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  status: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
}

interface FluidaCalendarEntry {
  id: string;
  contract_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  total_minutes?: number;
  status: string;
  notes?: string;
}

interface FluidaJustification {
  id: string;
  contract_id: string;
  justification_type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
  reason?: string;
  approved_by?: string;
  approved_at?: string;
}

export default async function handler(req: Request) {
  console.log('Fluida sync function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FLUIDA_API_KEY');
    const companyId = Deno.env.get('FLUIDA_COMPANY_ID');
    
    console.log('=== FLUIDA SYNC DEBUG ===');
    console.log('API Key available:', apiKey ? 'YES' : 'NO');
    console.log('Company ID available:', companyId ? 'YES' : 'NO');
    console.log('API Key length:', apiKey ? apiKey.length : 0);
    console.log('Company ID:', companyId);
    
    if (!apiKey || !companyId) {
      console.error('Missing Fluida API credentials');
      console.error('API Key missing:', !apiKey);
      console.error('Company ID missing:', !companyId);
      return new Response(
        JSON.stringify({ 
          error: 'Missing Fluida API credentials',
          details: {
            apiKey: apiKey ? 'present' : 'missing',
            companyId: companyId ? 'present' : 'missing'
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();

    console.log(`Processing action: ${action}`);

    switch (action) {
      case 'sync-employees':
        return await syncEmployees(supabase, apiKey, companyId);
      
      case 'sync-timesheets':
        return await syncTimesheets(supabase, apiKey, companyId);
      
      case 'sync-leave-requests':
        return await syncLeaveRequests(supabase, apiKey, companyId);
      
      case 'sync-all':
        await syncEmployees(supabase, apiKey, companyId);
        await syncTimesheets(supabase, apiKey, companyId);
        await syncLeaveRequests(supabase, apiKey, companyId);
        return new Response(
          JSON.stringify({ success: true, message: 'Tutti i dati sincronizzati' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      
      default:
        return new Response(
          JSON.stringify({ error: 'Azione non riconosciuta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in fluida-sync function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function makeFluidaRequest(endpoint: string, apiKey: string, method = 'GET', body?: any) {
  const url = `https://api.fluida.io/api/v1/${endpoint}`;
  console.log(`=== FLUIDA API REQUEST ===`);
  console.log(`Making ${method} request to: ${url}`);
  console.log(`API key first 8 chars: ${apiKey ? apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
  
  const headers: Record<string, string> = {
    'x-fluida-app-uuid': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  console.log(`Request headers (without API key):`, {
    'Content-Type': headers['Content-Type'],
    'Accept': headers['Accept'],
    'x-fluida-app-uuid': headers['x-fluida-app-uuid'] ? '[PRESENT]' : '[MISSING]'
  });
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`=== FLUIDA API ERROR ===`);
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error(`Error body: ${errorText}`);
      console.error(`Request URL: ${url}`);
      console.error(`Request headers: ${JSON.stringify(headers, null, 2)}`);
      throw new Error(`Fluida API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`=== FLUIDA API SUCCESS ===`);
    console.log(`Response data keys:`, Object.keys(responseData));
    console.log(`Response data:`, JSON.stringify(responseData, null, 2));
    return responseData;
  } catch (error) {
    console.error(`=== FLUIDA API FETCH ERROR ===`);
    console.error(`Error:`, error);
    console.error(`URL:`, url);
    console.error(`Headers:`, headers);
    throw error;
  }
}

async function syncEmployees(supabase: any, apiKey: string, companyId: string) {
  console.log('Syncing employees (contracts) from Fluida...');
  
  try {
    // Endpoint corretto dalla documentazione: "Renders a list contract entries for a given company id"
    const contractsResponse = await makeFluidaRequest(`contracts/company/${companyId}`, apiKey);
    const contracts = contractsResponse.data || contractsResponse;
    console.log(`Found ${contracts.length} contracts`);

    for (const contract of contracts) {
      const employeeData = {
        fluida_id: contract.id,
        first_name: contract.first_name || '',
        last_name: contract.last_name || '',
        email: contract.email,
        phone: contract.phone,
        department: contract.department,
        position: contract.position,
        hire_date: contract.hire_date,
        status: contract.status || 'active',
        synced_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('hr_employees')
        .upsert(employeeData, { 
          onConflict: 'fluida_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting employee ${contract.id}:`, error);
      } else {
        console.log(`Synced employee: ${employeeData.first_name} ${employeeData.last_name}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronizzati ${contracts.length} dipendenti`,
        count: contracts.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing employees:', error);
    return new Response(
      JSON.stringify({ error: `Errore nella sincronizzazione dipendenti: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function syncTimesheets(supabase: any, apiKey: string, companyId: string) {
  console.log('Syncing timesheets from Fluida...');
  
  try {
    // Get current month calendar entries - endpoint corretto dalla documentazione
    const startDate = new Date();
    startDate.setDate(1);
    const endDate = new Date();
    
    const fromDate = startDate.toISOString().split('T')[0];
    const toDate = endDate.toISOString().split('T')[0];
    
    // Endpoint corretto: "Renders a list of working days for a given company in a range of days"
    const calendarResponse = await makeFluidaRequest(
      `calendar/company/${companyId}/from/${fromDate}/to/${toDate}`, 
      apiKey
    );
    
    const calendarEntries = calendarResponse.data || calendarResponse || [];
    console.log(`Found ${calendarEntries.length} calendar entries`);

    for (const entry of calendarEntries) {
      // Get employee from our database using contract_id
      const { data: employee } = await supabase
        .from('hr_employees')
        .select('id')
        .eq('fluida_id', entry.contract_id)
        .single();

      if (!employee) {
        console.warn(`Employee not found for calendar entry: ${entry.contract_id}`);
        continue;
      }

      // Calculate total hours from minutes - distinguendo ordinarie e straordinarie  
      const regularMinutes = entry.regular_minutes || entry.minutes || 0;
      const overtimeMinutes = entry.overtime_minutes || 0;
      const totalMinutes = regularMinutes + overtimeMinutes;

      const timesheetData = {
        employee_id: employee.id,
        fluida_timesheet_id: entry.id,
        date: entry.date,
        clock_in: entry.clock_in,
        clock_out: entry.clock_out,
        break_minutes: entry.break_minutes || 0,
        total_hours: totalMinutes ? (totalMinutes / 60) : null,
        status: entry.status || 'completed',
        notes: entry.notes || `Ore regolari: ${(regularMinutes/60).toFixed(2)}, Straordinari: ${(overtimeMinutes/60).toFixed(2)}`,
        synced_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('hr_timesheets')
        .upsert(timesheetData, { 
          onConflict: 'fluida_timesheet_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting timesheet ${entry.id}:`, error);
      } else {
        console.log(`Synced timesheet for ${entry.date}: ${(totalMinutes/60).toFixed(2)} hours`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronizzati ${calendarEntries.length} timesheet`,
        count: calendarEntries.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing timesheets:', error);
    return new Response(
      JSON.stringify({ error: `Errore nella sincronizzazione timesheet: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function syncLeaveRequests(supabase: any, apiKey: string, companyId: string) {
  console.log('Syncing leave requests (justifications) from Fluida...');
  
  try {
    // Get justifications for the company (leave requests) - endpoint corretto dalla documentazione
    const justificationsResponse = await makeFluidaRequest(`justification/company/${companyId}`, apiKey);
    const justifications = justificationsResponse.data || justificationsResponse;
    console.log(`Found ${justifications.length} justifications`);

    for (const justification of justifications) {
      // Get employee from our database
      const { data: employee } = await supabase
        .from('hr_employees')
        .select('id')
        .eq('fluida_id', justification.contract_id)
        .single();

      if (!employee) {
        console.warn(`Employee not found for justification: ${justification.contract_id}`);
        continue;
      }

      const leaveData = {
        employee_id: employee.id,
        fluida_request_id: justification.id,
        leave_type: justification.justification_type_name || 'leave',
        start_date: justification.start_date,
        end_date: justification.end_date,
        days_requested: justification.days_requested || 1,
        status: justification.status || 'pending',
        reason: justification.reason,
        approved_at: justification.approved_at,
        synced_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('hr_leave_requests')
        .upsert(leaveData, { 
          onConflict: 'fluida_request_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting leave request ${justification.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronizzate ${justifications.length} richieste ferie`,
        count: justifications.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing leave requests:', error);
    return new Response(
      JSON.stringify({ error: `Errore nella sincronizzazione richieste ferie: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}