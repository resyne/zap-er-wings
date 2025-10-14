import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting task reminders job...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current day of week (1=Monday, 7=Sunday)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDayOfWeek = tomorrow.getDay() === 0 ? 7 : tomorrow.getDay(); // Convert Sunday from 0 to 7

    console.log(`Tomorrow is day ${tomorrowDayOfWeek}`);

    // Get all active recurring tasks for tomorrow
    const { data: recurringTasks, error: tasksError } = await supabase
      .from("recurring_tasks")
      .select(`
        id,
        recurrence_days,
        tasks!recurring_tasks_task_template_id_fkey (
          id,
          title,
          description,
          category,
          assigned_to,
          estimated_hours,
          priority
        )
      `)
      .eq("is_active", true)
      .eq("recurrence_type", "weekly");

    if (tasksError) {
      console.error("Error fetching recurring tasks:", tasksError);
      throw tasksError;
    }

    console.log(`Found ${recurringTasks?.length || 0} recurring tasks`);

    // Filter tasks for tomorrow's day
    const tasksForTomorrow = recurringTasks?.filter(rt => 
      rt.recurrence_days?.includes(tomorrowDayOfWeek)
    ) || [];

    console.log(`${tasksForTomorrow.length} tasks scheduled for tomorrow`);

    let emailsSent = 0;
    const errors = [];

    // Send reminder emails
    for (const recurringTask of tasksForTomorrow) {
      const task = recurringTask.tasks;
      
      if (!task?.assigned_to) {
        console.log(`Task ${task?.title} has no assigned user, skipping`);
        continue;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", task.assigned_to)
        .single();

      if (profileError || !profile?.email) {
        console.error(`Error fetching profile for task ${task.title}:`, profileError);
        errors.push({ task: task.title, error: "User email not found" });
        continue;
      }

      const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Utente";
      
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

      const dayLabels: Record<number, string> = {
        1: "Lunedì",
        2: "Martedì",
        3: "Mercoledì",
        4: "Giovedì",
        5: "Venerdì"
      };

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
              .task-details { background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
              .detail-row { margin: 10px 0; }
              .label { font-weight: bold; color: #6b7280; }
              .value { color: #111827; }
              .priority-urgent { color: #dc2626; font-weight: bold; }
              .priority-high { color: #ea580c; font-weight: bold; }
              .priority-medium { color: #ca8a04; font-weight: bold; }
              .priority-low { color: #16a34a; font-weight: bold; }
              .reminder-badge { background-color: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 6px; display: inline-block; margin: 10px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📅 Promemoria Task</h1>
              </div>
              <div class="content">
                <p>Ciao ${userName},</p>
                
                <div class="reminder-badge">
                  Domani, ${dayLabels[tomorrowDayOfWeek]}
                </div>
                
                <p>Ti ricordiamo che domani hai questa task ricorrente da completare:</p>
                
                <div class="task-details">
                  <h2 style="margin-top: 0; color: #1f2937;">${task.title}</h2>
                  
                  ${task.description ? `
                    <div class="detail-row">
                      <div class="label">Descrizione:</div>
                      <div class="value">${task.description}</div>
                    </div>
                  ` : ""}
                  
                  <div class="detail-row">
                    <span class="label">Categoria:</span>
                    <span class="value">${categoryLabels[task.category] || task.category}</span>
                  </div>
                  
                  <div class="detail-row">
                    <span class="label">Priorità:</span>
                    <span class="value priority-${task.priority}">
                      ${priorityLabels[task.priority] || task.priority}
                    </span>
                  </div>
                  
                  ${task.estimated_hours ? `
                    <div class="detail-row">
                      <span class="label">Tempo stimato:</span>
                      <span class="value">${task.estimated_hours} ore</span>
                    </div>
                  ` : ""}
                </div>
                
                <p>Puoi gestire questa task nella sezione Task Management dell'applicazione.</p>
              </div>
              <div class="footer">
                <p>Questa è una notifica automatica dal sistema di Task Management.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: "Task Management <onboarding@resend.dev>",
          to: [profile.email],
          subject: `📅 Promemoria: ${task.title} - Domani`,
          html: emailHtml,
        });

        console.log(`Email sent to ${profile.email} for task "${task.title}":`, emailResponse);
        emailsSent++;
      } catch (emailError: any) {
        console.error(`Error sending email for task ${task.title}:`, emailError);
        errors.push({ task: task.title, error: emailError.message });
      }
    }

    console.log(`Task reminders job completed. Sent ${emailsSent} emails.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        tasksChecked: recurringTasks?.length || 0,
        tasksForTomorrow: tasksForTomorrow.length,
        errors: errors.length > 0 ? errors : undefined
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-task-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
