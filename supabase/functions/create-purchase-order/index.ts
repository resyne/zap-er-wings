import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePurchaseOrderRequest {
  materialId: string;
  quantity: number;
  supplierId: string;
  deliveryTimeframe: string;
  priority: string;
  notes?: string;
  additionalEmailNotes?: string;
}

interface Material {
  id: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  cost: number;
}

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!resendApiKey) {
      throw new Error("Missing Resend API key");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    console.log("=== CREATE PURCHASE ORDER START ===");
    
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("Missing authorization header");
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token extracted, length:", token.length);
    
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    console.log("User auth result:", { userData: !!userData.user, error: userError });
    
    if (userError || !userData.user) {
      console.error("Authentication error:", userError);
      throw new Error("Invalid authentication token");
    }

    console.log("About to parse request body...");
    const requestData: CreatePurchaseOrderRequest = await req.json();
    console.log("Request data parsed successfully:", requestData);
    
    const { materialId, quantity, supplierId, deliveryTimeframe, priority, notes, additionalEmailNotes } = requestData;

    console.log("Creating purchase order with data:", requestData);

    // Fetch material details
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (materialError || !material) {
      throw new Error("Material not found");
    }

    console.log("Material found:", material);

    // Fetch supplier details
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      throw new Error("Supplier not found");
    }

    console.log("Supplier found:", supplier);

    // Calculate expected delivery date based on timeframe
    const currentDate = new Date();
    const deliveryDays = deliveryTimeframe && deliveryTimeframe.trim() !== '' ? parseInt(deliveryTimeframe) : 7; // Default to 7 days if empty
    const expectedDeliveryDate = new Date(currentDate);
    
    if (isNaN(deliveryDays)) {
      console.error("Invalid delivery timeframe provided:", deliveryTimeframe);
      throw new Error("Invalid delivery timeframe");
    }
    
    expectedDeliveryDate.setDate(currentDate.getDate() + deliveryDays);
    
    console.log("Date calculation:", {
      currentDate: currentDate.toISOString(),
      deliveryTimeframe,
      deliveryDays,
      expectedDeliveryDate: expectedDeliveryDate.toISOString(),
      formattedDate: expectedDeliveryDate.toISOString().split('T')[0]
    });

    // Calculate pricing (use material cost as placeholder)
    const estimatedUnitPrice = material.cost || 0;
    const totalPrice = quantity * estimatedUnitPrice;

    // Create purchase order
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: supplierId,
        status: 'pending',
        expected_delivery_date: expectedDeliveryDate.toISOString().split('T')[0],
        priority: priority,
        delivery_timeframe_days: deliveryDays,
        subtotal: totalPrice,
        tax_amount: totalPrice * 0.22, // 22% VAT
        total_amount: totalPrice * 1.22,
        notes: notes || `Riordino ${material.name} - Priorità: ${priority}`,
        created_by: userData.user.id
      })
      .select()
      .single();

    if (poError || !purchaseOrder) {
      console.error("Error creating purchase order:", poError);
      throw new Error("Failed to create purchase order");
    }

    console.log("Purchase order created:", purchaseOrder);

    // Create purchase order item
    const { data: orderItem, error: itemError } = await supabase
      .from('purchase_order_items')
      .insert({
        purchase_order_id: purchaseOrder.id,
        material_id: materialId,
        quantity: quantity,
        unit_price: estimatedUnitPrice,
        total_price: totalPrice,
        notes: notes || null
      })
      .select()
      .single();

    if (itemError) {
      console.error("Error creating order item:", itemError);
      throw new Error("Failed to create order item");
    }

    console.log("Order item created:", orderItem);

    // Create confirmation token for supplier
    const confirmationToken = crypto.randomUUID();
    
    const { data: confirmation, error: confirmationError } = await supabase
      .from('purchase_order_confirmations')
      .insert({
        purchase_order_id: purchaseOrder.id,
        supplier_email: supplier.email || '',
        confirmation_token: confirmationToken
      })
      .select()
      .single();

    if (confirmationError) {
      console.error("Error creating confirmation:", confirmationError);
      // Continue even if confirmation creation fails
    }

    console.log("Confirmation token created:", confirmation);

    // Send email to supplier if email is available
    if (supplier.email) {
      const deliveryDateText = expectedDeliveryDate 
        ? new Date(expectedDeliveryDate).toLocaleDateString('it-IT')
        : "Da concordare";

      const confirmationUrl = confirmation 
        ? `https://927bac44-432a-46fc-b33f-adc680e49394.sandbox.lovable.dev/procurement/purchase-order-confirm?token=${confirmationToken}`
        : null;

      const emailHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <h1 style="color: #333; text-align: center;">Ordine di Acquisto</h1>
              <h2 style="color: #666;">N° ${purchaseOrder.number}</h2>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Dettagli Ordine</h3>
                <p><strong>Data Ordine:</strong> ${new Date(purchaseOrder.order_date).toLocaleDateString('it-IT')}</p>
                <p><strong>Data Consegna Richiesta:</strong> ${deliveryDateText} (${deliveryDays} giorni)</p>
                <p><strong>Priorità:</strong> ${priority.toUpperCase()}</p>
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
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${material.code}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">
                        <strong>${material.name}</strong><br>
                        <small style="color: #666;">${material.description || ''}</small>
                      </td>
                      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">${quantity} ${material.unit}</td>
                    </tr>
                  </tbody>
                </table>
              </div>


              ${notes ? `
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Note e Richieste</h3>
                  <p>${notes}</p>
                </div>
              ` : ''}

              ${additionalEmailNotes ? `
                <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                  <h3 style="color: #004085; border-bottom: 2px solid #b3d7ff; padding-bottom: 10px; margin-top: 0;">Comunicazioni Aggiuntive</h3>
                  <p style="color: #004085; margin: 10px 0;">${additionalEmailNotes}</p>
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

      try {
        const emailResult = await resend.emails.send({
          from: "Sistema ERP <acquisti@abbattitorizapper.it>",
          to: [supplier.email],
          subject: `🔔 Ordine di Acquisto N° ${purchaseOrder.number} - Conferma Richiesta`,
          html: emailHtml,
        });

        console.log("Email sent successfully:", emailResult);
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Continue even if email fails - the order was created successfully
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        purchaseOrder: purchaseOrder,
        orderItem: orderItem,
        emailSent: !!supplier.email
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
    console.error("Error in create-purchase-order function:", error);
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