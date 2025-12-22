import { NextRequest, NextResponse } from 'next/server'
import {
  loginUpworkPlaywright,
  manualLoginUpwork,
  loginFreelancerPlaywright,
  loginHirelinePlaywright,
  loginIndeedPlaywright,
  loginBraintrustPlaywright,
  loginGlassdoorPlaywright,
  loginLinkedinPlaywright,
  PlatformCredentials
} from '@/lib/platform-auth'
import { sendDebugLog, clearDebugLogs } from '@/lib/debug-logger'

// Cargar variables de entorno explícitamente
const dotenv = require('dotenv')
dotenv.config({ path: '.env' })

/**
 * POST /api/authenticate-platform/[platform]
 * Autentica una plataforma individual
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toLowerCase()

  // Log de depuración para verificar variables de entorno
  console.log(`🔍 [${platform.toUpperCase()}] Verificando variables de entorno:`)
  console.log(`   UPWORK_EMAIL: ${process.env.UPWORK_EMAIL ? '✅ Presente' : '❌ Ausente'}`)
  console.log(`   LINKEDIN_EMAIL: ${process.env.LINKEDIN_EMAIL ? '✅ Presente' : '❌ Ausente'}`)
  console.log(`   FREELANCER_EMAIL: ${process.env.FREELANCER_EMAIL ? '✅ Presente' : '❌ Ausente'}`)
  console.log(`   HIRELINE_EMAIL: ${process.env.HIRELINE_EMAIL ? '✅ Presente' : '❌ Ausente'}`)
  console.log(`   INDEED_EMAIL: ${process.env.INDEED_EMAIL ? '✅ Presente' : '❌ Ausente'}`)
  console.log(`   BRAINTRUST_EMAIL: ${process.env.BRAINTRUST_EMAIL ? '✅ Presente' : '❌ Ausente'}`)
  console.log(`   GLASSDOOR_EMAIL: ${process.env.GLASSDOOR_EMAIL ? '✅ Presente' : '❌ Ausente'}`)

  try {
    // Limpiar logs anteriores solo para esta plataforma
    clearDebugLogs()
    
    sendDebugLog({
      type: 'info',
      message: `Iniciando autenticación individual para ${platform.toUpperCase()}...`,
      platform: platform
    })

    // Obtener credenciales del .env según la plataforma
    let credentials: PlatformCredentials | null = null
    
    switch (platform) {
      case 'upwork':
        // Usar credenciales específicas de Upwork
        // (Upwork usa Google OAuth, pero puede tener credenciales diferentes)
        const upworkEmail = process.env.UPWORK_EMAIL
        const upworkPassword = process.env.UPWORK_PASSWORD

        if (upworkEmail && upworkPassword) {
          credentials = {
            email: upworkEmail,
            password: upworkPassword
          }
        }
        break
      case 'freelancer':
        if (process.env.FREELANCER_EMAIL && process.env.FREELANCER_PASSWORD && process.env.FREELANCER_USERNAME) {
          credentials = {
            email: process.env.FREELANCER_EMAIL,
            password: process.env.FREELANCER_PASSWORD,
            username: process.env.FREELANCER_USERNAME
          }
        }
        break
      case 'hireline':
        if (process.env.HIRELINE_EMAIL && process.env.HIRELINE_PASSWORD) {
          credentials = {
            email: process.env.HIRELINE_EMAIL,
            password: process.env.HIRELINE_PASSWORD
          }
        }
        break
      case 'indeed':
        if (process.env.INDEED_EMAIL && process.env.INDEED_PASSWORD) {
          credentials = {
            email: process.env.INDEED_EMAIL,
            password: process.env.INDEED_PASSWORD
          }
        }
        break
      case 'braintrust':
        if (process.env.BRAINTRUST_EMAIL && process.env.BRAINTRUST_PASSWORD) {
          credentials = {
            email: process.env.BRAINTRUST_EMAIL,
            password: process.env.BRAINTRUST_PASSWORD
          }
        }
        break
      case 'glassdoor':
        if (process.env.GLASSDOOR_EMAIL && process.env.GLASSDOOR_PASSWORD) {
          credentials = {
            email: process.env.GLASSDOOR_EMAIL,
            password: process.env.GLASSDOOR_PASSWORD
          }
        }
        break
      case 'linkedin':
        if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
          credentials = {
            email: process.env.LINKEDIN_EMAIL,
            password: process.env.LINKEDIN_PASSWORD
          }
        }
        break
      default:
        sendDebugLog({
          type: 'error',
          message: `Plataforma no reconocida: ${platform}`,
          platform: platform
        })
        return NextResponse.json({
          success: false,
          error: `Plataforma no reconocida: ${platform}`
        }, { status: 400 })
    }

    if (!credentials) {
      // Determinar qué variables faltan para dar un mensaje más específico
      let missingVars = []
      switch (platform) {
        case 'upwork':
          if (!process.env.UPWORK_EMAIL) missingVars.push('UPWORK_EMAIL')
          if (!process.env.UPWORK_PASSWORD) missingVars.push('UPWORK_PASSWORD')
          break
        case 'linkedin':
          if (!process.env.LINKEDIN_EMAIL) missingVars.push('LINKEDIN_EMAIL')
          if (!process.env.LINKEDIN_PASSWORD) missingVars.push('LINKEDIN_PASSWORD')
          break
        case 'freelancer':
          if (!process.env.FREELANCER_EMAIL) missingVars.push('FREELANCER_EMAIL')
          if (!process.env.FREELANCER_PASSWORD) missingVars.push('FREELANCER_PASSWORD')
          if (!process.env.FREELANCER_USERNAME) missingVars.push('FREELANCER_USERNAME')
          break
        case 'hireline':
          if (!process.env.HIRELINE_EMAIL) missingVars.push('HIRELINE_EMAIL')
          if (!process.env.HIRELINE_PASSWORD) missingVars.push('HIRELINE_PASSWORD')
          break
        case 'indeed':
          if (!process.env.INDEED_EMAIL) missingVars.push('INDEED_EMAIL')
          if (!process.env.INDEED_PASSWORD) missingVars.push('INDEED_PASSWORD')
          break
        case 'braintrust':
          if (!process.env.BRAINTRUST_EMAIL) missingVars.push('BRAINTRUST_EMAIL')
          if (!process.env.BRAINTRUST_PASSWORD) missingVars.push('BRAINTRUST_PASSWORD')
          break
        case 'glassdoor':
          if (!process.env.GLASSDOOR_EMAIL) missingVars.push('GLASSDOOR_EMAIL')
          if (!process.env.GLASSDOOR_PASSWORD) missingVars.push('GLASSDOOR_PASSWORD')
          break
      }

      const missingVarsText = missingVars.length > 0 ? `Variables faltantes: ${missingVars.join(', ')}` : 'Credenciales incompletas'

      sendDebugLog({
        type: 'warning',
        message: `Credenciales faltantes para ${platform.toUpperCase()}`,
        platform: platform,
        details: missingVarsText
      })

      return NextResponse.json({
        success: false,
        platform: platform,
        error: `Credenciales faltantes para ${platform}`,
        message: missingVarsText,
        details: 'Configura las variables de entorno en el archivo .env'
      }, { status: 400 })
    }

    sendDebugLog({
      type: 'step',
      message: `Iniciando proceso de login para ${platform.toUpperCase()}...`,
      platform: platform,
      details: `Email: ${credentials.email.substring(0, 3)}***`
    })

    // Autenticar la plataforma específica usando Playwright
    let session = null
    try {
      switch (platform) {
        case 'upwork':
          // Usar login completamente manual para Upwork
          console.log('🔄 Iniciando login manual de Upwork...')
          session = await manualLoginUpwork()
          console.log('📤 Login manual completado, resultado:', {
            isAuthenticated: session?.isAuthenticated,
            hasCookies: session?.cookies?.length || 0,
            hasUserAgent: !!session?.userAgent,
            error: session?.error
          })
          break
        case 'freelancer':
          session = await loginFreelancerPlaywright(credentials)
          break
        case 'hireline':
          session = await loginHirelinePlaywright(credentials)
          break
        case 'indeed':
          session = await loginIndeedPlaywright(credentials)
          break
        case 'braintrust':
          session = await loginBraintrustPlaywright(credentials)
          break
        case 'glassdoor':
          session = await loginGlassdoorPlaywright(credentials)
          break
        case 'linkedin':
          session = await loginLinkedinPlaywright(credentials)
          break
      }

      if (session?.isAuthenticated) {
        console.log(`✅ ${platform.toUpperCase()} autenticado exitosamente - retornando respuesta...`)

        sendDebugLog({
          type: 'success',
          message: `${platform.toUpperCase()} autenticado exitosamente`,
          platform: platform,
          details: `Cookies obtenidas: ${session.cookies?.length || 0}`
        })

        const responseData = {
          success: true,
          platform: platform,
          isAuthenticated: true,
          session: {
            cookies: session.cookies?.length || 0,
            userAgent: session.userAgent
          },
          message: `${platform.toUpperCase()} autenticado exitosamente`
        }

        console.log(`📤 Enviando respuesta JSON:`, responseData)
        return NextResponse.json(responseData)
      } else {
        sendDebugLog({
          type: 'error',
          message: `${platform.toUpperCase()} falló la autenticación`,
          platform: platform,
          details: session?.error || 'Error desconocido'
        })
        return NextResponse.json({
          success: false,
          platform: platform,
          isAuthenticated: false,
          error: session?.error || 'Error desconocido',
          message: `Autenticación fallida en ${platform.toUpperCase()}`
        }, { status: 400 })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      sendDebugLog({
        type: 'error',
        message: `Error durante autenticación de ${platform.toUpperCase()}`,
        platform: platform,
        details: errorMessage + (error instanceof Error && error.stack ? `\n${error.stack}` : '')
      })
      return NextResponse.json({
        success: false,
        platform: platform,
        isAuthenticated: false,
        error: errorMessage,
        errorDetails: error instanceof Error ? error.stack : undefined,
        message: `Error durante autenticación: ${errorMessage}`
      }, { status: 500 })
    }
  } catch (error) {
    console.error(`Error en autenticación de ${platform}:`, error)
    sendDebugLog({
      type: 'error',
      message: `Error general en autenticación de ${platform.toUpperCase()}`,
      platform: platform,
      details: error instanceof Error ? error.message : 'Error desconocido'
    })
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
