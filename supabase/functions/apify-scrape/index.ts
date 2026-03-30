import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY')
    if (!APIFY_API_KEY) {
      throw new Error('APIFY_API_KEY not configured')
    }

    const { query, location, language, maxResults, actorId } = await req.json()

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default to Google Search Results Scraper
    const actor = actorId || 'apify/google-search-scraper'

    console.log(`[APIFY-SCRAPE] Running actor ${actor} with query: "${query}", location: ${location || 'default'}`)

    // Start the actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: query,
          languageCode: language || 'it',
          countryCode: location || 'it',
          maxPagesPerQuery: 1,
          resultsPerPage: maxResults || 20,
          mobileResults: false,
          includeUnfilteredResults: false,
        }),
      }
    )

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('[APIFY-SCRAPE] Apify error:', runResponse.status, errorText)
      throw new Error(`Apify API error: ${runResponse.status} - ${errorText}`)
    }

    const results = await runResponse.json()
    console.log(`[APIFY-SCRAPE] Got ${Array.isArray(results) ? results.length : 0} result sets`)

    // Extract organic results
    const organicResults: any[] = []
    if (Array.isArray(results)) {
      for (const resultSet of results) {
        if (resultSet.organicResults && Array.isArray(resultSet.organicResults)) {
          for (const result of resultSet.organicResults) {
            organicResults.push({
              title: result.title,
              url: result.url,
              description: result.description,
              position: result.position,
            })
          }
        }
      }
    }

    console.log(`[APIFY-SCRAPE] Extracted ${organicResults.length} organic results`)

    return new Response(JSON.stringify({
      success: true,
      query,
      resultsCount: organicResults.length,
      results: organicResults,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[APIFY-SCRAPE] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
