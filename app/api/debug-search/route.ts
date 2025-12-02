import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/storage'
import { filterJobsByCriteria } from '@/lib/job-matcher'
import { getLinkedInScraper } from '@/lib/linkedin-scraper'

// Force dynamic rendering to avoid build-time timeouts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { minScore } = await request.json()
    const profile = db.profile.get()
    
    // Debug: obtener perfil directamente del storage
    let clientProfile = null
    try {
      const clientProfileRes = await fetch('http://localhost:3000/api/profile')
      if (clientProfileRes.ok) {
        clientProfile = await clientProfileRes.json()
      }
    } catch (e) {
      console.log('Could not fetch from client')
    }
    
    const debug: any = {
      serverHasProfile: !!profile,
      clientHasProfile: !!clientProfile,
      profileSkills: profile?.skills || clientProfile?.skills || [],
      profileSkillsCount: (profile?.skills || clientProfile?.skills || []).length,
      jobsInStorage: db.jobs.getAll().length,
      minScore
    }
    
    if (!profile) {
      return NextResponse.json({ error: 'No profile', debug }, { status: 400 })
    }
    
    let allJobs = db.jobs.getAll()
    
    if (allJobs.length === 0) {
      console.log('🔍 Obteniendo trabajos de LinkedIn...')
      const scraper = getLinkedInScraper()
      allJobs = await scraper.searchRemoteQAJobs()
      console.log(`✅ Obtenidos ${allJobs.length} trabajos`)
      db.jobs.set(allJobs)
    }
    
    debug.totalJobs = allJobs.length
    
    // Hacer matching
    const matchingJobs = filterJobsByCriteria(allJobs, profile, minScore)
    debug['matchingJobs'] = matchingJobs.length
    debug['scores'] = matchingJobs.map(j => j.score)
    
    return NextResponse.json({ success: true, debug, matchingJobs })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

