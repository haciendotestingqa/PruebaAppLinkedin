import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/storage'
import { filterJobsByCriteria } from '@/lib/job-matcher'
import { getLinkedInScraper } from '@/lib/linkedin-scraper'
import { getAllJobsScraper } from '@/lib/job-scraper'
// No importar freelanceJobs - solo usar scrapers reales
// import { freelanceJobs } from '@/lib/freelance-jobs'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 POST /api/search - Iniciando búsqueda...')
    const { minScore, profile, excludedJobIds } = await request.json()
    
    console.log('📋 Params recibidos:', { 
      minScore, 
      hasProfile: !!profile,
      profileSkills: profile?.skills?.length || 0,
      excludedJobs: excludedJobIds?.length || 0
    })
    
    // Usar perfil del request si existe, sino intentar del storage
    const userProfile = profile || db.profile.get()
    
    if (!userProfile) {
      console.log('❌ No hay perfil')
      return NextResponse.json(
        { error: 'Profile not found. Please upload your CV first.' },
        { status: 400 }
      )
    }
    
    console.log('✅ Perfil encontrado con', userProfile.skills?.length || 0, 'skills')
    
    let allJobs = db.jobs.getAll()
    console.log(`📦 Jobs en cache inicial: ${allJobs.length}`)
    
    // SIEMPRE obtener trabajos de LinkedIn si no hay en cache
    if (allJobs.length === 0 || allJobs.filter(j => j.source === 'linkedin').length === 0) {
      try {
        console.log('🔍 Buscando trabajos en LinkedIn...')
        const scraper = getLinkedInScraper()
        const linkedInJobs = await scraper.searchRemoteQAJobs()
        
        if (!linkedInJobs || linkedInJobs.length === 0) {
          console.warn('⚠️ No se encontraron trabajos en LinkedIn')
        } else {
          console.log(`✅ Encontrados ${linkedInJobs.length} trabajos de LinkedIn`)
          allJobs = [...allJobs, ...linkedInJobs]
        }
      } catch (error) {
        console.error('❌ Error obteniendo trabajos de LinkedIn:', error)
        // Continuar con trabajos freelance aunque falle LinkedIn
        console.log('⚠️ Continuando con trabajos freelance...')
      }
    }
    
    // Obtener trabajos de otras plataformas si aún no tenemos
    const hasExternalSources = allJobs.some(job => job.source && job.source !== 'linkedin')
    if (!hasExternalSources) {
      try {
        console.log('🔍 Buscando trabajos en plataformas externas...')
        const multiScraper = getAllJobsScraper()
        const externalJobs = await multiScraper.searchAllPlatforms()
        console.log(`✅ Plataformas externas devolvieron ${externalJobs.length} trabajos`)

        if (externalJobs.length > 0) {
          const existingIds = new Set(allJobs.map(job => job.id))
          const uniqueExternal = externalJobs.filter(job => !existingIds.has(job.id))
          allJobs = [...allJobs, ...uniqueExternal]
          console.log(`➕ Agregados ${uniqueExternal.length} trabajos externos nuevos`)
        }
      } catch (error) {
        console.error('❌ Error obteniendo trabajos externos:', error)
      }
    }
    
    // Guardar todos los trabajos en storage
    db.jobs.set(allJobs)
    
    console.log(`✅ Total de trabajos disponibles: ${allJobs.length} (LinkedIn: ${allJobs.filter(j => j.source === 'linkedin').length}, Otras plataformas: ${allJobs.filter(j => j.source !== 'linkedin').length})`)
    
    // Filtrar trabajos ya aplicados
    if (excludedJobIds && excludedJobIds.length > 0) {
      console.log('🚫 Excluyendo trabajos ya aplicados:', excludedJobIds.length)
      allJobs = allJobs.filter(job => !excludedJobIds.includes(job.id))
    }
    
    // Hacer matching con el perfil
    console.log('🔄 Haciendo matching con', allJobs.length, 'trabajos...')
    const matchingJobs = filterJobsByCriteria(allJobs, userProfile, minScore || 60)
    
    console.log('✅ Encontrados', matchingJobs.length, 'matches')
    
    const sourceBreakdown = matchingJobs.reduce<Record<string, number>>((acc, result) => {
      const source = result.job.source || 'desconocido'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      jobs: matchingJobs,
      count: matchingJobs.length,
      sources: sourceBreakdown
    })
  } catch (error) {
    console.error('❌ Error en búsqueda:', error)
    console.error('❌ Stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { 
        error: 'Failed to search jobs',
        details: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

