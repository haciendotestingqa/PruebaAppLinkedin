import { NextResponse } from 'next/server'
import { db } from '@/lib/storage'
import { filterJobsByCriteria, MatchResult } from '@/lib/job-matcher'
import { getLinkedInScraper } from '@/lib/linkedin-scraper'

// Force dynamic rendering to avoid build-time timeouts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const profile = db.profile.get()
    const jobs = db.jobs.getAll()
    
    let allJobs = jobs
    if (jobs.length === 0) {
      // Intentar obtener trabajos
      const scraper = getLinkedInScraper()
      allJobs = await scraper.searchRemoteQAJobs()
      db.jobs.set(allJobs)
    }
    
    let matchingJobs: MatchResult[] = []
    if (profile && allJobs.length > 0) {
      matchingJobs = filterJobsByCriteria(allJobs, profile, 0) // Score 0 para ver todos
    }
    
    return NextResponse.json({
      profile: profile ? {
        has: true,
        name: profile.name,
        skills: profile.skills,
        skillsCount: profile.skills?.length || 0,
        totalExperience: profile.totalExperience
      } : null,
      jobs: {
        total: allJobs.length,
        samples: allJobs.slice(0, 3).map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          isRemote: j.isRemote,
          skills: j.skills
        }))
      },
      matching: {
        count: matchingJobs.length,
        samples: matchingJobs.slice(0, 3).map(m => ({
          job: m.job.title,
          score: m.score,
          matchedSkills: m.matchedSkills,
          reasons: m.reasons
        }))
      },
      summary: {
        hasProfile: !!profile,
        hasJobs: allJobs.length > 0,
        hasMatching: matchingJobs.length > 0,
        message: !profile 
          ? '❌ No tienes perfil. Sube tu CV primero.'
          : allJobs.length === 0
          ? '❌ No hay trabajos. Busca trabajos primero.'
          : matchingJobs.length === 0
          ? '⚠️ No hay matches. Tal vez tu perfil no tiene las skills necesarias.'
          : `✅ Encontraste ${matchingJobs.length} trabajos que hacen match!`
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}











