import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkOrderAssignmentPayload {
  type: string;
  table: string;
  record: {
    id: string;
    number: string;
    title?: string;
    description?: string;
    status: string;
    priority?: string;
    assigned_to?: string;
    service_responsible_id?: string;
    shipping_responsible_id?: string;
    scheduled_date?: string;
    shipping_date?: string;
  };
  old_record?: {
    assigned_to?: string;
    service_responsible_id?: string;
    shipping_responsible_id?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WorkOrderAssignmentPayload = await req.json();
    console.log("Received work order assignment payload:", payload);

    // Determine the assigned user based on table type
    let assignedUserId: string | undefined;
    let oldAssignedUserId: string | undefined;

    if (payload.table === "work_orders") {
      assignedUserId = payload.record.assigned_to;
      oldAssignedUserId = payload.old_record?.assigned_to;
    } else if (payload.table === "service_work_orders") {
      assignedUserId = payload.record.service_responsible_id;
      oldAssignedUserId = payload.old_record?.service_responsible_id;
    } else if (payload.table === "shipping_orders") {
      assignedUserId = payload.record.shipping_responsible_id;
      oldAssignedUserId = payload.old_record?.shipping_responsible_id;
    }

    // Check if assigned_to has changed or is new
    const isNewAssignment = payload.type === "INSERT" && assignedUserId;
    const isReassignment = payload.type === "UPDATE" && 
      assignedUserId && 
      oldAssignedUserId !== assignedUserId;

    if (!isNewAssignment && !isReassignment) {
      console.log("No assignment change detected");
      return new Response(JSON.stringify({ message: "No assignment change" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get assigned user's email
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", assignedUserId)
      .single();

    if (profileError || !profile?.email) {
      console.error("Error fetching user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Utente";
    
    // Determine work order type and labels
    let workOrderType = "";
    let workOrderTypeLabel = "";
    
    if (payload.table === "work_orders") {
      workOrderType = "produzione";
      workOrderTypeLabel = "Commessa di Produzione";
    } else if (payload.table === "service_work_orders") {
      workOrderType = "lavoro";
      workOrderTypeLabel = "Commessa di Lavoro";
    } else if (payload.table === "shipping_orders") {
      workOrderType = "spedizione";
      workOrderTypeLabel = "Commessa di Spedizione";
    }

    const statusLabels: Record<string, string> = {
      to_do: "Da fare",
      planned: "Pianificato",
      in_progress: "In corso",
      in_lavorazione: "In lavorazione",
      test: "Test",
      pronti: "Pronti",
      spediti_consegnati: "Spediti/Consegnati",
      da_fare: "Da fare",
      spedito: "Spedito"
    };

    const priorityLabels: Record<string, string> = {
      low: "Bassa",
      medium: "Media",
      high: "Alta",
      urgent: "Urgente"
    };

    const scheduledDateText = payload.record.scheduled_date || payload.record.shipping_date
      ? new Date(payload.record.scheduled_date || payload.record.shipping_date!).toLocaleDateString("it-IT", { 
          day: "numeric", 
          month: "long", 
          year: "numeric" 
        })
      : "Non specificata";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .work-order-details { background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #6b7280; }
            .value { color: #111827; }
            .priority-urgent { color: #dc2626; font-weight: bold; }
            .priority-high { color: #ea580c; font-weight: bold; }
            .priority-medium { color: #ca8a04; font-weight: bold; }
            .priority-low { color: #16a34a; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">${workOrderTypeLabel} Assegnata</h1>
            </div>
            <div class="content">
              <p>Ciao ${userName},</p>
              <p>Ti è stata assegnata una nuova ${workOrderType === "spedizione" ? "commessa di spedizione" : workOrderType === "lavoro" ? "commessa di lavoro" : "commessa di produzione"}:</p>
              
              <div class="work-order-details">
                <h2 style="margin-top: 0; color: #1f2937;">
                  ${payload.record.number}
                  ${payload.record.title ? ' - ' + payload.record.title : ''}
                </h2>
                
                ${payload.record.description ? `
                  <div class="detail-row">
                    <div class="label">Descrizione:</div>
                    <div class="value">${payload.record.description}</div>
                  </div>
                ` : ""}
                
                <div class="detail-row">
                  <span class="label">Stato:</span>
                  <span class="value">${statusLabels[payload.record.status] || payload.record.status}</span>
                </div>
                
                ${payload.record.priority ? `
                  <div class="detail-row">
                    <span class="label">Priorità:</span>
                    <span class="value priority-${payload.record.priority}">
                      ${priorityLabels[payload.record.priority] || payload.record.priority}
                    </span>
                  </div>
                ` : ""}
                
                ${(payload.record.scheduled_date || payload.record.shipping_date) ? `
                  <div class="detail-row">
                    <span class="label">${workOrderType === "spedizione" ? "Data spedizione" : "Data pianificata"}:</span>
                    <span class="value">${scheduledDateText}</span>
                  </div>
                ` : ""}
              </div>
              
              <p>Puoi visualizzare e gestire questa commessa nella sezione Produzione dell'applicazione.</p>
            </div>
            <div class="footer">
              <p>Questa è una notifica automatica dal sistema ERP.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "ERP Zapper <noreply@abbattitorizapper.it>",
      to: [profile.email],
      subject: `${workOrderTypeLabel}: ${payload.record.number}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in send-work-order-assignment function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
