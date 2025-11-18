import { NextRequest, NextResponse } from 'next/server'
import { getLinkedInScraper } from '@/lib/linkedin-scraper'
import { getAllJobsScraper } from '@/lib/job-scraper'
import { db } from '@/lib/storage'

/**
 * GET /api/linkedin-jobs
 * Obtiene trabajos de múltiples plataformas (LinkedIn, Upwork, Freelancer, Remotive, etc.)
 * NO usa datos mock - solo trabajos reales del scraper
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Iniciando búsqueda en múltiples plataformas...')
    
    const allJobs: any[] = []
    
    // 1. LinkedIn
    try {
      console.log('🔍 Buscando en LinkedIn...')
      const linkedInScraper = getLinkedInScraper()
      const linkedInJobs = await linkedInScraper.searchRemoteQAJobs()
      allJobs.push(...linkedInJobs)
      console.log(`✅ LinkedIn: ${linkedInJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en LinkedIn:', error)
    }
    
    // 2. Otras plataformas (scraping real)
    try {
      console.log('🔍 Buscando en otras plataformas (scraping real)...')
      const multiScraper = getAllJobsScraper()
      const otherJobs = await multiScraper.searchAllPlatforms()
      
      if (otherJobs && otherJobs.length > 0) {
        // Verificar que las URLs sean reales (empiezan con http/https y son válidas)
        const validJobs = otherJobs.filter(job => 
          job.applicationUrl && 
          (job.applicationUrl.startsWith('http://') || job.applicationUrl.startsWith('https://')) &&
          job.title && // Debe tener título
          job.company // Debe tener compañía
        )
        allJobs.push(...validJobs)
        console.log(`✅ Otras plataformas: ${validJobs.length} trabajos válidos de ${otherJobs.length} encontrados`)
      } else {
        console.log('⚠️ No se encontraron trabajos de otras plataformas')
      }
    } catch (error) {
      console.error('❌ Error en scraping de otras plataformas:', error)
      console.log('ℹ️ Nota: Upwork y Freelancer tienen protección anti-scraping. Solo se mostrarán ofertas de LinkedIn si el scraping falla.')
    }
    
    // 3. Trabajos mock DESHABILITADOS
    // No usamos ofertas mock porque tienen URLs falsas
    // Solo mostramos ofertas reales obtenidas del scraper
    
    if (allJobs.length === 0) {
      throw new Error('No se encontraron trabajos en ninguna plataforma')
    }
    
    // Guardar en storage
    db.jobs.set(allJobs)
    
    // Contar por plataforma
    const bySource: any = {}
    allJobs.forEach(job => {
      const source = job.source || 'linkedin'
      bySource[source] = (bySource[source] || 0) + 1
    })
    
    return NextResponse.json({
      success: true,
      jobs: allJobs,
      count: allJobs.length,
      bySource,
      sources: Object.keys(bySource)
    })
  } catch (error) {
    console.error('❌ Error obteniendo trabajos:', error)
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    
    // NO usar datos mock - devolver error
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo trabajos',
      message: 'No se pudieron obtener trabajos. Por favor, intenta nuevamente más tarde.',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
