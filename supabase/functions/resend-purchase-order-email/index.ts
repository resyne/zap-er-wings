import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error("Missing environment configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    console.log("=== RESEND PURCHASE ORDER EMAIL START ===");
    
    // Check authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Invalid authentication token");
    }

    const { purchase_order_id } = await req.json();

    if (!purchase_order_id) {
      throw new Error("Missing purchase_order_id");
    }

    console.log("Fetching purchase order:", purchase_order_id);

    // Fetch purchase order with items
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_order_items (
          *,
          materials (*)
        ),
        suppliers (*)
      `)
      .eq('id', purchase_order_id)
      .single();

    if (poError || !purchaseOrder) {
      console.error("Purchase order not found:", poError);
      throw new Error("Purchase order not found");
    }

    console.log("Purchase order found:", purchaseOrder);

    const supplier = purchaseOrder.suppliers;
    const items = purchaseOrder.purchase_order_items;

    if (!supplier) {
      throw new Error("Supplier not found");
    }

    // Prioritize contact_email if available
    const recipientEmail = supplier.contact_email || supplier.email;
    
    if (!recipientEmail) {
      throw new Error("No email found for supplier");
    }

    console.log("Sending email to:", recipientEmail);

    // Create confirmation token
    const confirmationToken = crypto.randomUUID();
    
    const { data: confirmation, error: confirmationError } = await supabase
      .from('purchase_order_confirmations')
      .insert({
        purchase_order_id: purchaseOrder.id,
        supplier_email: recipientEmail,
        confirmation_token: confirmationToken
      })
      .select()
      .single();

    if (confirmationError) {
      console.error("Error creating confirmation:", confirmationError);
    }

    const deliveryDateText = purchaseOrder.expected_delivery_date 
      ? new Date(purchaseOrder.expected_delivery_date).toLocaleDateString('it-IT')
      : "Da concordare";

    const confirmationUrl = confirmation 
      ? `https://erp.abbattitorizapper.it/procurement/purchase-order-confirm?token=${confirmationToken}`
      : null;

    // Build items table HTML
    const itemsHtml = items.map((item: any) => {
      const material = item.materials;
      if (!material) return '';
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${material.code}</td>
          <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">
            <strong>${material.name}</strong><br>
            <small style="color: #666;">${material.description || ''}</small>
          </td>
          <td style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">${item.quantity} ${material.unit}</td>
        </tr>
      `;
    }).join('');

    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h1 style="color: #333; text-align: center;">Ordine di Acquisto</h1>
            <h2 style="color: #666;">N° ${purchaseOrder.number}</h2>
            ${supplier.contact_name ? `<p style="color: #666; text-align: center;">Attenzione: ${supplier.contact_name}</p>` : ''}
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Dettagli Ordine</h3>
              <p><strong>Data Ordine:</strong> ${new Date(purchaseOrder.order_date).toLocaleDateString('it-IT')}</p>
              <p><strong>Data Consegna Richiesta:</strong> ${deliveryDateText}</p>
              <p><strong>Fornitore:</strong> ${supplier.name}</p>
            </div>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Articoli Ordinati</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Codice</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Descrizione</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">Quantità</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            ${purchaseOrder.notes ? `
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Note e Richieste</h3>
                <p>${purchaseOrder.notes}</p>
              </div>
            ` : ''}

            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">Richiesta di Conferma</h3>
              <p style="color: #856404; margin: 10px 0;">
                Vi chiediamo cortesemente di:
              </p>
              <ul style="color: #856404; margin: 10px 0; padding-left: 20px;">
                <li>Confermare la disponibilità dei materiali richiesti</li>
                <li>Confermare i tempi di produzione/consegna o comunicare eventuali tempistiche diverse</li>
                <li>Confermare i prezzi o comunicare le quotazioni aggiornate</li>
                <li>Comunicare eventuali note o richieste particolari</li>
              </ul>
            </div>

            ${confirmationUrl ? `
              <div style="background-color: #d4edda; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #28a745;">
                <h2 style="color: #155724; margin-top: 0; font-size: 20px;">🎯 CONFERMA ORDINE RICHIESTA</h2>
                <p style="color: #155724; margin: 15px 0; font-size: 16px; font-weight: bold;">
                  IMPORTANTE: Confermate la ricezione di questo ordine e comunicate la vostra data di consegna
                </p>
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="color: #333; margin: 10px 0; font-size: 14px;">
                    • Cliccate sul bottone per confermare la ricezione<br>
                    • Indicate la vostra data di consegna<br>  
                    • Aggiungete eventuali note sui prezzi o specifiche
                  </p>
                </div>
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background-color: #28a745; color: white; padding: 15px 35px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold; margin: 15px 0; 
                          font-size: 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                  ✅ CONFERMA RICEZIONE E CONSEGNA
                </a>
                <p style="color: #155724; font-size: 12px; margin: 10px 0;">
                  Link valido per 30 giorni. Una volta confermato, l'ordine passerà automaticamente allo stato "Confermato".
                </p>
              </div>
            ` : ''}

            <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                Questo ordine è stato generato automaticamente dal sistema ERP.<br>
                Per qualsiasi domanda o chiarimento, contattate il nostro ufficio acquisti.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResult = await resend.emails.send({
      from: "Sistema ERP <acquisti@abbattitorizapper.it>",
      to: [recipientEmail],
      cc: ["info@abbattitorizapper.it"],
      subject: `🔔 Ordine di Acquisto N° ${purchaseOrder.number} - Conferma Richiesta`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: true,
        recipientEmail: recipientEmail
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in resend-purchase-order-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
