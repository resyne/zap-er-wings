import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Token mancante", { 
        status: 400, 
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
      });
    }

    // GET request - show confirmation form
    if (req.method === "GET") {
      // Fetch confirmation details
      const { data: confirmation, error: confirmationError } = await supabase
        .from('purchase_order_confirmations')
        .select(`
          *,
          purchase_orders!inner(
            *,
            suppliers!inner(name),
            purchase_order_items!inner(
              *,
              materials!inner(code, name, description, unit)
            )
          )
        `)
        .eq('confirmation_token', token)
        .single();

      if (confirmationError || !confirmation) {
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Token non valido</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .error { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="error">
                <h2>Token non valido o scaduto</h2>
                <p>Il link di conferma non è valido o è scaduto. Contattare l'ufficio acquisti per assistenza.</p>
              </div>
            </body>
          </html>
        `, { 
          status: 404, 
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
        });
      }

      if (confirmation.confirmed) {
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Ordine già confermato</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="success">
                <h2>Ordine già confermato</h2>
                <p>Questo ordine è già stato confermato il ${new Date(confirmation.confirmed_at).toLocaleDateString('it-IT')}.</p>
                <p><strong>Ordine N°:</strong> ${confirmation.purchase_orders.number}</p>
              </div>
            </body>
          </html>
        `, { 
          status: 200, 
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
        });
      }

      const purchaseOrder = confirmation.purchase_orders;
      const items = purchaseOrder.purchase_order_items || [];

      const confirmationForm = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Conferma Ordine di Acquisto</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 20px auto; 
                padding: 20px; 
                background-color: #f8f9fa;
              }
              .container { 
                background-color: white; 
                padding: 30px; 
                border-radius: 8px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .header { 
                text-align: center; 
                border-bottom: 2px solid #e9ecef; 
                padding-bottom: 20px; 
                margin-bottom: 30px;
              }
              .order-details { 
                background-color: #f8f9fa; 
                padding: 20px; 
                border-radius: 5px; 
                margin-bottom: 20px;
              }
              .items-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 20px;
              }
              .items-table th, .items-table td { 
                padding: 12px; 
                text-align: left; 
                border-bottom: 1px solid #dee2e6;
              }
              .items-table th { 
                background-color: #f8f9fa; 
                font-weight: bold;
              }
              .form-group { 
                margin-bottom: 20px;
              }
              .form-group label { 
                display: block; 
                margin-bottom: 5px; 
                font-weight: bold;
              }
              .form-group input, .form-group textarea, .form-group select { 
                width: 100%; 
                padding: 10px; 
                border: 1px solid #ddd; 
                border-radius: 4px; 
                font-size: 14px;
              }
              .form-group textarea { 
                height: 100px; 
                resize: vertical;
              }
              .btn { 
                background-color: #28a745; 
                color: white; 
                padding: 12px 30px; 
                border: none; 
                border-radius: 5px; 
                cursor: pointer; 
                font-size: 16px;
                margin-right: 10px;
              }
              .btn:hover { 
                background-color: #218838;
              }
              .btn-secondary { 
                background-color: #6c757d;
              }
              .btn-secondary:hover { 
                background-color: #5a6268;
              }
              .alert { 
                padding: 15px; 
                border-radius: 5px; 
                margin-bottom: 20px;
              }
              .alert-warning { 
                background-color: #fff3cd; 
                border: 1px solid #ffeaa7; 
                color: #856404;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Conferma Ricezione Ordine di Acquisto</h1>
                <h2>N° ${purchaseOrder.number}</h2>
              </div>

              <div class="order-details">
                <h3>Dettagli Ordine</h3>
                <p><strong>Fornitore:</strong> ${purchaseOrder.suppliers.name}</p>
                <p><strong>Data Ordine:</strong> ${new Date(purchaseOrder.order_date).toLocaleDateString('it-IT')}</p>
                <p><strong>Data Consegna Richiesta:</strong> ${new Date(purchaseOrder.expected_delivery_date).toLocaleDateString('it-IT')}</p>
                <p><strong>Priorità:</strong> ${purchaseOrder.priority?.toUpperCase() || 'MEDIA'}</p>
                <p><strong>Note:</strong> ${purchaseOrder.notes || 'Nessuna nota'}</p>
              </div>

              <h3>Articoli Ordinati</h3>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Descrizione</th>
                    <th>Quantità</th>
                    <th>Prezzo Unit. Est.</th>
                    <th>Totale Est.</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(item => `
                    <tr>
                      <td>${item.materials.code}</td>
                      <td>
                        <strong>${item.materials.name}</strong><br>
                        <small>${item.materials.description || ''}</small>
                      </td>
                      <td>${item.quantity} ${item.materials.unit}</td>
                      <td>€${item.unit_price.toFixed(2)}</td>
                      <td><strong>€${item.total_price.toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="alert alert-warning">
                <h4>Richiesta di Conferma</h4>
                <p>Vi chiediamo di confermare la ricezione di questo ordine e di fornire le seguenti informazioni:</p>
                <ul>
                  <li>Disponibilità dei materiali richiesti</li>
                  <li>Tempi di produzione/consegna effettivi</li>
                  <li>Prezzi aggiornati se diversi da quelli indicati</li>
                  <li>Eventuali note o comunicazioni</li>
                </ul>
              </div>

              <form id="confirmationForm" method="POST">
                <input type="hidden" name="token" value="${token}">
                
                <div class="form-group">
                  <label for="deliveryDate">Data di Consegna Confermata*</label>
                  <input type="date" id="deliveryDate" name="deliveryDate" required 
                         min="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                  <label for="supplierNotes">Note e Comunicazioni</label>
                  <textarea id="supplierNotes" name="supplierNotes" 
                           placeholder="Inserire eventuali note sui prezzi, disponibilità, tempi di consegna o altre comunicazioni..."></textarea>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                  <button type="submit" class="btn">Conferma Ricezione Ordine</button>
                  <button type="button" class="btn btn-secondary" onclick="window.close()">Annulla</button>
                </div>
              </form>
            </div>

            <script>
              document.getElementById('confirmationForm').addEventListener('submit', function(e) {
                if (confirm('Confermare la ricezione di questo ordine? Questa azione non può essere annullata.')) {
                  document.querySelector('button[type="submit"]').disabled = true;
                  document.querySelector('button[type="submit"]').textContent = 'Confermando...';
                } else {
                  e.preventDefault();
                }
              });
            </script>
          </body>
        </html>
      `;

      return new Response(confirmationForm, { 
        status: 200, 
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
      });
    }

    // POST request - process confirmation
    if (req.method === "POST") {
      const formData = await req.formData();
      const tokenFromForm = formData.get("token") as string;
      const deliveryDate = formData.get("deliveryDate") as string;
      const supplierNotes = formData.get("supplierNotes") as string;

      if (!tokenFromForm || tokenFromForm !== token) {
        return new Response("Token non valido", { 
          status: 400, 
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
        });
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
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Errore</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .error { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="error">
                <h2>Errore durante la conferma</h2>
                <p>Si è verificato un errore durante la conferma dell'ordine. Riprovare o contattare l'ufficio acquisti.</p>
              </div>
            </body>
          </html>
        `, { 
          status: 500, 
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
        });
      }

      // Also update purchase order status
      await supabase
        .from('purchase_orders')
        .update({ status: 'confirmed' })
        .eq('id', (await supabase
          .from('purchase_order_confirmations')
          .select('purchase_order_id')
          .eq('confirmation_token', token)
          .single()).data?.purchase_order_id);

      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Conferma Ricevuta</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 20px; border-radius: 5px; text-align: center; }
              .btn { background-color: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="success">
              <h2>✅ Conferma Ricevuta</h2>
              <p>Grazie! La ricezione dell'ordine è stata confermata con successo.</p>
              <p><strong>Data di consegna confermata:</strong> ${new Date(deliveryDate).toLocaleDateString('it-IT')}</p>
              ${supplierNotes ? `<p><strong>Note:</strong> ${supplierNotes}</p>` : ''}
              <p>L'ufficio acquisti riceverà una notifica della vostra conferma.</p>
              <button onclick="window.close()" class="btn">Chiudi</button>
            </div>
          </body>
        </html>
      `, { 
        status: 200, 
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
      });
    }

    return new Response("Metodo non supportato", { 
      status: 405, 
      headers: corsHeaders 
    });

  } catch (error: any) {
    console.error("Error in confirm-purchase-order function:", error);
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Errore</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>Errore del server</h2>
            <p>Si è verificato un errore imprevisto. Contattare l'ufficio acquisti per assistenza.</p>
          </div>
        </body>
      </html>
    `, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
    });
  }
};

serve(handler);