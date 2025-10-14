import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskAssignmentPayload {
  type: string;
  table: string;
  record: {
    id: string;
    title: string;
    description?: string;
    category: string;
    assigned_to?: string;
    priority: string;
    due_date?: string;
    is_template?: boolean;
  };
  old_record?: {
    assigned_to?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: TaskAssignmentPayload = await req.json();
    console.log("Received task assignment payload:", payload);

    // Skip if it's a template task
    if (payload.record.is_template) {
      console.log("Skipping template task");
      return new Response(JSON.stringify({ message: "Template task, no notification sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if assigned_to has changed or is new
    const isNewAssignment = payload.type === "INSERT" && payload.record.assigned_to;
    const isReassignment = payload.type === "UPDATE" && 
      payload.record.assigned_to && 
      payload.old_record?.assigned_to !== payload.record.assigned_to;

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
      .eq("id", payload.record.assigned_to)
      .single();

    if (profileError || !profile?.email) {
      console.error("Error fetching user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Utente";
    
    // Prepare email content
    const categoryLabels: Record<string, string> = {
      amministrazione: "Amministrazione",
      back_office: "Back-office",
      ricerca_sviluppo: "Ricerca & Sviluppo",
      tecnico: "Tecnico"
    };

    const priorityLabels: Record<string, string> = {
      low: "Bassa",
      medium: "Media",
      high: "Alta",
      urgent: "Urgente"
    };

    const dueDateText = payload.record.due_date 
      ? new Date(payload.record.due_date).toLocaleDateString("it-IT", { 
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
            .task-details { background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
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
              <h1 style="margin: 0;">Nuova Task Assegnata</h1>
            </div>
            <div class="content">
              <p>Ciao ${userName},</p>
              <p>Ti è stata assegnata una nuova task:</p>
              
              <div class="task-details">
                <h2 style="margin-top: 0; color: #1f2937;">${payload.record.title}</h2>
                
                ${payload.record.description ? `
                  <div class="detail-row">
                    <div class="label">Descrizione:</div>
                    <div class="value">${payload.record.description}</div>
                  </div>
                ` : ""}
                
                <div class="detail-row">
                  <span class="label">Categoria:</span>
                  <span class="value">${categoryLabels[payload.record.category] || payload.record.category}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Priorità:</span>
                  <span class="value priority-${payload.record.priority}">
                    ${priorityLabels[payload.record.priority] || payload.record.priority}
                  </span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Scadenza:</span>
                  <span class="value">${dueDateText}</span>
                </div>
              </div>
              
              <p>Puoi visualizzare e gestire questa task nella sezione Task Management dell'applicazione.</p>
            </div>
            <div class="footer">
              <p>Questa è una notifica automatica dal sistema di Task Management.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Task Management <onboarding@resend.dev>",
      to: [profile.email],
      subject: `Nuova Task: ${payload.record.title}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in send-task-assignment function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
