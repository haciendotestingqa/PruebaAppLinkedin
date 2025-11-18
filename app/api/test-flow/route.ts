import { NextResponse } from 'next/server'
import { db } from '@/lib/storage'

/**
 * Test endpoint para verificar el flujo completo
 */
export async function GET() {
  try {
    const profile = db.profile.get()
    const jobs = db.jobs.getAll()
    
    return NextResponse.json({
      success: true,
      profile: profile ? {
        has: true,
        name: profile.name,
        skillsCount: profile.skills?.length || 0
      } : {
        has: false,
        message: 'No hay perfil. Sube tu CV primero.'
      },
      jobs: {
        count: jobs.length,
        samples: jobs.slice(0, 3).map(j => ({
          id: j.id,
          title: j.title,
          company: j.company
        }))
      },
      diagnostic: {
        hasProfile: !!profile,
        hasJobs: jobs.length > 0,
        canSearch: !!profile && jobs.length > 0,
        message: !profile 
          ? 'Falta subir CV en la pestaña Profile'
          : jobs.length === 0
          ? 'No hay trabajos. Haz click en Search Jobs para obtenerlos.'
          : 'Todo listo para buscar trabajos'
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}


















