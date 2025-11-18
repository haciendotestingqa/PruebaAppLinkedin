import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/storage'

export async function GET() {
  try {
    const config = db.automationConfig.get()
    return NextResponse.json(config)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch automation config' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const updates = await request.json()
    
    const currentConfig = db.automationConfig.get()
    const updatedConfig = { ...currentConfig, ...updates }
    
    db.automationConfig.update(updatedConfig)
    
    return NextResponse.json({ success: true, config: updatedConfig })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update automation config' },
      { status: 500 }
    )
  }
}


















