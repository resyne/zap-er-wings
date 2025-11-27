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

    const { supplierId, accessCode } = await req.json()

    console.log('Validating supplier access:', { supplierId, accessCode: '***' });

    // Validate supplier and access code
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .eq('access_code', accessCode)
      .single()

    if (supplierError || !supplier) {
      console.error('Invalid access code:', supplierError);
      return new Response(
        JSON.stringify({ error: 'Codice di accesso non valido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
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
          *,
          count
        ),
        purchase_order_attachments (
          count
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
        orders,
        accessToken: `${supplierId}:${accessCode}` // Simple token for subsequent requests
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