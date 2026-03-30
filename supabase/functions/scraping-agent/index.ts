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

const BATCH_SIZE = 1 // cities per invocation - keep low due to Apify sync timeout

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

    // If mission is already completed or failed, skip
    if (mission.status === 'completed' || mission.status === 'failed') {
      return new Response(JSON.stringify({ 
        success: true, 
        status: mission.status,
        message: 'Mission already finished' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cities = ITALIAN_CITIES_50K
    const totalCities = cities.length
    const completedSoFar = mission.completed_cities || 0
    const totalResultsSoFar = mission.total_results || 0

    // First call: set total_cities and status
    if (mission.status === 'pending') {
      await supabase.from('scraping_missions').update({
        status: 'running',
        total_cities: totalCities,
      }).eq('id', missionId)
    }

    // Determine which cities to process in this batch
    const startIndex = completedSoFar
    const endIndex = Math.min(startIndex + BATCH_SIZE, totalCities)
    const batch = cities.slice(startIndex, endIndex)

    if (batch.length === 0) {
      // All cities done
      await supabase.from('scraping_missions').update({
        status: 'completed',
      }).eq('id', missionId)

      return new Response(JSON.stringify({
        success: true,
        status: 'completed',
        completedCities: completedSoFar,
        totalResults: totalResultsSoFar,
        hasMore: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[SCRAPING-AGENT] Mission "${mission.name}" batch: cities ${startIndex+1}-${endIndex}/${totalCities}`)

    let batchResults = 0

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
          return 0
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
                  place_id: result.placeId || null,
                })
              }
            }
          }
        }

        if (organicResults.length > 0) {
          const { error: insertError } = await supabase
            .from('scraping_results')
            .upsert(organicResults, { onConflict: 'url', ignoreDuplicates: true })

          if (insertError) {
            console.error(`[SCRAPING-AGENT] Insert error for ${city}:`, insertError)
          }
        }

        console.log(`[SCRAPING-AGENT] ${city}: ${organicResults.length} results`)
        return organicResults.length
      } catch (err) {
        console.error(`[SCRAPING-AGENT] Error for ${city}:`, err)
        return 0
      }
    })

    const counts = await Promise.all(batchPromises)
    batchResults = counts.reduce((sum, c) => sum + c, 0)

    const newCompleted = completedSoFar + batch.length
    const newTotalResults = totalResultsSoFar + batchResults
    const hasMore = newCompleted < totalCities

    // Update progress
    await supabase.from('scraping_missions').update({
      completed_cities: newCompleted,
      total_results: newTotalResults,
      status: hasMore ? 'running' : 'completed',
    }).eq('id', missionId)

    console.log(`[SCRAPING-AGENT] Batch done: ${newCompleted}/${totalCities} cities, ${newTotalResults} total results, hasMore: ${hasMore}`)

    return new Response(JSON.stringify({
      success: true,
      status: hasMore ? 'running' : 'completed',
      completedCities: newCompleted,
      totalResults: newTotalResults,
      hasMore,
    }), {
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
