import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALERT_EMAIL = "stanislaoelefante@gmail.com";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const alerts: Array<{ type: string; message: string; severity: string; details: any }> = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // ===== CHECK 1: Sync Loop Detection =====
    // Count call_records updated in last hour with short intervals
    const { count: recentSyncs } = await supabase
      .from('call_records')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', oneHourAgo.toISOString());

    if (recentSyncs && recentSyncs > 50) {
      alerts.push({
        type: 'sync_loop',
        message: `⚠️ Loop sincronizzazione rilevato: ${recentSyncs} record aggiornati nell'ultima ora (soglia: 50)`,
        severity: 'critical',
        details: { count: recentSyncs, threshold: 50, checked_at: now.toISOString() }
      });
    }

    // ===== CHECK 2: AI Activity / API Consumption =====
    const { count: recentAiCalls } = await supabase
      .from('ai_activity_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    if (recentAiCalls && recentAiCalls > 200) {
      alerts.push({
        type: 'api_consumption',
        message: `⚠️ Consumo API elevato: ${recentAiCalls} chiamate AI nell'ultima ora (soglia: 200)`,
        severity: 'warning',
        details: { count: recentAiCalls, threshold: 200, checked_at: now.toISOString() }
      });
    }

    // ===== CHECK 3: Edge Function Errors =====
    // Check for repeated failures in ai_activity_logs
    const { count: recentErrors } = await supabase
      .from('ai_activity_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())
      .eq('success', false);

    if (recentErrors && recentErrors > 10) {
      alerts.push({
        type: 'edge_function_errors',
        message: `🔴 Errori ripetuti: ${recentErrors} fallimenti nell'ultima ora (soglia: 10)`,
        severity: 'critical',
        details: { count: recentErrors, threshold: 10, checked_at: now.toISOString() }
      });
    }

    // ===== CHECK 4: Duplicate sync detection (same record updated multiple times) =====
    const { data: duplicateUpdates } = await supabase
      .from('call_records')
      .select('unique_call_id, updated_at')
      .gte('updated_at', oneHourAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(100);

    if (duplicateUpdates) {
      const callIdCounts: Record<string, number> = {};
      for (const r of duplicateUpdates) {
        callIdCounts[r.unique_call_id] = (callIdCounts[r.unique_call_id] || 0) + 1;
      }
      const duplicates = Object.entries(callIdCounts).filter(([, c]) => c > 3);
      if (duplicates.length > 0) {
        alerts.push({
          type: 'sync_duplicate_loop',
          message: `🔄 Record aggiornati ripetutamente: ${duplicates.length} chiamate con >3 aggiornamenti/ora`,
          severity: 'warning',
          details: { duplicates: duplicates.slice(0, 5), checked_at: now.toISOString() }
        });
      }
    }

    // If no alerts, just log and return
    if (alerts.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', message: 'Nessuna anomalia rilevata' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== Check for duplicate alerts (avoid spam) =====
    const filteredAlerts = [];
    for (const alert of alerts) {
      const { data: existing } = await supabase
        .from('system_alerts')
        .select('id')
        .eq('alert_type', alert.type)
        .eq('resolved', false)
        .gte('created_at', new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        filteredAlerts.push(alert);
      }
    }

    if (filteredAlerts.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', message: 'Alert già inviati recentemente, nessun duplicato' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== Save alerts to DB =====
    for (const alert of filteredAlerts) {
      await supabase.from('system_alerts').insert({
        alert_type: alert.type,
        alert_message: alert.message,
        severity: alert.severity,
        details: alert.details
      });
    }

    // ===== Send email alert =====
    if (resendKey) {
      const emailBody = filteredAlerts.map(a => 
        `<div style="padding:12px;margin:8px 0;border-left:4px solid ${a.severity === 'critical' ? '#ef4444' : '#f59e0b'};background:#f9fafb;border-radius:4px;">
          <strong>${a.message}</strong>
          <pre style="font-size:11px;color:#666;margin-top:4px;">${JSON.stringify(a.details, null, 2)}</pre>
        </div>`
      ).join('');

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@abbattitorizapper.it',
          to: [ALERT_EMAIL],
          subject: `🚨 Sistema Alert ERP - ${filteredAlerts.length} anomalie rilevate`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#dc2626;">🚨 Alert Sistema ERP</h2>
              <p style="color:#666;">Data controllo: ${now.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</p>
              ${emailBody}
              <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
              <p style="font-size:12px;color:#999;">Alert automatico dal sistema di monitoraggio ERP Zapper.</p>
            </div>
          `,
        }),
      });

      const emailResult = await emailRes.json();
      console.log('Email alert sent:', emailResult);
    } else {
      console.warn('RESEND_API_KEY non configurata, alert salvati solo nel DB');
    }

    return new Response(JSON.stringify({ 
      status: 'alerts_sent', 
      count: filteredAlerts.length,
      alerts: filteredAlerts.map(a => a.message)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('System monitor error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
