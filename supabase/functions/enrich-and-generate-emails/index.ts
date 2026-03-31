import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Contact page URL patterns to check
const CONTACT_PATHS = ['/contatti', '/contact', '/contacts', '/contattaci', '/about', '/chi-siamo', '/about-us', '/impressum', '/info']

// Simple HTML to text extraction
function htmlToText(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

// Extract emails from raw HTML (mailto: links + regex on text)
function extractEmailsFromHtml(html: string): string[] {
  const emails = new Set<string>()
  
  // 1. Extract mailto: links
  const mailtoMatches = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi) || []
  for (const m of mailtoMatches) {
    const email = m.replace(/^mailto:/i, '').toLowerCase().trim()
    emails.add(email)
  }
  
  // 2. Extract from Schema.org / JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const block of jsonLdMatches) {
    const jsonContent = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
    try {
      const data = JSON.parse(jsonContent)
      const extractFromObj = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        if (obj.email) {
          const e = String(obj.email).replace(/^mailto:/i, '').toLowerCase().trim()
          if (e.includes('@')) emails.add(e)
        }
        if (obj.contactPoint) {
          const points = Array.isArray(obj.contactPoint) ? obj.contactPoint : [obj.contactPoint]
          for (const cp of points) {
            if (cp.email) {
              const e = String(cp.email).replace(/^mailto:/i, '').toLowerCase().trim()
              if (e.includes('@')) emails.add(e)
            }
          }
        }
        if (Array.isArray(obj)) obj.forEach(extractFromObj)
      }
      extractFromObj(data)
    } catch {}
  }
  
  // 3. Regex on text content
  const text = htmlToText(html)
  const textMatches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []
  for (const e of textMatches) {
    emails.add(e.toLowerCase().trim())
  }
  
  // Filter out junk emails
  const filtered = Array.from(emails).filter(e =>
    !e.includes('example.') && !e.includes('sentry.') && !e.includes('wixpress.') &&
    !e.includes('wordpress.') && !e.includes('noreply') && !e.includes('no-reply') &&
    !e.includes('@sentry') && !e.includes('privacy@') && !e.includes('cookie')
  )
  
  // Prioritize info@, contatti@, contatto@, commerciale@ emails
  const priority = ['info@', 'contatti@', 'contatto@', 'commerciale@', 'vendite@', 'sales@', 'contact@']
  filtered.sort((a, b) => {
    const aP = priority.findIndex(p => a.startsWith(p))
    const bP = priority.findIndex(p => b.startsWith(p))
    if (aP >= 0 && bP < 0) return -1
    if (bP >= 0 && aP < 0) return 1
    if (aP >= 0 && bP >= 0) return aP - bP
    return 0
  })
  
  return filtered
}

// Fetch raw HTML from a URL
async function fetchRawHtml(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
    })
    clearTimeout(timeout)
    if (!response.ok) return ''
    return await response.text()
  } catch {
    return ''
  }
}

// Discover contact page URLs from the homepage HTML
function discoverContactPages(html: string, baseUrl: string): string[] {
  const found = new Set<string>()
  const base = new URL(baseUrl)
  
  // Check links in HTML for contact-related paths
  const linkMatches = html.match(/<a[^>]+href\s*=\s*["']([^"'#]+)["'][^>]*>/gi) || []
  for (const link of linkMatches) {
    const hrefMatch = link.match(/href\s*=\s*["']([^"'#]+)["']/i)
    if (!hrefMatch) continue
    const href = hrefMatch[1].toLowerCase()
    
    const isContact = CONTACT_PATHS.some(p => href.includes(p)) || 
      /contatt|contact|about|chi.siamo|info/i.test(link)
    
    if (isContact) {
      try {
        const fullUrl = new URL(hrefMatch[1], baseUrl)
        if (fullUrl.hostname === base.hostname) {
          found.add(fullUrl.href)
        }
      } catch {}
    }
  }
  
  // Also try common paths directly
  for (const path of CONTACT_PATHS.slice(0, 5)) {
    found.add(`${base.origin}${path}`)
  }
  
  return Array.from(found).slice(0, 6)
}

// Main: fetch website + contact pages, extract all emails
async function fetchWebsiteEmails(url: string): Promise<{ emails: string[], textContent: string }> {
  const homepageHtml = await fetchRawHtml(url)
  if (!homepageHtml) return { emails: [], textContent: '' }
  
  // Extract emails from homepage
  let allEmails = extractEmailsFromHtml(homepageHtml)
  const textContent = htmlToText(homepageHtml).slice(0, 3000)
  
  // If we found a good email on homepage, return early
  if (allEmails.length > 0 && allEmails.some(e => e.startsWith('info@') || e.startsWith('contatti@') || e.startsWith('commerciale@'))) {
    return { emails: allEmails, textContent }
  }
  
  // Otherwise, discover and check contact pages
  const contactPages = discoverContactPages(homepageHtml, url)
  
  // Fetch contact pages in parallel (max 3 to stay within time limits)
  const pagesToCheck = contactPages.slice(0, 3)
  const pageResults = await Promise.allSettled(
    pagesToCheck.map(pageUrl => fetchRawHtml(pageUrl))
  )
  
  for (const result of pageResults) {
    if (result.status === 'fulfilled' && result.value) {
      const pageEmails = extractEmailsFromHtml(result.value)
      allEmails = [...allEmails, ...pageEmails]
    }
  }
  
  // Deduplicate and re-sort
  const unique = [...new Set(allEmails)]
  const priority = ['info@', 'contatti@', 'contatto@', 'commerciale@', 'vendite@', 'sales@', 'contact@']
  unique.sort((a, b) => {
    const aP = priority.findIndex(p => a.startsWith(p))
    const bP = priority.findIndex(p => b.startsWith(p))
    if (aP >= 0 && bP < 0) return -1
    if (bP >= 0 && aP < 0) return 1
    if (aP >= 0 && bP >= 0) return aP - bP
    return 0
  })
  
  return { emails: unique, textContent }
}

// Legacy wrapper for text content
async function fetchWebsiteContent(url: string): Promise<string> {
  const { textContent } = await fetchWebsiteEmails(url)
  return textContent
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
        console.log(`[ENRICH-EMAILS] ${emailOnly ? '[EMAIL-ONLY]' : ''} Fetching website: ${result.url}`)
        const websiteContent = await fetchWebsiteContent(result.url)

        if (emailOnly) {
          // Email-only mode: just extract email from website, no AI call
          let contactEmail: string | null = null
          if (websiteContent) {
            const emailMatch = websiteContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
            if (emailMatch) {
              const validEmails = emailMatch.filter((e: string) => 
                !e.includes('example.') && !e.includes('sentry.') && !e.includes('wixpress.') && !e.includes('wordpress.')
              )
              contactEmail = validEmails[0] || null
            }
          }

          if (!contactEmail && websiteContent) {
            // Try AI extraction as fallback
            const emailPrompt = `Analizza questo contenuto di un sito web e trova l'email di contatto dell'azienda (info@, contatti@, ecc.). Rispondi SOLO con l'email trovata oppure "null" se non trovata.\n\nContenuto:\n${websiteContent.slice(0, 2000)}`
            
            const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: 'Rispondi SOLO con l\'indirizzo email trovato oppure la parola "null". Nient\'altro.' },
                  { role: 'user', content: emailPrompt }
                ],
                temperature: 0,
                max_tokens: 100,
              }),
            })

            if (aiResponse.ok) {
              const aiData = await aiResponse.json()
              const emailResult = aiData.choices?.[0]?.message?.content?.trim() || ''
              const emailExtract = emailResult.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
              if (emailExtract) contactEmail = emailExtract[0]
            }
          }

          if (contactEmail) {
            await supabase.from('scraping_results').update({
              contact_email: contactEmail,
            }).eq('id', result.id)
            successCount++
            console.log(`[ENRICH-EMAILS] ✓ Email found for "${result.title}": ${contactEmail}`)
          } else {
            // Mark as "not found" so we don't retry infinitely
            await supabase.from('scraping_results').update({
              contact_email: 'NOT_FOUND',
            }).eq('id', result.id)
            console.log(`[ENRICH-EMAILS] ✗ No email found for "${result.title}" - marked as NOT_FOUND`)
          }

          await new Promise(r => setTimeout(r, 100))
          continue
        }
        
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
