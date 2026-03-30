const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { resultIds, senderEmail, senderName, htmlTemplate, subject: overrideSubject } = await req.json()

    if (!resultIds || !Array.isArray(resultIds) || resultIds.length === 0) {
      return new Response(JSON.stringify({ error: 'resultIds array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!senderEmail) {
      return new Response(JSON.stringify({ error: 'senderEmail is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the results to send
    const { data: results, error: fetchError } = await supabase
      .from('scraping_results')
      .select('*')
      .in('id', resultIds)

    if (fetchError) throw fetchError
    if (!results || results.length === 0) throw new Error('No results found')

    let sentCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const result of results) {
      try {
        // Skip if no email content
        if (!result.generated_email_subject || !result.generated_email_body) {
          errors.push(`${result.title}: no email generated`)
          failedCount++
          continue
        }

        // Skip if no contact email found on the result
        const recipientEmail = result.contact_email
        if (!recipientEmail) {
          errors.push(`${result.title}: no contact email`)
          failedCount++
          continue
        }

        const emailSubject = overrideSubject || result.generated_email_subject
        
        // Build HTML body using template or default
        let htmlBody: string
        if (htmlTemplate) {
          // Replace placeholders in HTML template
          htmlBody = htmlTemplate
            .replace(/\{\{subject\}\}/g, emailSubject)
            .replace(/\{\{body\}\}/g, result.generated_email_body.replace(/\n/g, '<br>'))
            .replace(/\{\{recipient_name\}\}/g, result.recipient_name || '')
            .replace(/\{\{recipient_company\}\}/g, result.recipient_company || '')
            .replace(/\{\{sender_name\}\}/g, senderName || '')
            .replace(/\{\{city\}\}/g, result.city || '')
            .replace(/\{\{url\}\}/g, result.url || '')
        } else {
          // Default HTML template
          htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#1e3a5f;padding:24px 32px;text-align:center;">
          <img src="https://zap-er-wings.lovable.app/lovable-uploads/e8493046-02d3-407a-ae34-b061ef9720af.png" alt="ZAPPER" height="48" style="height:48px;" />
        </td></tr>
        <tr><td style="padding:32px;">
           ${result.recipient_company ? `<p style="margin:0 0 8px;font-size:13px;color:#666;">A: ${result.recipient_company}</p>` : ''}
           <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#333;">${result.generated_email_body.replace(/\n/g, '<br>')}</p>
         </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0;font-size:13px;color:#666;">Cordiali saluti,<br><strong>${senderName || 'Il Team'}</strong></p>
        </td></tr>
        <tr><td style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#999;">info@abbattitorizapper.it | Scafati (SA) - Italy | 08119968436</p>
          <p style="margin:4px 0 0;font-size:11px;"><a href="https://www.abbattitorizapper.it" style="color:#1e3a5f;">www.abbattitorizapper.it</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
        }

        // Send via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
            to: [recipientEmail],
            subject: emailSubject,
            html: htmlBody,
          }),
        })

        if (!resendResponse.ok) {
          const errText = await resendResponse.text()
          console.error(`[SEND-EMAIL] Resend error for ${result.title}:`, errText)
          errors.push(`${result.title}: ${errText}`)
          failedCount++
          continue
        }

        const resendData = await resendResponse.json()
        console.log(`[SEND-EMAIL] ✓ Sent to ${recipientEmail} (${result.title}), id: ${resendData.id}`)

        // Mark as sent in database
        await supabase.from('scraping_results').update({
          email_sent: true,
        }).eq('id', result.id)

        sentCount++

        // Rate limit: small delay between sends
        await new Promise(r => setTimeout(r, 100))

      } catch (err: any) {
        console.error(`[SEND-EMAIL] Error for ${result.title}:`, err)
        errors.push(`${result.title}: ${err.message}`)
        failedCount++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: results.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[SEND-EMAIL] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
