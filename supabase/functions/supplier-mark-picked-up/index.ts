import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarkPickedUpRequest {
  orderId: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { orderId, notes }: MarkPickedUpRequest = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Order ID è richiesto" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get order details
    const { data: order } = await supabase
      .from('purchase_orders')
      .select('number, suppliers(name), actual_delivery_date')
      .eq('id', orderId)
      .single();

    // Update order status to picked_up
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ 
        production_status: 'picked_up',
        notes: notes ? `${order?.notes || ''}\n\nRitiro confermato: ${notes}`.trim() : order?.notes
      })
      .eq('id', orderId);

    if (updateError) {
      console.error("Error updating status:", updateError);
      return new Response(
        JSON.stringify({ error: "Errore durante la segnalazione del ritiro" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Add comment
    await supabase
      .from('purchase_order_comments')
      .insert({
        purchase_order_id: orderId,
        comment: `✅ Ordine ritirato dall'azienda${notes ? `: ${notes}` : ''}`,
        is_supplier: true,
        supplier_name: order?.suppliers?.name || 'Fornitore'
      });

    // Send notification email
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      await resend.emails.send({
        from: "Portale Fornitori <noreply@abbattitorizapper.it>",
        to: ["info@abbattitorizapper.it"],
        subject: `✅ Ordine ${order?.number} ritirato da ${order?.suppliers?.name}`,
        html: `
          <h2>Ordine Ritirato</h2>
          <p><strong>${order?.suppliers?.name}</strong> ha confermato che l'ordine <strong>${order?.number}</strong> è stato ritirato dall'azienda.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Data consegna:</strong> ${order?.actual_delivery_date ? new Date(order.actual_delivery_date).toLocaleDateString('it-IT') : 'N/A'}</p>
            <p style="margin: 10px 0 0 0;"><strong>Data ritiro:</strong> ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</p>
            ${notes ? `<p style="margin: 10px 0 0 0;"><strong>Note:</strong> ${notes}</p>` : ''}
          </div>
          
          <p>L'ordine è stato completato con successo.</p>
        `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Ordine segnato come ritirato" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in supplier-mark-picked-up function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
