import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Italian cities with 50k+ inhabitants
const ITALIAN_CITIES_50K = [
  'Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova', 'Bologna', 'Firenze',
  'Bari', 'Catania', 'Venezia', 'Verona', 'Messina', 'Padova', 'Trieste', 'Taranto',
  'Brescia', 'Parma', 'Prato', 'Modena', 'Reggio Calabria', 'Reggio Emilia',
  'Perugia', 'Ravenna', 'Livorno', 'Cagliari', 'Foggia', 'Rimini', 'Salerno',
  'Ferrara', 'Sassari', 'Latina', 'Giugliano in Campania', 'Monza', 'Siracusa',
  'Pescara', 'Bergamo', 'Forlì', 'Trento', 'Vicenza', 'Terni', 'Bolzano',
  'Novara', 'Piacenza', 'Ancona', 'Andria', 'Arezzo', 'Udine', 'Cesena',
  'Lecce', 'Pesaro', 'Alessandria', 'La Spezia', 'Pistoia', 'Catanzaro',
  'Lucca', 'Torre del Greco', 'Brindisi', 'Como', 'Busto Arsizio', 'Marsala',
  'Altamura', 'Sesto San Giovanni', 'Pozzuoli', 'Guidonia Montecelio',
  'Quartu Sant\'Elena', 'Castellammare di Stabia', 'Lamezia Terme', 'Ragusa',
  'Cosenza', 'Massa', 'Trapani', 'Crotone', 'Potenza', 'Fiumicino',
  'Cinisello Balsamo', 'Carrara', 'Vittoria', 'Aprilia', 'Manfredonia',
  'Vigevano', 'Legnano', 'Matera', 'Caserta', 'Asti', 'Moncalieri',
  'Acerra', 'Afragola', 'Aversa', 'Portici', 'San Severo', 'Cerignola',
  'Casoria', 'Caltanissetta', 'Treviso', 'Bagheria', 'Gela', 'Carpi',
  'Imola', 'Mazara del Vallo', 'Cava de\' Tirreni', 'Barletta', 'Olbia',
  'Acireale', 'Molfetta', 'Bitonto', 'San Benedetto del Tronto',
  'Ercolano', 'Scafati', 'Gallarate', 'Faenza', 'Marano di Napoli',
  'Velletri', 'Viterbo', 'Savona', 'Agrigento', 'Corigliano-Rossano',
  'Collegno', 'Sanremo', 'Benevento', 'Avellino', 'Lodi', 'Trani',
  'Teramo', 'Chieti', 'Rovigo', 'Grosseto', 'Siena', 'Varese',
  'Cremona', 'Pavia', 'Mantova', 'Lecco', 'Campobasso', 'Vercelli',
  'Enna', 'Nuoro', 'Oristano', 'Biella', 'Verbania', 'Belluno',
  'Pordenone', 'Gorizia', 'Aosta', 'Rieti', 'Frosinone', 'Isernia',
  'Sondrio', 'Imperia'
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY')
    if (!APIFY_API_KEY) {
      throw new Error('APIFY_API_KEY not configured')
    }

    const { missionId } = await req.json()
    if (!missionId) {
      return new Response(JSON.stringify({ error: 'missionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get mission details
    const { data: mission, error: missionError } = await supabase
      .from('scraping_missions')
      .select('*')
      .eq('id', missionId)
      .single()

    if (missionError || !mission) {
      throw new Error('Mission not found')
    }

    const cities = ITALIAN_CITIES_50K
    const totalCities = cities.length

    // Update mission as running
    await supabase.from('scraping_missions').update({
      status: 'running',
      total_cities: totalCities,
      completed_cities: 0,
    }).eq('id', missionId)

    console.log(`[SCRAPING-AGENT] Starting mission "${mission.name}" for ${totalCities} cities, query: "${mission.query}"`)

    let totalResults = 0
    let completedCities = 0

    // Process cities in batches of 3 to avoid rate limits
    const batchSize = 3
    for (let i = 0; i < cities.length; i += batchSize) {
      const batch = cities.slice(i, i + batchSize)

      const batchPromises = batch.map(async (city) => {
        const searchQuery = `${mission.query} ${city}`
        
        try {
          console.log(`[SCRAPING-AGENT] Scraping: "${searchQuery}"`)

          const runResponse = await fetch(
            `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                queries: searchQuery,
                languageCode: mission.language_code || 'it',
                countryCode: mission.country_code || 'it',
                maxPagesPerQuery: 1,
                resultsPerPage: mission.max_results_per_city || 20,
                mobileResults: false,
                includeUnfilteredResults: false,
              }),
            }
          )

          if (!runResponse.ok) {
            console.error(`[SCRAPING-AGENT] Apify error for ${city}:`, runResponse.status)
            return []
          }

          const results = await runResponse.json()
          const organicResults: any[] = []

          if (Array.isArray(results)) {
            for (const resultSet of results) {
              if (resultSet.organicResults && Array.isArray(resultSet.organicResults)) {
                for (const result of resultSet.organicResults) {
                  organicResults.push({
                    mission_id: missionId,
                    city,
                    title: result.title,
                    url: result.url,
                    description: result.description,
                    position: result.position,
                  })
                }
              }
            }
          }

          // Insert results into database, skip duplicates by URL
          if (organicResults.length > 0) {
            const { data: inserted, error: insertError } = await supabase
              .from('scraping_results')
              .upsert(organicResults, { onConflict: 'url', ignoreDuplicates: true })

            if (insertError) {
              console.error(`[SCRAPING-AGENT] Insert error for ${city}:`, insertError)
            } else {
              console.log(`[SCRAPING-AGENT] ${city}: ${organicResults.length} found, duplicates skipped`)
            }
          }

          console.log(`[SCRAPING-AGENT] ${city}: ${organicResults.length} results`)
          return organicResults
        } catch (err) {
          console.error(`[SCRAPING-AGENT] Error for ${city}:`, err)
          return []
        }
      })

      const batchResults = await Promise.all(batchPromises)
      const batchTotal = batchResults.reduce((sum, r) => sum + r.length, 0)
      totalResults += batchTotal
      completedCities += batch.length

      // Update progress
      await supabase.from('scraping_missions').update({
        completed_cities: completedCities,
        total_results: totalResults,
      }).eq('id', missionId)

      // Delay between batches to avoid rate limits
      if (i + batchSize < cities.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Mark mission as completed
    await supabase.from('scraping_missions').update({
      status: 'completed',
      completed_cities: completedCities,
      total_results: totalResults,
    }).eq('id', missionId)

    console.log(`[SCRAPING-AGENT] Mission completed. ${totalResults} total results from ${completedCities} cities.`)

    return new Response(JSON.stringify({
      success: true,
      totalCities: completedCities,
      totalResults,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[SCRAPING-AGENT] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
