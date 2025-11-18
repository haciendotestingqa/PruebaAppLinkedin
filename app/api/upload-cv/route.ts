import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/storage'
import { parsePDF, parseDOCX } from '@/lib/cv-parser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    const buffer = Buffer.from(await file.arrayBuffer())
    
    let parsedCV
    if (file.name.endsWith('.pdf')) {
      parsedCV = await parsePDF(buffer)
    } else if (file.name.endsWith('.docx')) {
      parsedCV = await parseDOCX(buffer)
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please use PDF or DOCX.' },
        { status: 400 }
      )
    }
    
    console.log('📄 CV parsed:', {
      name: parsedCV.name,
      skillsDetected: parsedCV.skills.length,
      skillsList: parsedCV.skills.slice(0, 10)
    })
    
    // Convert parsed CV to QA profile format
    const profile = {
      id: `profile-${Date.now()}`,
      name: parsedCV.name,
      email: parsedCV.email,
      resume: parsedCV.text,
      skills: parsedCV.skills.map(skill => ({
        name: skill,
        years: 2, // Default, can be edited
        level: 'intermediate' as const,
        category: 'testing' as const,
      })),
      totalExperience: 3, // Default, can be edited
      availability: 'immediate' as const,
      location: 'Venezuela / Latin America',
      preferredLocations: ['Remote', 'Venezuela', 'Latin America'],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    console.log('✅ Profile created with', profile.skills.length, 'skills')
    
    db.profile.set(profile)
    
    return NextResponse.json({
      success: true,
      profile,
      parsed: parsedCV
    })
  } catch (error) {
    console.error('Error parsing CV:', error)
    return NextResponse.json(
      { error: 'Failed to parse CV' },
      { status: 500 }
    )
  }
}







