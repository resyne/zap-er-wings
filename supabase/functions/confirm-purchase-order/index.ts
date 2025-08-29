import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmOrderRequest {
  token: string;
  deliveryDate: string;
  supplierNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }), 
      { 
        status: 405, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, deliveryDate, supplierNotes }: ConfirmOrderRequest = await req.json();

    if (!token || !deliveryDate) {
      return new Response(
        JSON.stringify({ error: "Token e data di consegna sono richiesti" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // Check if token exists and is valid
    const { data: confirmation, error: confirmationError } = await supabase
      .from('purchase_order_confirmations')
      .select('*, purchase_orders(*)')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (confirmationError || !confirmation) {
      return new Response(
        JSON.stringify({ error: "Token non valido o scaduto" }),
        { 
          status: 404, 
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    if (confirmation.confirmed) {
      return new Response(
        JSON.stringify({ 
          error: "Questo ordine è già stato confermato",
          already_confirmed: true 
        }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    if (new Date(confirmation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token di conferma scaduto" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // Update confirmation
    const { error: updateError } = await supabase
      .from('purchase_order_confirmations')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        supplier_delivery_date: deliveryDate,
        supplier_notes: supplierNotes || null
      })
      .eq('confirmation_token', token);

    if (updateError) {
      console.error("Error updating confirmation:", updateError);
      return new Response(
        JSON.stringify({ error: "Errore durante la conferma dell'ordine" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // Update purchase order status
    const { error: orderUpdateError } = await supabase
      .from('purchase_orders')
      .update({ status: 'confirmed' })
      .eq('id', confirmation.purchase_order_id);

    if (orderUpdateError) {
      console.error("Error updating purchase order status:", orderUpdateError);
      // Don't fail the request if this update fails
    }

    console.log(`Purchase order ${confirmation.purchase_orders?.number} confirmed by supplier`);

    // Send notification email to procurement department
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      const emailResult = await resend.emails.send({
        from: "Sistema Ordini <noreply@abbattitorizapper.it>",
        to: ["acquisti@abbattitorizapper.it"],
        subject: `Ordine di Acquisto ${confirmation.purchase_orders?.number} confermato dal fornitore`,
        html: `
          <h2>Conferma Ordine di Acquisto</h2>
          <p>L'ordine di acquisto <strong>${confirmation.purchase_orders?.number}</strong> è stato confermato dal fornitore.</p>
          
          <h3>Dettagli della conferma:</h3>
          <ul>
            <li><strong>Email fornitore:</strong> ${confirmation.supplier_email}</li>
            <li><strong>Data di consegna prevista:</strong> ${new Date(deliveryDate).toLocaleDateString('it-IT')}</li>
            <li><strong>Data conferma:</strong> ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</li>
            ${supplierNotes ? `<li><strong>Note del fornitore:</strong> ${supplierNotes}</li>` : ''}
          </ul>
          
          <p>L'ordine è ora confermato e in attesa di consegna.</p>
        `,
      });

      console.log("Notification email sent successfully:", emailResult);
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Conferma ricevuta con successo",
        confirmed_at: new Date().toISOString(),
        delivery_date: deliveryDate
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error("Error in confirm-purchase-order function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Errore interno del server" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

serve(handler);