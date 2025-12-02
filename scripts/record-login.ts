import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

interface RecordedAction {
  type: 'click' | 'type' | 'navigate' | 'wait' | 'select' | 'keypress'
  selector?: string
  text?: string
  url?: string
  timestamp: number
  description?: string
}

/**
 * Script para grabar el flujo de inicio de sesión manualmente
 * Permite al usuario interactuar con el navegador mientras se registran todos los pasos
 */
export async function recordLoginFlow(platform: 'upwork' | 'glassdoor' | 'indeed' | 'hireline', startUrl: string) {
  console.log(`🎬 Iniciando grabación del flujo de inicio de sesión para ${platform}...`)
  console.log('📝 Interactúa con el navegador normalmente. Todos tus pasos serán registrados.')
  console.log('⏸️  Presiona Ctrl+C cuando termines de grabar.\n')

  const browser: Browser = await chromium.launch({
    headless: false, // Navegador visible para interacción manual
    slowMo: 100, // Desacelerar acciones para mejor visualización
    channel: 'chrome' // O 'chromium', 'msedge', etc.
  })

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  // Habilitar trazas para análisis posterior
  await context.tracing.start({ screenshots: true, snapshots: true })

  const page: Page = await context.newPage()
  
  const recordedActions: RecordedAction[] = []
  const actionCounter = { value: 0 }

  // Registrar navegación inicial
  console.log(`🌐 Navegando a: ${startUrl}`)
  recordedActions.push({
    type: 'navigate',
    url: startUrl,
    timestamp: Date.now(),
    description: 'Navegación inicial'
  })
  await page.goto(startUrl, { waitUntil: 'networkidle' })

  // Configurar listeners para capturar acciones
  setupActionListeners(page, recordedActions, actionCounter)

  // Esperar a que el usuario complete el flujo manualmente
  console.log('\n✅ Navegador abierto. Realiza el flujo de inicio de sesión manualmente...')
  console.log('👀 Observando y registrando todas tus acciones...')
  console.log('💡 Cuando termines, presiona Enter aquí en la terminal para finalizar la grabación.\n')

  // Esperar input del usuario para finalizar
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve()
    })
  })

  // Detener el tracing
  await context.tracing.stop({ 
    path: path.join(process.cwd(), `recordings/${platform}-login-trace.zip`) 
  })

  await browser.close()

  // Generar código basado en las acciones registradas
  const generatedCode = generateCodeFromActions(platform, startUrl, recordedActions)

  // Guardar el código generado
  const outputPath = path.join(process.cwd(), `scripts/generated/${platform}-login-recorded.ts`)
  const outputDir = path.dirname(outputPath)
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, generatedCode, 'utf-8')

  // Guardar también las acciones en JSON para análisis
  const jsonPath = path.join(process.cwd(), `recordings/${platform}-login-actions.json`)
  const recordingsDir = path.dirname(jsonPath)
  
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true })
  }

  fs.writeFileSync(jsonPath, JSON.stringify(recordedActions, null, 2), 'utf-8')

  console.log('\n✅ Grabación completada!')
  console.log(`📄 Código generado: ${outputPath}`)
  console.log(`📊 Acciones registradas: ${jsonPath}`)
  console.log(`🎬 Traza de Playwright: recordings/${platform}-login-trace.zip`)
  console.log(`\n📝 Total de acciones registradas: ${recordedActions.length}`)

  return {
    codePath: outputPath,
    actionsPath: jsonPath,
    tracePath: `recordings/${platform}-login-trace.zip`,
    actions: recordedActions
  }
}

function setupActionListeners(page: Page, recordedActions: RecordedAction[], counter: { value: number }) {
  // Usar interceptores para capturar acciones
  let lastUrl = page.url()
  
  // Interceptar clicks usando evaluación en la página
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const newUrl = frame.url()
      if (newUrl !== lastUrl) {
        recordedActions.push({
          type: 'navigate',
          url: newUrl,
          timestamp: Date.now(),
          description: 'Navegación automática'
        })
        console.log(`🌐 Navegación registrada: ${newUrl}`)
        lastUrl = newUrl
      }
    }
  })

  // Capturar cuando la página carga completamente
  page.on('load', () => {
    recordedActions.push({
      type: 'wait',
      timestamp: Date.now(),
      description: 'Página cargada completamente'
    })
  })

  // Usar evaluación en la página para interceptar eventos DOM
  page.evaluate(() => {
    // Interceptar clicks
    document.addEventListener('click', (e: any) => {
      const target = e.target as HTMLElement
      if (target) {
        const selector = getElementSelector(target)
        window.dispatchEvent(new CustomEvent('pw:click', { 
          detail: { selector } 
        }))
      }
    }, true)

    // Interceptar cambios en inputs
    document.addEventListener('input', (e: any) => {
      const target = e.target as HTMLInputElement
      if (target && (target.type === 'email' || target.type === 'password' || target.type === 'text')) {
        const selector = getElementSelector(target)
        window.dispatchEvent(new CustomEvent('pw:input', { 
          detail: { selector, value: target.value } 
        }))
      }
    }, true)

    function getElementSelector(el: HTMLElement): string {
      if (el.id) return `#${el.id}`
      if (el.name) return `[name="${el.name}"]`
      if (el.className) {
        const classNameStr = String(el.className)
        const classes = classNameStr.split(' ').filter((c: string) => c && c.trim())
        if (classes.length > 0) {
          return `.${classes.join('.')}`
        }
      }
      return el.tagName.toLowerCase()
    }
  })

  // Escuchar eventos personalizados desde la página
  page.on('console', async (msg) => {
    // Los eventos serán capturados por el trace
  })
}

async function getSelector(page: Page, element: any): Promise<string> {
  try {
    // Intentar obtener el selector más específico posible
    const result = await page.evaluate((el) => {
      if (el.id) return `#${el.id}`
      if (el.name) return `[name="${el.name}"]`
      if (el.className) {
        const classes = el.className.split(' ').filter((c: string) => c.trim())
        if (classes.length > 0) {
          return `.${classes.join('.')}`
        }
      }
      return el.tagName.toLowerCase()
    }, element)
    return result
  } catch {
    return 'unknown'
  }
}

function generateCodeFromActions(
  platform: string,
  startUrl: string,
  actions: RecordedAction[]
): string {
  const code = `/**
 * Código generado automáticamente desde grabación manual
 * Plataforma: ${platform}
 * Fecha de grabación: ${new Date().toISOString()}
 * Total de acciones: ${actions.length}
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright'
import type { PlatformCredentials } from '../lib/platform-auth'

export async function login${platform.charAt(0).toUpperCase() + platform.slice(1)}Recorded(
  credentials: PlatformCredentials
): Promise<{ cookies: any[], userAgent: string, isAuthenticated: boolean }> {
  const browser: Browser = await chromium.launch({
    headless: false,
    slowMo: 50
  })

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  const page: Page = await context.newPage()

  try {
    // Navegación inicial
    console.log('  → Navegando a la página de login...')
    await page.goto('${startUrl}', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

${actions.map((action, index) => {
  switch (action.type) {
    case 'click':
      return `    // Acción ${index + 1}: Click
    console.log('  → Click en: ${action.selector}')
    await page.waitForSelector('${action.selector}', { timeout: 10000 })
    await page.click('${action.selector}')
    await page.waitForTimeout(1000)`

    case 'type':
      // Determinar si es email o password basado en el selector
      const isEmail = action.selector?.toLowerCase().includes('email') || 
                      action.selector?.toLowerCase().includes('identifier') ||
                      action.selector?.toLowerCase().includes('username')
      const isPassword = action.selector?.toLowerCase().includes('password')
      
      const value = isEmail 
        ? 'credentials.email' 
        : isPassword 
          ? 'credentials.password'
          : `'${action.text || ''}'`

      return `    // Acción ${index + 1}: Ingresar texto
    console.log('  → Ingresando texto en: ${action.selector}')
    await page.waitForSelector('${action.selector}', { timeout: 10000 })
    await page.fill('${action.selector}', ${value})
    await page.waitForTimeout(500)`

    case 'navigate':
      if (action.url && action.url !== startUrl) {
        return `    // Acción ${index + 1}: Navegación
    console.log('  → Navegando a: ${action.url}')
    await page.goto('${action.url}', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)`
      }
      return ''

    case 'wait':
      return `    // Acción ${index + 1}: Espera
    await page.waitForTimeout(2000)`

    default:
      return `    // Acción ${index + 1}: ${action.type}`
  }
}).filter(Boolean).join('\n\n')}

    // Verificar si el login fue exitoso
    await page.waitForTimeout(3000)
    const currentUrl = page.url()
    console.log('  → URL final:', currentUrl)

    // Obtener cookies y user agent
    const cookies = await context.cookies()
    const userAgent = await page.evaluate(() => navigator.userAgent)

    // Verificar autenticación (ajustar según la plataforma)
    const isAuthenticated = !currentUrl.includes('/login') && 
                           !currentUrl.includes('/signin') &&
                           cookies.length > 0

    if (isAuthenticated) {
      console.log('✅ Login exitoso')
    } else {
      console.log('⚠️ Login puede no haber sido exitoso')
    }

    await browser.close()

    return {
      cookies,
      userAgent,
      isAuthenticated
    }
  } catch (error) {
    await browser.close()
    throw error
  }
}
`

  return code
}

// Script para ejecutar desde la línea de comandos
if (require.main === module) {
  const platform = process.argv[2] as 'upwork' | 'glassdoor' | 'indeed' | 'hireline'
  const urls = {
    upwork: 'https://www.upwork.com/ab/account-security/login',
    glassdoor: 'https://www.glassdoor.com/profile/login_input.htm',
    indeed: 'https://secure.indeed.com/account/login',
    hireline: 'https://hireline.io/login'
  }

  if (!platform || !urls[platform]) {
    console.error('Uso: npx ts-node scripts/record-login.ts <platform>')
    console.error('Plataformas disponibles: upwork, glassdoor, indeed, hireline')
    process.exit(1)
  }

  recordLoginFlow(platform, urls[platform])
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error)
      process.exit(1)
    })
}

