import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/storage'

export async function GET() {
  try {
    const profile = db.profile.get()
    return NextResponse.json(profile)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const profile = data
    
    db.profile.set(profile)
    
    return NextResponse.json({ success: true, profile })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save profile' },
      { status: 500 }
    )
  }
}


















