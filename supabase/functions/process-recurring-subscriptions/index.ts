import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-RECURRING-SUBSCRIPTIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role to bypass RLS
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started - checking for subscriptions to process");

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    logStep("Processing subscriptions for date", { date: today });

    // Get all active subscriptions where next_payment is today or past due
    const { data: subscriptions, error: subscriptionsError } = await supabaseClient
      .from('recurring_subscriptions')
      .select('*')
      .eq('active', true)
      .lte('next_payment', today);

    if (subscriptionsError) {
      logStep("Error fetching subscriptions", { error: subscriptionsError });
      throw subscriptionsError;
    }

    logStep("Found subscriptions to process", { count: subscriptions?.length || 0 });

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No subscriptions to process",
        processed: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const subscription of subscriptions) {
      try {
        logStep("Processing subscription", { 
          id: subscription.id, 
          name: subscription.name,
          user_id: subscription.user_id 
        });

        // Generate registration number for movement
        const currentYear = new Date().getFullYear();
        const { count } = await supabaseClient
          .from('financial_movements')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', subscription.user_id)
          .gte('date', `${currentYear}-01-01`)
          .lte('date', `${currentYear}-12-31`);

        const registrationNumber = `PN-${currentYear}-${((count || 0) + 1).toString().padStart(3, '0')}`;
        
        // Get user info for reporting_user field
        const { data: userData } = await supabaseClient.auth.admin.getUserById(subscription.user_id);
        const reportingUser = userData?.user?.user_metadata?.first_name && userData?.user?.user_metadata?.last_name
          ? `${userData.user.user_metadata.first_name} ${userData.user.user_metadata.last_name}`
          : userData?.user?.email || "Sistema automatico";

        // Create financial movement
        const { error: movementError } = await supabaseClient
          .from('financial_movements')
          .insert({
            user_id: subscription.user_id,
            date: today,
            registration_number: registrationNumber,
            causale: subscription.causale || "Abbonamento ricorrente",
            movement_type: "acquisto",
            amount: Number(subscription.amount),
            payment_method: subscription.payment_method,
            description: `Rinnovo abbonamento: ${subscription.name}`,
            notes: `Movimento automatico per rinnovo abbonamento - Frequenza: ${subscription.frequency}`,
            registered: false,
            reporting_user: reportingUser,
            attachments: []
          });

        if (movementError) {
          logStep("Error creating movement", { 
            subscriptionId: subscription.id, 
            error: movementError 
          });
          errorCount++;
          continue;
        }

        // Calculate next payment date based on frequency
        let nextPaymentDate = new Date(subscription.next_payment);
        
        switch (subscription.frequency) {
          case 'mensile':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            break;
          case 'trimestrale':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
            break;
          case 'semestrale':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 6);
            break;
          case 'annuale':
            nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
            break;
          default:
            logStep("Unknown frequency", { frequency: subscription.frequency });
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1); // Default to monthly
        }

        // Update subscription with next payment date
        const { error: updateError } = await supabaseClient
          .from('recurring_subscriptions')
          .update({
            next_payment: nextPaymentDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        if (updateError) {
          logStep("Error updating subscription", { 
            subscriptionId: subscription.id, 
            error: updateError 
          });
          errorCount++;
          continue;
        }

        logStep("Successfully processed subscription", { 
          id: subscription.id,
          nextPayment: nextPaymentDate.toISOString().split('T')[0]
        });
        processedCount++;

      } catch (error) {
        logStep("Error processing individual subscription", { 
          subscriptionId: subscription.id, 
          error: error.message 
        });
        errorCount++;
      }
    }

    logStep("Processing completed", { 
      total: subscriptions.length,
      processed: processedCount,
      errors: errorCount 
    });

    return new Response(JSON.stringify({ 
      message: "Subscription processing completed",
      total: subscriptions.length,
      processed: processedCount,
      errors: errorCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-recurring-subscriptions", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      processed: 0 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});