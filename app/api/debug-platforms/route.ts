import { NextResponse } from 'next/server'
import { getAllJobsScraper } from '@/lib/job-scraper'

/**
 * GET /api/debug-platforms
 * Muestra el estado de las plataformas y credenciales
 */
export async function GET() {
  try {
    const scraper = getAllJobsScraper()
    
    // Inicializar auth para verificar credenciales
    await scraper.initializeAuth()
    
    // Obtener estado de autenticación
    const authStatus = scraper.getAuthStatus()
    
    // Verificar qué credenciales están en el .env
    const credentials = {
      upwork: {
        hasEmail: !!process.env.UPWORK_EMAIL,
        hasPassword: !!process.env.UPWORK_PASSWORD,
        isAuthenticated: authStatus.sessions.upwork?.isAuthenticated || false,
        error: authStatus.sessions.upwork?.error || null,
        errorDetails: authStatus.sessions.upwork?.errorDetails || null
      },
      freelancer: {
        hasEmail: !!process.env.FREELANCER_EMAIL,
        hasPassword: !!process.env.FREELANCER_PASSWORD,
        hasUsername: !!process.env.FREELANCER_USERNAME,
        isAuthenticated: authStatus.sessions.freelancer?.isAuthenticated || false
      },
      hireline: {
        hasEmail: !!process.env.HIRELINE_EMAIL,
        hasPassword: !!process.env.HIRELINE_PASSWORD,
        isAuthenticated: authStatus.sessions.hireline?.isAuthenticated || false,
        error: authStatus.sessions.hireline?.error || null,
        errorDetails: authStatus.sessions.hireline?.errorDetails || null
      },
      indeed: {
        hasEmail: !!process.env.INDEED_EMAIL,
        hasPassword: !!process.env.INDEED_PASSWORD,
        isAuthenticated: authStatus.sessions.indeed?.isAuthenticated || false,
        error: authStatus.sessions.indeed?.error || null,
        errorDetails: authStatus.sessions.indeed?.errorDetails || null
      },
      braintrust: {
        hasEmail: !!process.env.BRAINTRUST_EMAIL,
        hasPassword: !!process.env.BRAINTRUST_PASSWORD,
        isAuthenticated: authStatus.sessions.braintrust?.isAuthenticated || false,
        error: authStatus.sessions.braintrust?.error || null,
        errorDetails: authStatus.sessions.braintrust?.errorDetails || null
      },
      glassdoor: {
        hasEmail: !!process.env.GLASSDOOR_EMAIL,
        hasPassword: !!process.env.GLASSDOOR_PASSWORD,
        isAuthenticated: authStatus.sessions.glassdoor?.isAuthenticated || false
      }
    }

    return NextResponse.json({
      success: true,
      credentials,
      message: 'Estado de plataformas obtenido correctamente'
    })
  } catch (error) {
    console.error('Error obteniendo estado de plataformas:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

