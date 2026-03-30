const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    const { results, mission, senderName, senderCompany, language } = await req.json()

    if (!results || !Array.isArray(results) || results.length === 0) {
      return new Response(JSON.stringify({ error: 'Results array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!mission) {
      return new Response(JSON.stringify({ error: 'Mission is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[GENERATE-EMAILS] Generating emails for ${results.length} results, mission: "${mission}"`)

    const generatedEmails: any[] = []

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (result: any) => {
        const prompt = `Sei un esperto di business development e outreach commerciale.

Devi generare un'email professionale e personalizzata per contattare questa attività:
- Nome/Titolo: ${result.title}
- URL: ${result.url}
- Descrizione: ${result.description || 'Non disponibile'}

La MISSIONE dell'email è: "${mission}"

${senderName ? `Il mittente si chiama: ${senderName}` : ''}
${senderCompany ? `L'azienda mittente è: ${senderCompany}` : ''}

Lingua dell'email: ${language || 'Italiano'}

Genera un JSON con questa struttura:
{
  "subject": "oggetto dell'email",
  "body": "corpo dell'email in formato testo",
  "recipientName": "nome del destinatario estratto se possibile",
  "recipientCompany": "nome dell'azienda destinataria"
}`

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              max_tokens: 1000,
            }),
          })

          if (!response.ok) {
            const errText = await response.text()
            console.error(`[GENERATE-EMAILS] OpenAI error for "${result.title}":`, errText)
            return {
              source: result,
              error: `OpenAI error: ${response.status}`,
              email: null,
            }
          }

          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ''
          
          // Parse JSON from response
          let emailData
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            emailData = jsonMatch ? JSON.parse(jsonMatch[0]) : null
          } catch {
            emailData = null
          }

          return {
            source: result,
            email: emailData,
            error: emailData ? null : 'Failed to parse email',
          }
        } catch (err) {
          console.error(`[GENERATE-EMAILS] Error for "${result.title}":`, err)
          return {
            source: result,
            email: null,
            error: err.message,
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      generatedEmails.push(...batchResults)

      // Small delay between batches
      if (i + batchSize < results.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const successCount = generatedEmails.filter(e => e.email).length
    console.log(`[GENERATE-EMAILS] Generated ${successCount}/${results.length} emails successfully`)

    return new Response(JSON.stringify({
      success: true,
      totalProcessed: results.length,
      successCount,
      emails: generatedEmails,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[GENERATE-EMAILS] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
