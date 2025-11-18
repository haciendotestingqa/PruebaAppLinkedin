import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/storage'

export async function GET() {
  try {
    const applications = db.applications.getAll()
    return NextResponse.json(applications)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const application = data
    
    db.applications.add(application)
    db.metrics.refresh()
    
    return NextResponse.json({ success: true, application })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add application' },
      { status: 500 }
    )
  }
}


















