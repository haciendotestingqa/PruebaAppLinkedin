import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/has-recorded-session/[platform]
 * Verifica si existe una sesión grabada para una plataforma específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toLowerCase()

  try {
    // Verificar si existe el archivo de sesión grabada
    const sessionFile = join(process.cwd(), 'scripts', 'generated', `${platform}-session-recorded.ts`)
    const hasSession = existsSync(sessionFile)

    return NextResponse.json({
      platform: platform,
      hasSession: hasSession,
      sessionFile: hasSession ? sessionFile : null
    })

  } catch (error) {
    console.error(`Error verificando sesión grabada para ${platform}:`, error)

    return NextResponse.json({
      platform: platform,
      hasSession: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}




