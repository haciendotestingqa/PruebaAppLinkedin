import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/storage'
import { LinkedInJob } from '@/types'

export async function GET() {
  try {
    const jobs = db.jobs.getAll()
    return NextResponse.json(jobs)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const jobs: LinkedInJob[] = data.jobs || []
    
    db.jobs.set(jobs)
    
    return NextResponse.json({ success: true, count: jobs.length })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save jobs' },
      { status: 500 }
    )
  }
}


















