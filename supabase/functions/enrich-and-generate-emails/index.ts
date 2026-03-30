import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Simple HTML to text extraction
function htmlToText(html: string): string {
  // Remove script/style tags and their content
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)',
        'Accept': 'text/html',
      },
    })
    clearTimeout(timeout)
    
    if (!response.ok) return ''
    
    const html = await response.text()
    const text = htmlToText(html)
    // Limit to ~3000 chars to keep prompt manageable
    return text.slice(0, 3000)
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

    const { missionId, batchOffset = 0, batchSize = 5, emailOnly = false } = await req.json()
    if (!missionId) {
      return new Response(JSON.stringify({ error: 'missionId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get mission info
    const { data: mission, error: missionError } = await supabase
      .from('scraping_missions')
      .select('*')
      .eq('id', missionId)
      .single()

    if (missionError || !mission) throw new Error('Mission not found')

    let results, resultsError, remainingCount

    if (emailOnly) {
      // Mode: only re-fetch websites for results that have emails generated but no contact_email
      const { data, error } = await supabase
        .from('scraping_results')
        .select('*')
        .eq('mission_id', missionId)
        .eq('email_generated', true)
        .is('contact_email', null)
        .order('created_at', { ascending: true })
        .range(0, batchSize - 1)

      results = data
      resultsError = error

      const { count } = await supabase
        .from('scraping_results')
        .select('*', { count: 'exact', head: true })
        .eq('mission_id', missionId)
        .eq('email_generated', true)
        .is('contact_email', null)

      remainingCount = count
    } else {
      // Normal mode: get results that don't have emails yet
      const { data, error } = await supabase
        .from('scraping_results')
        .select('*')
        .eq('mission_id', missionId)
        .eq('email_generated', false)
        .order('created_at', { ascending: true })
        .range(0, batchSize - 1)

      results = data
      resultsError = error

      const { count } = await supabase
        .from('scraping_results')
        .select('*', { count: 'exact', head: true })
        .eq('mission_id', missionId)
        .eq('email_generated', false)

      remainingCount = count
    }

    console.log(`[ENRICH-EMAILS] Processing ${results.length} results for mission "${mission.name}"`)

    let successCount = 0

    for (const result of results) {
      try {
        // 1. Fetch and analyze website
        console.log(`[ENRICH-EMAILS] Fetching website: ${result.url}`)
        const websiteContent = await fetchWebsiteContent(result.url)
        
        // 2. Generate personalized email with context
        const prompt = `Sei un esperto di business development e outreach B2B.

Devi generare un'email professionale, personalizzata e contestualizzata per contattare questa attività.

INFORMAZIONI SUL DESTINATARIO:
- Nome/Titolo dalla ricerca: ${result.title}
- URL: ${result.url}
- Descrizione Google: ${result.description || 'Non disponibile'}
- Città: ${result.city || 'Non specificata'}
${websiteContent ? `\nCONTENUTO DEL SITO WEB (analizzalo per personalizzare l'email):\n${websiteContent}` : '\n(Sito web non raggiungibile - usa le info dalla ricerca Google)'}

MISSIONE/OBIETTIVO DELL'EMAIL: "${mission.mission_description}"

${mission.sender_name ? `Mittente: ${mission.sender_name}` : ''}
${mission.sender_company ? `Azienda mittente: ${mission.sender_company}` : ''}

ISTRUZIONI IMPORTANTI:
- Analizza il sito web per capire cosa fa l'azienda, i suoi servizi, il suo target
- Personalizza l'email facendo riferimento specifico a dettagli trovati sul loro sito
- Spiega perché la proposta è rilevante per LORO in particolare
- Tono professionale ma diretto, non generico
- L'email deve sembrare scritta da un umano che ha veramente visitato il sito

ISTRUZIONI PER L'ESTRAZIONE DEI DATI:
- "recipientCompany": Cerca il NOME ESATTO dell'azienda dal sito (dal logo, titolo pagina, about, footer). NON usare la categoria/settore come nome azienda. Es: "Termoidraulica Rossi Srl", NON "Caldaie Industriali".
- "recipientName": Se trovi il nome del titolare/responsabile sul sito, inseriscilo. Altrimenti null.
- "contactEmail": Cerca email di contatto sul sito (info@, contatti@, etc.)

Rispondi SOLO con JSON valido:
{
  "subject": "oggetto email personalizzato",
  "body": "corpo email personalizzato con riferimenti al loro sito/attività",
  "recipientName": "nome della persona di contatto se trovata, altrimenti null",
  "recipientCompany": "nome ESATTO dell'azienda (NON il settore/categoria)",
  "contactEmail": "email di contatto trovata sul sito oppure null"
}`

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Rispondi SOLO con JSON valido, senza markdown o altro testo.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        })

        if (!aiResponse.ok) {
          console.error(`[ENRICH-EMAILS] OpenAI error for "${result.title}":`, await aiResponse.text())
          continue
        }

        const aiData = await aiResponse.json()
        const content = aiData.choices?.[0]?.message?.content || ''

        let emailData
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          emailData = jsonMatch ? JSON.parse(jsonMatch[0]) : null
        } catch {
          emailData = null
        }

        if (emailData) {
          // Also try to extract email from website content directly
          let contactEmail = emailData.contactEmail || null
          if (!contactEmail && websiteContent) {
            const emailMatch = websiteContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
            if (emailMatch) {
              // Filter out common non-contact emails
              const validEmails = emailMatch.filter((e: string) => 
                !e.includes('example.') && !e.includes('sentry.') && !e.includes('wixpress.')
              )
              contactEmail = validEmails[0] || null
            }
          }

          await supabase.from('scraping_results').update({
            generated_email_subject: emailData.subject,
            generated_email_body: emailData.body,
            recipient_name: emailData.recipientName || null,
            recipient_company: emailData.recipientCompany || null,
            contact_email: contactEmail,
            email_generated: true,
          }).eq('id', result.id)

          successCount++
          console.log(`[ENRICH-EMAILS] ✓ Email generated for "${result.title}"`)
        } else {
          // Mark as generated (failed) to avoid retrying
          await supabase.from('scraping_results').update({
            email_generated: true,
          }).eq('id', result.id)
          console.error(`[ENRICH-EMAILS] ✗ Failed to parse email for "${result.title}"`)
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 200))

      } catch (err) {
        console.error(`[ENRICH-EMAILS] Error for "${result.title}":`, err)
      }
    }

    const remaining = (remainingCount || 0) - results.length

    console.log(`[ENRICH-EMAILS] Batch done: ${successCount}/${results.length} emails generated, ${remaining} remaining`)

    return new Response(JSON.stringify({
      success: true,
      done: remaining <= 0,
      processed: results.length,
      successCount,
      remaining: Math.max(0, remaining),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[ENRICH-EMAILS] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
