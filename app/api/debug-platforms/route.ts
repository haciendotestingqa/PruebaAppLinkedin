import { NextResponse } from 'next/server'
import { getAllJobsScraper } from '@/lib/job-scraper'
import { sendDebugLog, clearDebugLogs } from '@/lib/debug-logger'

/**
 * GET /api/debug-platforms
 * Muestra el estado de las plataformas y credenciales
 */
export async function GET() {
  try {
    // Limpiar logs anteriores
    clearDebugLogs()
    
    sendDebugLog({
      type: 'info',
      message: 'Iniciando verificación de estado de plataformas...'
    })
    
    const scraper = getAllJobsScraper()
    
    // Definir plataformas una sola vez
    const platforms = [
      { key: 'upwork', name: 'Upwork', email: 'UPWORK_EMAIL', password: 'UPWORK_PASSWORD', username: undefined },
      { key: 'freelancer', name: 'Freelancer', email: 'FREELANCER_EMAIL', password: 'FREELANCER_PASSWORD', username: 'FREELANCER_USERNAME' },
      { key: 'hireline', name: 'Hireline', email: 'HIRELINE_EMAIL', password: 'HIRELINE_PASSWORD', username: undefined },
      { key: 'indeed', name: 'Indeed', email: 'INDEED_EMAIL', password: 'INDEED_PASSWORD', username: undefined },
      { key: 'braintrust', name: 'Braintrust', email: 'BRAINTRUST_EMAIL', password: 'BRAINTRUST_PASSWORD', username: undefined },
      { key: 'glassdoor', name: 'Glassdoor', email: 'GLASSDOOR_EMAIL', password: 'GLASSDOOR_PASSWORD', username: undefined }
    ]
    
    // Verificar qué credenciales están disponibles antes de iniciar
    const availablePlatforms: string[] = []
    for (const platform of platforms) {
      if (process.env[platform.email] && process.env[platform.password]) {
        availablePlatforms.push(platform.name)
      }
    }
    
    // NO autenticar automáticamente - solo verificar credenciales y estado
    sendDebugLog({
      type: 'info',
      message: 'Verificando estado de plataformas (sin autenticar automáticamente)...',
      details: availablePlatforms.length > 0 
        ? `Plataformas con credenciales: ${availablePlatforms.join(', ')}\nUsa los botones individuales en la interfaz para autenticar cada plataforma.`
        : 'No hay credenciales configuradas. Verificando variables de entorno...'
    })
    
    // Obtener estado de autenticación actual (puede estar vacío si no se ha autenticado)
    const authStatus = scraper.getAuthStatus()
    
    // Verificar qué credenciales están en el .env
    sendDebugLog({
      type: 'step',
      message: 'Verificando credenciales de plataformas...'
    })
    
    const credentials: any = {}
    
    for (const platform of platforms) {
      const hasEmail = !!process.env[platform.email]
      const hasPassword = !!process.env[platform.password]
      
      if (hasEmail && hasPassword) {
        sendDebugLog({
          type: 'success',
          message: `Credenciales de ${platform.name} encontradas`,
          platform: platform.key
        })
      } else {
        sendDebugLog({
          type: 'warning',
          message: `Credenciales de ${platform.name} no encontradas`,
          platform: platform.key
        })
      }
      
      credentials[platform.key] = {
        hasEmail,
        hasPassword,
        hasUsername: platform.username ? !!process.env[platform.username] : undefined,
        isAuthenticated: authStatus.sessions[platform.key as keyof typeof authStatus.sessions]?.isAuthenticated || false,
        error: authStatus.sessions[platform.key as keyof typeof authStatus.sessions]?.error || null,
        errorDetails: authStatus.sessions[platform.key as keyof typeof authStatus.sessions]?.errorDetails || null
      }
      
      if (credentials[platform.key].isAuthenticated) {
        sendDebugLog({
          type: 'success',
          message: `${platform.name} autenticado correctamente`,
          platform: platform.key
        })
      } else if (hasEmail && hasPassword) {
        sendDebugLog({
          type: 'error',
          message: `${platform.name} falló la autenticación`,
          platform: platform.key,
          details: credentials[platform.key].error || 'Error desconocido'
        })
      }
    }

    sendDebugLog({
      type: 'success',
      message: 'Estado de plataformas obtenido correctamente'
    })
    
    return NextResponse.json({
      success: true,
      credentials,
      message: 'Estado de plataformas obtenido correctamente'
    })
  } catch (error) {
    console.error('Error obteniendo estado de plataformas:', error)
    sendDebugLog({
      type: 'error',
      message: 'Error obteniendo estado de plataformas',
      details: error instanceof Error ? error.message : 'Error desconocido'
    })
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

