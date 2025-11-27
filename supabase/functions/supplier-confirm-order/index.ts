import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmOrderRequest {
  orderId: string;
  deliveryDate: string;
  supplierNotes?: string;
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
    const { orderId, deliveryDate, supplierNotes }: ConfirmOrderRequest = await req.json();

    if (!orderId || !deliveryDate) {
      return new Response(
        JSON.stringify({ error: "Order ID e data di consegna sono richiesti" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Ordine non trovato" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ 
        status: 'confirmed',
        production_status: 'confirmed',
        estimated_delivery_date: deliveryDate,
        supplier_confirmed_at: new Date().toISOString(),
        notes: supplierNotes || order.notes
      })
      .eq('id', orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
      return new Response(
        JSON.stringify({ error: "Errore durante la conferma dell'ordine" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send notification email
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      await resend.emails.send({
        from: "Portale Fornitori <noreply@abbattitorizapper.it>",
        to: ["info@abbattitorizapper.it"],
        subject: `✅ Ordine ${order.number} confermato da ${order.suppliers?.name}`,
        html: `
          <h2>Conferma Ordine di Acquisto</h2>
          <p>L'ordine <strong>${order.number}</strong> è stato confermato dal fornitore <strong>${order.suppliers?.name}</strong>.</p>
          
          <h3>Dettagli della conferma:</h3>
          <ul>
            <li><strong>Fornitore:</strong> ${order.suppliers?.name}</li>
            <li><strong>Data di consegna prevista:</strong> ${new Date(deliveryDate).toLocaleDateString('it-IT')}</li>
            <li><strong>Data conferma:</strong> ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</li>
            <li><strong>Importo totale:</strong> €${order.total_amount?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</li>
            ${supplierNotes ? `<li><strong>Note del fornitore:</strong> ${supplierNotes}</li>` : ''}
          </ul>
          
          <p>L'ordine è ora confermato e in attesa di consegna.</p>
        `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Ordine confermato con successo" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in supplier-confirm-order function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
