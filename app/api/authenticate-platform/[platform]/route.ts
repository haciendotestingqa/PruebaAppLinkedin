import { NextRequest, NextResponse } from 'next/server'
import { loginUpworkPlaywright, manualLoginUpwork, loginFreelancerPlaywright, loginHirelinePlaywright, loginIndeedPlaywright, loginBraintrustPlaywright, loginGlassdoorPlaywright, PlatformCredentials } from '@/lib/platform-auth'
import { sendDebugLog, clearDebugLogs } from '@/lib/debug-logger'

/**
 * POST /api/authenticate-platform/[platform]
 * Autentica una plataforma individual
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toLowerCase()
  
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
      sendDebugLog({
        type: 'warning',
        message: `No se encontraron credenciales para ${platform.toUpperCase()}`,
        platform: platform,
        details: 'Verifica que las variables de entorno estén configuradas correctamente en el archivo .env'
      })
      return NextResponse.json({
        success: false,
        error: `No se encontraron credenciales para ${platform}`,
        message: 'Verifica que las variables de entorno estén configuradas correctamente'
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
          errorDetails: session?.errorDetails,
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
