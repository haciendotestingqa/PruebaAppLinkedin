import { NextResponse } from 'next/server'

// Force dynamic rendering to avoid build-time timeouts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Test endpoint para diagnosticar el scraper
 */
export async function GET() {
  try {
    console.log('🧪 Test: Verificando dependencias...')
    
    // Test 1: Verificar Puppeteer
    let puppeteerInstalled = false
    try {
      require('puppeteer')
      puppeteerInstalled = true
      console.log('✅ Puppeteer instalado')
    } catch (e) {
      console.log('❌ Puppeteer NO instalado')
    }
    
    // Test 2: Verificar Cheerio
    let cheerioInstalled = false
    try {
      require('cheerio')
      cheerioInstalled = true
      console.log('✅ Cheerio instalado')
    } catch (e) {
      console.log('❌ Cheerio NO instalado')
    }
    
    // Test 3: Intentar obtener trabajos
    let scraperError = null
    let jobsCount = 0
    try {
      const { getLinkedInScraper } = require('@/lib/linkedin-scraper')
      const scraper = getLinkedInScraper()
      console.log('🔄 Intentando obtener trabajos...')
      const jobs = await scraper.searchRemoteQAJobs()
      jobsCount = jobs.length
      console.log(`✅ Obtenidos ${jobsCount} trabajos`)
    } catch (error) {
      scraperError = error
      console.error('❌ Error en scraper:', error)
    }
    
    return NextResponse.json({
      success: true,
      tests: {
        puppeteer: puppeteerInstalled,
        cheerio: cheerioInstalled,
        scraper: scraperError ? { error: scraperError instanceof Error ? scraperError.message : 'Unknown error' } : { success: true, jobsCount },
      },
      summary: {
        allDependenciesInstalled: puppeteerInstalled && cheerioInstalled,
        scraperWorking: scraperError === null && jobsCount > 0,
        issues: [
          !puppeteerInstalled && 'Puppeteer no está instalado',
          !cheerioInstalled && 'Cheerio no está instalado',
          scraperError && `Scraper falló: ${scraperError instanceof Error ? scraperError.message : 'Unknown error'}`,
          jobsCount === 0 && 'No se encontraron trabajos'
        ].filter(Boolean)
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}











