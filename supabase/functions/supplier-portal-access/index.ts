import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { supplierId } = await req.json()

    console.log('Loading supplier portal for:', supplierId);

    // Get supplier data
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single()

    if (supplierError || !supplier) {
      console.error('Supplier not found:', supplierError);
      return new Response(
        JSON.stringify({ error: 'Fornitore non trovato' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Update last access time
    await supabase
      .from('suppliers')
      .update({ last_access_at: new Date().toISOString() })
      .eq('id', supplierId)

    // Fetch purchase orders for this supplier
    const { data: orders, error: ordersError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_order_items (
          *,
          material:materials (*)
        ),
        purchase_order_comments (
          *
        ),
        purchase_order_attachments (
          *
        ),
        purchase_order_status_updates (
          *
        ),
        purchase_order_change_requests (
          *
        )
      `)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError
    }

    console.log(`Successfully fetched ${orders?.length || 0} orders for supplier ${supplierId}`);

    return new Response(
      JSON.stringify({ 
        supplier, 
        orders
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in supplier-portal-access:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})