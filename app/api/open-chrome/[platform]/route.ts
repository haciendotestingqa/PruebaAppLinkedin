import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'

/**
 * POST /api/open-chrome/[platform]
 * Abre Chrome automáticamente para una plataforma específica
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toLowerCase()

  console.log(`🌐 Abriendo Chrome para ${platform}...`)

  // Validar plataforma
  const validPlatforms = ['upwork', 'glassdoor', 'indeed', 'hireline', 'linkedin', 'freelancer', 'braintrust']
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({
      success: false,
      error: `Plataforma no reconocida: ${platform}`
    }, { status: 400 })
  }

  try {
    // Ejecutar el script open-chrome-debug.ts
    const scriptPath = join(process.cwd(), 'scripts', 'open-chrome-debug.ts')

    console.log(`📝 Ejecutando script: ${scriptPath} ${platform}`)

    // Ejecutar el script con ts-node
    const child = spawn('npx', ['ts-node', scriptPath, platform], {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    })

    let output = ''
    let errorOutput = ''

    // Capturar stdout
    child.stdout?.on('data', (data) => {
      const chunk = data.toString()
      console.log(`📝 [${platform}] ${chunk}`)
      output += chunk
    })

    // Capturar stderr
    child.stderr?.on('data', (data) => {
      const chunk = data.toString()
      console.error(`❌ [${platform}] ${chunk}`)
      errorOutput += chunk
    })

    // Retornar respuesta cuando Chrome se abra o después de un timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`⏰ Timeout alcanzado para abrir Chrome en ${platform}`)
        // No matar el proceso, puede seguir ejecutándose
        resolve(NextResponse.json({
          success: true,
          message: `Chrome debería abrirse para ${platform}. Si no se abre, ejecuta manualmente: npm run open:chrome ${platform}`,
          platform: platform,
          manualCommand: `npm run open:chrome ${platform}`
        }))
      }, 5000) // 5 segundos de timeout

      child.on('close', (code) => {
        clearTimeout(timeout)

        if (code === 0 || code === null) {
          console.log(`✅ Chrome abierto exitosamente para ${platform}`)
          resolve(NextResponse.json({
            success: true,
            platform: platform,
            message: `Chrome abierto exitosamente para ${platform}`,
            output: output.trim()
          }))
        } else {
          console.error(`❌ Error abriendo Chrome para ${platform} (código: ${code})`)
          resolve(NextResponse.json({
            success: false,
            platform: platform,
            error: `Error abriendo Chrome: código ${code}`,
            output: output.trim(),
            errorOutput: errorOutput.trim()
          }, { status: 500 }))
        }
      })

      child.on('error', (error) => {
        clearTimeout(timeout)
        console.error(`❌ Error ejecutando script para abrir Chrome en ${platform}:`, error)

        resolve(NextResponse.json({
          success: false,
          platform: platform,
          error: `Error ejecutando script: ${error.message}`,
          output: output.trim(),
          errorOutput: errorOutput.trim()
        }, { status: 500 }))
      })
    })

  } catch (error) {
    console.error(`❌ Error general abriendo Chrome para ${platform}:`, error)

    return NextResponse.json({
      success: false,
      platform: platform,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
