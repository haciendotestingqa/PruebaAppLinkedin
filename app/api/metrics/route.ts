import { NextResponse } from 'next/server'
import { db } from '@/lib/storage'

export async function GET() {
  try {
    const metrics = db.metrics.get()
    return NextResponse.json(metrics)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}


















