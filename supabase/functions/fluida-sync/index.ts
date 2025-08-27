import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FluidaEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  hireDate?: string;
  status: string;
  salary?: number;
}

interface FluidaTimesheet {
  id: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakMinutes?: number;
  totalHours?: number;
  status: string;
  notes?: string;
}

interface FluidaLeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: string;
  reason?: string;
  approvedBy?: string;
  approvedAt?: string;
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
    
    if (!apiKey || !companyId) {
      console.error('Missing Fluida API credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Fluida API credentials' }),
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
  const url = `https://api.fluida.io/v1/${endpoint}`;
  console.log(`Making ${method} request to: ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Fluida API error: ${response.status} - ${errorText}`);
    throw new Error(`Fluida API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function syncEmployees(supabase: any, apiKey: string, companyId: string) {
  console.log('Syncing employees from Fluida...');
  
  try {
    const employees = await makeFluidaRequest(`companies/${companyId}/employees`, apiKey);
    console.log(`Found ${employees.length} employees`);

    for (const emp of employees) {
      const employeeData = {
        fluida_id: emp.id,
        first_name: emp.firstName,
        last_name: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        department: emp.department,
        position: emp.position,
        hire_date: emp.hireDate,
        status: emp.status || 'active',
        salary: emp.salary,
        synced_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('hr_employees')
        .upsert(employeeData, { 
          onConflict: 'fluida_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting employee ${emp.id}:`, error);
      } else {
        console.log(`Synced employee: ${emp.firstName} ${emp.lastName}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronizzati ${employees.length} dipendenti`,
        count: employees.length 
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
    // Get current month timesheets
    const startDate = new Date();
    startDate.setDate(1);
    const endDate = new Date();
    
    const timesheets = await makeFluidaRequest(
      `companies/${companyId}/timesheets?start=${startDate.toISOString().split('T')[0]}&end=${endDate.toISOString().split('T')[0]}`, 
      apiKey
    );
    
    console.log(`Found ${timesheets.length} timesheets`);

    for (const ts of timesheets) {
      // Get employee from our database
      const { data: employee } = await supabase
        .from('hr_employees')
        .select('id')
        .eq('fluida_id', ts.employeeId)
        .single();

      if (!employee) {
        console.warn(`Employee not found for timesheet: ${ts.employeeId}`);
        continue;
      }

      const timesheetData = {
        employee_id: employee.id,
        fluida_timesheet_id: ts.id,
        date: ts.date,
        clock_in: ts.clockIn,
        clock_out: ts.clockOut,
        break_minutes: ts.breakMinutes || 0,
        total_hours: ts.totalHours,
        status: ts.status || 'pending',
        notes: ts.notes,
        synced_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('hr_timesheets')
        .upsert(timesheetData, { 
          onConflict: 'fluida_timesheet_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting timesheet ${ts.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronizzati ${timesheets.length} timesheet`,
        count: timesheets.length 
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
  console.log('Syncing leave requests from Fluida...');
  
  try {
    const leaveRequests = await makeFluidaRequest(`companies/${companyId}/leave-requests`, apiKey);
    console.log(`Found ${leaveRequests.length} leave requests`);

    for (const req of leaveRequests) {
      // Get employee from our database
      const { data: employee } = await supabase
        .from('hr_employees')
        .select('id')
        .eq('fluida_id', req.employeeId)
        .single();

      if (!employee) {
        console.warn(`Employee not found for leave request: ${req.employeeId}`);
        continue;
      }

      const leaveData = {
        employee_id: employee.id,
        fluida_request_id: req.id,
        leave_type: req.leaveType,
        start_date: req.startDate,
        end_date: req.endDate,
        days_requested: req.daysRequested,
        status: req.status || 'pending',
        reason: req.reason,
        approved_at: req.approvedAt,
        synced_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('hr_leave_requests')
        .upsert(leaveData, { 
          onConflict: 'fluida_request_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting leave request ${req.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronizzate ${leaveRequests.length} richieste ferie`,
        count: leaveRequests.length 
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