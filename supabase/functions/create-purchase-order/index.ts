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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Invalid authentication token");
    }

    const requestData: CreatePurchaseOrderRequest = await req.json();
    const { materialId, quantity, supplierId, deliveryTimeframe, priority, notes } = requestData;

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
    const deliveryDays = parseInt(deliveryTimeframe);
    const expectedDeliveryDate = new Date(currentDate);
    expectedDeliveryDate.setDate(currentDate.getDate() + deliveryDays);

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

    // Send email to supplier if email is available
    if (supplier.email) {
      const deliveryDateText = expectedDeliveryDate 
        ? new Date(expectedDeliveryDate).toLocaleDateString('it-IT')
        : "Da concordare";

      const emailHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <h1 style="color: #333; text-align: center;">Ordine di Acquisto</h1>
              <h2 style="color: #666;">N° ${purchaseOrder.number}</h2>
              
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
                      <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">Prezzo Unit.</th>
                      <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">Totale</th>
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
                      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">€${estimatedUnitPrice.toFixed(2)}</td>
                      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;"><strong>€${totalPrice.toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <div style="text-align: right;">
                  <p style="margin: 5px 0;"><strong>Subtotale: €${purchaseOrder.subtotal.toFixed(2)}</strong></p>
                  <p style="margin: 5px 0;">IVA (22%): €${purchaseOrder.tax_amount.toFixed(2)}</p>
                  <h3 style="margin: 10px 0; color: #333; border-top: 2px solid #e9ecef; padding-top: 10px;">
                    Totale: €${purchaseOrder.total_amount.toFixed(2)}
                  </h3>
                </div>
              </div>

              ${notes ? `
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Note</h3>
                  <p>${notes}</p>
                </div>
              ` : ''}

              <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #666; font-size: 14px;">
                  Questo ordine è stato generato automaticamente dal sistema di gestione magazzino.<br>
                  Per conferma e dettagli di consegna, contattate il nostro ufficio acquisti.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        const emailResult = await resend.emails.send({
          from: "Sistema ERP <noreply@abbattitorizapper.it>",
          to: [supplier.email],
          subject: `Ordine di Acquisto N° ${purchaseOrder.number} - ${supplier.name}`,
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