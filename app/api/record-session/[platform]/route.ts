import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

/**
 * POST /api/record-session/[platform]
 * Graba la sesión actual de una plataforma específica desde Chrome ya abierto
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toLowerCase()

  console.log(`🎬 Iniciando grabación de sesión para ${platform}...`)

  // Validar plataforma
  const validPlatforms = ['upwork', 'glassdoor', 'indeed', 'hireline', 'linkedin']
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({
      success: false,
      error: `Plataforma no reconocida: ${platform}`
    }, { status: 400 })
  }

  let browser
  try {
    console.log('🔍 Intentando conectar a Chrome abierto...')

    // Intentar conectar a Chrome ya abierto con puerto de depuración
    browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: { width: 1280, height: 720 }
    })

    console.log('✅ Conectado exitosamente a Chrome')

    // Obtener las páginas abiertas
    const pages = await browser.pages()
    const page = pages[0] // Usar la primera página (donde el usuario hizo login)

    if (!page) {
      throw new Error('No se encontraron páginas abiertas en Chrome')
    }

    console.log(`📍 Página actual: ${page.url()}`)

    // Obtener cookies de sesión
    const cookies = await page.cookies()
    console.log(`🍪 Encontradas ${cookies.length} cookies`)

    // Obtener localStorage si está disponible
    let localStorage: Record<string, string> = {}
    try {
      localStorage = await page.evaluate(() => {
        const items: Record<string, string> = {}
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key) {
            const value = window.localStorage.getItem(key)
            if (value) {
              items[key] = value
            }
          }
        }
        return items
      })
      console.log(`💾 Encontrados ${Object.keys(localStorage).length} items en localStorage`)
    } catch (e) {
      console.log('💾 No se pudo acceder a localStorage (puede estar vacío)')
    }

    // Obtener sessionStorage si está disponible
    let sessionStorage: Record<string, string> = {}
    try {
      sessionStorage = await page.evaluate(() => {
        const items: Record<string, string> = {}
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i)
          if (key) {
            const value = window.sessionStorage.getItem(key)
            if (value) {
              items[key] = value
            }
          }
        }
        return items
      })
      console.log(`💾 Encontrados ${Object.keys(sessionStorage).length} items en sessionStorage`)
    } catch (e) {
      console.log('💾 No se pudo acceder a sessionStorage (puede estar vacío)')
    }

    // Verificar que estamos en una página de la plataforma correcta
    const currentUrl = page.url()
    const expectedDomains = {
      upwork: 'upwork.com',
      linkedin: 'linkedin.com',
      glassdoor: 'glassdoor.com',
      indeed: 'indeed.com',
      hireline: 'hireline.io'
    }

    const expectedDomain = expectedDomains[platform as keyof typeof expectedDomains]
    if (!currentUrl.includes(expectedDomain)) {
      console.warn(`⚠️ La página actual (${currentUrl}) no parece ser de ${platform}. Continuando de todos modos...`)
    }

    // Crear directorio si no existe
    const outputDir = join(process.cwd(), 'scripts', 'generated')
    mkdirSync(outputDir, { recursive: true })

    // Generar código de login basado en la sesión
    const loginCode = generateLoginCode(platform, cookies, localStorage, sessionStorage)

    // Guardar el código generado
    const outputPath = join(outputDir, `${platform}-session-recorded.ts`)
    writeFileSync(outputPath, loginCode)

    console.log('')
    console.log('✅ Sesión registrada exitosamente!')
    console.log(`📄 Código generado en: ${outputPath}`)
    console.log('')
    console.log('🔧 El código generado incluye:')
    console.log('   - Cookies de autenticación')
    console.log('   - Datos de localStorage y sessionStorage')
    console.log('   - Configuración de navegador')
    console.log('')

    return NextResponse.json({
      success: true,
      platform: platform,
      message: 'Sesión grabada exitosamente',
      details: {
        cookiesCount: cookies.length,
        localStorageItems: Object.keys(localStorage).length,
        sessionStorageItems: Object.keys(sessionStorage).length,
        currentUrl: currentUrl,
        generatedFile: outputPath
      }
    })

  } catch (error) {
    console.error('❌ Error al registrar la sesión:', error)

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

    // Si no se puede conectar a Chrome, dar instrucciones
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ECONNREFUSED')) {
      return NextResponse.json({
        success: false,
        platform: platform,
        error: 'No se puede conectar a Chrome',
        message: 'Chrome debe estar abierto con --remote-debugging-port=9222',
        instructions: [
          '1. Abre una terminal',
          `2. Ejecuta: npm run open:chrome ${platform}`,
          '3. Chrome se abrirá con la página de login',
          `4. Haz login manualmente en ${platform}`,
          '5. Mantén Chrome abierto',
          '6. Regresa aquí y vuelve a hacer click en "Grabar Sesión"'
        ],
        manualCommand: `npm run open:chrome ${platform}`
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      platform: platform,
      error: errorMessage,
      message: 'Error durante la grabación de sesión'
    }, { status: 500 })
  } finally {
    if (browser) {
      try {
        await browser.disconnect()
      } catch (e) {
        console.warn('Error al desconectar del navegador:', e)
      }
    }
  }
}

function generateLoginCode(platformName: string, cookies: any[], localStorage: Record<string, string>, sessionStorage: Record<string, string>): string {
  const capitalizedPlatform = platformName.charAt(0).toUpperCase() + platformName.slice(1)

  let code = `import { Browser, Page, Cookie } from 'playwright'

export async function loginTo${capitalizedPlatform}(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  console.log('🚀 Iniciando login a ${capitalizedPlatform} usando sesión registrada...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Establecer cookies de la sesión registrada
    const sessionCookies: Cookie[] = ${JSON.stringify(cookies, null, 2)}

    await context.addCookies(sessionCookies)
    console.log('🍪 Cookies de sesión establecidas')
`

  // Agregar localStorage si hay datos
  if (Object.keys(localStorage).length > 0) {
    code += `
    // Establecer localStorage
    await page.evaluate(() => {
      const lsData = ${JSON.stringify(localStorage, null, 6)}
      Object.entries(lsData).forEach(([key, value]) => {
        localStorage.setItem(key, value as string)
      })
    })
    console.log('💾 localStorage establecido')
`
  }

  // Agregar sessionStorage si hay datos
  if (Object.keys(sessionStorage).length > 0) {
    code += `
    // Establecer sessionStorage
    await page.evaluate(() => {
      const ssData = ${JSON.stringify(sessionStorage, null, 6)}
      Object.entries(ssData).forEach(([key, value]) => {
        sessionStorage.setItem(key, value as string)
      })
    })
    console.log('💾 sessionStorage establecido')
`
  }

  code += `
    console.log('✅ Login exitoso usando sesión registrada!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login usando sesión registrada:', error)

    // Si falla, intentar login manual como fallback
    console.log('🔄 Intentando login manual como fallback...')
    throw error // Re-throw para que sea manejado por el código que lo llama
  }
}

// Información de la sesión registrada:
/*
Plataforma: ${capitalizedPlatform}
Cookies encontradas: ${cookies.length}
LocalStorage items: ${Object.keys(localStorage).length}
SessionStorage items: ${Object.keys(sessionStorage).length}
Fecha de registro: ${new Date().toISOString()}
*/
`

  return code
}
