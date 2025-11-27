import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddAttachmentRequest {
  orderId: string;
  fileName: string;
  fileUrl: string;
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
    const { orderId, fileName, fileUrl }: AddAttachmentRequest = await req.json();

    if (!orderId || !fileName || !fileUrl) {
      return new Response(
        JSON.stringify({ error: "Tutti i campi sono richiesti" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get order details
    const { data: order } = await supabase
      .from('purchase_orders')
      .select('number, suppliers(name)')
      .eq('id', orderId)
      .single();

    // Add attachment
    const { data: newAttachment, error: attachmentError } = await supabase
      .from('purchase_order_attachments')
      .insert({
        purchase_order_id: orderId,
        file_name: fileName,
        file_url: fileUrl
      })
      .select()
      .single();

    if (attachmentError) {
      console.error("Error adding attachment:", attachmentError);
      return new Response(
        JSON.stringify({ error: "Errore durante l'aggiunta dell'allegato" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send notification email
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      await resend.emails.send({
        from: "Portale Fornitori <noreply@abbattitorizapper.it>",
        to: ["info@abbattitorizapper.it"],
        subject: `📎 Nuovo allegato da ${order?.suppliers?.name} - Ordine ${order?.number}`,
        html: `
          <h2>Nuovo Allegato dal Fornitore</h2>
          <p><strong>${order?.suppliers?.name}</strong> ha caricato un nuovo file per l'ordine <strong>${order?.number}</strong>.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>File:</strong> ${fileName}</p>
          </div>
          
          <p><a href="${fileUrl}" style="color: #0066cc;">Scarica allegato</a></p>
          
          <p><small>Data: ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</small></p>
        `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, attachment: newAttachment }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in supplier-add-attachment function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
