import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddCommentRequest {
  orderId: string;
  comment: string;
  supplierName: string;
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
    const { orderId, comment, supplierName }: AddCommentRequest = await req.json();

    if (!orderId || !comment) {
      return new Response(
        JSON.stringify({ error: "Order ID e commento sono richiesti" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get order details
    const { data: order } = await supabase
      .from('purchase_orders')
      .select('number')
      .eq('id', orderId)
      .single();

    // Add comment
    const { data: newComment, error: commentError } = await supabase
      .from('purchase_order_comments')
      .insert({
        purchase_order_id: orderId,
        comment: comment,
        is_supplier: true,
        supplier_name: supplierName
      })
      .select()
      .single();

    if (commentError) {
      console.error("Error adding comment:", commentError);
      return new Response(
        JSON.stringify({ error: "Errore durante l'aggiunta del commento" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send notification email
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      await resend.emails.send({
        from: "Portale Fornitori <noreply@abbattitorizapper.it>",
        to: ["info@abbattitorizapper.it"],
        subject: `💬 Nuovo commento da ${supplierName} - Ordine ${order?.number}`,
        html: `
          <h2>Nuovo Commento dal Fornitore</h2>
          <p><strong>${supplierName}</strong> ha aggiunto un commento all'ordine <strong>${order?.number}</strong>.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;">${comment}</p>
          </div>
          
          <p><small>Data: ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</small></p>
        `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, comment: newComment }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in supplier-add-comment function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
