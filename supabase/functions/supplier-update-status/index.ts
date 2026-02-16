import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateStatusRequest {
  orderId: string;
  status: string;
  notes?: string;
}

const statusLabels: Record<string, string> = {
  confirmed: "Confermato",
  in_production: "In Produzione",
  ready_to_ship: "Pronto per Spedizione",
  shipped: "Spedito",
  delivered: "Consegnato"
};

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
    const body = await req.json();
    const { orderId, status, notes, toggleArchive: archiveValue } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Order ID è richiesto" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Handle archive toggle
    if (typeof archiveValue === 'boolean') {
      const { error: archiveError } = await supabase
        .from('purchase_orders')
        .update({ archived: archiveValue })
        .eq('id', orderId);

      if (archiveError) {
        console.error("Error toggling archive:", archiveError);
        return new Response(
          JSON.stringify({ error: "Errore durante l'archiviazione" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: archiveValue ? "Ordine archiviato" : "Ordine ripristinato" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!status) {
      return new Response(
        JSON.stringify({ error: "Status è richiesto" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get order details
    const { data: order } = await supabase
      .from('purchase_orders')
      .select('number, suppliers(name)')
      .eq('id', orderId)
      .single();

    // Update order status
    const updateData: any = { 
      production_status: status
    };

    if (status === 'delivered') {
      updateData.actual_delivery_date = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error("Error updating status:", updateError);
      return new Response(
        JSON.stringify({ error: "Errore durante l'aggiornamento dello stato" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Add status update as comment if notes provided
    if (notes) {
      await supabase
        .from('purchase_order_comments')
        .insert({
          purchase_order_id: orderId,
          comment: `Stato aggiornato a "${statusLabels[status]}": ${notes}`,
          is_supplier: true,
          supplier_name: order?.suppliers?.name || 'Fornitore'
        });
    }

    // Send notification email
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      await resend.emails.send({
        from: "Portale Fornitori <noreply@abbattitorizapper.it>",
        to: ["info@abbattitorizapper.it"],
        subject: `🔄 Aggiornamento stato da ${order?.suppliers?.name} - Ordine ${order?.number}`,
        html: `
          <h2>Aggiornamento Stato Ordine</h2>
          <p><strong>${order?.suppliers?.name}</strong> ha aggiornato lo stato dell'ordine <strong>${order?.number}</strong>.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Nuovo stato:</strong> ${statusLabels[status]}</p>
            ${notes ? `<p style="margin: 10px 0 0 0;"><strong>Note:</strong> ${notes}</p>` : ''}
          </div>
          
          <p><small>Data: ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</small></p>
        `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Stato aggiornato con successo" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in supplier-update-status function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
