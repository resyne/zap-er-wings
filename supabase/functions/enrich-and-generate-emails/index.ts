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

    const { missionId, batchOffset = 0, batchSize = 5, emailOnly = false, background = false } = await req.json()
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

    // Get total results count for progress tracking
    const { count: missionResults_count } = await supabase
      .from('scraping_results')
      .select('*', { count: 'exact', head: true })
      .eq('mission_id', missionId)

    // Update status to running if background mode
    if (background && results.length > 0) {
      await supabase.from('scraping_missions').update({
        email_generation_status: 'running',
        email_generation_total: missionResults_count || 0,
      }).eq('id', missionId)
    }

    console.log(`[ENRICH-EMAILS] Processing ${results.length} results for mission "${mission.name}"`)

    let successCount = 0

    for (const result of results) {
      try {
        // 1. Fetch website + contact pages and extract emails
        console.log(`[ENRICH-EMAILS] ${emailOnly ? '[EMAIL-ONLY]' : ''} Fetching website (multi-page): ${result.url}`)
        const { emails: extractedEmails, textContent: websiteContent } = await fetchWebsiteEmails(result.url)
        
        console.log(`[ENRICH-EMAILS] Found ${extractedEmails.length} emails for "${result.title}": ${extractedEmails.slice(0, 3).join(', ')}`)

        if (emailOnly) {
          // Email-only mode: use extracted emails, fallback to AI
          let contactEmail: string | null = extractedEmails[0] || null

          if (!contactEmail && websiteContent) {
            // Try AI extraction as last resort
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
            await supabase.from('scraping_results').update({
              contact_email: 'NOT_FOUND',
            }).eq('id', result.id)
            console.log(`[ENRICH-EMAILS] ✗ No email found for "${result.title}" - marked as NOT_FOUND`)
          }

          await new Promise(r => setTimeout(r, 100))
          continue
        }
        
        // 2. Generate personalized email with context
        const LANGUAGE_MAP: Record<string, string> = {
          'it': 'Italiano', 'en': 'English', 'de': 'Deutsch', 'fr': 'Français',
          'es': 'Español', 'pt': 'Português', 'nl': 'Nederlands', 'pl': 'Polski',
          'ro': 'Română', 'el': 'Ελληνικά', 'cs': 'Čeština', 'hu': 'Magyar',
          'sv': 'Svenska', 'da': 'Dansk', 'fi': 'Suomi', 'hr': 'Hrvatski',
          'bg': 'Български', 'sk': 'Slovenčina',
        }
        const emailLanguage = LANGUAGE_MAP[mission.language_code] || mission.language_code || 'Italiano'

        const prompt = `You are an expert in B2B business development and commercial outreach.

You must generate a professional, personalized and contextualized email to contact this business.

CRITICAL: The email MUST be written entirely in ${emailLanguage}. Every part of the email (subject, body, greeting, closing) must be in ${emailLanguage}.

RECIPIENT INFORMATION:
- Name/Title from search: ${result.title}
- URL: ${result.url}
- Google description: ${result.description || 'Not available'}
- City: ${result.city || 'Not specified'}
${websiteContent ? `\nWEBSITE CONTENT (analyze it to personalize the email):\n${websiteContent}` : '\n(Website not reachable - use info from Google search)'}
${extractedEmails.length > 0 ? `\nEMAILS ALREADY FOUND ON SITE: ${extractedEmails.join(', ')}` : ''}

EMAIL MISSION/OBJECTIVE: "${mission.mission_description}"

${mission.sender_name ? `Sender: ${mission.sender_name}` : ''}
${mission.sender_company ? `Sender company: ${mission.sender_company}` : ''}

IMPORTANT INSTRUCTIONS:
- WRITE THE ENTIRE EMAIL IN ${emailLanguage}
- Analyze the website to understand what the company does, its services, its target
- Personalize the email with specific references to details found on their site
- Explain why the proposal is relevant to THEM in particular
- Professional but direct tone, not generic
- The email should look like it was written by a human who actually visited the site

DATA EXTRACTION INSTRUCTIONS:
- "recipientCompany": Look for the EXACT company name from the site (logo, page title, about, footer). DO NOT use the category/sector as company name.
- "recipientName": If you find the name of the owner/manager on the site, include it. Otherwise null.
- "contactEmail": Use the best email from those already found, or null if none available.

Reply ONLY with valid JSON:
{
  "subject": "personalized email subject in ${emailLanguage}",
  "body": "personalized email body in ${emailLanguage} with references to their site/business",
  "recipientName": "contact person name if found, otherwise null",
  "recipientCompany": "EXACT company name (NOT the sector/category)",
  "contactEmail": "contact email found on site or null"
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
          // Use extracted emails as primary source, AI suggestion as fallback
          let contactEmail = extractedEmails[0] || emailData.contactEmail || null

          await supabase.from('scraping_results').update({
            generated_email_subject: emailData.subject,
            generated_email_body: emailData.body,
            recipient_name: emailData.recipientName || null,
            recipient_company: emailData.recipientCompany || null,
            contact_email: contactEmail,
            email_generated: true,
          }).eq('id', result.id)

          successCount++
          console.log(`[ENRICH-EMAILS] ✓ Email generated for "${result.title}" (contact: ${contactEmail || 'none'})`)
        } else {
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

    // Update mission progress in DB
    const totalGenerated = missionResults_count || 0
    await supabase.from('scraping_missions').update({
      email_generation_processed: totalGenerated - Math.max(0, remaining),
      email_generation_total: totalGenerated,
      email_generation_status: remaining <= 0 ? 'completed' : 'running',
    }).eq('id', missionId)

    console.log(`[ENRICH-EMAILS] Batch done: ${successCount}/${results.length} emails generated, ${remaining} remaining`)

    // If background mode and more to process, check if not paused then self-invoke
    if (background && remaining > 0) {
      // Re-check mission status to see if paused
      const { data: missionCheck } = await supabase
        .from('scraping_missions')
        .select('email_generation_status')
        .eq('id', missionId)
        .single()

      if (missionCheck?.email_generation_status !== 'paused') {
        const selfUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-and-generate-emails`
        fetch(selfUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ missionId, batchSize: 3, emailOnly, background: true }),
        }).catch(err => console.error('[ENRICH-EMAILS] Self-invoke error:', err))
      } else {
        console.log('[ENRICH-EMAILS] Generation paused by user, stopping self-invocation')
      }
    }

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
