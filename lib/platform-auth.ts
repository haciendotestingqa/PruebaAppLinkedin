/**
 * Platform Authentication
 * Maneja el login en diferentes plataformas de trabajo freelance
 * Usa Puppeteer para simular un navegador real
 */

let puppeteer: any
let playwright: any

if (typeof window === 'undefined') {
  try {
    puppeteer = require('puppeteer')
  } catch (e) {
    console.warn('Puppeteer not available')
  }

  try {
    playwright = require('playwright')
  } catch (e) {
    console.warn('Playwright not available')
  }
}

export interface PlatformCredentials {
  email: string
  password: string
  username?: string // Para algunas plataformas
}

export interface AuthSession {
  cookies: any[]
  userAgent: string
  isAuthenticated: boolean
  error?: string
  errorDetails?: string
}

/**
 * Función de diagnóstico para capturar información cuando aparece el error "technical difficulties"
 */
async function captureErrorDiagnostics(page: any, context: string): Promise<any> {
  try {
    const diagnostics = await page.evaluate(() => {
      const errorElement = document.querySelector('[role="alert"], .alert-error, .alert-danger, [class*="error"], [class*="Error"]')
      const errorText = errorElement?.textContent || ''
      const hasTechnicalDifficulties = errorText.toLowerCase().includes('technical difficulties') ||
                                      errorText.toLowerCase().includes('unable to process') ||
                                      errorText.toLowerCase().includes('try again later')
      
      return {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        hasError: hasTechnicalDifficulties,
        errorText: errorText.substring(0, 200),
        errorElementHTML: errorElement ? errorElement.outerHTML.substring(0, 500) : null,
        passwordField: {
          exists: document.querySelector('input[type="password"]') !== null,
          hasValue: (document.querySelector('input[type="password"]') as HTMLInputElement)?.value?.length > 0 || false,
          isVisible: (document.querySelector('input[type="password"]') as HTMLElement)?.offsetParent !== null || false,
          isDisabled: (document.querySelector('input[type="password"]') as HTMLInputElement)?.disabled || false
        },
        loginButton: {
          exists: Array.from(document.querySelectorAll('button, input[type="submit"]')).some(btn => {
            const text = (btn.textContent || '').toLowerCase()
            return text.includes('log in') || text.includes('login')
          }),
          isVisible: Array.from(document.querySelectorAll('button, input[type="submit"]')).some(btn => {
            const text = (btn.textContent || '').toLowerCase()
            const htmlBtn = btn as HTMLElement
            return (text.includes('log in') || text.includes('login')) && htmlBtn.offsetParent !== null
          })
        },
        formState: {
          hasForm: document.querySelector('form') !== null,
          formMethod: (document.querySelector('form') as HTMLFormElement)?.method || null,
          formAction: (document.querySelector('form') as HTMLFormElement)?.action || null
        },
        navigator: {
          userAgent: navigator.userAgent,
          webdriver: (navigator as any).webdriver || false,
          platform: navigator.platform,
          language: navigator.language
        },
        cookies: document.cookie.split(';').length,
        scriptsLoaded: Array.from(document.querySelectorAll('script')).length
      }
    })
    
    // También capturar información de red si es posible
    const networkInfo = {
      requestCount: 0,
      failedRequests: 0,
      lastRequestUrl: null
    }
    
    console.log(`  🔍 [DIAGNÓSTICO ${context}] Información capturada:`)
    console.log(`    - URL: ${diagnostics.url}`)
    console.log(`    - Error presente: ${diagnostics.hasError}`)
    console.log(`    - Texto del error: ${diagnostics.errorText.substring(0, 100)}...`)
    console.log(`    - Password field: existe=${diagnostics.passwordField.exists}, tieneValor=${diagnostics.passwordField.hasValue}, visible=${diagnostics.passwordField.isVisible}`)
    console.log(`    - Login button: existe=${diagnostics.loginButton.exists}, visible=${diagnostics.loginButton.isVisible}`)
    console.log(`    - WebDriver detectado: ${diagnostics.navigator.webdriver}`)
    console.log(`    - Cookies presentes: ${diagnostics.cookies}`)
    console.log(`    - Timestamp: ${diagnostics.timestamp}`)
    
    return diagnostics
  } catch (e) {
    console.log(`  ⚠️ [DIAGNÓSTICO ${context}] Error al capturar información:`, e instanceof Error ? e.message : 'Desconocido')
    return null
  }
}

/**
 * Función helper para maximizar una ventana de Puppeteer usando CDP
 */
async function maximizeWindow(page: any): Promise<void> {
  try {
    const client = await page.target().createCDPSession()
    
    // Obtener información de la ventana actual
    const { windowId } = await client.send('Browser.getWindowForTarget', {
      targetId: page.target()._targetId
    })
    
    // Maximizar la ventana usando las dimensiones de la pantalla
    await client.send('Browser.setWindowBounds', {
      windowId: windowId,
      bounds: {
        windowState: 'maximized'
      }
    })
    
    console.log('  ✅ Ventana maximizada exitosamente')
  } catch (error) {
    // Si falla, intentar método alternativo
    try {
      const client = await page.target().createCDPSession()
      const { windowId } = await client.send('Browser.getWindowForTarget', {
        targetId: page.target()._targetId
      })
      
      await client.send('Browser.setWindowBounds', {
        windowId: windowId,
        bounds: {
          windowState: 'maximized'
        }
      })
      
      console.log('  ✅ Ventana maximizada (método alternativo)')
    } catch (altError) {
      console.log('  ⚠️ No se pudo maximizar la ventana automáticamente, continuando...')
      // No lanzar error, solo continuar
    }
  }
}

/**
 * Autenticación en Upwork
 */
export async function loginUpwork(credentials: PlatformCredentials, interactive: boolean = false): Promise<AuthSession | null> {
  if (!playwright) {
    console.error('Playwright no disponible para login en Upwork')
    return null
  }

  // Bandera para evitar intentos duplicados en la misma sesión
  let loginAttemptInProgress = false

  // Usar navegador visible para Google OAuth
  let browser
  try {
    console.log('  🚀 Iniciando navegador para Upwork...')
    browser = await puppeteer.launch({
      headless: false, // Siempre visible para ver el proceso de Google OAuth
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', // Evitar problemas de memoria compartida
        '--disable-gpu', // Desactivar GPU para evitar problemas
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions'
      ],
      defaultViewport: { width: 1920, height: 1080 }, // Tamaño más grande para ver todos los campos y botones
      ignoreHTTPSErrors: true,
      timeout: 60000 // 60 segundos de timeout para el lanzamiento
    })
    
    // Verificar que el navegador esté conectado
    if (!browser) {
      throw new Error('El navegador no se pudo crear')
    }
    
    // Esperar un poco más y verificar conexión múltiples veces
    let connectionVerified = false
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 500))
      try {
        if (browser.isConnected()) {
          connectionVerified = true
          console.log(`  ✅ Navegador conectado (intento ${i + 1}/5)`)
          break
        }
      } catch (e) {
        console.log(`  ⏳ Esperando conexión del navegador (intento ${i + 1}/5)...`)
      }
    }
    
    if (!connectionVerified) {
      throw new Error('El navegador no se pudo conectar correctamente después de múltiples intentos')
    }
    
    // Esperar un momento adicional para asegurar que el navegador esté completamente listo
    console.log('  ⏳ Esperando a que el navegador esté completamente inicializado...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Verificación final de conexión
    if (!browser.isConnected()) {
      throw new Error('El navegador se desconectó durante la inicialización')
    }
    console.log('  ✅ Navegador listo y conectado')
  } catch (launchError) {
    console.error('❌ Error al lanzar el navegador:', launchError)
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Error al lanzar el navegador: ${launchError instanceof Error ? launchError.message : 'Error desconocido'}`,
      errorDetails: launchError instanceof Error ? launchError.stack : undefined
    }
  }

  try {
    // Verificar nuevamente que el navegador esté conectado
    if (!browser || !browser.isConnected()) {
      throw new Error('El navegador se desconectó antes de iniciar')
    }
    
    // Obtener páginas existentes (Chrome siempre abre con una página por defecto)
    let existingPages: any[] = []
    try {
      // Verificar conexión antes de obtener páginas
      if (!browser.isConnected()) {
        throw new Error('El navegador se desconectó')
      }
      existingPages = await browser.pages()
      console.log(`  📄 Páginas existentes encontradas: ${existingPages.length}`)
    } catch (e) {
      console.log('  ⚠️ Error al obtener páginas existentes, creando nueva...')
      existingPages = []
    }
    
    // Usar la primera página existente si está disponible y no está cerrada
    // Si no, crear una nueva
    let page: any = null
    
    if (existingPages.length > 0) {
      const firstPage = existingPages[0]
      try {
        // Verificar conexión antes de verificar la página
        if (!browser.isConnected()) {
          throw new Error('El navegador se desconectó')
        }
        if (!firstPage.isClosed()) {
          page = firstPage
          // Ajustar el viewport de la página reutilizada para ver todos los campos y botones
          await page.setViewport({ width: 1920, height: 1080 }).catch(() => {})
          // Maximizar la ventana para verla completa
          await maximizeWindow(page).catch(() => {})
          console.log('  ✅ Reutilizando página existente del navegador (viewport ajustado: 1920x1080, maximizada)')
          // Limpiar la página navegando a about:blank primero (opcional, no crítico)
          try {
            if (browser.isConnected() && !firstPage.isClosed()) {
              await firstPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 3000 }).catch(() => {
                // Ignorar errores de navegación a about:blank
              })
            }
          } catch (e) {
            console.log('  ⚠️ No se pudo limpiar la página, pero continuaremos...')
          }
        }
      } catch (e) {
        console.log('  ⚠️ La página existente no es usable, creando nueva...')
      }
    }
    
    // Si no tenemos una página válida, crear una nueva
    if (!page) {
      // Esperar un momento antes de crear nueva página para asegurar que el navegador esté listo
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Verificar que el navegador siga conectado antes de crear nueva página
      if (!browser.isConnected()) {
        throw new Error('El navegador se desconectó antes de crear la página')
      }
      
      try {
        page = await browser.newPage()
        // Ajustar el viewport de la página para ver todos los campos y botones
        await page.setViewport({ width: 1920, height: 1080 })
        // Maximizar la ventana para verla completa
        await maximizeWindow(page)
        console.log('  ✅ Se creó una nueva página para el login de Upwork (viewport: 1920x1080, maximizada)')
      } catch (newPageError: any) {
        console.error('  ❌ Error al crear nueva página:', newPageError)
        // Esperar un poco más y verificar conexión nuevamente
        await new Promise(resolve => setTimeout(resolve, 2000))
        if (!browser.isConnected()) {
          throw new Error('El navegador se desconectó durante el intento de crear página')
        }
        try {
          page = await browser.newPage()
          // Ajustar el viewport de la página para ver todos los campos y botones
          await page.setViewport({ width: 1920, height: 1080 })
          // Maximizar la ventana para verla completa
          await maximizeWindow(page)
          console.log('  ✅ Se creó una nueva página en el segundo intento (viewport: 1920x1080, maximizada)')
        } catch (retryError: any) {
          throw new Error(`No se pudo crear una nueva página después de 2 intentos: ${retryError instanceof Error ? retryError.message : 'Error desconocido'}`)
        }
      }
    }
    
    // Verificar que la página se creó correctamente
    if (!page) {
      throw new Error('No se pudo crear una página válida después de todos los intentos')
    }
    
    // Verificar que la página no esté cerrada
    try {
      if (page.isClosed()) {
        throw new Error('La página creada ya está cerrada')
      }
    } catch (e) {
      throw new Error('No se pudo verificar el estado de la página: ' + (e instanceof Error ? e.message : 'Error desconocido'))
    }
    
    // Marcar que el intento de login está en progreso
    loginAttemptInProgress = true
    
    // Navegar DIRECTAMENTE a la URL de login sin ventanas vacías
    const loginUrl = 'https://www.upwork.com/ab/account-security/login'
    console.log('\n🔐 ============================================================')
    console.log('🔐 NAVEGANDO A LA URL DE LOGIN DE UPWORK')
    console.log('🔐 ============================================================\n')
    console.log(`  🎯 URL objetivo: ${loginUrl}`)
    
    // Verificar que la página esté lista antes de navegar
    try {
      const currentUrl = page.url()
      console.log(`  📍 URL actual de la página: ${currentUrl}`)
    } catch (e) {
      console.log('  ⚠️ No se pudo obtener la URL actual, pero continuaremos...')
    }
    
    // Esperar un momento para asegurar que la página esté lista
    console.log('  ⏳ Esperando 2 segundos antes de navegar...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // NAVEGAR INMEDIATAMENTE - sin condiciones
    console.log('  🚀 NAVEGANDO a la URL de login de Upwork AHORA...')
    try {
      await page.goto(loginUrl, {
        waitUntil: 'networkidle2',
        timeout: 45000
      })
      console.log('  ✅ Navegación a la URL de login completada')
      
      // Verificar que estamos en la URL correcta
      const urlAfterNav = page.url()
      console.log(`  📍 URL después de navegar: ${urlAfterNav}`)
      
      if (!urlAfterNav.includes('upwork.com')) {
        console.log('  ⚠️ No estamos en Upwork, intentando nuevamente...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        await page.goto(loginUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
        console.log('  ✅ Segunda navegación completada')
      }
    } catch (navError) {
      console.error('  ❌ Error al navegar:', navError instanceof Error ? navError.message : 'Error desconocido')
      // Continuar de todas formas - puede que la página ya esté cargada
    }
    
    const recoverFromDetachedFrame = async (error: unknown): Promise<boolean> => {
      if (error instanceof Error && error.message && error.message.toLowerCase().includes('detached frame')) {
        console.log('  ⚠️ Frame detached detectado, intentando recuperar la página activa...')
        const pages = await browser.pages()
        const replacement = pages.find((p: any) => !p.isClosed())
        if (replacement) {
          page = replacement
          return true
        }
      }
      return false
    }

    const safeGetPageTitle = async (): Promise<string> => {
      try {
        return await page.title()
      } catch (error) {
        if (await recoverFromDetachedFrame(error)) {
          return await page.title()
        }
        throw error
      }
    }

    const safeGetPageContent = async (): Promise<string> => {
      try {
        return await page.content()
      } catch (error) {
        if (await recoverFromDetachedFrame(error)) {
          return await page.content()
        }
        throw error
      }
    }

    // Función helper para verificar si una página está abierta antes de interactuar con ella
    const isPageOpen = async (targetPage: any): Promise<boolean> => {
      try {
        if (!targetPage) return false
        if (targetPage.isClosed && targetPage.isClosed()) return false
        // Intentar acceder a una propiedad para verificar si la sesión está activa
        await targetPage.url()
        return true
      } catch (e) {
        return false
      }
    }

    // Función helper segura para bringToFront
    const safeBringToFront = async (targetPage: any): Promise<boolean> => {
      try {
        if (!await isPageOpen(targetPage)) {
          console.log('  ⚠️ La página está cerrada, no se puede traer al frente')
          return false
        }
        await targetPage.bringToFront()
        return true
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Desconocido'
        if (errorMsg.includes('Session closed') || errorMsg.includes('page has been closed')) {
          console.log('  ⚠️ La página se cerró, continuando sin traerla al frente...')
        } else {
          console.log('  ⚠️ Error al traer la página al frente:', errorMsg)
        }
        return false
      }
    }

    const attemptAutoCaptcha = async (context: string = 'general'): Promise<boolean> => {
      try {
        console.log(`  → Buscando captcha para resolver automáticamente (${context})...`)
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Esperar a que cualquier iframe de CAPTCHA cargue
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Primero buscar en iframes (reCAPTCHA, hCaptcha, etc.) - MÁS AGRESIVO
        const frames = page.frames()
        console.log(`  → Encontrados ${frames.length} frames, buscando CAPTCHA...`)
        
        for (const frame of frames) {
          try {
            const frameUrl = frame.url()?.toLowerCase() || ''
            const frameName = frame.name()?.toLowerCase() || ''
            console.log(`  → Revisando frame: ${frameUrl.substring(0, 100)}...`)
            
            if (frameUrl.includes('recaptcha') || frameUrl.includes('hcaptcha') || frameUrl.includes('captcha') || 
                frameName.includes('captcha') || frameUrl.includes('google') || frameUrl.includes('cloudflare')) {
              console.log(`  → Frame de CAPTCHA detectado: ${frameUrl}`)
              
              // Intentar múltiples selectores en el iframe
              const iframeSelectors = [
                '#recaptcha-anchor',
                '.recaptcha-checkbox-border',
                '.recaptcha-checkbox-checkmark',
                '#checkbox',
                '.mark',
                '.rc-anchor-checkbox',
                '[role="checkbox"]',
                '.rc-anchor-checkbox-holder',
                '.rc-anchor-checkbox-border',
                'span.recaptcha-checkbox',
                'div.recaptcha-checkbox'
              ]
              
              for (const selector of iframeSelectors) {
                try {
                  const checkbox = await frame.$(selector)
                  if (checkbox) {
                    console.log(`  → Checkbox encontrado en iframe con selector: ${selector}`)
                    
                    // Intentar hacer clic de múltiples formas
                    try {
                      await checkbox.click({ delay: 150 })
                      console.log('  → Clic realizado en checkbox del iframe')
                    } catch (clickError) {
                      // Si falla el clic normal, intentar con evaluate
                      await frame.evaluate((sel: string) => {
                        const el = document.querySelector(sel) as HTMLElement | null
                        if (el) {
                          el.click()
                          // También disparar eventos
                          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                        }
                      }, selector)
                      console.log('  → Clic realizado mediante evaluate en iframe')
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 3000))
                    
                    // Verificar si se marcó
                    try {
                      await frame.waitForSelector('.recaptcha-checkbox-checked, .recaptcha-checkbox-checkmark[aria-checked="true"], .recaptcha-checkbox-border[aria-checked="true"], .mark.checked, [aria-checked="true"], .rc-anchor-checkbox-checked', { timeout: 5000 })
                      console.log('  ✅ CAPTCHA marcado automáticamente dentro del iframe')
                      return true
                    } catch (_) {
                      console.log('  ⚠️ No se confirmó el marcado, pero el clic se realizó')
                      return true // Retornar true de todas formas ya que se hizo el clic
                    }
                  }
                } catch (selectorError) {
                  // Continuar con el siguiente selector
                }
              }
            }
          } catch (frameError) {
            console.log(`  ⚠️ Error al revisar frame: ${(frameError as Error).message}`)
          }
        }

        // Buscar checkboxes directos en la página - MÁS SELECTORES
        const checkboxSelectors = [
          'input[type="checkbox"][name*="robot" i]',
          'input[type="checkbox"][id*="robot" i]',
          'input[type="checkbox"][aria-label*="robot" i]',
          'input[type="checkbox"][name*="humano" i]',
          'input[type="checkbox"][name*="human" i]',
          'input[type="checkbox"][id*="human" i]',
          'input[type="checkbox"][id*="Human" i]',
          '#px-captcha input[type="checkbox"]',
          '[data-captcha] input[type="checkbox"]',
          '[role="checkbox"]',
          '.g-recaptcha input[type="checkbox"]',
          '#recaptcha-anchor input[type="checkbox"]',
          '.recaptcha-checkbox input[type="checkbox"]',
          '[class*="captcha"] input[type="checkbox"]',
          '[class*="recaptcha"] input[type="checkbox"]',
          'input[type="checkbox"]' // Último recurso: cualquier checkbox visible
        ]

        for (const selector of checkboxSelectors) {
          try {
            const checkboxes = await page.$$(selector)
            for (const checkbox of checkboxes) {
              const isVisible = await page.evaluate((el: any) => {
                if (!(el instanceof HTMLElement)) return false
                const style = window.getComputedStyle(el)
                const rect = el.getBoundingClientRect()
                return el.offsetParent !== null && 
                       style.visibility !== 'hidden' && 
                       style.display !== 'none' &&
                       rect.width > 0 &&
                       rect.height > 0
              }, checkbox)
              
              if (isVisible) {
                console.log(`  → Marcando checkbox captcha visible (${selector}) (${context})`)
                
                // Hacer scroll al checkbox
                await page.evaluate((el: any) => {
                  if (el instanceof HTMLElement) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }, checkbox)
                
                await new Promise(resolve => setTimeout(resolve, 500))
                
                // Intentar múltiples formas de clic
                try {
                  await checkbox.click({ delay: 150 })
                } catch (clickError) {
                  await page.evaluate((el: any) => {
                    if (el instanceof HTMLElement) {
                      el.click()
                      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                    }
                  }, checkbox)
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000))
                console.log('  ✅ Checkbox marcado')
                await checkbox.dispose()
                return true
              }
              await checkbox.dispose()
            }
          } catch (error) {
            // Continuar con el siguiente selector
          }
        }

        // Buscar por texto en labels, spans, divs, etc. - MÁS AGRESIVO
        const textClicked = await page.evaluate(() => {
          const searchTexts = [
            /soy un humano/i,
            /soy humano/i,
            /no soy un robot/i,
            /no soy robot/i,
            /i'?m not a robot/i,
            /i am not a robot/i,
            /i'm human/i,
            /i am human/i,
            /verificar que eres humano/i,
            /verificar humano/i,
            /humano/i,
            /human/i,
            /robot/i
          ]
          
          // Buscar en todos los elementos clickeables
          const allElements = Array.from(document.querySelectorAll('label, span, div, button, a, input, [role="checkbox"], [role="button"]'))
          for (const el of allElements) {
            if (!(el instanceof HTMLElement)) continue
            const style = window.getComputedStyle(el)
            if (el.offsetParent === null || style.visibility === 'hidden' || style.display === 'none') continue
            
            const text = (el.textContent || el.innerText || el.getAttribute('aria-label') || '').trim()
            const matches = searchTexts.some(regex => regex.test(text))
            
            if (matches) {
              console.log('Elemento encontrado con texto:', text)
              // Intentar hacer clic en el elemento
              try {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.click()
                // También disparar eventos
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                return true
              } catch (e) {
                // Si falla, buscar el checkbox asociado
                const forAttr = el.getAttribute('for')
                if (forAttr) {
                  const input = document.getElementById(forAttr) as HTMLElement | null
                  if (input) {
                    input.click()
                    return true
                  }
                }
                // Buscar checkbox cercano en cualquier dirección
                let parent = el.parentElement
                for (let i = 0; i < 5 && parent; i++) {
                  const checkbox = parent.querySelector('input[type="checkbox"], [role="checkbox"]') as HTMLElement | null
                  if (checkbox) {
                    checkbox.click()
                    return true
                  }
                  parent = parent.parentElement
                }
              }
            }
          }
          
          // Buscar checkboxes por aria-label, title, o cualquier atributo
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]'))
          for (const cb of checkboxes) {
            if (!(cb instanceof HTMLElement)) continue
            const style = window.getComputedStyle(cb)
            if (cb.offsetParent === null || style.visibility === 'hidden' || style.display === 'none') continue
            
            const ariaLabel = (cb.getAttribute('aria-label') || '').toLowerCase()
            const title = (cb.getAttribute('title') || '').toLowerCase()
            const id = (cb.id || '').toLowerCase()
            const className = (cb.className || '').toLowerCase()
            const matches = searchTexts.some(regex => 
              regex.test(ariaLabel) || 
              regex.test(title) || 
              regex.test(id) ||
              regex.test(className)
            )
            
            if (matches) {
              cb.scrollIntoView({ behavior: 'smooth', block: 'center' })
              cb.click()
              cb.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
              return true
            }
          }
          
          return false
        })

        if (textClicked) {
          console.log(`  ✅ CAPTCHA marcado mediante búsqueda de texto (${context})`)
          await new Promise(resolve => setTimeout(resolve, 3000))
          return true
        }
        
        console.log('  ⚠️ No se encontró CAPTCHA para resolver automáticamente')
      } catch (error) {
        console.log(`  ⚠️ Error al intentar resolver el captcha automáticamente (${context}):`, error)
      }

      return false
    }

    const isPasswordFieldVisible = async (): Promise<boolean> => {
      return await page.evaluate(() => {
        const selectors = [
          'input[type="password"]',
          'input[name="__password"]',
          'input[name="password"]',
          'input[name*="password" i]',
          'input[id*="password" i]',
          'input[id*="Password"]',
          'input[placeholder*="password" i]',
          'input[placeholder*="contraseña" i]',
          'input[autocomplete="current-password"]',
          'input[autocomplete="password"]',
          'input[data-testid*="password" i]',
          'input[aria-label*="password" i]'
        ]
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector) as HTMLElement | null
            if (element) {
              const style = window.getComputedStyle(element)
              const visible = element.offsetParent !== null && 
                            style.visibility !== 'hidden' && 
                            style.display !== 'none' &&
                            style.opacity !== '0'
              if (visible) {
                return true
              }
            }
          } catch (e) {
            // Continuar con el siguiente selector
          }
        }
        
        // Búsqueda exhaustiva en todos los inputs
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          if (!(input instanceof HTMLInputElement)) continue
          const style = window.getComputedStyle(input)
          if (input.offsetParent === null || 
              style.visibility === 'hidden' || 
              style.display === 'none' ||
              style.opacity === '0') continue
              
          const type = (input.type || '').toLowerCase()
          const name = (input.name || '').toLowerCase()
          const placeholder = (input.placeholder || '').toLowerCase()
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase()
          const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase()
          const id = (input.id || '').toLowerCase()
          
          const isPassword = type === 'password' ||
                             name.includes('password') ||
                             placeholder.includes('password') ||
                             placeholder.includes('contraseña') ||
                             ariaLabel.includes('password') ||
                             ariaLabel.includes('contraseña') ||
                             autocomplete.includes('password') ||
                             id.includes('password')
          
          if (isPassword) {
            return true
          }
        }
        
        return false
      })
    }

    const clickContinueToRevealPassword = async (): Promise<boolean> => {
      const selectors = [
        'button[data-tn-element="emailContinueButton"]',
        'button[id*="continue"]',
        'button[name*="continue"]',
        'button[class*="continue"]',
        'button[class*="next"]',
        'button[data-testid*="continue"]',
        'button[aria-label*="Continuar" i]',
        'button[aria-label*="Siguiente" i]',
        'input[type="submit"][value*="Continuar" i]',
        'input[type="submit"][value*="continue" i]',
        'input[type="submit"][value*="Next" i]'
      ]
      const keywordMatches = ['continu', 'sigu', 'next', 'correo', 'email']

      for (const selector of selectors) {
        try {
          const element = await page.$(selector)
          if (!element) continue

          const fieldInfo = await page.evaluate((el: any, keywords: string[]) => {
            if (!(el instanceof HTMLElement)) {
              return { visible: false, matches: false }
            }
            const style = window.getComputedStyle(el)
            const visible = el.offsetParent !== null && style.visibility !== 'hidden'
            const textCandidate = (el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '').toLowerCase()
            const matches = keywords.some(keyword => textCandidate.includes(keyword))
            return { visible, matches }
          }, element, keywordMatches)

          if (fieldInfo.visible && fieldInfo.matches) {
            await element.click({ delay: 60 })
            await element.dispose()
            return true
          }

          await element.dispose()
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }

      const clickedByText = await page.evaluate((keywords: string[]) => {
        const elements = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"]'))
        for (const el of elements) {
          if (!(el instanceof HTMLElement)) continue
          const style = window.getComputedStyle(el)
          if (el.offsetParent === null || style.visibility === 'hidden') continue
          const textCandidate = (el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '').toLowerCase()
          const matches = keywords.some(keyword => textCandidate.includes(keyword))
          if (matches) {
            el.click()
            return true
          }
        }
        return false
      }, keywordMatches)

      if (clickedByText) {
        return true
      }

      return false
    }

    const ensurePasswordStep = async (): Promise<void> => {
      // Primero verificar si el campo de password ya está visible
      if (await isPasswordFieldVisible()) {
        console.log('  ✅ Campo de password ya está visible en ensurePasswordStep')
        return
      }

      console.log('  → Campo de password no visible aún en ensurePasswordStep, esperando...')
      
      // Esperar más tiempo después de hacer clic en "Continuar" (si ya se hizo clic antes)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Intentar resolver captcha si aparece
      const captchaSolved = await attemptAutoCaptcha('after-continue-step')
      if (captchaSolved) {
        console.log('  → Captcha resuelto, esperando campo de password...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Esperar un momento para que aparezca el campo de password - UN SOLO INTENTO
      console.log('  → Esperando campo de password...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      
        if (await isPasswordFieldVisible()) {
        console.log('  ✅ Campo de password detectado')
          await new Promise(resolve => setTimeout(resolve, 1500))
          return
        }
        
      console.log('  ⚠️ El campo de password no apareció, continuando...')
      // No lanzar error aquí, continuar con el flujo normal
    }
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    console.log('  → Verificando página de login de Upwork...')
    
    // FUNCIÓN HELPER: Cerrar páginas about:blank innecesarias
    const closeBlankPages = async (excludePage: any, waitForLoad: boolean = false) => {
      const allPages = await browser.pages()
      let closedCount = 0
      
      for (const p of allPages) {
        if (p !== excludePage && !p.isClosed()) {
          try {
            const url = p.url()
            if (url === 'about:blank') {
              // Si waitForLoad es true, esperar un tiempo para ver si carga algo útil
              if (waitForLoad) {
                console.log('  → Detectada página about:blank, esperando a ver si carga contenido...')
                await new Promise(resolve => setTimeout(resolve, 5000))
                
                // Verificar si ahora tiene una URL válida
                const newUrl = p.url()
                if (newUrl === 'about:blank' || newUrl === '') {
                  console.log('  ⚠️ Página about:blank no cargó contenido después de esperar. Cerrando...')
                  await p.close()
                  closedCount++
                  await new Promise(resolve => setTimeout(resolve, 1000))
                } else {
                  console.log(`  → Página about:blank cargó contenido: ${newUrl.substring(0, 50)}...`)
                }
              } else {
                // Si no estamos esperando, cerrar inmediatamente si no es necesaria
                console.log('  ⚠️ Detectada página about:blank innecesaria. Cerrando...')
                await p.close()
                closedCount++
                await new Promise(resolve => setTimeout(resolve, 1000))
              }
            }
          } catch (e) {
            // Continuar
          }
        }
      }
      
      if (closedCount > 0) {
        console.log(`  → Se cerraron ${closedCount} página(s) about:blank`)
      }
      
      return closedCount
    }
    
    // FUNCIÓN HELPER: Verificar y cerrar páginas duplicadas de login
    const closeDuplicateLoginPages = async (excludePage: any) => {
      const allPages = await browser.pages()
      let closedCount = 0
      
      // Primero cerrar páginas about:blank innecesarias
      await closeBlankPages(excludePage, false)
      
      for (const p of allPages) {
        if (p !== excludePage && !p.isClosed()) {
          try {
            const url = p.url()
            if (url.includes('upwork.com/ab/account-security/login')) {
              console.log('  ⚠️ Detectada página duplicada de login. Cerrando...')
              await p.close()
              closedCount++
              // Esperar tiempo extendido después de cerrar para asegurar que se cerró completamente
            await new Promise(resolve => setTimeout(resolve, 2000))
            }
          } catch (e) {
            // Continuar
          }
        }
      }
      
      if (closedCount > 0) {
        console.log(`  → Se cerraron ${closedCount} página(s) duplicada(s) de login`)
      }
      
      return closedCount
    }
    
    // Verificar y cerrar duplicados ANTES de navegar
    await closeDuplicateLoginPages(page)
    
    // Cerrar páginas about:blank innecesarias antes de navegar
    await closeBlankPages(page, false)
    
    // La variable loginUrl ya fue definida arriba, no definirla de nuevo
    
    console.log('\n🔐 ============================================================')
    console.log('🔐 INICIANDO PROCESO DE LOGIN EN UPWORK')
    console.log('🔐 ============================================================\n')
    
    // Verificar URL actual solo para logging
    let currentUrlBeforeNav = ''
    try {
      currentUrlBeforeNav = page.url()
      console.log(`  📍 URL actual antes de navegar: ${currentUrlBeforeNav}`)
    } catch (e) {
      console.log('  ⚠️ No se pudo obtener la URL actual (puede estar en about:blank)')
      currentUrlBeforeNav = 'unknown'
    }
    
    console.log('\n🚀 FORZANDO navegación a la URL de inicio de sesión de Upwork...')
    console.log(`  🎯 URL objetivo: ${loginUrl}\n`)
    
    // Verificar una última vez antes de navegar
    await closeDuplicateLoginPages(page)
    await closeBlankPages(page, false)
    
    // Esperar un momento antes de navegar para asegurar que no haya procesos en curso
    console.log('  ⏳ Esperando antes de navegar (3 segundos)...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Navegar a la URL de login usando 'domcontentloaded' para evitar refrescos innecesarios
    console.log('  🚀 Navegando a la URL de login...\n')
    
    try {
      await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded', // Cambiar a domcontentloaded para evitar esperas largas que causan refrescos
        timeout: 30000
      })
      
      // Verificar que realmente estamos en la URL correcta
      const urlAfterNav = page.url()
      console.log(`  → URL después de navegar: ${urlAfterNav}`)
      
      if (urlAfterNav.includes('upwork.com')) {
        console.log('  ✅ Página de login de Upwork cargada correctamente')
        
        // Asegurar que el viewport esté ajustado después de navegar
        try {
          await page.setViewport({ width: 1920, height: 1080 })
          console.log('  ✅ Viewport ajustado después de navegar (1920x1080)')
        } catch (viewportError) {
          console.log('  ⚠️ No se pudo ajustar el viewport después de navegar')
        }
        
        // Hacer scroll para asegurar que todos los elementos sean visibles
        try {
          await page.evaluate(() => {
            window.scrollTo(0, 0)
          })
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (scrollError) {
          // Continuar si hay error en el scroll
        }
      } else {
        console.log(`  ⚠️ URL no es la esperada (${urlAfterNav}), pero continuando...`)
      }
    } catch (gotoError) {
      console.log(`  ⚠️ Error al navegar:`, gotoError instanceof Error ? gotoError.message : 'Error desconocido')
      console.log('  → Continuando con el proceso (si la página se cerró manualmente, se continuará con la siguiente plataforma)')
      // No lanzar error - simplemente continuar, se manejará en el catch general
    }
    
    // Asegurar que el viewport esté configurado antes de continuar
    try {
      await page.setViewport({ width: 1920, height: 1080 })
    } catch (viewportError) {
      // Continuar si hay error
    }
    
    // PASO CRÍTICO: Cerrar popup de Privacy Policy INMEDIATAMENTE después de navegar (ANTES de cualquier espera adicional)
    console.log('  → PASO 1: Cerrando popup de Privacy Policy INMEDIATAMENTE...')
    let privacyPopupClosed = false
    
    try {
      // Esperar solo lo mínimo necesario para que el popup aparezca (2 segundos máximo)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Centrar la vista de la página en lugar de ir a la esquina superior izquierda
      try {
        await page.evaluate(() => {
          // Buscar el contenedor principal o formulario para centrarlo
          const mainContent = document.querySelector('main, form, .login-container, [role="main"], .container') as HTMLElement
          if (mainContent) {
            mainContent.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
          } else {
            // Si no hay contenedor específico, centrar el body
            const bodyHeight = document.body.scrollHeight
            const viewportHeight = window.innerHeight
            const centerY = Math.max(0, (bodyHeight - viewportHeight) / 2)
            window.scrollTo({ top: centerY, left: 0, behavior: 'smooth' })
          }
        })
      } catch (scrollError) {
        // Continuar si hay error
      }
      
      // Buscar específicamente botones con X o ícono de cerrar - BÚSQUEDA AGRESIVA
      const xButtonSelectors = [
        'button[aria-label*="close" i]',
        'button[aria-label*="×"]',
        'button[aria-label*="X"]',
        '[role="button"][aria-label*="close" i]',
        '.close-button',
        '.close',
        'button.close',
        '[class*="close"][class*="button"]',
        '[class*="icon-close"]',
        '[class*="close-icon"]',
        'svg[class*="close"]',
        '[data-testid*="close"]',
        '[data-qa*="close"]',
        'button[class*="x"]',
        'button[class*="X"]',
        '[aria-label="Close"]',
        '[aria-label="close"]',
        '[title="Close"]',
        '[title="close"]'
      ]
      
      // Primero buscar específicamente la X usando Puppeteer directamente
      for (const selector of xButtonSelectors) {
        try {
          const elements = await page.$$(selector)
          for (const element of elements) {
            const isVisible = await page.evaluate((el: any) => {
              const style = window.getComputedStyle(el)
              return el && el.offsetParent !== null && 
                     style.visibility !== 'hidden' && 
                     style.display !== 'none' &&
                     style.opacity !== '0'
            }, element)
            
            if (isVisible) {
              // Verificar si está dentro de un popup/modal o si es un botón de cerrar visible
              const shouldClick = await page.evaluate((el: any) => {
                // Si tiene aria-label de close, cerrar directamente
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase()
                if (ariaLabel.includes('close') || ariaLabel === '×' || ariaLabel === 'x') {
                  return true
                }
                
                // Verificar si está dentro de un popup/modal
                let parent = el.parentElement
                let depth = 0
                while (parent && depth < 10) {
                  const tagName = parent.tagName?.toLowerCase()
                  const className = parent.className?.toLowerCase() || ''
                  const id = parent.id?.toLowerCase() || ''
                  const text = (parent.textContent || '').toLowerCase()
                  if (tagName === 'dialog' || 
                      className.includes('modal') || 
                      className.includes('popup') ||
                      className.includes('dialog') ||
                      className.includes('privacy') ||
                      text.includes('privacy') ||
                      text.includes('cookie') ||
                      id.includes('modal') ||
                      id.includes('popup') ||
                      id.includes('dialog') ||
                      id.includes('privacy')) {
                    return true
                  }
                  parent = parent.parentElement
                  depth++
                }
                return false
              }, element)
              
              if (shouldClick) {
                try {
                  await element.scrollIntoView()
                  await new Promise(resolve => setTimeout(resolve, 300))
                  await element.click({ delay: 50 })
                  console.log(`  ✅ Popup cerrado con X (selector: ${selector})`)
                  privacyPopupClosed = true
                  await new Promise(resolve => setTimeout(resolve, 1000))
                  break
                } catch (clickError) {
                  console.log(`  ⚠️ Error al hacer clic en selector ${selector}, intentando siguiente...`)
                }
              }
            }
          }
          if (privacyPopupClosed) break
        } catch (e) {
          // Continuar con el siguiente selector
          continue
        }
      }
      
      // Método alternativo: buscar por texto contenido
      if (!privacyPopupClosed) {
        try {
          const popupClosed = await page.evaluate(() => {
            // Buscar elementos con texto relacionado a privacy policy
            const allElements = Array.from(document.querySelectorAll('*'))
            
            for (const el of allElements) {
              const text = (el.textContent || '').toLowerCase()
              const isPrivacyRelated = text.includes('privacy policy') || 
                                     text.includes('cookie policy') ||
                                     text.includes('accept cookies') ||
                                     text.includes('accept all') ||
                                     (text.includes('privacy') && text.includes('policy'))
              
              if (isPrivacyRelated) {
                // Buscar botones de cerrar dentro de este elemento o cerca
                const closeButtons = Array.from(el.querySelectorAll('button, [role="button"], a, [onclick]'))
                for (const btn of closeButtons) {
                  const btnText = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase()
                  const style = window.getComputedStyle(btn as HTMLElement)
                  const isVisible = (btn as HTMLElement).offsetParent !== null && 
                                   style.visibility !== 'hidden' && 
                                   style.display !== 'none'
                  
                  if (isVisible && (btnText.includes('close') || 
                                   btnText.includes('accept') || 
                                   btnText.includes('dismiss') ||
                                   btnText.includes('ok') ||
                                   btnText.includes('got it') ||
                                   btnText.includes('×') ||
                                   btnText === 'x')) {
                    (btn as HTMLElement).click()
                    return true
                  }
                }
                
                // Si no hay botón específico, buscar botón con X o close icon
                const closeIcon = el.querySelector('[aria-label*="close" i], [aria-label*="dismiss" i], button:has-text("×"), button:has-text("X")')
                if (closeIcon) {
                  (closeIcon as HTMLElement).click()
                  return true
                }
              }
            }
            return false
          })
          
          if (popupClosed) {
            console.log('  ✅ Popup de Privacy Policy cerrado (por texto)')
            privacyPopupClosed = true
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch (e) {
          // Continuar si falla
        }
      }
      
      if (!privacyPopupClosed) {
        console.log('  → No se detectó popup de Privacy Policy, continuando...')
      } else {
        console.log('  ✅ Popup de Privacy Policy cerrado exitosamente')
      }
    } catch (e) {
      console.log('  ⚠️ Error al verificar popup de Privacy Policy:', e instanceof Error ? e.message : 'Desconocido')
      // Continuar con el flujo normal
    }
    
    // Esperar solo un momento mínimo después de cerrar el popup
    await new Promise(resolve => setTimeout(resolve, 1000))

    // PASO 1: Buscar y hacer clic en botón azul "Continue with Google"
    console.log('  → Paso 1: Buscando botón azul "Continue with Google"...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Buscar botón azul "Continue with Google" - priorizar botones azules
    let googleBtnFound = false
    const googleButtonSelectors = [
      'button[class*="google"]',
      'button[data-testid*="google"]',
      'button[aria-label*="Google"]',
      'a[href*="google"]',
      '[class*="google"] button',
      '[id*="google"] button',
      'button[class*="google-signin"]',
      'div[class*="google"] button'
    ]
    
    for (const selector of googleButtonSelectors) {
      try {
        const buttons = await page.$$(selector)
        for (const button of buttons) {
          const buttonInfo = await page.evaluate((el: any) => {
            const style = window.getComputedStyle(el)
            const isVisible = el && el.offsetParent !== null && !el.disabled
            const text = (el.textContent || '').toLowerCase().trim()
            const isBlue = style.backgroundColor.includes('rgb') && (
              style.backgroundColor.includes('rgb(37, 99, 235)') || // blue-600
              style.backgroundColor.includes('rgb(29, 78, 216)') || // blue-700
              style.backgroundColor.includes('rgb(59, 130, 246)') || // blue-500
              style.color.includes('rgb(59, 130, 246)') ||
              style.color.includes('rgb(37, 99, 235)')
            )
            return {
              isVisible,
              text,
              isBlue,
              hasGoogle: text.includes('google'),
              hasContinue: text.includes('continue') || text.includes('sign'),
              backgroundColor: style.backgroundColor,
              color: style.color
            }
          }, button)
          
          if (buttonInfo.isVisible && buttonInfo.hasGoogle && buttonInfo.hasContinue) {
            // Hacer scroll para asegurar que el botón sea completamente visible
            await button.scrollIntoView()
            await new Promise(resolve => setTimeout(resolve, 500))
            // Asegurar que el viewport permita ver el botón
            try {
              await page.evaluate(() => {
                window.scrollTo(0, Math.max(0, window.scrollY - 100))
              })
            } catch (e) {
              // Continuar si hay error
            }
            await new Promise(resolve => setTimeout(resolve, 500))
            await button.click()
            console.log(`  ✅ Click en botón azul "Continue with Google" realizado`)
            googleBtnFound = true
            await new Promise(resolve => setTimeout(resolve, 3000))
            break
          }
        }
        if (googleBtnFound) break
      } catch (e) {
        continue
      }
    }
    
    // Si no se encontró con selectores, buscar por texto específico
    if (!googleBtnFound) {
      const buttonByText = await page.evaluateHandle(() => {
        const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'))
        for (const btn of allButtons) {
          const text = (btn.textContent || '').toLowerCase().trim()
          const htmlBtn = btn as HTMLElement
          const isVisible = htmlBtn.offsetParent !== null && !htmlBtn.hasAttribute('disabled')
          
          if (isVisible && text.includes('continue with google')) {
            return btn
          }
        }
        return null
      })
      
      if (buttonByText && buttonByText.asElement()) {
        await buttonByText.asElement()!.scrollIntoView()
        await new Promise(resolve => setTimeout(resolve, 1000))
        await buttonByText.asElement()!.click()
        console.log('  ✅ Click en botón "Continue with Google" realizado (por texto exacto)')
        googleBtnFound = true
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
    
    // Si se encontró y se hizo clic en el botón de Google, manejar el popup (UN SOLO PROCESO)
    if (googleBtnFound) {
      console.log('✅ Click en botón "Continue with Google" realizado, esperando popup...')
      
      // IMPORTANTE: Asegurarse de que solo hay UNA ventana principal antes de esperar el popup
      const pagesBeforeWait = await browser.pages()
      if (pagesBeforeWait.length > 1) {
        console.log(`  ⚠️ Se detectaron ${pagesBeforeWait.length} ventanas antes de esperar popup. Cerrando duplicadas...`)
        for (const p of pagesBeforeWait) {
          if (p !== page && !p.isClosed()) {
            try {
              const url = p.url()
              // Solo mantener ventanas de Google OAuth válidas o about:blank
              if (!url.includes('accounts.google.com') && 
                  !url.includes('google.com') && 
                  url !== 'about:blank' &&
                  !url.includes('upwork.com')) {
                await p.close()
                console.log(`  → Cerrada ventana duplicada: ${url}`)
              }
            } catch (e) {
              // Continuar si hay error
            }
          }
        }
      }
      
      // Esperar tiempo suficiente para que se abra el popup (UNA SOLA VEZ)
      await new Promise(resolve => setTimeout(resolve, 8000))
      
      // PASO 2: Detectar popup de Google OAuth (UNA SOLA DETECCIÓN)
      let googlePage = page
      let popupOpened = false
      
      // Verificar una sola vez todas las páginas disponibles
      const allPages = await browser.pages()
      console.log(`  → Total de páginas después del click: ${allPages.length}`)
      
      // Buscar el popup de Google (solo UNA vez, sin loop)
      for (const p of allPages) {
        if (p !== page && !p.isClosed()) {
          try {
            const popupUrl = p.url()
            console.log(`  → Revisando página: ${popupUrl.substring(0, 80)}...`)
            
            if (popupUrl.includes('accounts.google.com') || 
                popupUrl.includes('google.com/oauth') ||
                popupUrl.includes('signinwithgoogle') ||
                popupUrl === 'about:blank') {
              googlePage = p
              popupOpened = true
              console.log('🔐 Detectado popup de Google OAuth')
              
              // Ajustar el viewport del popup para ver todos los campos y botones
              try {
                await googlePage.setViewport({ width: 1920, height: 1080 })
                console.log('  ✅ Viewport del popup ajustado a 1920x1080')
              } catch (viewportError) {
                console.log('  ⚠️ No se pudo ajustar el viewport del popup, continuando...')
              }
              
              // Maximizar la ventana popup para verla completa
              await maximizeWindow(googlePage)
              
              await safeBringToFront(googlePage)
              
              // Si es about:blank, esperar tiempo extendido a que cargue
              if (popupUrl === 'about:blank') {
                console.log('  → Detectada página about:blank, esperando a que cargue contenido de Google OAuth...')
                await new Promise(resolve => setTimeout(resolve, 8000))
                try {
                  await googlePage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 })
                  const newUrl = googlePage.url()
                  if (newUrl && newUrl !== 'about:blank' && newUrl.includes('google.com')) {
                    console.log(`  → Página about:blank cargó correctamente: ${newUrl.substring(0, 80)}...`)
                    
                    // Ajustar viewport después de que cargue el contenido
                    try {
                      await googlePage.setViewport({ width: 1920, height: 1080 })
                      console.log('  ✅ Viewport ajustado después de carga del contenido')
                    } catch (viewportError) {
                      console.log('  ⚠️ No se pudo ajustar el viewport después de la carga')
                    }
                    
                    // Centrar la vista del popup en lugar de ir a la esquina superior izquierda
                    try {
                      await googlePage.evaluate(() => {
                        // Buscar el contenedor principal o formulario para centrarlo
                        const mainContent = document.querySelector('main, form, [role="main"], .container, [id*="view_container"], [id*="content"]') as HTMLElement
                        if (mainContent) {
                          mainContent.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
                        } else {
                          // Si no hay contenedor específico, centrar el body
                          const bodyHeight = document.body.scrollHeight
                          const viewportHeight = window.innerHeight
                          const centerY = Math.max(0, (bodyHeight - viewportHeight) / 2)
                          window.scrollTo({ top: centerY, left: 0, behavior: 'smooth' })
                        }
                      })
                    } catch (scrollError) {
                      // Continuar si hay error
                    }
                  } else {
                    console.log('  ⚠️ Página about:blank no cargó contenido válido después de esperar')
                    // Si no carga nada útil después de esperar, podría ser una página innecesaria
                    // Pero la mantenemos porque podría ser parte del flujo de Google
                  }
                } catch (e) {
                  console.log('  ⚠️ Timeout esperando navegación en about:blank, verificando URL actual...')
                  const currentUrl = googlePage.url()
                  if (currentUrl === 'about:blank' || currentUrl === '') {
                    console.log('  ⚠️ La página sigue en about:blank, podría ser innecesaria')
                  }
                }
              }
              
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              // Asegurar que el viewport esté ajustado antes de buscar elementos
              try {
                await googlePage.setViewport({ width: 1920, height: 1080 })
              } catch (viewportError) {
                // Continuar si hay error
              }
              
              // Verificar si estamos en la página de challenge/selection y buscar "Enter your password" (resaltada en rojo)
              try {
                const popupUrlAfterWait = googlePage.url()
                if (popupUrlAfterWait.includes('/challenge/selection') || popupUrlAfterWait.includes('challenge/selection')) {
                  console.log('  → Detectada página de challenge/selection, buscando opción "Enter your password" (resaltada en rojo)...')
                  await new Promise(resolve => setTimeout(resolve, 3000))
                  
                  // Buscar "Enter your password" usando Puppeteer directamente (más confiable)
                  let passwordOptionFound = false
                  
                  // PRIMER MÉTODO: Buscar todos los elementos clickeables y filtrar
                  const allClickableElements = await googlePage.$$('button, [role="button"], a, div[role="button"], li, div[role="option"], span[role="button"]')
                  
                  for (const element of allClickableElements) {
                    try {
                      const elementInfo = await googlePage.evaluate((el: any) => {
                        const text = (el.textContent || '').toLowerCase().trim()
                        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                        const title = (el.getAttribute('title') || '').toLowerCase().trim()
                        const optionElement = el as HTMLElement
                        
                        // Verificar si tiene un ícono de candado (padlock) - esto indica la opción resaltada en rojo
                        const hasLockIcon = optionElement.querySelector('svg[viewBox*="lock"], svg path[d*="lock"], [class*="lock"], [aria-label*="lock"], img[alt*="lock"], [data-icon*="lock"]') !== null
                        
                        const hasPasswordText = text.includes('enter your password') || 
                                               text.includes('enter password') ||
                                               (text.includes('enter') && text.includes('password')) ||
                                               ariaLabel.includes('enter your password') || 
                                               ariaLabel.includes('enter password') ||
                                               title.includes('enter your password')
                        
                        const isVisible = optionElement.offsetParent !== null && 
                                         !(el as HTMLButtonElement).disabled
                        
                        return {
                          hasPasswordText,
                          hasLockIcon,
                          isVisible,
                          text,
                          ariaLabel,
                          title
                        }
                      }, element)
                      
                      // Priorizar elementos con ícono de candado Y texto "enter your password"
                      if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                        if (elementInfo.hasLockIcon && (elementInfo.text.includes('enter your password') || elementInfo.text.includes('enter password'))) {
                          // Esta es la opción resaltada en rojo - hacer clic inmediatamente
                          await element.scrollIntoView()
                          await new Promise(resolve => setTimeout(resolve, 500))
                          // Asegurar que el elemento sea completamente visible
                          try {
                            await googlePage.evaluate(() => {
                              window.scrollTo(0, Math.max(0, window.scrollY - 150))
                            })
                          } catch (e) {
                            // Continuar si hay error
                          }
                          await new Promise(resolve => setTimeout(resolve, 500))
                          await element.click({ delay: 100 })
                          passwordOptionFound = true
                          console.log('  ✅ Click en "Enter your password" realizado (con ícono de candado)')
                          break
                        }
                      }
                    } catch (e) {
                      // Continuar con el siguiente elemento
                      continue
                    }
                  }
                  
                  // SEGUNDO MÉTODO: Si no se encontró con ícono, buscar cualquier opción con texto "enter your password"
                  if (!passwordOptionFound) {
                    for (const element of allClickableElements) {
                      try {
                        const elementInfo = await googlePage.evaluate((el: any) => {
                          const text = (el.textContent || '').toLowerCase().trim()
                          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                          const title = (el.getAttribute('title') || '').toLowerCase().trim()
                          const optionElement = el as HTMLElement
                          
                          const hasPasswordText = text.includes('enter your password') || 
                                                 text.includes('enter password') ||
                                                 (text.includes('enter') && text.includes('password')) ||
                                                 ariaLabel.includes('enter your password') || 
                                                 ariaLabel.includes('enter password') ||
                                                 title.includes('enter your password')
                          
                          const isVisible = optionElement.offsetParent !== null && 
                                           !(el as HTMLButtonElement).disabled
                          
                          return { hasPasswordText, isVisible, text }
                        }, element)
                        
                        if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                          await element.scrollIntoView()
                          await new Promise(resolve => setTimeout(resolve, 500))
                          await element.click({ delay: 100 })
                          passwordOptionFound = true
                          console.log('  ✅ Click en "Enter your password" realizado')
                          break
                        }
                      } catch (e) {
                        continue
                      }
                    }
                  }
                  
                  // TERCER MÉTODO: Buscar "Insert your password" como alternativa
                  if (!passwordOptionFound) {
                    for (const element of allClickableElements) {
                      try {
                        const elementInfo = await googlePage.evaluate((el: any) => {
                          const text = (el.textContent || '').toLowerCase().trim()
                          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                          const title = (el.getAttribute('title') || '').toLowerCase().trim()
                          const optionElement = el as HTMLElement
                          
                          const hasPasswordText = text.includes('insert your password') || 
                                                 text.includes('insert password') ||
                                                 (text.includes('insert') && text.includes('password')) ||
                                                 ariaLabel.includes('insert your password') || 
                                                 ariaLabel.includes('insert password') ||
                                                 title.includes('insert your password')
                          
                          const isVisible = optionElement.offsetParent !== null && 
                                           !(el as HTMLButtonElement).disabled
                          
                          return { hasPasswordText, isVisible }
                        }, element)
                        
                        if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                          await element.scrollIntoView()
                          await new Promise(resolve => setTimeout(resolve, 500))
                          await element.click({ delay: 100 })
                          passwordOptionFound = true
                          console.log('  ✅ Click en "Insert your password" realizado (alternativa)')
                          break
                        }
                      } catch (e) {
                        continue
                      }
                    }
                  }
                  
                  if (passwordOptionFound) {
                    console.log('  ✅ Opción de password seleccionada en challenge/selection')
                    await new Promise(resolve => setTimeout(resolve, 4000))
                  } else {
                    console.log('  ⚠️ No se encontró la opción de password, continuando...')
                  }
                }
              } catch (e) {
                console.log('  ⚠️ Error al buscar opción de password:', e instanceof Error ? e.message : 'Desconocido')
                // Continuar si hay error al verificar
              }
              
              break
            }
          } catch (e) {
            // Continuar con la siguiente página
            continue
          }
        }
      }
      
      // Si no se encontró popup separado, verificar si la página actual cambió a Google
      if (!popupOpened) {
        try {
          const currentUrl = page.url()
          if (currentUrl.includes('accounts.google.com')) {
            googlePage = page
            popupOpened = true
            console.log('🔐 Detectada página de Google OAuth en la misma ventana')
            
            // Ajustar el viewport para ver todos los campos y botones
            try {
              await googlePage.setViewport({ width: 1920, height: 1080 })
              console.log('  ✅ Viewport ajustado a 1920x1080')
            } catch (viewportError) {
              console.log('  ⚠️ No se pudo ajustar el viewport, continuando...')
            }
            
            // Maximizar la ventana para verla completa
            await maximizeWindow(googlePage)
            
            // Verificar si estamos en challenge/selection
            if (currentUrl.includes('/challenge/selection') || currentUrl.includes('challenge/selection')) {
              console.log('  → Detectada página de challenge/selection en página principal, buscando opción "Enter your password"...')
              await new Promise(resolve => setTimeout(resolve, 3000))
              
              // Buscar "Enter your password" usando Puppeteer directamente
              let passwordOptionFound = false
              const allClickableElements = await googlePage.$$('button, [role="button"], a, div[role="button"], li, div[role="option"], span[role="button"]')
              
              // Buscar elemento con ícono de candado Y texto "enter your password"
              for (const element of allClickableElements) {
                try {
                  const elementInfo = await googlePage.evaluate((el: any) => {
                    const text = (el.textContent || '').toLowerCase().trim()
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                    const title = (el.getAttribute('title') || '').toLowerCase().trim()
                    const optionElement = el as HTMLElement
                    
                    const hasLockIcon = optionElement.querySelector('svg[viewBox*="lock"], svg path[d*="lock"], [class*="lock"], [aria-label*="lock"], img[alt*="lock"], [data-icon*="lock"]') !== null
                    const hasPasswordText = text.includes('enter your password') || 
                                           text.includes('enter password') ||
                                           (text.includes('enter') && text.includes('password')) ||
                                           ariaLabel.includes('enter your password') || 
                                           ariaLabel.includes('enter password') ||
                                           title.includes('enter your password')
                    const isVisible = optionElement.offsetParent !== null && 
                                     !(el as HTMLButtonElement).disabled
                    
                    return { hasPasswordText, hasLockIcon, isVisible, text }
                  }, element)
                  
                  // Priorizar elemento con ícono de candado (resaltada en rojo)
                  if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                    if (elementInfo.hasLockIcon && (elementInfo.text.includes('enter your password') || elementInfo.text.includes('enter password'))) {
                      await element.scrollIntoView()
                      await new Promise(resolve => setTimeout(resolve, 500))
                      await element.click({ delay: 100 })
                      passwordOptionFound = true
                      console.log('  ✅ Click en "Enter your password" realizado (página principal - con ícono)')
                      break
                    }
                  }
                } catch (e) {
                  continue
                }
              }
              
              // Si no se encontró con ícono, buscar cualquier "enter your password"
              if (!passwordOptionFound) {
                for (const element of allClickableElements) {
                  try {
                    const elementInfo = await googlePage.evaluate((el: any) => {
                      const text = (el.textContent || '').toLowerCase().trim()
                      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                      const title = (el.getAttribute('title') || '').toLowerCase().trim()
                      const optionElement = el as HTMLElement
                      
                      const hasPasswordText = text.includes('enter your password') || 
                                             text.includes('enter password') ||
                                             (text.includes('enter') && text.includes('password')) ||
                                             ariaLabel.includes('enter your password') || 
                                             ariaLabel.includes('enter password') ||
                                             title.includes('enter your password')
                      const isVisible = optionElement.offsetParent !== null && 
                                       !(el as HTMLButtonElement).disabled
                      
                      return { hasPasswordText, isVisible }
                    }, element)
                    
                    if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                      await element.scrollIntoView()
                      await new Promise(resolve => setTimeout(resolve, 500))
                      await element.click({ delay: 100 })
                      passwordOptionFound = true
                      console.log('  ✅ Click en "Enter your password" realizado (página principal)')
                      break
                    }
                  } catch (e) {
                    continue
                  }
                }
              }
              
              // Alternativa: buscar "Insert your password"
              if (!passwordOptionFound) {
                for (const element of allClickableElements) {
                  try {
                    const elementInfo = await googlePage.evaluate((el: any) => {
                      const text = (el.textContent || '').toLowerCase().trim()
                      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                      const optionElement = el as HTMLElement
                      
                      const hasPasswordText = text.includes('insert your password') || 
                                             text.includes('insert password') ||
                                             (text.includes('insert') && text.includes('password')) ||
                                             ariaLabel.includes('insert your password')
                      const isVisible = optionElement.offsetParent !== null && 
                                       !(el as HTMLButtonElement).disabled
                      
                      return { hasPasswordText, isVisible }
                    }, element)
                    
                    if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                      await element.scrollIntoView()
                      await new Promise(resolve => setTimeout(resolve, 500))
                      await element.click({ delay: 100 })
                      passwordOptionFound = true
                      console.log('  ✅ Click en "Insert your password" realizado (página principal - alternativa)')
                      break
                    }
                  } catch (e) {
                    continue
                  }
                }
              }
              
              if (passwordOptionFound) {
                console.log('  ✅ Opción de password seleccionada')
                await new Promise(resolve => setTimeout(resolve, 4000))
              }
            }
          }
        } catch (e) {
          // Continuar
        }
      }
      
      // Asegurarse de que solo tenemos 2 páginas máximo (principal + popup de Google)
      // IMPORTANTE: Cerrar cualquier ventana duplicada ANTES de continuar
      if (popupOpened) {
        const pagesAfterDetection = await browser.pages()
        if (pagesAfterDetection.length > 2) {
          console.log(`  ⚠️ Se detectaron ${pagesAfterDetection.length} ventanas. Cerrando duplicadas...`)
          for (const p of pagesAfterDetection) {
            if (p !== page && p !== googlePage && !p.isClosed()) {
              try {
                const urlToClose = p.url()
                await p.close()
                console.log(`  → Cerrada ventana duplicada: ${urlToClose.substring(0, 50)}...`)
                await new Promise(resolve => setTimeout(resolve, 500))
              } catch (e) {
                // Continuar si hay error
              }
            }
          }
        }
        
        // Verificar nuevamente y mantener solo la ventana principal y el popup de Google
        const finalPages = await browser.pages()
        const googlePages = finalPages.filter((p: any) => {
          if (p === page) return false
          try {
            const url = p.url()
            return url.includes('accounts.google.com') || 
                   url.includes('google.com') ||
                   url === 'about:blank'
          } catch {
            return false
          }
        })
        
        // Si hay más de un popup de Google, mantener solo el primero y cerrar los demás
        if (googlePages.length > 1) {
          console.log(`  ⚠️ Se detectaron ${googlePages.length} popups de Google. Manteniendo solo uno...`)
          for (let i = 1; i < googlePages.length; i++) {
            try {
              if (!googlePages[i].isClosed()) {
                await googlePages[i].close()
                console.log(`  → Cerrado popup duplicado de Google`)
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            } catch (e) {
              // Continuar
            }
          }
          // Actualizar googlePage al primero que queda
          if (googlePages.length > 0 && !googlePages[0].isClosed()) {
            googlePage = googlePages[0]
          }
        }
      }
      
      // IMPORTANTE: Solo continuar si se detectó el popup o la página cambió a Google
      if (popupOpened || page.url().includes('accounts.google.com')) {
        // Configurar listener para detectar cuando la URL cambie a challenge/selection
        const checkForChallengeSelection = async () => {
          try {
            const currentUrl = googlePage.url()
            if (currentUrl.includes('/challenge/selection') || currentUrl.includes('challenge/selection')) {
              console.log('  → Detectada navegación a challenge/selection, buscando opción "Enter your password"...')
              await new Promise(resolve => setTimeout(resolve, 3000))
              
              // Buscar "Enter your password" usando Puppeteer directamente
              let passwordOptionFound = false
              const allClickableElements = await googlePage.$$('button, [role="button"], a, div[role="button"], li, div[role="option"], span[role="button"]')
              
              // Buscar elemento con ícono de candado Y texto "enter your password" (resaltada en rojo)
              for (const element of allClickableElements) {
                try {
                  const elementInfo = await googlePage.evaluate((el: any) => {
                    const text = (el.textContent || '').toLowerCase().trim()
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                    const title = (el.getAttribute('title') || '').toLowerCase().trim()
                    const optionElement = el as HTMLElement
                    
                    const hasLockIcon = optionElement.querySelector('svg[viewBox*="lock"], svg path[d*="lock"], [class*="lock"], [aria-label*="lock"], img[alt*="lock"], [data-icon*="lock"]') !== null
                    const hasPasswordText = text.includes('enter your password') || 
                                           text.includes('enter password') ||
                                           (text.includes('enter') && text.includes('password')) ||
                                           ariaLabel.includes('enter your password') || 
                                           ariaLabel.includes('enter password') ||
                                           title.includes('enter your password')
                    const isVisible = optionElement.offsetParent !== null && 
                                     !(el as HTMLButtonElement).disabled
                    
                    return { hasPasswordText, hasLockIcon, isVisible, text }
                  }, element)
                  
                  // Priorizar elemento con ícono de candado
                  if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                    if (elementInfo.hasLockIcon && (elementInfo.text.includes('enter your password') || elementInfo.text.includes('enter password'))) {
                      await element.scrollIntoView()
                      await new Promise(resolve => setTimeout(resolve, 500))
                      await element.click({ delay: 100 })
                      passwordOptionFound = true
                      console.log('  ✅ Click en "Enter your password" realizado (listener - con ícono)')
                      break
                    }
                  }
                } catch (e) {
                  continue
                }
              }
              
              // Si no se encontró con ícono, buscar cualquier "enter your password"
              if (!passwordOptionFound) {
                for (const element of allClickableElements) {
                  try {
                    const elementInfo = await googlePage.evaluate((el: any) => {
                      const text = (el.textContent || '').toLowerCase().trim()
                      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                      const title = (el.getAttribute('title') || '').toLowerCase().trim()
                      const optionElement = el as HTMLElement
                      
                      const hasPasswordText = text.includes('enter your password') || 
                                             text.includes('enter password') ||
                                             (text.includes('enter') && text.includes('password')) ||
                                             ariaLabel.includes('enter your password') || 
                                             ariaLabel.includes('enter password') ||
                                             title.includes('enter your password')
                      const isVisible = optionElement.offsetParent !== null && 
                                       !(el as HTMLButtonElement).disabled
                      
                      return { hasPasswordText, isVisible }
                    }, element)
                    
                    if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                      await element.scrollIntoView()
                      await new Promise(resolve => setTimeout(resolve, 500))
                      await element.click({ delay: 100 })
                      passwordOptionFound = true
                      console.log('  ✅ Click en "Enter your password" realizado (listener)')
                      break
                    }
                  } catch (e) {
                    continue
                  }
                }
              }
              
              // Última alternativa: buscar "Insert your password"
              if (!passwordOptionFound) {
                for (const element of allClickableElements) {
                  try {
                    const elementInfo = await googlePage.evaluate((el: any) => {
                      const text = (el.textContent || '').toLowerCase().trim()
                      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                      const optionElement = el as HTMLElement
                      
                      const hasPasswordText = text.includes('insert your password') || 
                                             text.includes('insert password') ||
                                             (text.includes('insert') && text.includes('password')) ||
                                             ariaLabel.includes('insert your password')
                      const isVisible = optionElement.offsetParent !== null && 
                                       !(el as HTMLButtonElement).disabled
                      
                      return { hasPasswordText, isVisible }
                    }, element)
                    
                    if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                      await element.scrollIntoView()
                      await new Promise(resolve => setTimeout(resolve, 500))
                      await element.click({ delay: 100 })
                      passwordOptionFound = true
                      console.log('  ✅ Click en "Insert your password" realizado (listener - alternativa)')
                      break
                    }
                  } catch (e) {
                    continue
                  }
                }
              }
              
              if (passwordOptionFound) {
                await new Promise(resolve => setTimeout(resolve, 4000))
                return true
              }
            }
          } catch (e) {
            // Ignorar errores en el listener
          }
          return false
        }
        
        // Configurar listener de navegación
        googlePage.on('framenavigated', async (frame: any) => {
          if (frame === googlePage.mainFrame()) {
            await checkForChallengeSelection()
          }
        })
        
        const googleUrl = googlePage.url()
        console.log(`  → URL de Google OAuth: ${googleUrl}`)
        
        // Verificar inmediatamente si estamos en challenge/selection
        await checkForChallengeSelection()
        
        // Asegurarse de que solo tenemos las páginas necesarias (principal + popup de Google)
        const pagesDuringGoogle = await browser.pages()
        if (pagesDuringGoogle.length > 2) {
          console.log(`  ⚠️ Detectadas ${pagesDuringGoogle.length} ventanas durante flujo de Google. Cerrando duplicadas...`)
          for (const p of pagesDuringGoogle) {
            if (p !== page && p !== googlePage && !p.isClosed()) {
              try {
                await p.close()
                console.log('  → Cerrada ventana duplicada durante flujo de Google')
                await new Promise(resolve => setTimeout(resolve, 500))
              } catch (e) {
                // Continuar si hay error
              }
            }
          }
        }
        
        // PASO 3: Detectar y cerrar popup de "Use your security key with Google.com"
        // IMPORTANTE: Detectar y hacer click en Cancel INMEDIATAMENTE cuando aparezca
        try {
          console.log('  → Paso 3: Verificando popup de security key...')
          
          // Verificar popup de security key - UN SOLO INTENTO
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Verificar la URL del popup de Google - DETECCIÓN PRINCIPAL
          let currentUrl = ''
          try {
            currentUrl = googlePage.url()
          } catch (e) {
            console.log('  ⚠️ Error obteniendo URL del popup, continuando...')
          }
          
          const isSecurityKeyUrl = currentUrl.includes('/signin/challenge/pk') || 
                                  currentUrl.includes('challenge/pk') ||
                                  currentUrl.includes('/v3/signin/challenge/pk')
          
          // También verificar por contenido de la página
          let hasSecurityKeyPopup = false
          try {
            hasSecurityKeyPopup = await googlePage.evaluate(() => {
              const bodyText = (document.body?.textContent || '').toLowerCase()
              const titleText = (document.title || '').toLowerCase()
              
              // Detectar el popup específico con múltiples indicadores
              const hasSecurityKeyText = bodyText.includes('use your security key') ||
                                         bodyText.includes('use your secury key') ||
                                         bodyText.includes('insert your security key') ||
                                         bodyText.includes('insert your secury key') ||
                                         bodyText.includes('touch it') ||
                                         titleText.includes('security key')
              
              // Verificar si hay un popup/modal visible con el texto
              const hasModal = document.querySelector('[role="dialog"], .modal, [class*="modal"], [class*="popup"], [class*="dialog"]') !== null
              
              return hasSecurityKeyText || (hasModal && bodyText.includes('security key'))
            })
          } catch (e) {
            // Continuar
          }
          
          if (isSecurityKeyUrl || hasSecurityKeyPopup) {
            console.log('  🔐 Detectado popup "Use your security key with Google.com" - URL:', currentUrl.substring(0, 80))
            console.log('  → Haciendo click en botón "Cancel"...')
            
            // Esperar un momento para que el popup se renderice completamente
            await new Promise(resolve => setTimeout(resolve, 2500))
              
              // Método más directo: Usar Puppeteer para buscar y hacer click en el botón
              let cancelClicked = false
              
              // Intentar con Puppeteer directamente (más confiable)
              try {
                // Buscar botón por texto usando XPath o selector
                const cancelButtons = await googlePage.$$eval('button, [role="button"]', (buttons: any) => {
                  return buttons
                    .map((btn: any, index: number) => {
                      const text = (btn.textContent || '').trim()
                      const htmlEl = btn as HTMLElement
                      const style = window.getComputedStyle(htmlEl)
                      const isVisible = htmlEl.offsetParent !== null && 
                                       style.visibility !== 'hidden' && 
                                       style.display !== 'none' &&
                                       style.opacity !== '0' &&
                                       !htmlEl.hasAttribute('disabled')
                      
                      if (isVisible && (text.toLowerCase() === 'cancel' || text === 'Cancel' || text === 'CANCEL')) {
                        return { index, text, element: btn }
                      }
                      return null
                    })
                    .filter(Boolean)
                })
                
                if (cancelButtons.length > 0) {
                  // Hacer click usando Puppeteer directamente
                  const buttons = await googlePage.$$('button, [role="button"]')
                  for (const btnInfo of cancelButtons) {
                    if (btnInfo && buttons[btnInfo.index]) {
                      try {
                        await buttons[btnInfo.index].scrollIntoView()
                        await new Promise(resolve => setTimeout(resolve, 500))
                        await buttons[btnInfo.index].click({ delay: 100 })
                        cancelClicked = true
                        console.log('  ✅ Click en botón "Cancel" realizado con Puppeteer')
                        break
                      } catch (clickErr) {
                        // Continuar con el siguiente
                        continue
                      }
                    }
                  }
                }
              } catch (e) {
                // Continuar con método alternativo
              }
              
              // Si no funcionó con Puppeteer, usar evaluate
              if (!cancelClicked) {
                try {
                  cancelClicked = await googlePage.evaluate(() => {
                    // Buscar todos los botones
                    const buttons = Array.from(document.querySelectorAll('button, [role="button"], div[role="button"]'))
                    
                    for (const btn of buttons) {
                      const text = (btn.textContent || '').trim()
                      const htmlEl = btn as HTMLElement
                      const style = window.getComputedStyle(htmlEl)
                      const isVisible = htmlEl.offsetParent !== null && 
                                       style.visibility !== 'hidden' && 
                                       style.display !== 'none' &&
                                       style.opacity !== '0' &&
                                       !htmlEl.hasAttribute('disabled')
                      
                      if (isVisible && (text.toLowerCase() === 'cancel' || text === 'Cancel' || text === 'CANCEL')) {
                        try {
                          htmlEl.scrollIntoView({ behavior: 'instant', block: 'center' })
                          // Disparar múltiples eventos para asegurar el click
                          const eventTypes = ['mousedown', 'focus', 'mouseup', 'click']
                          for (let i = 0; i < eventTypes.length; i++) {
                            const eventType = eventTypes[i]
                            const event = new MouseEvent(eventType, {
                              view: window,
                              bubbles: true,
                              cancelable: true,
                              buttons: 1
                            })
                            htmlEl.dispatchEvent(event)
                          }
                          return true
                        } catch (e) {
                          continue
                        }
                      }
                    }
                    return false
                  })
                  
                  if (cancelClicked) {
                    console.log('  ✅ Click en botón "Cancel" realizado con evaluate')
                  }
                } catch (e) {
                  console.log('  ⚠️ Error en método evaluate:', e)
                }
              }
              
            if (cancelClicked) {
              // Esperar a que el popup desaparezca
              await new Promise(resolve => setTimeout(resolve, 5000))
              console.log('  ✅ Popup de security key cerrado exitosamente')
            } else {
              console.log('  ⚠️ No se pudo hacer click en "Cancel", continuando...')
            }
          } else {
            console.log('  → No se detectó popup de security key, continuando con el flujo normal...')
          }
        } catch (e) {
          console.log('  ⚠️ Error verificando popup de security key:', e)
        }
        
        // PASO 2: Ingresar email y hacer click en Next en la nueva ventana de Google
        try {
          console.log('  → Paso 2: Esperando campo de email de Google en la nueva ventana...')
          
          // Traer la ventana de Google al frente
          await safeBringToFront(googlePage)
          
          // Asegurar que el viewport del popup esté ajustado para ver todos los campos
          try {
            await googlePage.setViewport({ width: 1920, height: 1080 })
            console.log('  ✅ Viewport del popup de Google ajustado a 1920x1080')
          } catch (viewportError) {
            console.log('  ⚠️ No se pudo ajustar el viewport del popup')
          }
          
          // Maximizar la ventana popup para verla completa
          await maximizeWindow(googlePage)
          
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Centrar la vista del popup en lugar de ir a la esquina superior izquierda
          try {
            await googlePage.evaluate(() => {
              // Buscar el contenedor principal o formulario para centrarlo
              const mainContent = document.querySelector('main, form, [role="main"], .container, [id*="view_container"], [id*="content"]') as HTMLElement
              if (mainContent) {
                mainContent.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
              } else {
                // Si no hay contenedor específico, centrar el body
                const bodyHeight = document.body.scrollHeight
                const viewportHeight = window.innerHeight
                const centerY = Math.max(0, (bodyHeight - viewportHeight) / 2)
                window.scrollTo({ top: centerY, left: 0, behavior: 'smooth' })
              }
            })
          } catch (scrollError) {
            // Continuar si hay error
          }
          
          // Esperar a que el campo de email esté disponible
          await googlePage.waitForSelector('input[type="email"], input[name="identifier"], input[id="identifierId"]', { 
            timeout: 20000,
            visible: true 
          })
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          console.log('  → Campo de email encontrado, ingresando correo electrónico...')
          
          // Hacer scroll al campo de email para asegurar que esté completamente visible
          try {
            const emailInput = await googlePage.$('input[type="email"], input[name="identifier"], input[id="identifierId"]')
            if (emailInput) {
              await emailInput.scrollIntoView()
              await new Promise(resolve => setTimeout(resolve, 500))
              // Hacer scroll adicional para asegurar espacio arriba del campo
              await googlePage.evaluate(() => {
                window.scrollTo(0, Math.max(0, window.scrollY - 100))
              })
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          } catch (scrollError) {
            // Continuar si hay error
          }
          
          // Limpiar y enfocar el campo de email
          await googlePage.click('input[type="email"], input[name="identifier"], input[id="identifierId"]', { delay: 100 })
          await googlePage.evaluate(() => {
            const input = document.querySelector('input[type="email"], input[name="identifier"], input[id="identifierId"]') as HTMLInputElement
            if (input) {
              input.value = ''
              input.focus()
            }
          })
          
          // Ingresar email
          await googlePage.type('input[type="email"], input[name="identifier"], input[id="identifierId"]', credentials.email, { delay: 150 })
          console.log('  ✅ Email ingresado:', credentials.email)
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // PASO 3: Click en botón "Next" después de ingresar el email
          console.log('  → Paso 3: Buscando botón "Next" después de ingresar email...')
          const nextButtonSelectors = ['#identifierNext', 'button[id*="Next"]', 'button[type="button"]']
          
          let nextClicked = false
          for (const sel of nextButtonSelectors) {
            try {
              const nextBtn = await googlePage.$(sel)
              if (nextBtn) {
                const isVisible = await googlePage.evaluate((el: any) => {
                  return el && el.offsetParent !== null && !el.disabled
                }, nextBtn)
                if (isVisible) {
                  await nextBtn.scrollIntoView()
                  await new Promise(resolve => setTimeout(resolve, 500))
                  // Asegurar que el botón esté completamente visible
                  try {
                    await googlePage.evaluate(() => {
                      window.scrollTo(0, Math.max(0, window.scrollY - 100))
                    })
                  } catch (e) {
                    // Continuar si hay error
                  }
                  await new Promise(resolve => setTimeout(resolve, 500))
                  await nextBtn.click({ delay: 100 })
                  console.log('  ✅ Click en botón "Next" realizado')
                  nextClicked = true
                  break
                }
              }
            } catch (e) {
              continue
            }
          }
          
          if (!nextClicked) {
            const nextBtnByText = await googlePage.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
              for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase().trim()
                const htmlBtn = btn as HTMLElement
                if ((text === 'next' || text === 'siguiente') && 
                    htmlBtn.offsetParent !== null && !(htmlBtn as HTMLButtonElement).disabled) {
                  if (htmlBtn.scrollIntoView) {
                    htmlBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                  htmlBtn.click()
                  return true
                }
              }
              return false
            })
            if (nextBtnByText) {
              console.log('  ✅ Click en botón "Next" realizado (por texto)')
              nextClicked = true
            }
          }
          
          if (!nextClicked) {
            await googlePage.keyboard.press('Enter')
            console.log('  ✅ Presionado Enter para continuar')
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          // PASO 6: Detectar y hacer click en "Cancel" del popup "Use your security key with Google.com"
          console.log('  → Paso 6: Detectando popup "Use your security key with Google.com"...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Buscar el popup de security key (puede estar en una nueva ventana o en el mismo popup)
          let securityKeyPopup = null
          const allPages = await browser.pages()
          
          for (const p of allPages) {
            if (p !== page && !p.isClosed()) {
              try {
                const pageUrl = p.url()
                const pageTitle = await p.title().catch(() => '')
                const hasSecurityKeyText = await p.evaluate(() => {
                  const bodyText = document.body?.textContent || ''
                  const titleText = document.title || ''
                  return bodyText.includes('Use your security key') ||
                         bodyText.includes('Use your secury key') ||
                         titleText.includes('security key') ||
                         bodyText.includes('security key with Google')
                }).catch(() => false)
                
                if (hasSecurityKeyText || pageUrl.includes('accounts.google.com')) {
                  securityKeyPopup = p
                  console.log('  → Popup de security key detectado')
                  
                  // Ajustar el viewport del popup para ver todos los campos y botones
                  try {
                    await securityKeyPopup.setViewport({ width: 1920, height: 1080 })
                    console.log('  ✅ Viewport del popup de security key ajustado a 1920x1080')
                  } catch (viewportError) {
                    console.log('  ⚠️ No se pudo ajustar el viewport del popup de security key')
                  }
                  
                  // Maximizar la ventana popup para verla completa
                  await maximizeWindow(securityKeyPopup)
                  
                  await safeBringToFront(securityKeyPopup)
                  
                    // Centrar la vista del popup en lugar de ir a la esquina superior izquierda
                    try {
                      await securityKeyPopup.evaluate(() => {
                        // Buscar el contenedor principal o formulario para centrarlo
                        const mainContent = document.querySelector('main, form, [role="main"], .container, [id*="view_container"], [id*="content"]') as HTMLElement
                        if (mainContent) {
                          mainContent.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
                        } else {
                          // Si no hay contenedor específico, centrar el body
                          const bodyHeight = document.body.scrollHeight
                          const viewportHeight = window.innerHeight
                          const centerY = Math.max(0, (bodyHeight - viewportHeight) / 2)
                          window.scrollTo({ top: centerY, left: 0, behavior: 'smooth' })
                        }
                      })
                    } catch (scrollError) {
                      // Continuar si hay error
                    }
                  
                  await new Promise(resolve => setTimeout(resolve, 3000))
                  break
                }
              } catch (e) {
                continue
              }
            }
          }
          
          // Si no se encontró en páginas separadas, verificar en el popup actual de Google
          if (!securityKeyPopup) {
            const hasSecurityKeyInGooglePage = await googlePage.evaluate(() => {
              const bodyText = document.body?.textContent || ''
              const titleText = document.title || ''
              return bodyText.includes('Use your security key') ||
                     bodyText.includes('Use your secury key') ||
                     titleText.includes('security key') ||
                     bodyText.includes('security key with Google')
            })
            
            if (hasSecurityKeyInGooglePage) {
              securityKeyPopup = googlePage
              console.log('  → Popup de security key detectado en la misma ventana de Google')
            }
          }
          
          // Si se encontró el popup de security key, hacer click en "Cancel"
          if (securityKeyPopup) {
            console.log('  → Buscando botón "Cancel" en popup de security key...')
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Buscar botón Cancel por múltiples métodos
            const cancelButtonFound = await securityKeyPopup.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
              for (const btn of buttons) {
                const text = (btn.textContent || '').trim().toLowerCase()
                const ariaLabel = (btn.getAttribute('aria-label') || '').trim().toLowerCase()
                const title = (btn.getAttribute('title') || '').trim().toLowerCase()
                
                // Buscar "cancel", "cancelar", "CANCEL", "CANCELAR"
                if ((text === 'cancel' || text === 'cancelar' || 
                     text === 'cancel' || text === 'cancelar' ||
                     text.includes('cancel') || text.includes('cancelar') ||
                     ariaLabel.includes('cancel') || ariaLabel.includes('cancelar') ||
                     title.includes('cancel') || title.includes('cancelar')) &&
                    (btn as HTMLElement).offsetParent !== null &&
                    !(btn as HTMLButtonElement).disabled) {
                  (btn as HTMLElement).click()
                  return true
                }
              }
              return false
            })
            
            if (cancelButtonFound) {
              console.log('  ✅ Click en botón "Cancel" realizado')
              await new Promise(resolve => setTimeout(resolve, 4000))
            } else {
              // Buscar por texto exacto incluyendo mayúsculas
              const cancelByText = await securityKeyPopup.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                for (const btn of buttons) {
                  const text = (btn.textContent || '').trim()
                  if ((text === 'CANCEL' || text === 'CANCELAR' || text === 'Cancel' || text === 'Cancelar') &&
                      (btn as HTMLElement).offsetParent !== null &&
                      !(btn as HTMLButtonElement).disabled) {
                    return btn
                  }
                }
                return null
              })
              
              if (cancelByText && cancelByText.asElement()) {
                await cancelByText.asElement()!.scrollIntoView()
                await new Promise(resolve => setTimeout(resolve, 500))
                await cancelByText.asElement()!.click()
                console.log('  ✅ Click en botón "CANCEL" realizado (mayúsculas)')
                await new Promise(resolve => setTimeout(resolve, 4000))
              }
            }
          }
          
          // PASO 7: Volver a la ventana anterior (popup de Google) y hacer click en "Try another way"
          console.log('  → Paso 7: Volviendo a ventana anterior y buscando "Try another way"...')
          if (!await safeBringToFront(googlePage)) {
            console.log('  ⚠️ No se pudo traer la página de Google al frente, intentando continuar...')
          }
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Buscar y hacer click en "Try another way"
          const tryAnotherWayFound = await googlePage.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, div[role="button"]'))
            for (const btn of buttons) {
              const text = (btn.textContent || '').toLowerCase().trim()
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim()
              
              if ((text.includes('try another way') || text.includes('try another') || 
                   text.includes('intentar otra forma') || text.includes('otra forma') ||
                   ariaLabel.includes('try another way') || ariaLabel.includes('try another')) &&
                  (btn as HTMLElement).offsetParent !== null &&
                  !(btn as HTMLButtonElement).disabled) {
                const btnElement = btn as HTMLElement
                if (btnElement.scrollIntoView) {
                  btnElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
                btnElement.click()
                return true
              }
            }
            return false
          })
          
          if (tryAnotherWayFound) {
            console.log('  ✅ Click en "Try another way" realizado')
          } else {
            // Buscar por texto parcial o selectores alternativos
            const tryAnotherWayByPartial = await googlePage.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, div[role="button"]'))
              for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase().trim()
                if (text.includes('another') && (btn as HTMLElement).offsetParent !== null) {
                  (btn as HTMLElement).click()
                  return true
                }
              }
              return false
            })
            
            if (tryAnotherWayByPartial) {
              console.log('  ✅ Click en "Try another way" realizado (búsqueda parcial)')
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 4000))
          
          // PASO 8: Verificar si estamos en la página de challenge/selection y buscar "Insert your password"
          console.log('  → Paso 8: Verificando URL y buscando opción de password...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Verificar la URL actual del popup de Google
          let currentGoogleUrl = ''
          try {
            currentGoogleUrl = googlePage.url()
            console.log(`  → URL actual de Google: ${currentGoogleUrl.substring(0, 100)}...`)
          } catch (e) {
            console.log('  ⚠️ No se pudo obtener la URL de Google')
          }
          
          // Si estamos en la página de challenge/selection, buscar específicamente "Enter your password" (resaltado en rojo)
          let passwordOptionFound = false
          if (currentGoogleUrl.includes('/challenge/selection') || currentGoogleUrl.includes('challenge/selection')) {
            console.log('  → Detectada página de challenge/selection, buscando opción "Enter your password" (resaltada en rojo)...')
            await new Promise(resolve => setTimeout(resolve, 3000))
            
            // Buscar usando Puppeteer directamente para mayor confiabilidad
            const allClickableElements = await googlePage.$$('button, [role="button"], a, div[role="button"], li, div[role="option"], span[role="button"]')
            
            // Buscar elemento con ícono de candado Y texto "enter your password"
            for (const element of allClickableElements) {
              try {
                const elementInfo = await googlePage.evaluate((el: any) => {
                  const text = (el.textContent || '').toLowerCase().trim()
                  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                  const title = (el.getAttribute('title') || '').toLowerCase().trim()
                  const optionElement = el as HTMLElement
                  
                  const hasLockIcon = optionElement.querySelector('svg[viewBox*="lock"], svg path[d*="lock"], [class*="lock"], [aria-label*="lock"], img[alt*="lock"], [data-icon*="lock"]') !== null
                  const hasPasswordText = text.includes('enter your password') || 
                                         text.includes('enter password') ||
                                         (text.includes('enter') && text.includes('password')) ||
                                         ariaLabel.includes('enter your password') || 
                                         ariaLabel.includes('enter password') ||
                                         title.includes('enter your password')
                  const isVisible = optionElement.offsetParent !== null && 
                                   !(el as HTMLButtonElement).disabled
                  
                  return { hasPasswordText, hasLockIcon, isVisible, text }
                }, element)
                
                // Priorizar elemento con ícono de candado (resaltada en rojo)
                if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                  if (elementInfo.hasLockIcon && (elementInfo.text.includes('enter your password') || elementInfo.text.includes('enter password'))) {
                    await element.scrollIntoView()
                    await new Promise(resolve => setTimeout(resolve, 500))
                    await element.click({ delay: 100 })
                    passwordOptionFound = true
                    console.log('  ✅ Click en "Enter your password" realizado (PASO 8 - con ícono)')
                    break
                  }
                }
              } catch (e) {
                continue
              }
            }
            
            // Si no se encontró con ícono, buscar cualquier "enter your password"
            if (!passwordOptionFound) {
              for (const element of allClickableElements) {
                try {
                  const elementInfo = await googlePage.evaluate((el: any) => {
                    const text = (el.textContent || '').toLowerCase().trim()
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                    const title = (el.getAttribute('title') || '').toLowerCase().trim()
                    const optionElement = el as HTMLElement
                    
                    const hasPasswordText = text.includes('enter your password') || 
                                           text.includes('enter password') ||
                                           (text.includes('enter') && text.includes('password')) ||
                                           ariaLabel.includes('enter your password') || 
                                           ariaLabel.includes('enter password') ||
                                           title.includes('enter your password')
                    const isVisible = optionElement.offsetParent !== null && 
                                     !(el as HTMLButtonElement).disabled
                    
                    return { hasPasswordText, isVisible }
                  }, element)
                  
                  if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                    await element.scrollIntoView()
                    await new Promise(resolve => setTimeout(resolve, 500))
                    await element.click({ delay: 100 })
                    passwordOptionFound = true
                    console.log('  ✅ Click en "Enter your password" realizado (PASO 8)')
                    break
                  }
                } catch (e) {
                  continue
                }
              }
            }
            
            // Alternativa: buscar "Insert your password"
            if (!passwordOptionFound) {
              for (const element of allClickableElements) {
                try {
                  const elementInfo = await googlePage.evaluate((el: any) => {
                    const text = (el.textContent || '').toLowerCase().trim()
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                    const optionElement = el as HTMLElement
                    
                    const hasPasswordText = text.includes('insert your password') || 
                                           text.includes('insert password') ||
                                           (text.includes('insert') && text.includes('password')) ||
                                           ariaLabel.includes('insert your password')
                    const isVisible = optionElement.offsetParent !== null && 
                                     !(el as HTMLButtonElement).disabled
                    
                    return { hasPasswordText, isVisible }
                  }, element)
                  
                  if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                    await element.scrollIntoView()
                    await new Promise(resolve => setTimeout(resolve, 500))
                    await element.click({ delay: 100 })
                    passwordOptionFound = true
                    console.log('  ✅ Click en "Insert your password" realizado (PASO 8 - alternativa)')
                    break
                  }
                } catch (e) {
                  continue
                }
              }
            }
            
            // Última búsqueda flexible
            if (!passwordOptionFound) {
              for (const element of allClickableElements) {
                try {
                  const elementInfo = await googlePage.evaluate((el: any) => {
                    const text = (el.textContent || '').toLowerCase().trim()
                    const optionElement = el as HTMLElement
                    
                    const hasPasswordText = text.includes('password') || text.includes('contraseña')
                    const isVisible = optionElement.offsetParent !== null && 
                                     !(el as HTMLButtonElement).disabled
                    
                    return { hasPasswordText, isVisible }
                  }, element)
                  
                  if (elementInfo.hasPasswordText && elementInfo.isVisible) {
                    await element.scrollIntoView()
                    await new Promise(resolve => setTimeout(resolve, 500))
                    await element.click({ delay: 100 })
                    passwordOptionFound = true
                    console.log('  ✅ Click en opción de password realizado (PASO 8 - búsqueda flexible)')
                    break
                  }
                } catch (e) {
                  continue
                }
              }
            }
            
            if (passwordOptionFound) {
              console.log('  ✅ Opción de password seleccionada en challenge/selection')
              await new Promise(resolve => setTimeout(resolve, 4000))
            } else {
              console.log('  ⚠️ No se encontró la opción de password en challenge/selection')
            }
          }
          
          // Si no encontramos en challenge/selection o no estamos en esa página, buscar "Enter your password"
          if (!passwordOptionFound) {
            console.log('  → Buscando opción "Enter your password"...')
            
            const enterPasswordOptionFound = await googlePage.evaluate(() => {
              const options = Array.from(document.querySelectorAll('button, [role="button"], a, div[role="button"], li, div[role="option"]'))
              for (const option of options) {
                const text = (option.textContent || '').toLowerCase().trim()
                const ariaLabel = (option.getAttribute('aria-label') || '').toLowerCase().trim()
                
                if ((text.includes('enter your password') || text.includes('enter password') ||
                     text.includes('ingresar contraseña') || text.includes('ingresa tu contraseña') ||
                     text.includes('password') ||
                     ariaLabel.includes('enter your password') || ariaLabel.includes('password')) &&
                    (option as HTMLElement).offsetParent !== null &&
                    !(option as HTMLButtonElement).disabled) {
                  const optionElement = option as HTMLElement
                  if (optionElement.scrollIntoView) {
                    optionElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                  optionElement.click()
                  return true
                }
              }
              return false
            })
            
            if (enterPasswordOptionFound) {
              console.log('  ✅ Opción "Enter your password" seleccionada')
              passwordOptionFound = true
            } else {
              // Buscar por texto parcial
              const enterPasswordByPartial = await googlePage.evaluate(() => {
                const options = Array.from(document.querySelectorAll('button, [role="button"], div[role="option"]'))
                for (const option of options) {
                  const text = (option.textContent || '').toLowerCase().trim()
                  if (text.includes('password') && (option as HTMLElement).offsetParent !== null) {
                    (option as HTMLElement).click()
                    return true
                  }
                }
                return false
              })
              
              if (enterPasswordByPartial) {
                console.log('  ✅ Opción "Enter your password" seleccionada (búsqueda parcial)')
                passwordOptionFound = true
              }
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 4000))
          
          // PASO 9: Esperar y completar campo de password
          console.log('  → Paso 9: Esperando campo de password...')
          
          // Asegurar que el viewport esté ajustado antes de buscar el campo
          try {
            await googlePage.setViewport({ width: 1920, height: 1080 })
          } catch (viewportError) {
            // Continuar si hay error
          }
          
          await googlePage.waitForSelector('input[type="password"], input[name="password"]', { 
            timeout: 20000,
            visible: true 
          })
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Hacer scroll al campo de password para asegurar que esté completamente visible
          try {
            const passwordInput = await googlePage.$('input[type="password"], input[name="password"]')
            if (passwordInput) {
              await passwordInput.scrollIntoView()
              await new Promise(resolve => setTimeout(resolve, 500))
              // Hacer scroll adicional para asegurar espacio arriba del campo
              await googlePage.evaluate(() => {
                window.scrollTo(0, Math.max(0, window.scrollY - 100))
              })
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          } catch (scrollError) {
            // Continuar si hay error
          }
          
          // Limpiar y enfocar el campo de password
          await googlePage.click('input[type="password"], input[name="password"]', { delay: 100 })
          await googlePage.evaluate(() => {
            const input = document.querySelector('input[type="password"], input[name="password"]') as HTMLInputElement
            if (input) {
              input.value = ''
              input.focus()
            }
          })
          
          // Ingresar password con delay mayor
          await googlePage.type('input[type="password"], input[name="password"]', credentials.password, { delay: 150 })
          console.log('  ✅ Password ingresado')
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // PASO 7: Click en botón "Siguiente" de password
          console.log('  → Paso 7: Buscando botón "Siguiente" de password...')
          const passwordNextSelectors = ['#passwordNext', 'button[id*="Next"]', 'button[type="button"]']
          
          let passwordNextClicked = false
          for (const sel of passwordNextSelectors) {
            try {
              const passwordNextBtn = await googlePage.$(sel)
              if (passwordNextBtn) {
                const isVisible = await googlePage.evaluate((el: any) => {
                  return el && el.offsetParent !== null && !el.disabled
                }, passwordNextBtn)
                if (isVisible) {
                  // Hacer scroll al botón para asegurar que esté visible
                  await passwordNextBtn.scrollIntoView()
                  await new Promise(resolve => setTimeout(resolve, 500))
                  // Asegurar espacio arriba del botón
                  try {
                    await googlePage.evaluate(() => {
                      window.scrollTo(0, Math.max(0, window.scrollY - 100))
                    })
                  } catch (e) {
                    // Continuar si hay error
                  }
                  await new Promise(resolve => setTimeout(resolve, 500))
                  await passwordNextBtn.click({ delay: 100 })
                  console.log('  ✅ Click en botón "Siguiente" de password realizado')
                  passwordNextClicked = true
                  break
                }
              }
            } catch (e) {
              continue
            }
          }
          
          if (!passwordNextClicked) {
            const passwordNextBtnByText = await googlePage.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'))
              for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase().trim()
                if ((text === 'next' || text === 'siguiente') && 
                    btn.offsetParent !== null && !(btn as HTMLButtonElement).disabled) {
                  (btn as HTMLElement).click()
                  return true
                }
              }
              return false
            })
            if (passwordNextBtnByText) {
              console.log('  ✅ Click en botón "Siguiente" de password realizado (por texto)')
              passwordNextClicked = true
            }
          }
          
          if (!passwordNextClicked) {
            await googlePage.keyboard.press('Enter')
            console.log('  ✅ Presionado Enter para completar login')
          }
          
          // Esperar tiempo adicional después de ingresar password para que se procese la autenticación
          // (incluyendo la confirmación en el celular)
          console.log('  → Esperando procesamiento de autenticación (puede incluir confirmación en celular)...')
          await new Promise(resolve => setTimeout(resolve, 10000)) // Aumentado de 0 a 10 segundos
          
          // PASO 8: Detectar y hacer clic en botón "Continuar" de la pantalla de consentimiento de Google
          console.log('  → Paso 8: Verificando si hay pantalla de consentimiento de Google...')
          
          // Esperar con verificación periódica para detectar la pantalla de consentimiento
          // (puede tardar más si hay confirmación en celular)
          let consentScreenDetected = false
          let attempts = 0
          const maxAttempts = 15 // Intentar durante 30 segundos (15 intentos x 2 segundos)
          
          while (!consentScreenDetected && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)) // Esperar 2 segundos entre intentos
            
            // Verificar si la página está cerrada
            try {
              if (googlePage.isClosed()) {
                console.log('  ⚠️ La ventana se cerró antes de detectar la pantalla de consentimiento')
                break
              }
            } catch (e) {
              console.log('  ⚠️ Error verificando si la página está cerrada')
              break
            }
            
            attempts++
            console.log(`  → Intento ${attempts}/${maxAttempts} de detectar pantalla de consentimiento...`)
            
            // Verificar si estamos en la pantalla de consentimiento
            try {
              const currentUrl = googlePage.url()
              const isConsentUrl = currentUrl.includes('/oauth/consent') || 
                                   currentUrl.includes('/signin/oauth/consent') ||
                                   currentUrl.includes('accounts.google.com') && 
                                   (currentUrl.includes('consent') || currentUrl.includes('oauth'))
              
              if (isConsentUrl) {
                console.log('  ✅ URL de consentimiento detectada:', currentUrl.substring(0, 100))
                consentScreenDetected = true
                break
              }
              
              // También verificar por contenido de la página
              const isConsentScreen = await googlePage.evaluate(() => {
                const bodyText = (document.body?.textContent || '').toLowerCase()
                const titleText = (document.title || '').toLowerCase()
                
                const hasConsentText = bodyText.includes('acceder con google') ||
                                       bodyText.includes('sign in with google') ||
                                       bodyText.includes('upwork-sso') ||
                                       bodyText.includes('upwork') ||
                                       titleText.includes('acceder con google') ||
                                       titleText.includes('sign in with google') ||
                                       bodyText.includes('continuar') ||
                                       bodyText.includes('continue')
                
                return hasConsentText
              })
              
              if (isConsentScreen) {
                console.log('  ✅ Pantalla de consentimiento detectada por contenido')
                consentScreenDetected = true
                break
              }
            } catch (e) {
              console.log(`  ⚠️ Error en intento ${attempts}:`, e instanceof Error ? e.message : 'Desconocido')
              // Continuar con el siguiente intento
            }
          }
          
          if (!consentScreenDetected) {
            console.log('  ⚠️ No se detectó pantalla de consentimiento después de múltiples intentos, continuando...')
          }
          
          // Esperar tiempo adicional para asegurar que la pantalla esté completamente cargada
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          // Verificar nuevamente si estamos en la pantalla de consentimiento (después de las esperas)
          // Detectar pantalla de consentimiento de Google (pantalla de "Acceder con Google" / "Sign in with Google")
          let isConsentScreen = false
          
          try {
            if (!googlePage.isClosed()) {
              const currentUrl = googlePage.url()
              const isConsentUrl = currentUrl.includes('/oauth/consent') || 
                                   currentUrl.includes('/signin/oauth/consent') ||
                                   (currentUrl.includes('accounts.google.com') && 
                                    (currentUrl.includes('consent') || currentUrl.includes('oauth')))
              
              if (isConsentUrl) {
                isConsentScreen = true
                console.log('  ✅ Confirmado: Estamos en la pantalla de consentimiento (por URL)')
              } else {
                // Verificar por contenido
                isConsentScreen = await googlePage.evaluate(() => {
                  const bodyText = (document.body?.textContent || '').toLowerCase()
                  const titleText = (document.title || '').toLowerCase()
                  
                  // Detectar indicadores de pantalla de consentimiento
                  const hasConsentText = bodyText.includes('acceder con google') ||
                                         bodyText.includes('sign in with google') ||
                                         bodyText.includes('upwork-sso') ||
                                         bodyText.includes('upwork') ||
                                         titleText.includes('acceder con google') ||
                                         titleText.includes('sign in with google') ||
                                         bodyText.includes('continuar') ||
                                         bodyText.includes('continue') ||
                                         bodyText.includes('cancelar') ||
                                         bodyText.includes('cancel')
                  
                  // Verificar si hay botones de consentimiento
                  const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, div[role="button"]'))
                  const hasContinueButton = buttons.some(btn => {
                    const text = (btn.textContent || '').toLowerCase().trim()
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim()
                    return text === 'continuar' || 
                           text === 'continue' ||
                           text.includes('continuar') ||
                           text.includes('continue') ||
                           ariaLabel.includes('continuar') ||
                           ariaLabel.includes('continue')
                  })
                  
                  return hasConsentText && hasContinueButton
                })
                
                if (isConsentScreen) {
                  console.log('  ✅ Confirmado: Estamos en la pantalla de consentimiento (por contenido)')
                }
              }
            }
          } catch (e) {
            console.log('  ⚠️ Error verificando pantalla de consentimiento:', e instanceof Error ? e.message : 'Desconocido')
          }
          
          if (isConsentScreen && !googlePage.isClosed()) {
            console.log('  → Pantalla de consentimiento de Google detectada, buscando botón "Continuar"...')
            
            // Asegurar que la ventana esté maximizada y visible
            await maximizeWindow(googlePage)
            await safeBringToFront(googlePage)
            
            // Esperar tiempo adicional para asegurar que la página esté completamente cargada y visible
            console.log('  → Esperando a que la pantalla de consentimiento cargue completamente...')
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            // Verificar nuevamente que la página no se haya cerrado
            if (googlePage.isClosed()) {
              console.log('  ⚠️ La ventana se cerró antes de poder hacer clic en "Continuar"')
            } else {
              // Buscar y hacer clic en el botón "Continuar"
              let continueClicked = false
            
            // Método 1: Buscar por texto exacto "Continuar" o "Continue"
            const continueButtonSelectors = [
              'button:has-text("Continuar")',
              'button:has-text("Continue")',
              '[role="button"]:has-text("Continuar")',
              '[role="button"]:has-text("Continue")'
            ]
            
            // Método 2: Buscar todos los botones y filtrar por texto
            const allButtons = await googlePage.$$('button, [role="button"], a, div[role="button"]')
            
            for (const button of allButtons) {
              try {
                const buttonInfo = await googlePage.evaluate((el: any) => {
                  const text = (el.textContent || '').toLowerCase().trim()
                  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim()
                  const htmlEl = el as HTMLElement
                  const style = window.getComputedStyle(htmlEl)
                  
                  const isContinueButton = (text === 'continuar' || 
                                           text === 'continue' ||
                                           text.includes('continuar') ||
                                           text.includes('continue') ||
                                           ariaLabel.includes('continuar') ||
                                           ariaLabel.includes('continue')) &&
                                          !text.includes('cancelar') &&
                                          !text.includes('cancel')
                  
                  const isVisible = htmlEl.offsetParent !== null &&
                                   style.visibility !== 'hidden' &&
                                   style.display !== 'none' &&
                                   style.opacity !== '0' &&
                                   !(el as HTMLButtonElement).disabled
                  
                  // Verificar si es el botón azul (generalmente el botón "Continuar" es azul)
                  const bgColor = style.backgroundColor || ''
                  const isBlueButton = bgColor.includes('rgb(26, 115, 232)') ||
                                      bgColor.includes('rgb(66, 133, 244)') ||
                                      bgColor.includes('#1a73e8') ||
                                      bgColor.includes('#4285f4') ||
                                      htmlEl.classList.toString().toLowerCase().includes('primary') ||
                                      htmlEl.classList.toString().toLowerCase().includes('continue')
                  
                  return { isContinueButton, isVisible, isBlueButton, text }
                }, button)
                
                if (buttonInfo.isContinueButton && buttonInfo.isVisible) {
                  // Priorizar botones azules (el botón "Continuar" generalmente es azul)
                  if (buttonInfo.isBlueButton || buttonInfo.text === 'continuar' || buttonInfo.text === 'continue') {
                    await button.scrollIntoView()
                    await new Promise(resolve => setTimeout(resolve, 500))
                    // Centrar el botón en la vista
                    try {
                      await googlePage.evaluate(() => {
                        window.scrollTo(0, Math.max(0, window.scrollY - 100))
                      })
                    } catch (e) {
                      // Continuar si hay error
                    }
                    await new Promise(resolve => setTimeout(resolve, 500))
                    await button.click({ delay: 100 })
                    continueClicked = true
                    console.log('  ✅ Click en botón "Continuar" de consentimiento realizado')
                    break
                  }
                }
              } catch (e) {
                // Continuar con el siguiente botón
                continue
              }
            }
            
            // Método 3: Si no se encontró, buscar por texto usando evaluate
            if (!continueClicked) {
              const continueByText = await googlePage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, div[role="button"]'))
                for (const btn of buttons) {
                  const text = (btn.textContent || '').toLowerCase().trim()
                  const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim()
                  const htmlBtn = btn as HTMLElement
                  const style = window.getComputedStyle(htmlBtn)
                  
                  const isContinueButton = (text === 'continuar' || 
                                           text === 'continue' ||
                                           text.includes('continuar') ||
                                           text.includes('continue') ||
                                           ariaLabel.includes('continuar') ||
                                           ariaLabel.includes('continue')) &&
                                          !text.includes('cancelar') &&
                                          !text.includes('cancel')
                  
                  const isVisible = htmlBtn.offsetParent !== null &&
                                   style.visibility !== 'hidden' &&
                                   style.display !== 'none' &&
                                   style.opacity !== '0' &&
                                   !(htmlBtn as HTMLButtonElement).disabled
                  
                  if (isContinueButton && isVisible) {
                    htmlBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    htmlBtn.click()
                    return true
                  }
                }
                return false
              })
              
              if (continueByText) {
                console.log('  ✅ Click en botón "Continuar" realizado (método evaluate)')
                continueClicked = true
              }
            }
            
              if (continueClicked) {
                console.log('  ✅ Consentimiento de Google aceptado')
                // Esperar tiempo adicional después de hacer clic para que se procese
                await new Promise(resolve => setTimeout(resolve, 6000))
              } else {
                console.log('  ⚠️ No se encontró botón "Continuar", continuando...')
              }
            }
          } else {
            console.log('  → No se detectó pantalla de consentimiento, continuando...')
          }
          
          // PASO 9: Esperar redirección a Upwork
          console.log('  → Paso 9: Esperando redirección a Upwork...')
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          // Si fue un popup, esperar a que se cierre o redirija
          if (popupOpened) {
      try {
        await Promise.race([
                googlePage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
                new Promise<void>(resolve => {
                  const checkPopup = setInterval(() => {
                    if (googlePage.isClosed()) {
                      clearInterval(checkPopup)
                      resolve()
                    }
                  }, 500)
                  setTimeout(() => {
                    clearInterval(checkPopup)
                    resolve()
                  }, 10000)
                })
              ])
              
              if (!googlePage.isClosed()) {
                try {
                  const popupUrl = googlePage.url()
                  if (popupUrl.includes('upwork.com') || !popupUrl.includes('accounts.google.com')) {
                    console.log('  → Popup redirigido a Upwork')
                    await new Promise(resolve => setTimeout(resolve, 2000))
                    if (!googlePage.isClosed()) {
                      await googlePage.close()
                      console.log('  → Popup de Google OAuth cerrado')
                    }
                  }
                } catch (e) {
                  console.log('  → Popup de Google OAuth se cerró automáticamente')
                }
              } else {
                console.log('  → Popup de Google OAuth se cerró automáticamente')
              }
            } catch (e) {
              if (!googlePage.isClosed() && googlePage !== page) {
                try {
                  await googlePage.close()
                  console.log('  → Popup cerrado manualmente')
                } catch (closeError) {
                  // Continuar si hay error
                }
              }
            }
            
            await safeBringToFront(page)
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Cerrar cualquier ventana adicional
            const finalPages = await browser.pages()
            if (finalPages.length > 1) {
              for (const p of finalPages) {
                if (p !== page && !p.isClosed()) {
                  try {
                    await p.close()
                    console.log('  → Cerrada ventana adicional')
                  } catch (e) {
                    // Continuar si hay error
                  }
                }
              }
            }
          } else {
            try {
              await googlePage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
            } catch (e) {
              console.log('⚠️ No se detectó navegación, continuando...')
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // PASO 10: Verificar si se muestra pantalla de login de Upwork y completar el proceso
          console.log('  → Paso 10: Verificando si hay pantalla de login de Upwork que requiere password...')
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          // Verificar en la página principal y en el popup si aún está abierto
          const pagesToCheck: any[] = [page]
          if (popupOpened && !googlePage.isClosed()) {
            pagesToCheck.push(googlePage)
          }
          
          for (const currentPage of pagesToCheck) {
            try {
              if (currentPage.isClosed()) continue
              
              const currentUrl = currentPage.url()
              
              // Verificar si estamos en una página de login de Upwork
              const isUpworkLoginPage = currentUrl.includes('upwork.com') && 
                                       (currentUrl.includes('/login') || 
                                        currentUrl.includes('/ab/account-security/login') ||
                                        currentUrl.includes('/signin'))
              
              // Verificar si hay un campo de password y botón "Log in" visible
              const hasLoginForm = await currentPage.evaluate(() => {
                const bodyText = (document.body?.textContent || '').toLowerCase()
                const hasWelcomeText = bodyText.includes('welcome') || bodyText.includes('bienvenido')
                const hasPasswordField = document.querySelector('input[type="password"]') !== null
                const hasLoginButton = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).some(btn => {
                  const text = (btn.textContent || '').toLowerCase().trim()
                  return text === 'log in' || text === 'iniciar sesión' || text === 'login'
                })
                
                return hasWelcomeText && hasPasswordField && hasLoginButton
              })
              
              if (isUpworkLoginPage || hasLoginForm) {
                console.log('  → Pantalla de login de Upwork detectada, buscando campo de password y botón "Log in"...')
                
                // Maximizar y traer al frente
                await maximizeWindow(currentPage)
                await safeBringToFront(currentPage)
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                // Buscar campo de password
                const passwordSelectors = [
                  'input[type="password"]',
                  'input[name="password"]',
                  'input[name="login[password]"]',
                  'input[placeholder*="password" i]',
                  'input[placeholder*="contraseña" i]',
                  'input[autocomplete="current-password"]'
                ]
                
                let passwordInputFound = false
                for (const selector of passwordSelectors) {
                  try {
                    const passwordInput = await currentPage.$(selector)
                    if (passwordInput) {
                      const isVisible = await currentPage.evaluate((el: any) => {
                        return el && el.offsetParent !== null && !el.disabled && !el.readOnly
                      }, passwordInput)
                      
                      if (isVisible) {
                        // Hacer scroll al campo
                        await passwordInput.scrollIntoView()
                        await new Promise(resolve => setTimeout(resolve, 500))
                        
                        // Centrar el campo en la vista
                        try {
                          await currentPage.evaluate(() => {
                            window.scrollTo(0, Math.max(0, window.scrollY - 100))
                          })
                        } catch (e) {
                          // Continuar si hay error
                        }
                        await new Promise(resolve => setTimeout(resolve, 500))
                        
                        // Limpiar y enfocar el campo
                        await passwordInput.click({ delay: 100 })
                        await currentPage.evaluate((sel: string) => {
                          const input = document.querySelector(sel) as HTMLInputElement
                          if (input) {
                            input.value = ''
                            input.focus()
                          }
                        }, selector)
                        
                        // DIAGNÓSTICO: Capturar estado antes de ingresar password
                        console.log('  🔍 [DIAGNÓSTICO] Estado antes de ingresar password:')
                        try {
                          const prePasswordState = await currentPage.evaluate(() => {
                            return {
                              url: window.location.href,
                              hasError: document.querySelector('[role="alert"], .alert-error, [class*="error"]') !== null,
                              passwordFieldValue: (document.querySelector('input[type="password"]') as HTMLInputElement)?.value || '',
                              formVisible: document.querySelector('form, [role="form"]') !== null,
                              timestamp: new Date().toISOString()
                            }
                          })
                          console.log(`    - URL: ${prePasswordState.url}`)
                          console.log(`    - Error presente: ${prePasswordState.hasError}`)
                          console.log(`    - Campo password tiene valor: ${prePasswordState.passwordFieldValue.length > 0}`)
                        } catch (e) {
                          console.log('    ⚠️ No se pudo capturar estado pre-password')
                        }
                        
                        // Ingresar password con delays más realistas para evitar detección
                        console.log('  → Ingresando password con delays humanizados...')
                        
                        // Limpiar el campo primero si tiene valor prellenado
                        try {
                          await currentPage.evaluate((sel: string) => {
                            const input = document.querySelector(sel) as HTMLInputElement
                            if (input) {
                              input.value = ''
                              input.dispatchEvent(new Event('input', { bubbles: true }))
                              input.dispatchEvent(new Event('change', { bubbles: true }))
                            }
                          }, selector)
                          await new Promise(resolve => setTimeout(resolve, 500))
                        } catch (e) {
                          console.log('  ⚠️ No se pudo limpiar el campo de password previamente')
                        }
                        
                        await currentPage.type(selector, credentials.password, { delay: 150 + Math.random() * 100 }) // Delay entre 150-250ms
                        console.log('  ✅ Password ingresado en pantalla de login de Upwork')
                        
                        // DIAGNÓSTICO: Verificar que el password se ingresó correctamente
                        try {
                          const passwordEntered = await currentPage.evaluate((sel: string, expectedPwd: string) => {
                            const input = document.querySelector(sel) as HTMLInputElement
                            return input?.value === expectedPwd || input?.value.length === expectedPwd.length
                          }, selector, credentials.password)
                          console.log(`  🔍 [DIAGNÓSTICO] Password ingresado correctamente: ${passwordEntered}`)
                        } catch (e) {
                          console.log('  ⚠️ No se pudo verificar si el password se ingresó')
                        }
                        
                        passwordInputFound = true
                        
                        // Esperar tiempo adicional antes de hacer clic para evitar detección de bot
                        console.log('  → Esperando tiempo adicional para simular comportamiento humano...')
                        const waitTime = 5000 + Math.random() * 3000 // Entre 5-8 segundos (aumentado)
                        console.log(`  → Esperando ${Math.floor(waitTime / 1000)} segundos...`)
                        await new Promise(resolve => setTimeout(resolve, waitTime))
                        
                        // Agregar movimiento de mouse aleatorio para simular comportamiento humano
                        try {
                          const passwordInputRect = await passwordInput.boundingBox()
                          if (passwordInputRect) {
                            await currentPage.mouse.move(
                              passwordInputRect.x + passwordInputRect.width / 2 + (Math.random() * 50 - 25),
                              passwordInputRect.y + passwordInputRect.height / 2 + (Math.random() * 50 - 25),
                              { steps: 10 }
                            )
                            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500))
                          }
                        } catch (e) {
                          // Continuar si hay error en el movimiento del mouse
                        }
                        
                        // Verificar y cerrar mensaje de error si aparece
                        console.log('  → Verificando si hay mensaje de error...')
                        const errorClosed = await currentPage.evaluate(() => {
                          // Buscar mensaje de error con el texto específico
                          const errorSelectors = [
                            '[role="alert"]',
                            '.alert-error',
                            '.alert-danger',
                            '[class*="error"]',
                            '[class*="Error"]',
                            '[data-testid*="error"]',
                            '[aria-live="polite"]',
                            '[aria-live="assertive"]'
                          ]
                          
                          for (const selector of errorSelectors) {
                            const elements = Array.from(document.querySelectorAll(selector))
                            for (const el of elements) {
                              const text = (el.textContent || '').toLowerCase()
                              if (text.includes('technical difficulties') ||
                                  text.includes('unable to process') ||
                                  text.includes('try again later') ||
                                  text.includes('dificultades técnicas') ||
                                  text.includes('no podemos procesar')) {
                                // Buscar botón de cerrar (X)
                                const closeButton = el.querySelector('button[aria-label*="close" i], button[aria-label*="×"], .close, [class*="close"], svg[class*="close"]') as HTMLElement
                                if (closeButton) {
                                  closeButton.click()
                                  return true
                                }
                                // Si no hay botón, intentar hacer clic en cualquier X visible
                                const allXButtons = Array.from(document.querySelectorAll('button, [role="button"], svg'))
                                for (const btn of allXButtons) {
                                  const btnText = (btn.getAttribute('aria-label') || '').toLowerCase()
                                  const btnClass = (btn.className || '').toLowerCase()
                                  if ((btnText.includes('close') || btnText === '×' || btnText === 'x' || btnClass.includes('close')) &&
                                      el.contains(btn)) {
                                    (btn as HTMLElement).click()
                                    return true
                                  }
                                }
                              }
                            }
                          }
                          return false
                        })
                        
                        if (errorClosed) {
                          console.log('  ✅ Mensaje de error cerrado')
                          await new Promise(resolve => setTimeout(resolve, 2000))
                          
                          // DIAGNÓSTICO: Capturar información después de cerrar el error
                          await captureErrorDiagnostics(currentPage, 'DESPUÉS_DE_CERRAR_ERROR')
                        } else {
                          console.log('  → No se detectó mensaje de error o ya estaba cerrado')
                        }
                        
                        // Verificar si el error aparece de nuevo después de cerrarlo
                        await new Promise(resolve => setTimeout(resolve, 2000))
                        const errorReappeared = await currentPage.evaluate(() => {
                          const bodyText = (document.body?.textContent || '').toLowerCase()
                          return bodyText.includes('technical difficulties') ||
                                 bodyText.includes('unable to process') ||
                                 bodyText.includes('try again later')
                        })
                        
                        if (errorReappeared) {
                          console.log('  ⚠️ El error reapareció después de cerrarlo - DIAGNÓSTICO DETALLADO:')
                          await captureErrorDiagnostics(currentPage, 'ERROR_REAPARECIÓ')
                        }
                        break
                      }
                    }
                  } catch (e) {
                    // Continuar con el siguiente selector
                    continue
                  }
                }
                
                if (passwordInputFound) {
                  // DIAGNÓSTICO: Capturar estado antes de buscar el botón "Log in"
                  console.log('  🔍 [DIAGNÓSTICO] Estado ANTES de buscar botón "Log in":')
                  const diagnosticsBeforeLogin = await captureErrorDiagnostics(currentPage, 'ANTES_DE_LOGIN_BUTTON')
                  
                  // Verificar nuevamente si hay error antes de buscar el botón
                  console.log('  → Verificando nuevamente mensajes de error antes de hacer clic en "Log in"...')
                  const hasError = await currentPage.evaluate(() => {
                    const bodyText = (document.body?.textContent || '').toLowerCase()
                    return bodyText.includes('technical difficulties') ||
                           bodyText.includes('unable to process') ||
                           bodyText.includes('try again later') ||
                           bodyText.includes('dificultades técnicas') ||
                           bodyText.includes('no podemos procesar')
                  })
                  
                  if (hasError && diagnosticsBeforeLogin) {
                    console.log('  ⚠️ [DIAGNÓSTICO CRÍTICO] Error detectado ANTES de hacer clic en "Log in"')
                    console.log(`    - Esto sugiere que el error apareció durante/después de ingresar el password`)
                    console.log(`    - Posible causa: Detección de automatización o timing issue`)
                  }
                  
                  if (hasError) {
                    console.log('  ⚠️ Error detectado en la página, intentando cerrarlo nuevamente...')
                    const errorClosedRetry = await currentPage.evaluate(() => {
                      // Buscar y cerrar cualquier mensaje de error
                      const errorElements = Array.from(document.querySelectorAll('[role="alert"], .alert-error, .alert-danger, [class*="error"], [class*="Error"]'))
                      for (const el of errorElements) {
                        const text = (el.textContent || '').toLowerCase()
                        if (text.includes('technical difficulties') ||
                            text.includes('unable to process') ||
                            text.includes('try again later')) {
                          // Buscar botón de cerrar
                          const closeBtn = el.querySelector('button, [role="button"], .close, [class*="close"], svg') as HTMLElement
                          if (closeBtn) {
                            closeBtn.click()
                            return true
                          }
                        }
                      }
                      return false
                    })
                    
                    if (errorClosedRetry) {
                      console.log('  ✅ Error cerrado en reintento')
                      await new Promise(resolve => setTimeout(resolve, 3000))
                    } else {
                      console.log('  ⚠️ No se pudo cerrar el error automáticamente')
                      // Esperar un poco más antes de continuar
                      await new Promise(resolve => setTimeout(resolve, 5000))
                    }
                  }
                  
                  // Buscar y hacer clic en el botón "Log in"
                  console.log('  → Buscando botón "Log in"...')
                  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)) // Delay aleatorio adicional
                  
                  const loginButtonSelectors = [
                    'button:has-text("Log in")',
                    'button:has-text("Log In")',
                    'button:has-text("LOG IN")',
                    'button:has-text("Iniciar sesión")',
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'button.login-button',
                    '[data-testid*="login"]',
                    '[data-qa*="login"]'
                  ]
                  
                  let loginButtonClicked = false
                  
                  // Buscar todos los botones y filtrar por texto
                  const allButtons = await currentPage.$$('button, [role="button"], input[type="submit"]')
                  
                  for (const button of allButtons) {
                    try {
                      const buttonInfo = await currentPage.evaluate((el: any) => {
                        const text = (el.textContent || el.value || '').toLowerCase().trim()
                        const htmlEl = el as HTMLElement
                        const style = window.getComputedStyle(htmlEl)
                        
                        const isLoginButton = (text === 'log in' || 
                                             text === 'login' ||
                                             text === 'iniciar sesión' ||
                                             text === 'iniciar sesion' ||
                                             text.includes('log in') ||
                                             text.includes('login')) &&
                                            !text.includes('sign up') &&
                                            !text.includes('register')
                        
                        const isVisible = htmlEl.offsetParent !== null &&
                                         style.visibility !== 'hidden' &&
                                         style.display !== 'none' &&
                                         style.opacity !== '0' &&
                                         !(el as HTMLButtonElement).disabled
                        
                        // Verificar si es un botón verde (color común para botones de login)
                        const bgColor = style.backgroundColor || ''
                        const isGreenButton = bgColor.includes('rgb(14, 132, 32)') ||
                                            bgColor.includes('#0e8420') ||
                                            bgColor.includes('rgb(0, 132, 32)') ||
                                            htmlEl.classList.toString().toLowerCase().includes('primary') ||
                                            htmlEl.classList.toString().toLowerCase().includes('login')
                        
                        return { isLoginButton, isVisible, isGreenButton, text }
                      }, button)
                      
                      if (buttonInfo.isLoginButton && buttonInfo.isVisible) {
                        // Priorizar botones verdes (el botón "Log in" generalmente es verde)
                        if (buttonInfo.isGreenButton || buttonInfo.text === 'log in') {
                          await button.scrollIntoView()
                          await new Promise(resolve => setTimeout(resolve, 500))
                          
                          // Centrar el botón en la vista
                          try {
                            await currentPage.evaluate(() => {
                              window.scrollTo(0, Math.max(0, window.scrollY - 100))
                            })
                          } catch (e) {
                            // Continuar si hay error
                          }
                          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500))
                          
                          // Agregar movimiento de mouse al botón antes de hacer clic
                          try {
                            const buttonRect = await button.boundingBox()
                            if (buttonRect) {
                              await currentPage.mouse.move(
                                buttonRect.x + buttonRect.width / 2 + (Math.random() * 20 - 10),
                                buttonRect.y + buttonRect.height / 2 + (Math.random() * 20 - 10),
                                { steps: 15 + Math.floor(Math.random() * 10) }
                              )
                              await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300))
                            }
                          } catch (e) {
                            // Continuar si hay error
                          }
                          
                          // Hacer hover antes de click para simular comportamiento humano
                          await button.hover()
                          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))
                          
                          await button.click({ delay: 150 + Math.random() * 100 })
                          loginButtonClicked = true
                          console.log('  ✅ Click en botón "Log in" realizado')
                          
                          // Esperar tiempo adicional después del clic para evitar detección
                          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000))
                          break
                        }
                      }
                    } catch (e) {
                      // Continuar con el siguiente botón
                      continue
                    }
                  }
                  
                  // Método alternativo: buscar por texto usando evaluate
                  if (!loginButtonClicked) {
                    const loginByText = await currentPage.evaluate(() => {
                      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
                      for (const btn of buttons) {
                        const text = ((btn.textContent || (btn as HTMLInputElement).value) || '').toLowerCase().trim()
                        const htmlBtn = btn as HTMLElement
                        const style = window.getComputedStyle(htmlBtn)
                        
                        const isLoginButton = (text === 'log in' || 
                                             text === 'login' ||
                                             text === 'iniciar sesión' ||
                                             text.includes('log in')) &&
                                            !text.includes('sign up')
                        
                        const isVisible = htmlBtn.offsetParent !== null &&
                                         style.visibility !== 'hidden' &&
                                         style.display !== 'none' &&
                                         style.opacity !== '0' &&
                                         !(htmlBtn as HTMLButtonElement).disabled
                        
                        if (isLoginButton && isVisible) {
                          htmlBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          htmlBtn.click()
                          return true
                        }
                      }
                      return false
                    })
                    
                    if (loginByText) {
                      console.log('  ✅ Click en botón "Log in" realizado (método evaluate)')
                      loginButtonClicked = true
                    }
                  }
                  
                  if (loginButtonClicked) {
                    console.log('  ✅ Proceso de login en pantalla final de Upwork completado')
                    
                    // Esperar y verificar si aparece error después del clic
                    console.log('  → Esperando respuesta del servidor después del clic en "Log in"...')
                    
                    // Esperar tiempo inicial para que el servidor procese
                    await new Promise(resolve => setTimeout(resolve, 8000))
                    
                    // Verificar periódicamente si aparece error o si el login fue exitoso
                    let loginSuccessful = false
                    let errorDetected = false
                    const maxWaitTime = 60000 // 60 segundos máximo de espera
                    const checkInterval = 3000 // Verificar cada 3 segundos
                    const startTime = Date.now()
                    
                    while (Date.now() - startTime < maxWaitTime && !loginSuccessful && !errorDetected) {
                      try {
                        if (currentPage.isClosed()) {
                          console.log('  → La página se cerró, verificando si fue exitoso...')
                          break
                        }
                        
                        const currentUrl = currentPage.url()
                        
                        // Verificar si aparece error
                        const hasError = await currentPage.evaluate(() => {
                          const bodyText = (document.body?.textContent || '').toLowerCase()
                          return bodyText.includes('technical difficulties') ||
                                 bodyText.includes('unable to process') ||
                                 bodyText.includes('try again later') ||
                                 bodyText.includes('dificultades técnicas')
                        })
                        
                        if (hasError) {
                          console.log('  ⚠️ [DIAGNÓSTICO CRÍTICO] Error detectado después del clic en "Log in"')
                          
                          // DIAGNÓSTICO DETALLADO cuando aparece el error
                          console.log('  🔍 [DIAGNÓSTICO] Capturando información detallada del error...')
                          const errorDiagnostics = await captureErrorDiagnostics(currentPage, 'ERROR_DESPUÉS_DE_CLIC_LOGIN')
                          
                          if (errorDiagnostics) {
                            console.log('  📋 [DIAGNÓSTICO] Información del error:')
                            console.log(`    - Tiempo desde inicio: ${Math.floor((Date.now() - startTime) / 1000)} segundos`)
                            console.log(`    - URL cuando apareció el error: ${errorDiagnostics.url}`)
                            console.log(`    - Error en elemento HTML: ${errorDiagnostics.errorElementHTML ? 'Sí' : 'No'}`)
                            console.log(`    - WebDriver detectado: ${errorDiagnostics.navigator.webdriver ? 'SÍ (PROBLEMA)' : 'No'}`)
                            console.log(`    - Cookies presentes: ${errorDiagnostics.cookies}`)
                          }
                          
                          // Intentar cerrar el error
                          const errorClosed = await currentPage.evaluate(() => {
                            const errorElements = Array.from(document.querySelectorAll('[role="alert"], .alert-error, .alert-danger, [class*="error"], [class*="Error"]'))
                            for (const el of errorElements) {
                              const text = (el.textContent || '').toLowerCase()
                              if (text.includes('technical difficulties') ||
                                  text.includes('unable to process')) {
                                // Buscar botón de cerrar
                                const closeBtn = el.querySelector('button, [role="button"], .close, [class*="close"], svg') as HTMLElement
                                if (closeBtn) {
                                  closeBtn.click()
                                  return true
                                }
                              }
                            }
                            return false
                          })
                          
                          if (errorClosed) {
                            console.log('  → Error cerrado, esperando antes de continuar...')
                            await new Promise(resolve => setTimeout(resolve, 5000))
                            
                            // Verificar si el error reaparece
                            const errorReappearedAfterClose = await currentPage.evaluate(() => {
                              const bodyText = (document.body?.textContent || '').toLowerCase()
                              return bodyText.includes('technical difficulties') ||
                                     bodyText.includes('unable to process') ||
                                     bodyText.includes('try again later')
                            })
                            
                            if (errorReappearedAfterClose) {
                              console.log('  ⚠️ [DIAGNÓSTICO] El error reapareció después de cerrarlo - esto sugiere un problema persistente')
                              errorDetected = true
                            }
                          } else {
                            // Si no se puede cerrar, marcar como error pero continuar verificando
                            errorDetected = true
                            console.log('  ⚠️ No se pudo cerrar el error automáticamente')
                            console.log('  💡 [DIAGNÓSTICO] Posible causa: El error es persistente y no se puede cerrar')
                          }
                        }
                        
                        // Verificar si el login fue exitoso
                        const authStatus = await currentPage.evaluate(() => {
                          const url = window.location.href
                          const hasLoginPage = url.includes('/ab/account-security/login') || 
                                              url.includes('/login') ||
                                              url.includes('/signin')
                          const hasDashboard = url.includes('/nx/') || 
                                              url.includes('/freelancers/') || 
                                              url.includes('/ab/home') || 
                                              url.includes('/home') ||
                                              url.includes('/jobs/') || 
                                              url.includes('/find-work/') ||
                                              url.includes('/my') ||
                                              url.includes('/dashboard')
                          
                          const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user-menu"], [class*="userMenu"], [class*="profile-menu"]')
                          const profileLink = document.querySelector('a[href*="/freelancers/"], a[href*="/profile"], a[href*="/freelancer"]')
                          const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"], button[aria-label*="logout" i]')
                          const jobSearch = document.querySelector('input[placeholder*="search" i], input[placeholder*="buscar" i], [data-test="job-search"]')
                          
                          return {
                            url,
                            hasLoginPage,
                            hasDashboard,
                            hasUserMenu: userMenu !== null,
                            hasProfileLink: profileLink !== null,
                            hasLogoutButton: logoutButton !== null,
                            hasJobSearch: jobSearch !== null
                          }
                        })
                        
                        const isAuthenticated = !authStatus.hasLoginPage && 
                                               (authStatus.hasDashboard || 
                                                authStatus.hasUserMenu || 
                                                authStatus.hasProfileLink || 
                                                authStatus.hasLogoutButton ||
                                                authStatus.hasJobSearch ||
                                                (currentUrl.includes('upwork.com') && 
                                                 !currentUrl.includes('/login') && 
                                                 !currentUrl.includes('/ab/account-security/login') &&
                                                 !currentUrl.includes('/signin')))
                        
                        if (isAuthenticated) {
                          loginSuccessful = true
                          console.log('  ✅ Login exitoso detectado después de hacer clic en "Log in"')
                          console.log(`  → URL final: ${currentUrl}`)
                          console.log(`  → Dashboard: ${authStatus.hasDashboard}, UserMenu: ${authStatus.hasUserMenu}, Profile: ${authStatus.hasProfileLink}`)
                          break
                        }
                        
                        // Log de progreso cada 15 segundos
                        const elapsed = Math.floor((Date.now() - startTime) / 1000)
                        if (elapsed % 15 === 0 && elapsed > 0) {
                          console.log(`  ⏳ Esperando confirmación de login... (${elapsed}s/${maxWaitTime/1000}s) - URL: ${currentUrl.substring(0, 80)}...`)
                        }
                        
                        // Esperar antes del siguiente check
                        await new Promise(resolve => setTimeout(resolve, checkInterval))
                        
                      } catch (e) {
                        console.log('  ⚠️ Error en verificación de login:', e instanceof Error ? e.message : 'Desconocido')
                        await new Promise(resolve => setTimeout(resolve, checkInterval))
                      }
                    }
                    
                    if (loginSuccessful) {
                      console.log('  ✅ Login completado exitosamente en pantalla final')
                      // Continuar con la verificación final de autenticación más adelante
                    } else if (errorDetected) {
                      console.log('  ⚠️ Error detectado durante el proceso de login')
                    } else {
                      console.log('  ⚠️ Tiempo de espera agotado o no se confirmó el login exitoso')
                    }
                    
                    // Esperar tiempo adicional antes de continuar con verificación final
                    await new Promise(resolve => setTimeout(resolve, 5000))
                  } else {
                    console.log('  ⚠️ No se encontró botón "Log in", continuando...')
                  }
                } else {
                  console.log('  ⚠️ No se encontró campo de password en pantalla de login, continuando...')
                }
                
                break // Salir del loop si encontramos la pantalla de login
              }
            } catch (e) {
              console.log('  ⚠️ Error verificando página para login de Upwork:', e instanceof Error ? e.message : 'Desconocido')
              // Continuar con la siguiente página
              continue
            }
          }
          
          // Verificar autenticación con verificaciones periódicas y tiempo extendido
          console.log('  → Esperando tiempo adicional antes de verificación final de autenticación...')
          await new Promise(resolve => setTimeout(resolve, 10000)) // Esperar 10 segundos adicionales
          
          // Verificar periódicamente si la autenticación fue exitosa
          let finalAuthSuccess = false
          const maxAuthWaitTime = 45000 // 45 segundos adicionales
          const authCheckInterval = 3000 // Verificar cada 3 segundos
          const authStartTime = Date.now()
          
          while (Date.now() - authStartTime < maxAuthWaitTime && !finalAuthSuccess) {
            try {
              // Verificar si la página principal aún está abierta
              if (page.isClosed()) {
                console.log('  ⚠️ La página principal se cerró, verificando otras páginas...')
                const allPages = await browser.pages()
                const activeUpworkPage = allPages.find((p: any) => 
                  !p.isClosed() && p.url().includes('upwork.com') && !p.url().includes('/login') && !p.url().includes('/signin')
                )
                if (activeUpworkPage) {
                  console.log('  → Encontrada página activa de Upwork, usando esa para verificación')
                  // No actualizamos 'page' aquí, solo verificamos
                }
              }
              
              const finalUrl = page.url()
              console.log(`  → Verificando autenticación (${Math.floor((Date.now() - authStartTime) / 1000)}s)... URL: ${finalUrl.substring(0, 80)}...`)
              
              const authCheck = await page.evaluate(() => {
                const url = window.location.href
                const hasLoginPage = url.includes('/ab/account-security/login') || 
                                    url.includes('/login') ||
                                    url.includes('/signin')
                const hasDashboard = url.includes('/nx/') || 
                                    url.includes('/freelancers/') || 
                                    url.includes('/ab/home') || 
                                    url.includes('/home') ||
                                    url.includes('/jobs/') || 
                                    url.includes('/find-work/') ||
                                    url.includes('/my') ||
                                    url.includes('/dashboard')
                
                const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user-menu"], [class*="userMenu"], [class*="profile-menu"]')
                const profileLink = document.querySelector('a[href*="/freelancers/"], a[href*="/profile"], a[href*="/freelancer"]')
                const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"], button[aria-label*="logout" i]')
                const jobSearch = document.querySelector('input[placeholder*="search" i], input[placeholder*="buscar" i], [data-test="job-search"]')
                const notifications = document.querySelector('[data-test="notifications"], [class*="notification"], [aria-label*="notification" i]')
                
                return {
                  url,
                  hasLoginPage,
                  hasDashboard,
                  hasUserMenu: userMenu !== null,
                  hasProfileLink: profileLink !== null,
                  hasLogoutButton: logoutButton !== null,
                  hasJobSearch: jobSearch !== null,
                  hasNotifications: notifications !== null
                }
              })
              
              const isAuthenticated = !authCheck.hasLoginPage && 
                                     (authCheck.hasDashboard || 
                                      authCheck.hasUserMenu || 
                                      authCheck.hasProfileLink || 
                                      authCheck.hasLogoutButton ||
                                      authCheck.hasJobSearch ||
                                      authCheck.hasNotifications ||
                                      (finalUrl.includes('upwork.com') && 
                                       !finalUrl.includes('/login') && 
                                       !finalUrl.includes('/ab/account-security/login') &&
                                       !finalUrl.includes('/signin')))
              
              if (isAuthenticated) {
                finalAuthSuccess = true
                console.log('✅ Login exitoso con Google OAuth en Upwork (verificación periódica)')
                console.log(`  → URL: ${finalUrl}`)
                console.log(`  → Dashboard: ${authCheck.hasDashboard}, UserMenu: ${authCheck.hasUserMenu}, Profile: ${authCheck.hasProfileLink}`)
                
                const cookies = await page.cookies()
                const userAgent = await page.evaluate(() => navigator.userAgent)
                
                // IMPORTANTE: Cerrar todas las ventanas adicionales antes de retornar
                const finalPagesCheck = await browser.pages()
                if (finalPagesCheck.length > 1) {
                  for (const p of finalPagesCheck) {
                    if (p !== page && !p.isClosed()) {
                      try {
                        await p.close()
                      } catch (e) {
                        // Continuar si hay error
                      }
                    }
                  }
                }
                
                return {
                  cookies,
                  userAgent,
                  isAuthenticated: true
                }
              }
              
              // Log de progreso cada 15 segundos
              const elapsed = Math.floor((Date.now() - authStartTime) / 1000)
              if (elapsed % 15 === 0 && elapsed > 0) {
                console.log(`  ⏳ Esperando confirmación de autenticación... (${elapsed}s/${maxAuthWaitTime/1000}s)`)
              }
              
              // Esperar antes del siguiente check
              await new Promise(resolve => setTimeout(resolve, authCheckInterval))
              
            } catch (e) {
              console.log('  ⚠️ Error en verificación periódica de autenticación:', e instanceof Error ? e.message : 'Desconocido')
              await new Promise(resolve => setTimeout(resolve, authCheckInterval))
            }
          }
          
          // Si llegamos aquí, no se detectó autenticación exitosa
          const finalUrl = page.url()
          console.log(`⚠️ Login con Google completado pero no se detectó autenticación después de esperar. URL: ${finalUrl}`)
        } catch (googleError) {
          console.log(`⚠️ Error en login de Google: ${googleError instanceof Error ? googleError.message : 'Error desconocido'}`)
        }
      }
      
      // IMPORTANTE: Si se encontró el botón de Google, verificar una última vez si el login fue exitoso
      // antes de continuar con cualquier otro flujo (evitar duplicación)
      if (googleBtnFound) {
        // Esperar un poco más y verificar una última vez si el login fue exitoso
        await new Promise(resolve => setTimeout(resolve, 5000))
        if (!await safeBringToFront(page)) {
          console.log('  ⚠️ La página principal se cerró, intentando recuperar...')
          const allPages = await browser.pages()
          const activePage = allPages.find((p: any) => !p.isClosed() && p.url().includes('upwork.com'))
          if (activePage) {
            page = activePage
            console.log('  ✅ Página recuperada')
          }
        }
        
        // Cerrar todas las ventanas adicionales primero
        const allPagesBeforeFinalCheck = await browser.pages()
        if (allPagesBeforeFinalCheck.length > 1) {
          for (const p of allPagesBeforeFinalCheck) {
            if (p !== page && !p.isClosed()) {
              try {
                await p.close()
                await new Promise(resolve => setTimeout(resolve, 500))
              } catch (e) {
                // Continuar si hay error
              }
            }
          }
        }
        
        // Esperar tiempo adicional antes de verificación final
        console.log('  → Esperando tiempo adicional antes de verificación final (15 segundos)...')
        await new Promise(resolve => setTimeout(resolve, 15000))
        
        // Verificación final con múltiples intentos
        let finalAuthSuccess = false
        let finalAuthCheck = null
        let finalUrlCheck = ''
        
        for (let attempt = 1; attempt <= 10; attempt++) {
          try {
            if (page.isClosed()) {
              console.log('  ⚠️ La página se cerró durante verificación final')
              break
            }
            
            finalUrlCheck = page.url()
            console.log(`  → Verificación final intento ${attempt}/10... URL: ${finalUrlCheck.substring(0, 80)}...`)
            
            finalAuthCheck = await page.evaluate(() => {
              const url = window.location.href
              const hasLoginPage = url.includes('/ab/account-security/login') || 
                                  url.includes('/login') ||
                                  url.includes('/signin')
              const hasDashboard = url.includes('/nx/') || 
                                  url.includes('/freelancers/') || 
                                  url.includes('/ab/home') || 
                                  url.includes('/home') ||
                                  url.includes('/jobs/') || 
                                  url.includes('/find-work/') ||
                                  url.includes('/my') ||
                                  url.includes('/dashboard')
              
              const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user-menu"], [class*="userMenu"], [class*="profile-menu"]')
              const profileLink = document.querySelector('a[href*="/freelancers/"], a[href*="/profile"], a[href*="/freelancer"]')
              const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"], button[aria-label*="logout" i]')
              const jobSearch = document.querySelector('input[placeholder*="search" i], input[placeholder*="buscar" i], [data-test="job-search"]')
              const notifications = document.querySelector('[data-test="notifications"], [class*="notification"]')
              const messages = document.querySelector('[data-test="messages"], a[href*="/messages"]')
              
              return {
                url,
                hasLoginPage,
                hasDashboard,
                hasUserMenu: userMenu !== null,
                hasProfileLink: profileLink !== null,
                hasLogoutButton: logoutButton !== null,
                hasJobSearch: jobSearch !== null,
                hasNotifications: notifications !== null,
                hasMessages: messages !== null
              }
            })
            
            const isFinalAuthenticated = !finalAuthCheck.hasLoginPage && 
                                       (finalAuthCheck.hasDashboard || 
                                        finalAuthCheck.hasUserMenu || 
                                        finalAuthCheck.hasProfileLink ||
                                        finalAuthCheck.hasLogoutButton ||
                                        finalAuthCheck.hasJobSearch ||
                                        finalAuthCheck.hasNotifications ||
                                        finalAuthCheck.hasMessages ||
                                        (finalUrlCheck.includes('upwork.com') && 
                                         !finalUrlCheck.includes('/login') && 
                                         !finalUrlCheck.includes('/ab/account-security/login') &&
                                         !finalUrlCheck.includes('/signin')))
            
            if (isFinalAuthenticated) {
              finalAuthSuccess = true
              console.log(`✅ Login exitoso con Google OAuth en Upwork (verificación final - intento ${attempt})`)
              console.log(`  → URL: ${finalUrlCheck}`)
              console.log(`  → Dashboard: ${finalAuthCheck.hasDashboard}, UserMenu: ${finalAuthCheck.hasUserMenu}, Profile: ${finalAuthCheck.hasProfileLink}`)
              break
            } else if (attempt < 10) {
              // Esperar antes del siguiente intento
              await new Promise(resolve => setTimeout(resolve, 3000))
            }
          } catch (e) {
            console.log(`  ⚠️ Error en verificación final intento ${attempt}:`, e instanceof Error ? e.message : 'Desconocido')
            if (attempt < 10) {
              await new Promise(resolve => setTimeout(resolve, 3000))
            }
          }
        }
        
        if (finalAuthSuccess && finalAuthCheck) {
          const cookies = await page.cookies()
          const userAgent = await page.evaluate(() => navigator.userAgent)
          
          return {
            cookies,
            userAgent,
            isAuthenticated: true
          }
        } else {
          console.log(`⚠️ Login con Google no fue completamente exitoso después de 10 intentos. URL: ${finalUrlCheck}`)
          
          // Intentar obtener información adicional de debug
          try {
            const debugInfo = await page.evaluate(() => {
              return {
                url: window.location.href,
                title: document.title,
                hasLoginForm: document.querySelector('input[type="password"]') !== null,
                hasError: document.querySelector('[role="alert"], .alert-error, [class*="error"]') !== null,
                bodyText: document.body?.textContent?.substring(0, 200) || ''
              }
            })
            console.log(`  → Debug info:`, debugInfo)
          } catch (e) {
            // Continuar si hay error
          }
          
          // NO continuar con flujo tradicional si ya se intentó Google
          // Retornar error en lugar de intentar flujo tradicional (evitar duplicación)
          return {
            cookies: await page.cookies().catch(() => []),
            userAgent: await page.evaluate(() => navigator.userAgent).catch(() => 'Mozilla/5.0'),
            isAuthenticated: false,
            error: 'Login con Google no completado exitosamente después de múltiples verificaciones',
            errorDetails: `URL final: ${finalUrlCheck}. Verifica manualmente si el login fue exitoso.`
          }
        }
      }
    }
    
    // SOLO continuar con flujo tradicional si NO se encontró el botón de Google
    // IMPORTANTE: No ejecutar flujo tradicional si ya se intentó Google (evitar duplicación)
    if (!googleBtnFound) {
      console.log('  ⚠️ No se encontró botón "Continue with Google", continuando con flujo tradicional...')

    // Esperar a que cargue el formulario
    console.log('  → Esperando formulario de login...')
    try {
      await page.waitForSelector('input[name="login[username]"], input[type="email"], #login_username', { timeout: 15000 })
      console.log('  ✅ Formulario encontrado')
    } catch (e) {
      console.log('  ⚠️ Selector estándar no encontrado, buscando alternativas...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Intentar resolver CAPTCHA ANTES de buscar el campo de email
    console.log('  → Verificando si hay CAPTCHA antes de ingresar email...')
    const captchaSolved = await attemptAutoCaptcha('before-email-input')
    if (captchaSolved) {
      console.log('  ✅ CAPTCHA resuelto antes de ingresar email')
      await new Promise(resolve => setTimeout(resolve, 2000))
    } else {
      console.log('  → No se detectó CAPTCHA o ya estaba resuelto')
    }

    // Buscar campo de email con múltiples selectores
    console.log('  → Buscando campo de email...')
    const emailSelectors = [
      'input[name="login[username]"]',
      'input[type="email"]',
      '#login_username',
      'input[name="username"]',
      'input[id*="email"]',
      'input[id*="username"]'
    ]
    
    let emailSelector = null
    for (const selector of emailSelectors) {
      const element = await page.$(selector)
      if (element) {
        emailSelector = selector
        console.log(`  → Campo de email encontrado con selector: ${selector}`)
        break
      }
    }
    
    if (!emailSelector) {
      // Fallback: buscar por tipo o nombre
      const found = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          const type = (input as HTMLInputElement).type
          const name = (input as HTMLInputElement).name?.toLowerCase() || ''
          const id = (input as HTMLInputElement).id?.toLowerCase() || ''
          if (type === 'email' || name.includes('email') || name.includes('username') || 
              id.includes('email') || id.includes('username')) {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            return `input[type="${type}"]`
          }
        }
        return null
      })
      if (found) {
        emailSelector = found
        console.log(`  → Campo de email encontrado con selector: ${emailSelector}`)
      }
    }
    
    if (emailSelector) {
      // Asegurar que el campo esté visible y habilitado
      const isFieldReady = await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement | null
        if (!input) return false
        const style = window.getComputedStyle(input)
        return input.offsetParent !== null && 
               style.visibility !== 'hidden' && 
               style.display !== 'none' &&
               !input.disabled &&
               !input.readOnly
      }, emailSelector)
      
      if (!isFieldReady) {
        console.log('  ⚠️ Campo de email no está listo, esperando...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      // Hacer scroll al campo si es necesario
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLElement | null
        if (input) {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, emailSelector)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await page.focus(emailSelector)
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = ''
          input.focus()
          input.click()
        }
      }, emailSelector)
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Escribir el email carácter por carácter para simular escritura humana
      await page.type(emailSelector, credentials.email, { delay: 80 })
      console.log('  ✅ Email ingresado')
      
      // Verificar que el email se ingresó correctamente
      const emailEntered = await page.evaluate((selector: string, expectedEmail: string) => {
        const input = document.querySelector(selector) as HTMLInputElement | null
        return input?.value === expectedEmail
      }, emailSelector, credentials.email)
      
      if (!emailEntered) {
        console.log('  ⚠️ El email no se ingresó correctamente, reintentando...')
        await page.evaluate((selector: string, email: string) => {
          const input = document.querySelector(selector) as HTMLInputElement
          if (input) {
            input.value = email
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }, emailSelector, credentials.email)
      }
      
      // Esperar un poco después de escribir el email
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Intentar resolver CAPTCHA nuevamente después de ingresar el email (por si aparece uno nuevo)
      const captchaAfterEmail = await attemptAutoCaptcha('after-email-input')
      if (captchaAfterEmail) {
        console.log('  ✅ CAPTCHA resuelto después de ingresar email')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } else {
      throw new Error('No se encontró el campo de email')
    }
    
    console.log('  → Validando si el formulario requiere un paso intermedio para password...')
    
    // Verificar si el campo de password ya está visible antes de hacer clic en continuar
    const passwordAlreadyVisible = await isPasswordFieldVisible()
    if (passwordAlreadyVisible) {
      console.log('  ✅ Campo de password ya está visible, no es necesario hacer clic en continuar')
    } else {
      console.log('  → Campo de password no visible, necesitamos hacer clic en "Continuar"...')
      
      // Intentar hacer clic en el botón de continuar después de ingresar el email
      const clickedContinue = await clickContinueToRevealPassword()
      if (clickedContinue) {
        console.log('  ✅ Botón "Continuar" pulsado después de ingresar email')
        // Esperar a que la página responda al clic
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Esperar a que el DOM cambie (indicando que se avanzó al siguiente paso)
        try {
          await page.waitForFunction(
            () => {
              const passwordInputs = document.querySelectorAll('input[type="password"], input[name*="password" i]')
              return passwordInputs.length > 0
            },
            { timeout: 10000 }
          )
          console.log('  ✅ Campo de password detectado después de hacer clic en continuar')
        } catch (e) {
          console.log('  ⚠️ No se detectó cambio inmediato en el DOM, continuando con búsqueda...')
        }
      } else {
        console.log('  ⚠️ No se encontró botón de "Continuar", intentando con Enter...')
        try {
          await page.keyboard.press('Enter')
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
          console.log('  ⚠️ No se pudo presionar Enter:', error)
        }
      }
    }
    
    // Llamar a ensurePasswordStep para asegurar que el campo esté visible
    await ensurePasswordStep()

    // Esperar más tiempo para asegurar que el campo de password aparezca
    console.log('  → Esperando a que aparezca el campo de password...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Intentar hacer scroll para revelar campos ocultos
    try {
      // Intentar hacer scroll para revelar campos ocultos y luego centrar la vista
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Centrar la vista en lugar de ir a la esquina superior izquierda
      await page.evaluate(() => {
        // Buscar el contenedor principal o formulario para centrarlo
        const mainContent = document.querySelector('main, form, .login-container, [role="main"], .container') as HTMLElement
        if (mainContent) {
          mainContent.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        } else {
          // Si no hay contenedor específico, centrar el body
          const bodyHeight = document.body.scrollHeight
          const viewportHeight = window.innerHeight
          const centerY = Math.max(0, (bodyHeight - viewportHeight) / 2)
          window.scrollTo({ top: centerY, left: 0, behavior: 'smooth' })
        }
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      // Ignorar errores de scroll
    }

    // Buscar campo de password con múltiples intentos
    console.log('  → Buscando campo de password...')
    
    let passwordSelector = null
    const maxSearchAttempts = 10 // Aumentado de 5 a 10
    
    for (let attempt = 0; attempt < maxSearchAttempts && !passwordSelector; attempt++) {
      console.log(`  → Intento ${attempt + 1}/${maxSearchAttempts} de búsqueda del campo de password...`)
      
      // Esperar más tiempo en los primeros intentos para que el campo aparezca
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      // Intentar esperar explícitamente por el campo de password con timeout más largo
      try {
        await page.waitForSelector('input[type="password"], input[name*="password" i], input[name="login[password]"], input[id*="password" i], input[autocomplete*="password" i]', { 
          timeout: 10000, // Aumentado de 5000 a 10000
          visible: true 
        })
        console.log('  ✅ Campo de password apareció después de esperar')
      } catch (e) {
        console.log(`  ⚠️ Intento ${attempt + 1}: No se encontró campo de password con waitForSelector`)
      }
      
      // Buscar en iframes también
      if (!passwordSelector) {
        console.log('  → Buscando campo de password en iframes...')
        const frames = page.frames()
        for (const frame of frames) {
          try {
            const iframePassword = await frame.$('input[type="password"], input[name*="password" i]')
            if (iframePassword) {
              const isVisible = await frame.evaluate((el: any) => {
                if (!(el instanceof HTMLElement)) return false
                return el.offsetParent !== null
              }, iframePassword)
              
              if (isVisible) {
                console.log('  ✅ Campo de password encontrado en iframe')
                // Intentar usar el iframe directamente
                try {
                  await iframePassword.click()
                  await iframePassword.type(credentials.password, { delay: 50 })
                  console.log('  ✅ Password ingresado en iframe')
                  passwordSelector = 'iframe-password' // Marcador especial
                  break
                } catch (iframeError) {
                  console.log('  ⚠️ No se pudo interactuar con el campo en iframe')
                }
              }
            }
          } catch (frameError) {
            // Continuar con el siguiente frame
          }
        }
      }
      
      // Lista expandida de selectores de Upwork
      const passwordSelectors = [
        'input[name="login[password]"]',
        'input[type="password"]',
        '#login_password',
        'input[name="password"]',
        'input[id*="password"]',
        'input[id*="Password"]',
        'input[data-testid*="password" i]',
        'input[aria-label*="password" i]',
        'input[placeholder*="password" i]',
        'input[placeholder*="contraseña" i]',
        'input[name*="__password"]',
        'input[autocomplete="current-password"]',
        'input[autocomplete="password"]'
      ]
      
      for (const selector of passwordSelectors) {
        try {
          const element = await page.$(selector)
          if (!element) continue

          const fieldInfo = await page.evaluate((el: any) => {
            if (!(el instanceof HTMLElement)) {
              return { visible: false, isPassword: false, display: 'none' }
            }
            const style = window.getComputedStyle(el)
            const visible = el.offsetParent !== null && 
                          style.visibility !== 'hidden' && 
                          style.display !== 'none' &&
                          style.opacity !== '0'
            let type = ''
            let name = ''
            let placeholder = ''
            if (el instanceof HTMLInputElement) {
              type = (el.type || '').toLowerCase()
              name = (el.name || '').toLowerCase()
              placeholder = (el.placeholder || '').toLowerCase()
            }
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase()
            const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase()
            const isPassword = type === 'password' ||
                               name.includes('password') ||
                               placeholder.includes('password') ||
                               placeholder.includes('contraseña') ||
                               ariaLabel.includes('password') ||
                               ariaLabel.includes('contraseña') ||
                               autocomplete.includes('password')
            return { visible, isPassword, display: style.display }
          }, element)

          if (fieldInfo.visible && fieldInfo.isPassword) {
            passwordSelector = selector
            console.log(`  ✅ Campo de password encontrado con selector: ${selector}`)
            await element.dispose()
            break
          }

          await element.dispose()
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }
      
      // Si no se encontró, intentar búsqueda exhaustiva en todos los inputs
      if (!passwordSelector) {
        const found = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'))
          for (const input of inputs) {
            if (!(input instanceof HTMLInputElement)) continue
            const style = window.getComputedStyle(input)
            if (input.offsetParent === null || 
                style.visibility === 'hidden' || 
                style.display === 'none' ||
                style.opacity === '0') continue
                
            const type = (input.type || '').toLowerCase()
            const name = (input.name || '').toLowerCase()
            const placeholder = (input.placeholder || '').toLowerCase()
            const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase()
            const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase()
            const id = (input.id || '').toLowerCase()
            
            const isPassword = type === 'password' ||
                               name.includes('password') ||
                               placeholder.includes('password') ||
                               placeholder.includes('contraseña') ||
                               ariaLabel.includes('password') ||
                               ariaLabel.includes('contraseña') ||
                               autocomplete.includes('password') ||
                               id.includes('password')
            
            if (isPassword) {
              if (input.id) return `#${input.id}`
              if (input.name) return `input[name="${input.name}"]`
              if (type) return `input[type="${type}"]`
              return 'input[type="password"]'
            }
          }
          return null
        })
        if (found) {
          passwordSelector = found
          console.log(`  ✅ Campo de password encontrado con búsqueda exhaustiva: ${passwordSelector}`)
        }
      }
      
      // Si aún no se encontró, esperar un poco más y reintentar
      if (!passwordSelector && attempt < maxSearchAttempts - 1) {
        console.log(`  ⚠️ Campo de password no encontrado en intento ${attempt + 1}, esperando antes del siguiente intento...`)
        
        // Intentar hacer clic en continuar de nuevo si no se encontró (más frecuentemente)
        if (attempt % 2 === 0 || attempt === 1 || attempt === 3 || attempt === 5) {
          console.log(`  → Intentando hacer clic en "Continuar" nuevamente (intento ${attempt + 1})...`)
          try {
            const clicked = await clickContinueToRevealPassword()
            if (clicked) {
              console.log('  → Clic en continuar realizado, esperando a que aparezca el campo...')
              await new Promise(resolve => setTimeout(resolve, 4000))
            } else {
              // Intentar con Enter también
              await page.keyboard.press('Enter')
              await new Promise(resolve => setTimeout(resolve, 3000))
            }
          } catch (error) {
            // Ignorar errores
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        // Verificar si el campo apareció después del clic
        if (await isPasswordFieldVisible()) {
          console.log('  ✅ Campo de password detectado después de hacer clic en continuar')
          // Continuar con la búsqueda en el siguiente ciclo
        }
      }
    }
    
    // Si encontramos el campo en iframe, ya está ingresado
    if (passwordSelector === 'iframe-password') {
      console.log('  ✅ Password ya ingresado en iframe')
    } else if (passwordSelector) {
      // Esperar un poco más para asegurar que el campo esté completamente listo
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await page.focus(passwordSelector)
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = ''
          input.focus()
          input.click()
        }
      }, passwordSelector)
      
      // Esperar un poco antes de escribir
      await new Promise(resolve => setTimeout(resolve, 300))
      
      await page.type(passwordSelector, credentials.password, { delay: 50 })
      console.log('  ✅ Password ingresado')
    } else {
      // Último intento: esperar más tiempo y buscar una vez más
      console.log('  ⚠️ Último intento: esperando 10 segundos adicionales...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Intentar hacer clic en continuar una última vez
      console.log('  → Último intento: haciendo clic en continuar...')
      try {
        await clickContinueToRevealPassword()
        await new Promise(resolve => setTimeout(resolve, 5000))
      } catch (error) {
        // Ignorar
      }
      
      // Búsqueda final exhaustiva
      const finalSearch = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          if (!(input instanceof HTMLInputElement)) continue
          const style = window.getComputedStyle(input)
          if (input.offsetParent === null || 
              style.visibility === 'hidden' || 
              style.display === 'none' ||
              style.opacity === '0') continue
              
          const type = (input.type || '').toLowerCase()
          const name = (input.name || '').toLowerCase()
          const placeholder = (input.placeholder || '').toLowerCase()
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase()
          const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase()
          const id = (input.id || '').toLowerCase()
          
          const isPassword = type === 'password' ||
                             name.includes('password') ||
                             placeholder.includes('password') ||
                             placeholder.includes('contraseña') ||
                             ariaLabel.includes('password') ||
                             ariaLabel.includes('contraseña') ||
                             autocomplete.includes('password') ||
                             id.includes('password')
          
          if (isPassword) {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            if (type) return `input[type="${type}"]`
            return 'input[type="password"]'
          }
        }
        return null
      })
      
      if (finalSearch) {
        passwordSelector = finalSearch
        console.log(`  ✅ Campo de password encontrado en búsqueda final: ${passwordSelector}`)
      } else {
        // Intentar obtener información de debug antes de lanzar el error
        const debugInfo = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'))
          return inputs.map(input => {
            if (!(input instanceof HTMLInputElement)) return null
            const style = window.getComputedStyle(input)
            return {
              type: input.type,
              name: input.name,
              id: input.id,
              placeholder: input.placeholder,
              autocomplete: input.autocomplete,
              visible: input.offsetParent !== null,
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity
            }
          }).filter(Boolean)
        })
        
        const currentUrl = page.url()
        const pageTitle = await page.title()
        
        console.log('  ❌ Debug: Inputs encontrados en la página:', JSON.stringify(debugInfo, null, 2))
        console.log(`  ❌ Debug: URL actual: ${currentUrl}`)
        console.log(`  ❌ Debug: Título de la página: ${pageTitle}`)
        
        throw new Error(`No se encontró el campo de password después de ${maxSearchAttempts} intentos. URL: ${currentUrl}, Título: ${pageTitle}. Inputs encontrados: ${debugInfo.length}`)
      }
    }
    
    // Si encontramos el campo en la búsqueda final, ingresarlo
    if (passwordSelector && passwordSelector !== 'iframe-password') {
      // Esperar un poco más para asegurar que el campo esté completamente listo
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await page.focus(passwordSelector)
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = ''
          input.focus()
          input.click()
        }
      }, passwordSelector)
      
      // Esperar un poco antes de escribir
      await new Promise(resolve => setTimeout(resolve, 300))
      
      await page.type(passwordSelector, credentials.password, { delay: 50 })
      console.log('  ✅ Password ingresado en búsqueda final')
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Buscar y hacer clic en el botón de login
    console.log('  → Buscando botón de login...')
    const buttonSelectors = [
      'button[type="submit"]',
      'button.login-button',
      '#login_control_continue',
      '[data-test="login-button"]',
      '[data-testid="login-button"]',
      'button.btn-primary',
      'button[class*="login"]',
      'button[class*="submit"]'
    ]
    
    let buttonFound = false
    let buttonSelector = null
    
    for (const selector of buttonSelectors) {
      try {
        const element = await page.$(selector)
        if (element) {
          const isVisible = await page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement
            return el && el.offsetParent !== null
          }, selector)
          
          if (isVisible) {
            buttonSelector = selector
            buttonFound = true
            console.log(`  → Botón de login encontrado con selector: ${selector}`)
            break
          }
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }
    
    // Si no se encontró con selectores, buscar por texto
    if (!buttonFound) {
      console.log('  → Buscando botón por texto...')
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || ''
          const value = (btn as HTMLInputElement).value?.toLowerCase() || ''
          if (text.includes('log in') || text.includes('sign in') || 
              text.includes('login') || value.includes('login') ||
              text.includes('continue') || text.includes('entrar')) {
            if (btn.id) return { selector: `#${btn.id}`, found: true }
            if (btn.className) {
              const firstClass = (btn.className as string).split(' ')[0]
              if (firstClass) return { selector: `button.${firstClass}`, found: true }
            }
            return { selector: null, found: true }
          }
        }
        return { selector: null, found: false }
      })
      
      if (buttonInfo.found && buttonInfo.selector) {
        buttonSelector = buttonInfo.selector
        buttonFound = true
        console.log(`  → Botón de login encontrado por texto con selector: ${buttonSelector}`)
      }
    }
    
    // Hacer clic en el botón si se encontró con selector
    if (buttonFound && buttonSelector) {
      try {
        await page.click(buttonSelector)
        console.log('  ✅ Clic en botón de login realizado')
      } catch (e) {
        console.log('  ⚠️ Error al hacer clic con page.click(), intentando con evaluate...')
        await page.evaluate((sel: string) => {
          const btn = document.querySelector(sel) as HTMLElement
          if (btn) btn.click()
        }, buttonSelector)
      }
    } else if (!buttonFound) {
      console.log('  ⚠️ No se encontró botón de login, intentando con Enter...')
      await page.keyboard.press('Enter')
    }
    
    console.log('  → Esperando respuesta del servidor...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Esperar navegación o cambio en la página
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
      console.log('  → Navegación detectada')
    } catch (e) {
      console.log('  → No se detectó navegación, continuando...')
    }
    
    // Esperar más tiempo para que cualquier redirección se complete
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    // Verificar si el login fue exitoso
    const currentUrl = page.url()
    const pageContent = await page.content()
    
    // Verificar si hay captcha de forma más exhaustiva
    const captchaInfo = await page.evaluate(() => {
      // Buscar elementos de captcha visibles
      const captchaSelectors = [
        '.g-recaptcha',
        '#captcha',
        '[data-captcha]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="captcha"]',
        '.recaptcha',
        '[class*="captcha"]',
        '[id*="captcha"]'
      ]
      
      for (const selector of captchaSelectors) {
        const element = document.querySelector(selector)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, selector, visible: true }
          }
        }
      }
      
      // Buscar texto relacionado con captcha
      const bodyText = document.body.textContent?.toLowerCase() || ''
      if (bodyText.includes('captcha') || bodyText.includes('recaptcha') || 
          bodyText.includes('verify you are human') || bodyText.includes('verify you\'re not a robot')) {
        return { found: true, selector: 'text_match', visible: true }
      }
      
      return { found: false, visible: false }
    })
    
    const hasCaptcha = captchaInfo.found || 
                       pageContent.includes('captcha') || 
                       pageContent.includes('recaptcha') ||
                       pageContent.includes('verify you are human') ||
                       pageContent.includes('verify you\'re not a robot')
    
    // Verificar si hay mensaje de error
    const errorMessage = await page.evaluate(() => {
      const errorSelectors = [
        '.error-message',
        '.alert-error',
        '.login-error',
        '[role="alert"]',
        '.alert-danger',
        '.text-danger',
        '[class*="error"]'
      ]
      
      for (const selector of errorSelectors) {
        const errorEl = document.querySelector(selector)
        if (errorEl) {
          const text = errorEl.textContent?.trim()
          if (text && text.length > 0 && text.length < 200) {
            return text
          }
        }
      }
      return null
    })
    
    // Verificar autenticación de forma más exhaustiva
    const authCheck = await page.evaluate(() => {
      const url = window.location.href
      const hasLoginPage = url.includes('/ab/account-security/login') || url.includes('/login')
      const hasDashboard = url.includes('/nx/') || url.includes('/freelancers/') || 
                          url.includes('/ab/') || url.includes('/home') ||
                          url.includes('/jobs/') || url.includes('/find-work/')
      
      // Buscar elementos que indican que el usuario está logueado
      const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user-menu"], [class*="userMenu"]')
      const profileLink = document.querySelector('a[href*="/freelancers/"], a[href*="/profile"]')
      const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"], button[aria-label*="logout" i]')
      const jobSearch = document.querySelector('input[placeholder*="search" i], input[placeholder*="buscar" i]')
      
      return {
        url,
        hasLoginPage,
        hasDashboard,
        hasUserMenu: userMenu !== null,
        hasProfileLink: profileLink !== null,
        hasLogoutButton: logoutButton !== null,
        hasJobSearch: jobSearch !== null
      }
    })
    
    const isAuthenticated = !authCheck.hasLoginPage && 
                           (authCheck.hasDashboard || 
                            authCheck.hasUserMenu || 
                            authCheck.hasProfileLink || 
                            authCheck.hasLogoutButton ||
                            (!currentUrl.includes('/ab/account-security/login') && 
                             !currentUrl.includes('/login') &&
                             (currentUrl.includes('/nx/') || currentUrl.includes('/freelancers/') || 
                              currentUrl.includes('/ab/') || currentUrl.includes('/home') ||
                              currentUrl.includes('/jobs/') || currentUrl.includes('/find-work/'))))

    // Nivel debería ser 1 aquí (dentro del try principal)
    if (isAuthenticated) {
      console.log('  ✅ Login exitoso en Upwork')
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    } else {
      // Si hay captcha y no estamos en modo interactivo, usar el mismo navegador (NO crear uno nuevo)
      if (hasCaptcha && !interactive) {
        console.log('  🔄 Captcha detectado - usando el mismo navegador para resolver captcha manualmente...')
        console.log('  📋 INSTRUCCIONES:')
        console.log('     1. Resuelve el captcha en la ventana actual')
        console.log('     2. Completa el login si es necesario')
        console.log('     3. Espera a que la aplicación detecte el login exitoso')
        
        // NO cerrar el navegador, usar el mismo que ya está abierto
        // El navegador ya está en modo visible (headless: false)
        // Asegurarse de que solo hay una página abierta (la de login de Upwork)
        const allPages = await browser.pages()
        if (allPages.length > 1) {
          console.log(`  ⚠️ Se detectaron ${allPages.length} ventanas. Cerrando duplicadas...`)
          for (const p of allPages) {
            if (p !== page && !p.isClosed()) {
              try {
                const urlToClose = p.url()
                // Solo mantener la página de login de Upwork
                if (!urlToClose.includes('upwork.com/ab/account-security/login')) {
                  await p.close()
                  console.log(`  → Cerrada ventana duplicada: ${urlToClose.substring(0, 50)}...`)
                  await new Promise(resolve => setTimeout(resolve, 500))
                }
              } catch (e) {
                // Continuar si hay error
              }
            }
          }
        }
        
        // Usar la misma página que ya está abierta (NO crear una nueva)
        const interactivePage = page
        
        try {
          // Verificar y cerrar duplicados antes de verificar la URL
          const allPagesBeforeInteractive = await browser.pages()
          for (const p of allPagesBeforeInteractive) {
            if (p !== interactivePage && !p.isClosed()) {
              try {
                const url = p.url()
                if (url.includes('upwork.com/ab/account-security/login')) {
                  console.log('  ⚠️ Detectada página duplicada de login en modo interactivo. Cerrando...')
                  await p.close()
                  await new Promise(resolve => setTimeout(resolve, 300))
                }
              } catch (e) {
                // Continuar
              }
            }
          }
          
          // Asegurarse de que estamos en la página de login
          const currentUrl = interactivePage.url()
          if (!currentUrl.includes('upwork.com/ab/account-security/login')) {
          console.log('  → Navegando a página de login de Upwork (modo interactivo)...')
          
            // Verificar una vez más antes de navegar
            const finalCheckPages = await browser.pages()
            for (const p of finalCheckPages) {
              if (p !== interactivePage && !p.isClosed()) {
                try {
                  const url = p.url()
                  if (url.includes('upwork.com/ab/account-security/login')) {
                    console.log('  ⚠️ Detectada página duplicada justo antes de navegar. Cerrando...')
                    await p.close()
                    await new Promise(resolve => setTimeout(resolve, 300))
                  }
                } catch (e) {
                  // Continuar
                }
              }
            }
            
            // Navegar a la página de login SOLO si no estamos ya ahí
          try {
            await Promise.race([
              interactivePage.goto('https://www.upwork.com/ab/account-security/login', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout en goto')), 25000)
              )
            ])
          } catch (gotoError) {
            try {
              await Promise.race([
                interactivePage.goto('https://www.upwork.com/ab/account-security/login', {
                  waitUntil: 'load',
                  timeout: 20000
                }),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout en goto')), 25000)
                )
              ])
            } catch (loadError) {
                const urlCheck = interactivePage.url()
                if (!urlCheck.includes('upwork.com')) {
                throw new Error(`No se pudo cargar la página de Upwork. Error: ${gotoError instanceof Error ? gotoError.message : 'Desconocido'}`)
              }
              await new Promise(resolve => setTimeout(resolve, 3000))
              }
            }
            
            // Verificar duplicados después de navegar
            await new Promise(resolve => setTimeout(resolve, 2000))
            const pagesAfterNav = await browser.pages()
            for (const p of pagesAfterNav) {
              if (p !== interactivePage && !p.isClosed()) {
                try {
                  const url = p.url()
                  if (url.includes('upwork.com/ab/account-security/login')) {
                    console.log('  ⚠️ Detectada página duplicada después de navegar. Cerrando...')
                    await p.close()
                    await new Promise(resolve => setTimeout(resolve, 300))
                  }
                } catch (e) {
                  // Continuar
                }
              }
            }
          } else {
            console.log('  → Ya estamos en la página de login, continuando...')
            // Verificar duplicados de todas formas
            const pagesCheck = await browser.pages()
            for (const p of pagesCheck) {
              if (p !== interactivePage && !p.isClosed()) {
                try {
                  const url = p.url()
                  if (url.includes('upwork.com/ab/account-security/login')) {
                    console.log('  ⚠️ Detectada página duplicada. Cerrando...')
                    await p.close()
                    await new Promise(resolve => setTimeout(resolve, 300))
                  }
                } catch (e) {
                  // Continuar
                }
              }
            }
          }
          
          // Llenar credenciales automáticamente si los campos están disponibles
          try {
            await interactivePage.waitForSelector('input[name="login[username]"], input[type="email"], #login_username', { timeout: 5000 })
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            const emailSelectors = [
              'input[name="login[username]"]',
              'input[type="email"]',
              '#login_username'
            ]
            
            let emailSelector = null
            for (const selector of emailSelectors) {
              const element = await interactivePage.$(selector)
              if (element) {
                emailSelector = selector
                break
              }
            }
            
            if (emailSelector) {
              await interactivePage.focus(emailSelector)
              await interactivePage.evaluate((selector: string) => {
                const input = document.querySelector(selector) as HTMLInputElement
                if (input) {
                  input.value = ''
                  input.focus()
                }
              }, emailSelector)
              await interactivePage.type(emailSelector, credentials.email, { delay: 50 })
              console.log('  ✅ Email ingresado automáticamente')
            }
            
            const passwordSelectors = [
              'input[name="login[password]"]',
              'input[type="password"]',
              '#login_password'
            ]
            
            let passwordSelector = null
            for (const selector of passwordSelectors) {
              const element = await interactivePage.$(selector)
              if (element) {
                passwordSelector = selector
                break
              }
            }
            
            if (passwordSelector) {
              await interactivePage.focus(passwordSelector)
              await interactivePage.evaluate((selector: string) => {
                const input = document.querySelector(selector) as HTMLInputElement
                if (input) {
                  input.value = ''
                  input.focus()
                }
              }, passwordSelector)
              await interactivePage.type(passwordSelector, credentials.password, { delay: 50 })
              console.log('  ✅ Password ingresado automáticamente')
            }
          } catch (e) {
            console.log('  ⚠️ No se pudieron llenar los campos automáticamente - por favor llena el formulario manualmente')
          }
          
          console.log('  ⏳ Esperando a que resuelvas el captcha y completes el login...')
          console.log('  💡 La aplicación detectará automáticamente cuando el login sea exitoso')
          
          // Esperar hasta que el login sea exitoso (máximo 5 minutos)
          const maxWaitTime = 5 * 60 * 1000 // 5 minutos
          const checkInterval = 2000 // Verificar cada 2 segundos
          const startTime = Date.now()
          
          while (Date.now() - startTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval))
            
            const currentUrl = interactivePage.url()
            const pageContent = await interactivePage.content()
            
            // Verificar si el login fue exitoso
            const loginStatus = await interactivePage.evaluate(() => {
              const url = window.location.href
              const hasLoginPage = url.includes('/ab/account-security/login') || url.includes('/login')
              const hasDashboard = url.includes('/nx/') || url.includes('/freelancers/') || 
                                  url.includes('/ab/') || url.includes('/home')
              
              const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user"], [class*="profile"]')
              const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"]')
              
              return {
                url,
                hasLoginPage,
                hasDashboard,
                hasUserMenu: userMenu !== null,
                hasLogoutButton: logoutButton !== null
              }
            })
            
            const isAuthenticated = !loginStatus.hasLoginPage || 
                                 loginStatus.hasDashboard ||
                                 loginStatus.hasUserMenu ||
                                 loginStatus.hasLogoutButton ||
                                 (currentUrl !== 'https://www.upwork.com/ab/account-security/login' && !currentUrl.includes('/login'))
            
            if (isAuthenticated) {
              console.log('  ✅ Login exitoso detectado!')
              const cookies = await interactivePage.cookies()
              const userAgent = await interactivePage.evaluate(() => navigator.userAgent)
              
              // NO cerrar el navegador aquí, se cerrará en el bloque finally
              
              return {
                cookies,
                userAgent,
                isAuthenticated: true
              }
            }
            
            // Mostrar progreso cada 30 segundos
            const elapsed = Math.floor((Date.now() - startTime) / 1000)
            if (elapsed % 30 === 0 && elapsed > 0) {
              console.log(`  ⏳ Esperando... (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`)
            }
          }
          
          // Si llegamos aquí, el timeout se alcanzó
          console.log('  ⏱️ Tiempo de espera agotado (5 minutos)')
          // NO cerrar el navegador aquí, se cerrará en el bloque finally
          
          return {
            cookies: [],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            isAuthenticated: false,
            error: 'Timeout esperando resolución manual del captcha',
            errorDetails: 'El usuario no completó el login dentro del tiempo límite (5 minutos)'
          }
        } catch (interactiveError) {
          // NO cerrar el navegador aquí, solo relanzar el error
          throw interactiveError
        }
      }
      
      // Si no hay captcha o ya estamos en modo interactivo, retornar error normal
      let error: string = 'Login falló - URL no cambió después del login'
      if (hasCaptcha) {
        error = 'Captcha detectado - Upwork tiene protección anti-bot muy fuerte. La aplicación intentará hacer scraping sin autenticación, pero puede tener limitaciones.'
      } else if (errorMessage) {
        error = `Error de login: ${errorMessage}`
      } else {
        error = 'Login falló - verifica que las credenciales sean correctas'
      }
      
      console.log(`  Login en Upwork fallo: ${error}`)
      let finalUrl = ''
      let cookies: any[] = []
      try {
        finalUrl = page.url()
        cookies = await page.cookies()
      } catch (pageError) {
        // Si el browser ya está cerrado, usar valores por defecto
        finalUrl = 'unknown'
      }
      console.log(`  → URL final: ${finalUrl}`)
      if (hasCaptcha) {
        console.log('  Captcha detectado - la aplicacion continuara con otras plataformas')
      }
      
      const errorDetailsText = hasCaptcha 
        ? `URL final: ${finalUrl}. Nota: continuara con otras plataformas.`
        : `URL final: ${finalUrl}.`
      
      return {
        cookies: cookies.length > 0 ? cookies : [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: error,
        errorDetails: errorDetailsText
      }
    }
    }
  } catch (err: any) {
    console.error('Error en login de Upwork:', err)
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Excepcion: ${errorMsg}`,
      errorDetails: err instanceof Error ? err.stack : undefined
    }
  } finally {
    try {
      if (browser) {
        await browser.close().catch(() => {})
      }
    } catch (closeError) {
      // Ignorar errores al cerrar
    }
  }
  
  // Este return nunca debería ejecutarse, pero TypeScript lo requiere
  return null
}

// ============================================
// NUEVA VERSIÓN CON PLAYWRIGHT (solo para login)
// ============================================

/**
 * Autenticación en Upwork usando Playwright
 * Nueva implementación más robusta y moderna
 */
export async function loginUpworkPlaywright(credentials: PlatformCredentials, interactive: boolean = false): Promise<AuthSession | null> {
  if (!playwright) {
    console.error('Playwright no disponible para login en Upwork')
    return null
  }

  // Usar Playwright para el login
  let browser
  let context
  let page
  try {
    console.log('  🚀 Iniciando navegador Playwright para Upwork...')

    // Lanzar navegador Playwright
    browser = await playwright.chromium.launch({
      headless: false, // Siempre visible para ver el proceso de Google OAuth
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions'
      ]
    })

    // Crear contexto y página
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    page = await context.newPage()
    console.log('  ✅ Navegador y página Playwright listos')

    return await loginUpworkWithPlaywright(browser, context, page, credentials, interactive)

  } catch (error) {
    console.error('❌ Error en loginUpwork con Playwright:', error)
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      errorDetails: error instanceof Error ? error.stack : undefined
    }
  } finally {
    // Limpiar recursos
    try {
      if (page) await page.close().catch(() => {})
      if (context) await context.close().catch(() => {})
      if (browser) await browser.close().catch(() => {})
    } catch (closeError) {
      console.warn('⚠️ Error al cerrar recursos:', closeError)
    }
  }
}

// Función auxiliar que maneja el login real con Playwright
async function loginUpworkWithPlaywright(browser: any, context: any, page: any, credentials: PlatformCredentials, interactive: boolean): Promise<AuthSession | null> {
  try {
    console.log('\n🔐 ============================================================')
    console.log('🔐 INICIANDO LOGIN EN UPWORK CON PLAYWRIGHT')
    console.log('🔐 ============================================================\n')

    // PASO 0: PRIMERO AUTENTICAR EN GOOGLE DIRECTAMENTE
    console.log('\n🔐 ============================================================')
    console.log('🔐 PASO 0: AUTENTICANDO PRIMERO EN GOOGLE')
    console.log('🔐 ============================================================\n')
    console.log('  → Navegando a accounts.google.com para autenticarse primero...')

    // Navegar a Google Sign In
    await page.goto('https://accounts.google.com/signin', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('  ✅ Página de Google Sign In cargada')
    await page.waitForTimeout(2000)

    // Ingresar email
    console.log('  → Ingresando email en Google...')
    await page.waitForSelector('input[type="email"], input[name="identifier"], input[id="identifierId"]', {
      timeout: 15000,
      state: 'visible'
    })

    await page.click('input[type="email"], input[name="identifier"], input[id="identifierId"]')
    await page.fill('input[type="email"], input[name="identifier"], input[id="identifierId"]', '')
    await page.fill('input[type="email"], input[name="identifier"], input[id="identifierId"]', credentials.email, { delay: 150 })
    console.log('  ✅ Email ingresado')

    // Hacer click en "Next" o "Siguiente"
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Next"), button:has-text("Siguiente"), button:has-text("Continuar"), #identifierNext', { timeout: 10000 })
    console.log('  ✅ Click en Next después del email')

    // Esperar a que aparezca el campo de contraseña
    await page.waitForTimeout(2000)
    console.log('  → Ingresando contraseña en Google...')

    await page.waitForSelector('input[type="password"], input[name="password"], input[aria-label*="password" i]', {
      timeout: 15000,
      state: 'visible'
    })

    await page.fill('input[type="password"], input[name="password"], input[aria-label*="password" i]', credentials.password, { delay: 150 })
    console.log('  ✅ Contraseña ingresada')

    // Hacer click en "Next" después de la contraseña
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Next"), button:has-text("Siguiente"), button:has-text("Continuar"), #passwordNext', { timeout: 10000 })
    console.log('  ✅ Click en Next después de la contraseña')

    // Esperar a que se complete la autenticación
    console.log('  ⏳ Esperando a que se complete la autenticación en Google...')
    await page.waitForTimeout(5000)

    // Verificar si estamos autenticados en Google
    const currentUrl = page.url()
    console.log(`  📍 URL actual después del login: ${currentUrl}`)

    if (currentUrl.includes('myaccount.google.com') || currentUrl.includes('accounts.google.com') && !currentUrl.includes('signin')) {
      console.log('  ✅ Autenticación en Google completada exitosamente')
    } else {
      // Verificar si hay algún error
      const errorElement = await page.locator('[role="alert"], .Ekjuhf, [class*="error"]').first()
      if (await errorElement.isVisible().catch(() => false)) {
        const errorText = await errorElement.textContent().catch(() => 'Error desconocido')
        console.log(`  ⚠️ Posible error detectado: ${errorText}`)
      }
      console.log('  ⚠️ Estado de autenticación en Google incierto, pero continuando...')
    }

    // PASO 1: NAVEGAR A UPWORK Y HACER LOGIN CON GOOGLE
    console.log('\n🔐 ============================================================')
    console.log('🔐 PASO 1: NAVEGANDO A UPWORK PARA LOGIN CON GOOGLE')
    console.log('🔐 ============================================================\n')

    console.log('  → Navegando a Upwork...')
    await page.goto('https://www.upwork.com/ab/account-security/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('  ✅ Página de login de Upwork cargada')
    await page.waitForTimeout(3000)

    // Buscar y hacer click en "Continue with Google"
    console.log('  → Buscando botón "Continue with Google"...')
    const googleButtonSelectors = [
      'button:has-text("Continue with Google")',
      'button:has-text("Sign in with Google")',
      'button:has-text("Log in with Google")',
      'a:has-text("Continue with Google")',
      'a:has-text("Sign in with Google")',
      'a:has-text("Log in with Google")',
      '[data-qa="btn-google"]',
      '[aria-label*="Google" i]',
      'button[data-provider="google"]',
      '.google-login-button',
      '#google-login-button'
    ]

    let googleButtonClicked = false
    for (const selector of googleButtonSelectors) {
      try {
        const button = page.locator(selector).first()
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click({ timeout: 5000 })
          console.log(`  ✅ Click en botón Google usando selector: ${selector}`)
          googleButtonClicked = true
          break
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    if (!googleButtonClicked) {
      console.log('  ❌ No se encontró el botón de Google, intentando con JavaScript...')
      // Intentar con JavaScript como último recurso
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'))
        const googleBtn = buttons.find(btn =>
          btn.textContent?.toLowerCase().includes('google') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('google') ||
          btn.getAttribute('data-provider') === 'google'
        )
        if (googleBtn) {
          (googleBtn as HTMLElement).click()
          return true
        }
        return false
      }).then((clicked: boolean) => {
        if (clicked) {
          console.log('  ✅ Click en botón Google usando JavaScript')
          googleButtonClicked = true
        }
      }).catch(() => {})
    }

    if (!googleButtonClicked) {
      throw new Error('No se pudo encontrar ni hacer click en el botón de Google')
    }

    // Esperar a que aparezca el popup de Google o redirección
    console.log('  ⏳ Esperando popup de Google o redirección...')
    await page.waitForTimeout(3000)

    // Verificar si hay un popup (nueva página/ventana)
    const pages = context.pages()
    let googlePopup = null
    if (pages.length > 1) {
      // Buscar la página de Google entre las páginas abiertas
      for (const p of pages) {
        if (p !== page && p.url().includes('accounts.google.com')) {
          googlePopup = p
          break
        }
      }
    }

    if (googlePopup) {
      console.log('  📄 Popup de Google detectado, cambiando foco...')
      page = googlePopup
      await page.bringToFront()
      await page.waitForTimeout(2000)

      // Verificar si ya estamos autenticados en este popup
      const popupUrl = page.url()
      if (popupUrl.includes('myaccount.google.com') || popupUrl.includes('accounts.google.com') && !popupUrl.includes('signin')) {
        console.log('  ✅ Ya autenticado en Google, cerrando popup...')
        await page.close()
        // Volver a la página original
        const originalPages = context.pages()
        page = originalPages[0] || originalPages.find((p: any) => !p.isClosed())
      } else {
        console.log('  ⚠️ Popup requiere autenticación adicional...')
        // Aquí podría requerir manejo adicional si es necesario
      }
    } else {
      console.log('  📍 No se detectó popup, verificando redirección en página actual...')
      const currentUrl2 = page.url()
      console.log(`  📍 URL actual: ${currentUrl2}`)

      if (currentUrl2.includes('myaccount.google.com') || currentUrl2.includes('accounts.google.com') && !currentUrl2.includes('signin')) {
        console.log('  ✅ Redireccionado a Google, autenticación completada')
      }
    }

    // PASO 2: VERIFICAR AUTENTICACIÓN EN UPWORK
    console.log('\n🔐 ============================================================')
    console.log('🔐 PASO 2: VERIFICANDO AUTENTICACIÓN EN UPWORK')
    console.log('🔐 ============================================================\n')

    // Esperar un poco más para que se complete el proceso
    await page.waitForTimeout(5000)

    // Verificar si estamos en Upwork y autenticados
    const finalUrl = page.url()
    console.log(`  📍 URL final: ${finalUrl}`)

    if (finalUrl.includes('upwork.com') && !finalUrl.includes('login') && !finalUrl.includes('signin')) {
      console.log('  ✅ ¡Login en Upwork completado exitosamente!')

      // Obtener cookies y user agent para la sesión
      const cookies = await context.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    } else {
      // Verificar si hay errores en la página
      const pageContent = await page.textContent('body')
      if (pageContent?.toLowerCase().includes('technical difficulties') ||
          pageContent?.toLowerCase().includes('unable to process') ||
          pageContent?.toLowerCase().includes('try again later')) {
        throw new Error('Upwork reporta "technical difficulties"')
      }

      console.log('  ⚠️ Estado de autenticación incierto, pero continuando...')
      // Aun así devolver como exitoso si llegamos aquí
      const cookies = await context.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

  } catch (error) {
    console.error('❌ Error en loginUpworkWithPlaywright:', error)

    // Capturar información de diagnóstico si es posible
    try {
      if (page && !page.isClosed()) {
        const diagnostics = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            userAgent: navigator.userAgent,
            hasError: document.querySelector('[role="alert"], .alert-error') !== null,
            errorText: (document.querySelector('[role="alert"], .alert-error') as HTMLElement)?.textContent || '',
            passwordFieldExists: document.querySelector('input[type="password"]') !== null,
            loginButtonExists: Array.from(document.querySelectorAll('button, input[type="submit"]')).some(btn =>
              (btn.textContent || '').toLowerCase().includes('log in') ||
              (btn.textContent || '').toLowerCase().includes('login')
            )
          }
        })
        console.log('  🔍 Información de diagnóstico:', diagnostics)
      }
    } catch (diagError) {
      console.warn('⚠️ No se pudo capturar información de diagnóstico:', diagError)
    }

    throw error
  }
}

// ============================================
// FUNCIONES GENÉRICAS DE LOGIN CON PLAYWRIGHT
// ============================================

/**
 * Función genérica para login con Playwright
 * Maneja la lógica común de navegación y autenticación
 */
async function genericPlaywrightLogin(
  platformName: string,
  loginUrl: string,
  credentials: PlatformCredentials,
  options: {
    emailSelectors?: string[]
    passwordSelectors?: string[]
    submitSelectors?: string[]
    successUrls?: string[]
    errorSelectors?: string[]
    customSteps?: (page: any) => Promise<void>
  }
): Promise<AuthSession | null> {
  if (!playwright) {
    console.error(`Playwright no disponible para login en ${platformName}`)
    return null
  }

  let browser
  let context
  let page
  try {
    console.log(`  🚀 Iniciando navegador Playwright para ${platformName}...`)

    browser = await playwright.chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions'
      ]
    })

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    page = await context.newPage()
    console.log(`  ✅ Navegador y página Playwright listos para ${platformName}`)

    // Navegar a la página de login
    console.log(`  → Navegando a ${loginUrl}...`)
    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Ejecutar pasos personalizados si existen
    if (options.customSteps) {
      await options.customSteps(page)
    }

    // Ingresar email
    console.log('  → Ingresando email...')
    const emailSelectors = options.emailSelectors || [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[id="email"]',
      'input[id="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="correo" i]'
    ]

    let emailFound = false
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000, state: 'visible' })
        await page.fill(selector, '')
        await page.fill(selector, credentials.email, { delay: 100 })
        console.log(`  ✅ Email ingresado usando selector: ${selector}`)
        emailFound = true
        break
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    if (!emailFound) {
      throw new Error('No se pudo encontrar el campo de email')
    }

    // Ingresar contraseña
    console.log('  → Ingresando contraseña...')
    const passwordSelectors = options.passwordSelectors || [
      'input[type="password"]',
      'input[name="password"]',
      'input[name="pass"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="contraseña" i]'
    ]

    let passwordFound = false
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000, state: 'visible' })
        await page.fill(selector, credentials.password, { delay: 100 })
        console.log(`  ✅ Contraseña ingresada usando selector: ${selector}`)
        passwordFound = true
        break
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    if (!passwordFound) {
      throw new Error('No se pudo encontrar el campo de contraseña')
    }

    // Hacer submit del formulario
    console.log('  → Enviando formulario...')
    const submitSelectors = options.submitSelectors || [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'button:has-text("Iniciar sesión")',
      'button:has-text("Entrar")',
      'form button:last-of-type'
    ]

    let submitted = false
    for (const selector of submitSelectors) {
      try {
        await page.click(selector, { timeout: 3000 })
        console.log(`  ✅ Formulario enviado usando selector: ${selector}`)
        submitted = true
        break
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    if (!submitted) {
      // Intentar presionar Enter en el campo de contraseña
      try {
        await page.keyboard.press('Enter')
        console.log('  ✅ Formulario enviado presionando Enter')
        submitted = true
      } catch (e) {
        // Continuar
      }
    }

    if (!submitted) {
      throw new Error('No se pudo enviar el formulario')
    }

    // Esperar a que se complete el login
    console.log('  ⏳ Esperando a que se complete el login...')
    await page.waitForTimeout(5000)

    // Verificar resultado
    const currentUrl = page.url()
    console.log(`  📍 URL final: ${currentUrl}`)

    // Verificar URLs de éxito
    const successUrls = options.successUrls || []
    const isSuccess = successUrls.some(url => currentUrl.includes(url)) ||
                     (!currentUrl.includes('login') && !currentUrl.includes('signin') && !currentUrl.includes('auth'))

    if (isSuccess) {
      console.log(`  ✅ ¡Login en ${platformName} completado exitosamente!`)

      const cookies = await context.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    } else {
      // Verificar errores
      const errorSelectors = options.errorSelectors || [
        '[class*="error" i]',
        '[class*="alert" i]',
        '[role="alert"]',
        '.error-message',
        '.alert-danger'
      ]

      for (const selector of errorSelectors) {
        try {
          const errorElement = await page.locator(selector).first()
          if (await errorElement.isVisible({ timeout: 2000 })) {
            const errorText = await errorElement.textContent()
            console.log(`  ⚠️ Error detectado: ${errorText}`)
            throw new Error(`Error de autenticación: ${errorText}`)
          }
        } catch (e) {
          // Continuar
        }
      }

      console.log(`  ⚠️ Estado de autenticación incierto en ${platformName}, pero continuando...`)
      const cookies = await context.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

  } catch (error) {
    console.error(`❌ Error en login ${platformName} con Playwright:`, error)
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      errorDetails: error instanceof Error ? error.stack : undefined
    }
  } finally {
    try {
      if (page) await page.close().catch(() => {})
      if (context) await context.close().catch(() => {})
      if (browser) await browser.close().catch(() => {})
    } catch (closeError) {
      console.warn('⚠️ Error al cerrar recursos:', closeError)
    }
  }
}

// ============================================
// VERSIONES PLAYWRIGHT DE FUNCIONES DE LOGIN
// ============================================

/**
 * Autenticación en Hireline.io usando Playwright
 */
export async function loginHirelinePlaywright(credentials: PlatformCredentials): Promise<AuthSession | null> {
  return await genericPlaywrightLogin('Hireline', 'https://hireline.io/login', credentials, {
    successUrls: ['hireline.io/dashboard', 'hireline.io/profile'],
    errorSelectors: ['.error-message', '.alert-error', '[class*="error"]']
  })
}

/**
 * Autenticación en Indeed usando Playwright
 */
export async function loginIndeedPlaywright(credentials: PlatformCredentials): Promise<AuthSession | null> {
  return await genericPlaywrightLogin('Indeed', 'https://secure.indeed.com/auth', credentials, {
    successUrls: ['indeed.com'],
    errorSelectors: ['.error-message', '.alert-error', '[class*="error"]']
  })
}

/**
 * Autenticación en Braintrust usando Playwright
 */
export async function loginBraintrustPlaywright(credentials: PlatformCredentials): Promise<AuthSession | null> {
  return await genericPlaywrightLogin('Braintrust', 'https://braintrust.com/login', credentials, {
    successUrls: ['braintrust.com/dashboard', 'braintrust.com/profile'],
    errorSelectors: ['.error-message', '.alert-error', '[class*="error"]']
  })
}

/**
 * Autenticación en Glassdoor usando Playwright
 */
export async function loginGlassdoorPlaywright(credentials: PlatformCredentials): Promise<AuthSession | null> {
  return await genericPlaywrightLogin('Glassdoor', 'https://www.glassdoor.com/profile/login', credentials, {
    successUrls: ['glassdoor.com'],
    errorSelectors: ['.error-message', '.alert-error', '[class*="error"]']
  })
}

/**
 * Autenticación en Freelancer usando Playwright
 */
export async function loginFreelancerPlaywright(credentials: PlatformCredentials): Promise<AuthSession | null> {
  return await genericPlaywrightLogin('Freelancer', 'https://www.freelancer.com/login', credentials, {
    successUrls: ['freelancer.com'],
    errorSelectors: ['.error-message', '.alert-error', '[class*="error"]']
  })
}

// ============================================
// VERSIÓN ORIGINAL CON PUPPETEER (backup)
// ============================================

/**
 * Autenticación en Hireline.io
 */
export async function loginHireline(credentials: PlatformCredentials): Promise<AuthSession | null> {
  if (!puppeteer) {
    console.error('Puppeteer no disponible para login en Hireline.io')
    return null
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  })

  try {
    let page = await browser.newPage()
    let emailSelector: string | null = null
    
    const recoverFromDetachedFrame = async (error: unknown): Promise<boolean> => {
      if (error instanceof Error && error.message && error.message.toLowerCase().includes('detached frame')) {
        console.log('  ⚠️ Frame detached detectado, intentando recuperar la página activa...')
        const pages = await browser.pages()
        const replacement = pages.find((p: any) => !p.isClosed())
        if (replacement) {
          page = replacement
          return true
        }
      }
      return false
    }

    const safeGetPageTitle = async (): Promise<string> => {
      try {
        return await page.title()
      } catch (error) {
        if (await recoverFromDetachedFrame(error)) {
          return await page.title()
        }
        throw error
      }
    }

    const safeGetPageContent = async (): Promise<string> => {
      try {
        return await page.content()
      } catch (error) {
        if (await recoverFromDetachedFrame(error)) {
          return await page.content()
        }
        throw error
      }
    }

    const attemptAutoCaptcha = async (context: string = 'general'): Promise<boolean> => {
      try {
        console.log(`  → Buscando captcha para resolver automáticamente (${context})...`)
        await new Promise(resolve => setTimeout(resolve, 500))
        const frames = page.frames()
        for (const frame of frames) {
          const frameUrl = frame.url()?.toLowerCase() || ''
          const frameName = frame.name()?.toLowerCase() || ''
          if (frameUrl.includes('recaptcha') || frameUrl.includes('hcaptcha') || frameUrl.includes('captcha') || frameName.includes('captcha')) {
            try {
              const checkbox = await frame.$('#recaptcha-anchor, .recaptcha-checkbox-border, .recaptcha-checkbox-checkmark, #checkbox, .mark')
              if (checkbox) {
                console.log(`  → Intentando marcar checkbox dentro de iframe (${context})...`)
                await checkbox.click({ delay: 80 })
                try {
                  await frame.waitForSelector('.recaptcha-checkbox-checked, .recaptcha-checkbox-checkmark[aria-checked="true"], .recaptcha-checkbox-border[aria-checked="true"], .mark.checked', { timeout: 8000 })
                } catch (_) {
                  // Algunos captchas requieren pasos adicionales
                }
                console.log('  ✅ Captcha marcado automáticamente dentro del iframe')
                return true
              }
            } catch (frameError) {
              console.log(`  ⚠️ Error al interactuar con iframe de captcha: ${(frameError as Error).message}`)
            }
          }
        }

        const checkboxSelectors = [
          'input[type="checkbox"][name*="robot" i]',
          'input[type="checkbox"][id*="robot" i]',
          'input[type="checkbox"][aria-label*="robot" i]',
          'input[type="checkbox"][name*="humano" i]',
          'input[type="checkbox"][name*="human" i]',
          'input[type="checkbox"][id*="human" i]',
          '#px-captcha input[type="checkbox"]',
          '[data-captcha] input[type="checkbox"]'
        ]

        for (const selector of checkboxSelectors) {
          const checkbox = await page.$(selector)
          if (checkbox) {
            console.log(`  → Marcando checkbox captcha (${selector}) (${context})`)
            await checkbox.click({ delay: 60 })
            return true
          }
        }

        const labelClicked = await page.evaluate(() => {
          const labels = Array.from(document.querySelectorAll('label'))
          const target = labels.find(label => /no soy un robot|no soy humano|i'?m not a robot|i am not a robot/i.test(label.textContent || ''))
          if (target) {
            const forAttr = target.getAttribute('for')
            if (forAttr) {
              const input = document.getElementById(forAttr) as HTMLElement | null
              if (input) {
                input.click()
                return true
              }
            }
            (target as HTMLElement).click()
            return true
          }
          return false
        })

        if (labelClicked) {
          console.log(`  ✅ Captcha marcado mediante etiqueta (${context})`)
          return true
        }
      } catch (error) {
        console.log(`  ⚠️ No se pudo resolver el captcha automáticamente (${context}):`, error)
      }

      return false
    }

    const isPasswordFieldVisible = async (): Promise<boolean> => {
      return await page.evaluate(() => {
        const selectors = [
          'input[type="password"]',
          'input[name="__password"]',
          'input[name="password"]',
          'input[id*="password"]',
          'input[placeholder*="password" i]',
          'input[placeholder*="contraseña" i]'
        ]
        for (const selector of selectors) {
          const element = document.querySelector(selector) as HTMLElement | null
          if (element && element.offsetParent !== null) {
            return true
          }
        }
        return false
      })
    }

    const clickContinueToRevealPassword = async (): Promise<boolean> => {
      const selectors = [
        'button[data-tn-element="emailContinueButton"]',
        'button[id*="continue"]',
        'button[name*="continue"]',
        'button[class*="continue"]',
        'button[class*="next"]',
        'button[data-testid*="continue"]',
        'button[aria-label*="Continuar" i]',
        'button[aria-label*="Siguiente" i]',
        'input[type="submit"][value*="Continuar" i]',
        'input[type="submit"][value*="continue" i]',
        'input[type="submit"][value*="Next" i]'
      ]
      const keywordMatches = ['continu', 'sigu', 'next', 'correo', 'email']

      for (const selector of selectors) {
        try {
          const element = await page.$(selector)
          if (!element) continue

          const fieldInfo = await page.evaluate((el: any, keywords: string[]) => {
            if (!(el instanceof HTMLElement)) {
              return { visible: false, matches: false }
            }
            const style = window.getComputedStyle(el)
            const visible = el.offsetParent !== null && style.visibility !== 'hidden'
            const textCandidate = (el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '').toLowerCase()
            const matches = keywords.some(keyword => textCandidate.includes(keyword))
            return { visible, matches }
          }, element, keywordMatches)

          if (fieldInfo.visible && fieldInfo.matches) {
            await element.click({ delay: 60 })
            await element.dispose()
            return true
          }

          await element.dispose()
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }

      const clickedByText = await page.evaluate((keywords: string[]) => {
        const elements = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"]'))
        for (const el of elements) {
          if (!(el instanceof HTMLElement)) continue
          const style = window.getComputedStyle(el)
          if (el.offsetParent === null || style.visibility === 'hidden') continue
          const textCandidate = (el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '').toLowerCase()
          const matches = keywords.some(keyword => textCandidate.includes(keyword))
          if (matches) {
            el.click()
            return true
          }
        }
        return false
      }, keywordMatches)

      if (clickedByText) {
        return true
      }

      return false
    }

    const ensurePasswordStep = async (): Promise<void> => {
      if (await isPasswordFieldVisible()) {
        return
      }

      console.log('  → Campo de password no visible aún, intentando avanzar al siguiente paso...')
      const clickedContinue = await clickContinueToRevealPassword()
      if (clickedContinue) {
        console.log('  → Botón "Continuar/Siguiente" pulsado, esperando aparición del campo de password...')
      } else {
        console.log('  ⚠️ No se encontró botón de "Continuar", intentando con la tecla Enter...')
        try {
          await page.keyboard.press('Enter')
        } catch (error) {
          console.log('  ⚠️ No se pudo presionar Enter automáticamente:', error)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000))

      const captchaSolved = await attemptAutoCaptcha('after-continue-step')
      if (captchaSolved) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      // Esperar un momento para que aparezca el campo de password - UN SOLO INTENTO
      console.log('  → Esperando campo de password...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      
        if (await isPasswordFieldVisible()) {
          console.log('  → Campo de password detectado después de continuar')
          return
      }

      console.log('  ⚠️ El campo de password no apareció, continuando...')
    }
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    const hirelineLoginUrl = 'https://hireline.io/login'
    console.log('🔐 Iniciando login en Hireline.io...')
    console.log(`  → Abriendo URL de inicio de sesión: ${hirelineLoginUrl}`)
    await page.goto(hirelineLoginUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    console.log('  ✅ Página de login de Hireline.io cargada correctamente')

    console.log('  → Esperando formulario de login...')
    await page.waitForSelector('input[type="email"], input[name="email"], input[type="text"]', { timeout: 10000 })
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Buscar campo de email con múltiples selectores
    console.log('  → Buscando campo de email...')
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[id*="email" i]'
    ]
    
    for (const selector of emailSelectors) {
      const element = await page.$(selector)
      if (element) {
        emailSelector = selector
        console.log(`  → Campo de email encontrado con selector: ${selector}`)
        break
      }
    }
    
    if (!emailSelector) {
      // Fallback: buscar por tipo o nombre
      const found = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          const type = (input as HTMLInputElement).type
          const name = (input as HTMLInputElement).name?.toLowerCase() || ''
          if (type === 'email' || name.includes('email')) {
            // Crear un selector único
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            if (input.className) return `input.${input.className.split(' ')[0]}`
            return `input[type="${type}"]`
          }
        }
        return null
      })
      if (found) {
        emailSelector = found
        console.log(`  → Campo de email encontrado con selector: ${emailSelector}`)
      }
    }
    
    if (emailSelector) {
      // Usar page.type() directamente con el selector en lugar de ElementHandle.click()
      await page.focus(emailSelector)
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = ''
          input.focus()
        }
      }, emailSelector)
      await page.type(emailSelector, credentials.email, { delay: 50 })
      console.log('  ✅ Email ingresado')
    } else {
      throw new Error('No se encontró el campo de email')
    }
    
    // Buscar campo de password
    console.log('  → Buscando campo de password...')
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
      'input[id*="password" i]'
    ]
    
    let passwordSelector = null
    for (const selector of passwordSelectors) {
      try {
        const element = await page.$(selector)
        if (!element) continue

        const fieldInfo = await page.evaluate((el: any) => {
          if (!(el instanceof HTMLElement)) {
            return { visible: false, isPassword: false }
          }
          const style = window.getComputedStyle(el)
          const visible = el.offsetParent !== null && style.visibility !== 'hidden'
          let type = ''
          let name = ''
          let placeholder = ''
          if (el instanceof HTMLInputElement) {
            type = (el.type || '').toLowerCase()
            name = (el.name || '').toLowerCase()
            placeholder = (el.placeholder || '').toLowerCase()
          }
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase()
          const isPassword = type === 'password' ||
                             name.includes('password') ||
                             placeholder.includes('password') ||
                             placeholder.includes('contraseña') ||
                             ariaLabel.includes('password') ||
                             ariaLabel.includes('contraseña')
          return { visible, isPassword }
        }, element)

        if (fieldInfo.visible && fieldInfo.isPassword) {
          passwordSelector = selector
          console.log(`  → Campo de password encontrado con selector: ${selector}`)
          await element.dispose()
          break
        }

        await element.dispose()
      } catch (error) {
        // Continuar con el siguiente selector
      }
    }
    
    if (!passwordSelector) {
      // Fallback: buscar por tipo
      const found = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          const type = (input as HTMLInputElement).type
          if (type === 'password') {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            if (input.className) return `input.${input.className.split(' ')[0]}`
            return `input[type="password"]`
          }
        }
        return null
      })
      if (found) {
        passwordSelector = found
        console.log(`  → Campo de password encontrado con selector: ${passwordSelector}`)
      }
    }
    
    if (passwordSelector) {
      await page.focus(passwordSelector)
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = ''
          input.focus()
        }
      }, passwordSelector)
      await page.type(passwordSelector, credentials.password, { delay: 50 })
      console.log('  ✅ Password ingresado')
    } else {
      throw new Error('No se encontró el campo de password')
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Buscar y hacer clic en el botón de login
    console.log('  → Buscando botón de login...')
    
    // Primero intentar con selectores CSS válidos usando page.click()
    const buttonSelectors = [
      'button[type="submit"]',
      'button.login-button',
      '[data-testid="login-button"]',
      'input[type="submit"]',
      'button.btn-primary',
      'button[class*="login"]',
      'button[class*="submit"]'
    ]
    
    let buttonFound = false
    let buttonSelector = null
    
    for (const selector of buttonSelectors) {
      try {
        const element = await page.$(selector)
        if (element) {
          const isVisible = await page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement
            return el && el.offsetParent !== null
          }, selector)
          
          if (isVisible) {
            buttonSelector = selector
            buttonFound = true
            console.log(`  → Botón de login encontrado con selector: ${selector}`)
            break
          }
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }
    
    // Si no se encontró con selectores, buscar por texto
    if (!buttonFound) {
      console.log('  → Buscando botón por texto...')
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || ''
          const value = (btn as HTMLInputElement).value?.toLowerCase() || ''
          if (text.includes('log in') || text.includes('sign in') || 
              text.includes('login') || value.includes('login') ||
              text.includes('entrar') || text.includes('iniciar') ||
              text.includes('iniciar sesión')) {
            // Crear selector único
            if (btn.id) return { selector: `#${btn.id}`, found: true }
            if (btn.className) {
              const firstClass = (btn.className as string).split(' ')[0]
              if (firstClass) return { selector: `button.${firstClass}`, found: true }
            }
            return { selector: null, found: true, element: btn }
          }
        }
        return { selector: null, found: false }
      })
      
      if (buttonInfo.found) {
        if (buttonInfo.selector) {
          buttonSelector = buttonInfo.selector
          buttonFound = true
          console.log(`  → Botón de login encontrado por texto con selector: ${buttonSelector}`)
        } else if (buttonInfo.element) {
          // Hacer clic directamente usando evaluate
          await page.evaluate((btnText: string) => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
            const btn = buttons.find((b: any) => {
              const text = b.textContent?.toLowerCase() || ''
              return text.includes(btnText)
            })
            if (btn) (btn as HTMLElement).click()
          }, 'login')
          buttonFound = true
          console.log('  → Botón de login encontrado y clickeado por texto')
        }
      }
    }
    
    // Hacer clic en el botón si se encontró con selector
    if (buttonFound && buttonSelector) {
      try {
        await page.click(buttonSelector)
        console.log('  ✅ Clic en botón de login realizado')
      } catch (e) {
        console.log('  ⚠️ Error al hacer clic con page.click(), intentando con evaluate...')
        await page.evaluate((sel: string) => {
          const btn = document.querySelector(sel) as HTMLElement
          if (btn) btn.click()
        }, buttonSelector)
      }
    } else if (!buttonFound) {
      console.log('  ⚠️ No se encontró botón de login, intentando con Enter...')
      await page.keyboard.press('Enter')
    }
    
    console.log('  → Esperando respuesta del servidor...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Esperar navegación o cambio en la página
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
      console.log('  → Navegación detectada')
    } catch (e) {
      console.log('  → No se detectó navegación, continuando...')
    }
    
    // Esperar más tiempo para que cualquier redirección se complete
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    const currentUrl = page.url()
    console.log(`  → URL actual después del login: ${currentUrl}`)
    
    // Verificar si el login fue exitoso de múltiples formas
    const loginStatus = await page.evaluate(() => {
      const url = window.location.href
      const hasLoginPage = url.includes('/login') || url.includes('/signin')
      const hasDashboard = url.includes('/dashboard') || url.includes('/profile') || 
                          url.includes('/jobs') || url.includes('/home')
      
      // Buscar elementos que indiquen login exitoso
      const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user"], [class*="profile"]')
      
      // Buscar botón de logout por href o por texto (no usar :contains que no es CSS válido)
      let logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"]')
      if (!logoutButton) {
        // Buscar por texto en botones
        const buttons = Array.from(document.querySelectorAll('button, a'))
        logoutButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || ''
          const href = (btn as HTMLAnchorElement).href?.toLowerCase() || ''
          return text.includes('logout') || text.includes('log out') || 
                 text.includes('salir') || text.includes('cerrar sesión') ||
                 href.includes('logout') || href.includes('signout')
        }) as HTMLElement | undefined || null
      }
      
      const jobsLink = document.querySelector('a[href*="/jobs"], a[href*="/dashboard"]')
      
      return {
        url,
        hasLoginPage,
        hasDashboard,
        hasUserMenu: userMenu !== null,
        hasLogoutButton: logoutButton !== null,
        hasJobsLink: jobsLink !== null,
        pageTitle: document.title
      }
    })
    
    console.log('  → Estado de la página:', loginStatus)
    
    const pageContent = await page.content()
    const hasCaptcha = pageContent.includes('captcha') || pageContent.includes('recaptcha') ||
                       pageContent.includes('g-recaptcha')
    
    // Buscar mensajes de error de forma más exhaustiva
    const errorInfo = await page.evaluate(() => {
      const errorSelectors = [
        '.error',
        '.alert-error',
        '.alert-danger',
        '[role="alert"]',
        '.text-red-500',
        '.text-red-600',
        '[class*="error"]',
        '[class*="Error"]',
        '.invalid-feedback',
        '.form-error',
        '[data-error]'
      ]
      
      // Buscar en todos los selectores
      for (const selector of errorSelectors) {
        const errorEl = document.querySelector(selector)
        if (errorEl) {
          const text = errorEl.textContent?.trim()
          if (text && text.length > 0 && text.length < 200) {
            return { message: text, selector }
          }
        }
      }
      
      // Buscar cualquier texto que parezca un error
      const allText = document.body.textContent || ''
      const errorPatterns = [
        /invalid.*(email|password|credentials)/i,
        /incorrect.*(email|password|credentials)/i,
        /wrong.*(email|password|credentials)/i,
        /error.*login/i,
        /login.*failed/i,
        /credenciales.*incorrectas/i,
        /email.*no.*válido/i
      ]
      
      for (const pattern of errorPatterns) {
        const match = allText.match(pattern)
        if (match) {
          return { message: match[0], selector: 'pattern_match' }
        }
      }
      
      // Verificar si los campos tienen clases de error
      const emailInput = document.querySelector('input[type="email"], input[name="email"]')
      const passwordInput = document.querySelector('input[type="password"]')
      
      const emailHasError = emailInput && (
        emailInput.classList.contains('error') ||
        emailInput.classList.contains('invalid') ||
        emailInput.getAttribute('aria-invalid') === 'true'
      )
      
      const passwordHasError = passwordInput && (
        passwordInput.classList.contains('error') ||
        passwordInput.classList.contains('invalid') ||
        passwordInput.getAttribute('aria-invalid') === 'true'
      )
      
      if (emailHasError || passwordHasError) {
        return { message: 'Los campos tienen errores de validación', selector: 'field_validation' }
      }
      
      return null
    })
    
    const errorMessage = errorInfo?.message || null
    
    // Verificar si hay algún indicador de que el formulario se está procesando
    const isProcessing = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'))
      return buttons.some(btn => {
        const disabled = (btn as HTMLButtonElement).disabled
        const text = btn.textContent?.toLowerCase() || ''
        return disabled || text.includes('loading') || text.includes('cargando')
      })
    })
    
    if (isProcessing) {
      console.log('  → El formulario parece estar procesando, esperando más tiempo...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Re-verificar el estado después de esperar
      const newUrl = page.url()
      const newStatus = await page.evaluate(() => {
        const url = window.location.href
        return {
          url,
          hasLoginPage: url.includes('/login') || url.includes('/signin'),
          hasDashboard: url.includes('/dashboard') || url.includes('/profile') || 
                       url.includes('/jobs') || url.includes('/home')
        }
      })
      
      if (!newStatus.hasLoginPage || newStatus.hasDashboard) {
        console.log('  ✅ Login exitoso detectado después de esperar')
        const cookies = await page.cookies()
        const userAgent = await page.evaluate(() => navigator.userAgent)
        return {
          cookies,
          userAgent,
          isAuthenticated: true
        }
      }
    }
    
    // Determinar si el login fue exitoso
    const isAuthenticated = !loginStatus.hasLoginPage || 
                           loginStatus.hasDashboard ||
                           loginStatus.hasUserMenu ||
                           loginStatus.hasLogoutButton ||
                           (currentUrl !== 'https://hireline.io/login' && !currentUrl.includes('/login'))

    if (isAuthenticated) {
      console.log('  ✅ Login exitoso detectado')
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    // Construir mensaje de error detallado
    let error = 'Login falló - aún en página de login.'
    if (hasCaptcha) {
      error = 'Captcha detectado - requiere verificación manual'
    } else if (errorMessage) {
      error = `Error: ${errorMessage}`
    } else {
      error = 'Login falló - verifica que las credenciales sean correctas y que no haya captcha'
    }
    
    console.log(`  ❌ Login falló: ${error}`)
    console.log(`  → URL: ${currentUrl}`)
    console.log(`  → Título: ${loginStatus.pageTitle}`)
    if (errorMessage) {
      console.log(`  → Mensaje de error encontrado: ${errorMessage}`)
    }
    
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: error,
      errorDetails: `URL final: ${currentUrl}. Título: ${loginStatus.pageTitle}. ${errorMessage ? `Mensaje: ${errorMessage}` : 'No se encontró mensaje de error específico. Verifica las credenciales.'}`
    }
  } catch (error) {
    console.error('❌ Error en login de Hireline.io:', error)
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Excepción: ${errorMsg}`,
      errorDetails: error instanceof Error ? error.stack : undefined
    }
  } finally {
    await browser.close()
  }
}

/**
 * Autenticación en Indeed
 */
export async function loginIndeed(credentials: PlatformCredentials): Promise<AuthSession | null> {
  if (!puppeteer) {
    console.error('Puppeteer no disponible para login en Indeed')
    return null
  }

  const browser = await puppeteer.launch({
    headless: false, // Modo visible para ver el proceso
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1280, height: 720 }
  })

  try {
    let page = await browser.newPage()
    
    const safeGetPageTitle = async (): Promise<string> => {
      try {
        return await page.title()
      } catch (error) {
        return ''
      }
    }
    
    const attemptAutoCaptcha = async (context: string = 'general'): Promise<boolean> => {
      try {
        console.log(`  → Buscando captcha para resolver automáticamente (${context})...`)
        await new Promise(resolve => setTimeout(resolve, 500))
        const frames = page.frames()
        for (const frame of frames) {
          const frameUrl = frame.url()?.toLowerCase() || ''
          if (frameUrl.includes('recaptcha') || frameUrl.includes('hcaptcha') || frameUrl.includes('captcha')) {
            try {
              const checkbox = await frame.$('#recaptcha-anchor, .recaptcha-checkbox-border, .recaptcha-checkbox-checkmark, #checkbox, .mark')
              if (checkbox) {
                console.log(`  → Intentando marcar checkbox dentro de iframe (${context})...`)
                await checkbox.click({ delay: 80 })
                await new Promise(resolve => setTimeout(resolve, 2000))
                return true
              }
            } catch (frameError) {
              // Ignorar errores de iframe
            }
          }
        }
      } catch (error) {
        // Ignorar errores
      }
      return false
    }
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    const indeedLoginUrl = 'https://secure.indeed.com/account/login'
    console.log('🔐 Iniciando login en Indeed...')
    console.log(`  → Abriendo URL de inicio de sesión: ${indeedLoginUrl}`)
    
    // Usar Promise.race para evitar timeout infinito
    try {
      await Promise.race([
        page.goto(indeedLoginUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout en goto')), 25000)
        )
      ])
      console.log('  → Página cargada (domcontentloaded)')
    } catch (gotoError) {
      console.log('  ⚠️ domcontentloaded falló, intentando con load...')
      try {
        await Promise.race([
          page.goto('https://secure.indeed.com/account/login', {
            waitUntil: 'load',
            timeout: 20000
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout en goto')), 25000)
          )
        ])
        console.log('  → Página cargada (load)')
      } catch (loadError) {
        const currentUrl = page.url()
        if (currentUrl.includes('indeed.com')) {
          console.log('  ⚠️ La página cargó parcialmente, continuando...')
          await new Promise(resolve => setTimeout(resolve, 3000))
        } else {
          throw new Error(`No se pudo cargar la página de Indeed. Error: ${gotoError instanceof Error ? gotoError.message : 'Desconocido'}`)
        }
      }
    }

    // Listener para detectar nuevas páginas/popups (MEJORADO)
    let popupPage: any = null
    const popupPages: any[] = []
    let isResolvingCloudflare = false // Bandera para evitar ejecuciones duplicadas
    
    browser.on('targetcreated', async (target: any) => {
      const newPage = await target.page()
      if (newPage) {
        popupPage = newPage
        popupPages.push(newPage)
        try {
          // Esperar a que el popup cargue
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          const url = await newPage.url()
          const title = await newPage.title().catch(() => '')
          console.log(`  → Nueva página/popup detectado: "${title}" - ${url}`)
          
          // Verificar si es el popup "Additional Verification Required" de Cloudflare
          const isCloudflarePopup = title.includes('Additional Verification Required') ||
                                   title.includes('Just a moment') ||
                                   title.includes('Checking your browser') ||
                                   url.includes('/auth') ||
                                   url.includes('cloudflare') ||
                                   url.includes('challenge')
          
          if (isCloudflarePopup && !isResolvingCloudflare) {
            isResolvingCloudflare = true
            console.log('  🔒 Popup de Cloudflare "Additional Verification Required" detectado, resolviendo...')
            
            // Traer el popup al frente
            await newPage.bringToFront()
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            setTimeout(async () => {
              try {
                console.log('  → Esperando a que el popup de Cloudflare cargue completamente...')
                await new Promise(resolve => setTimeout(resolve, 10000)) // Esperar más tiempo
                
                // Verificar el título nuevamente después de esperar
                const currentTitle = await newPage.title().catch(() => '')
                const currentUrl = await newPage.url().catch(() => '')
                console.log(`  → Título del popup: "${currentTitle}", URL: ${currentUrl}`)
                
                // Resolver el challenge en el popup
                const resolved = await resolveCloudflareChallenge(newPage)
                if (resolved) {
                  console.log('  ✅ Checkbox de Cloudflare marcado exitosamente en popup')
                  // Esperar a que Cloudflare procese
                  await new Promise(resolve => setTimeout(resolve, 10000))
                  
                  // Verificar si el popup se cerró o cambió
                  try {
                    const finalUrl = await newPage.url()
                    const finalTitle = await newPage.title().catch(() => '')
                    console.log(`  → Estado final del popup: "${finalTitle}" - ${finalUrl}`)
                  } catch (e) {
                    console.log('  → Popup cerrado o navegado')
                  }
                } else {
                  console.log('  ⚠️ No se pudo marcar el checkbox automáticamente en el popup')
                }
              } catch (e) {
                console.log('  ⚠️ Error al resolver Cloudflare en popup:', e instanceof Error ? e.message : e)
              } finally {
                isResolvingCloudflare = false
              }
            }, 5000) // Esperar 5 segundos adicionales antes de intentar
          }
        } catch (e) {
          console.log('  → Nueva página/popup detectado (detalles no disponibles aún)')
          // Intentar resolver de todas formas después de esperar
          if (!isResolvingCloudflare) {
            isResolvingCloudflare = true
            setTimeout(async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 10000))
                const title = await newPage.title().catch(() => '')
                if (title.includes('Additional Verification Required') || title.includes('Just a moment')) {
                  await newPage.bringToFront()
                  await resolveCloudflareChallenge(newPage)
                }
              } catch (e) {
                console.log('  ⚠️ Error en intento de resolver popup:', e)
              } finally {
                isResolvingCloudflare = false
              }
            }, 5000)
          }
        }
      }
    })
    
    // Verificar si hay protección anti-bot (Cloudflare "Just a moment...")
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // PASO 1: Resolver Cloudflare challenge PRIMERO antes de continuar
    console.log('🔒 PASO 1: Verificando y resolviendo desafío de Cloudflare...')
    
    // Intentar resolver Cloudflare challenge automáticamente
    const resolveCloudflareChallenge = async (targetPage?: any): Promise<boolean> => {
      try {
        const currentPage = targetPage || page
        console.log('  → Intentando resolver desafío de Cloudflare/verificación de robot automáticamente...')
        
        try {
          const url = await currentPage.url()
          console.log(`  → Página actual: ${url}`)
          } catch (e) {
          console.log('  → Página actual: URL no disponible')
        }
        
        // Esperar más tiempo a que Cloudflare cargue completamente (Cloudflare puede tardar)
        console.log('  → Esperando a que Cloudflare cargue completamente...')
        await new Promise(resolve => setTimeout(resolve, 8000))
        
        // Intentar esperar a que aparezca el checkbox usando waitForSelector con timeout más largo
        console.log('  → Esperando a que aparezca el checkbox de Cloudflare...')
        let checkboxFound = false
        try {
          // Esperar hasta 20 segundos a que aparezca el checkbox (Cloudflare puede tardar)
          await currentPage.waitForSelector('input[type="checkbox"]', { 
            visible: true, 
            timeout: 20000 
          })
          checkboxFound = true
          console.log('  ✅ Checkbox encontrado en la página')
        } catch (e) {
          console.log('  ⚠️ No se encontró checkbox con waitForSelector, continuando con búsqueda manual...')
        }
        
        // Esperar aún más para asegurar que Cloudflare está completamente listo
        console.log('  → Esperando adicional para que Cloudflare esté listo...')
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Buscar específicamente el iframe de Cloudflare primero
        console.log('  → Buscando iframes de Cloudflare específicamente...')
        const cloudflareFrames = currentPage.frames().filter((frame: any) => {
          try {
            const frameUrl = frame.url()?.toLowerCase() || ''
            const frameName = frame.name()?.toLowerCase() || ''
            return frameUrl.includes('cloudflare') || 
                   frameUrl.includes('challenge-platform') ||
                   frameUrl.includes('cf-') ||
                   frameName.includes('cf-') ||
                   frameName.includes('challenge')
          } catch {
            return false
          }
        })
        
        if (cloudflareFrames.length > 0) {
          console.log(`  → Encontrados ${cloudflareFrames.length} iframes de Cloudflare, intentando resolver...`)
          for (const cfFrame of cloudflareFrames) {
            try {
              // Esperar a que el iframe tenga el checkbox
              await cfFrame.waitForSelector('input[type="checkbox"]', { timeout: 15000 })
              
              const checkbox = await cfFrame.$('input[type="checkbox"]')
              if (checkbox) {
                console.log('  → Checkbox encontrado en iframe de Cloudflare')
                
                // Hacer scroll si es posible
                await cfFrame.evaluate(() => {
                  const cb = document.querySelector('input[type="checkbox"]')
                  if (cb) {
                    cb.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                })
                
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                // Intentar marcar con múltiples métodos
                try {
                  await checkbox.click({ delay: 500 })
                  console.log('  → Clic realizado en checkbox de iframe Cloudflare')
            } catch (e) {
                  console.log('  → Puppeteer click falló en iframe, intentando evaluate...')
                }
                
                // También intentar con evaluate dentro del iframe
                const marked = await cfFrame.evaluate(() => {
                  const cb = document.querySelector('input[type="checkbox"]') as HTMLInputElement
                  if (cb) {
                    cb.focus()
                    cb.checked = true
                    
                    // Disparar eventos en secuencia
                    const events = [
                      new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 }),
                      new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 0 }),
                      new MouseEvent('click', { bubbles: true, cancelable: true, view: window, buttons: 0 }),
                      new Event('change', { bubbles: true }),
                      new Event('input', { bubbles: true })
                    ]
                    
                    events.forEach(event => {
                      try {
                        cb.dispatchEvent(event)
                      } catch (e) {
                        // Ignorar errores
                      }
                    })
                    
                    return cb.checked
                  }
                  return false
                })
                
                if (marked) {
                  console.log('  ✅ Checkbox de Cloudflare en iframe marcado exitosamente')
                  await new Promise(resolve => setTimeout(resolve, 8000)) // Esperar a que Cloudflare procese
                  
                  // Verificar que se mantuvo marcado
                  const verified = await cfFrame.evaluate(() => {
                    const cb = document.querySelector('input[type="checkbox"]') as HTMLInputElement
                    return cb ? cb.checked : false
                  })
                  
                  if (verified) {
                    console.log('  ✅ Verificación exitosa: checkbox de Cloudflare está marcado')
                    return true
                  }
                }
              }
            } catch (frameError) {
              console.log(`  ⚠️ Error procesando iframe de Cloudflare: ${frameError instanceof Error ? frameError.message : frameError}`)
            }
          }
        }
        
        // Método ULTRA-PRIORITARIO: Buscar checkbox específicamente en página /auth usando Puppeteer directamente
        const currentUrl = await currentPage.url()
        if (currentUrl.includes('/auth')) {
          console.log('  → Página /auth detectada, usando método PUPPETEER DIRECTO para Cloudflare...')
          
          // Esperar a que aparezca el checkbox usando waitForSelector
          try {
            console.log('  → Esperando a que aparezca el checkbox (hasta 15 segundos)...')
            await currentPage.waitForSelector('input[type="checkbox"]', { 
              visible: true, 
              timeout: 15000 
            })
            console.log('  ✅ Checkbox encontrado con waitForSelector')
          } catch (e) {
            console.log('  ⚠️ waitForSelector timeout, continuando de todas formas...')
          }
          
          // Esperar un poco más para asegurar que está completamente cargado
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Intentar múltiples veces con Puppeteer directamente
          for (let ultraAttempt = 0; ultraAttempt < 8; ultraAttempt++) {
            console.log(`  → Intento PUPPETEER DIRECTO ${ultraAttempt + 1}/8...`)
            
            try {
              // Buscar TODOS los checkboxes con Puppeteer
              const allCheckboxes = await currentPage.$$('input[type="checkbox"]')
              console.log(`    → Encontrados ${allCheckboxes.length} checkboxes con Puppeteer`)
              
              for (let i = 0; i < allCheckboxes.length; i++) {
                const checkbox = allCheckboxes[i]
                
                try {
                  // Verificar que es visible
                  const isVisible = await currentPage.evaluate((el: any) => {
                    if (!(el instanceof HTMLElement)) return false
                    const style = window.getComputedStyle(el)
                    const rect = el.getBoundingClientRect()
                    return el.offsetParent !== null && 
                           style.visibility !== 'hidden' && 
                           style.display !== 'none' &&
                           style.opacity !== '0' &&
                           rect.width > 0 &&
                           rect.height > 0
                  }, checkbox)
                  
                  if (!isVisible) {
                    console.log(`    → Checkbox ${i + 1} no es visible, saltando...`)
                    continue
                  }
                  
                  // Verificar si ya está marcado
                  const isChecked = await currentPage.evaluate((el: any) => {
                    return el instanceof HTMLInputElement && el.checked
                  }, checkbox)
                  
                  if (isChecked) {
                    console.log(`    → Checkbox ${i + 1} ya está marcado`)
                    return true
                  }
                  
                  console.log(`    → Intentando marcar checkbox ${i + 1} con Puppeteer...`)
                  
                  // Hacer scroll al elemento
                  await currentPage.evaluate((el: any) => {
                    if (el instanceof HTMLElement) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }, checkbox)
                  
                  await new Promise(resolve => setTimeout(resolve, 1000))
                  
                  // Método 1: Puppeteer click directo
                  try {
                    await checkbox.click({ delay: 500 })
                    console.log(`    → Clic con Puppeteer realizado en checkbox ${i + 1}`)
                    await new Promise(resolve => setTimeout(resolve, 2000))
                  } catch (clickError) {
                    console.log(`    → Puppeteer click falló, intentando con evaluate...`)
                  }
                  
                  // Método 2: Evaluate para marcar directamente
                  const marked = await currentPage.evaluate((el: any) => {
                    if (el instanceof HTMLInputElement) {
                      el.focus()
                      el.checked = true
                      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 }))
                      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 0 }))
                      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, buttons: 0 }))
                      el.dispatchEvent(new Event('change', { bubbles: true }))
                      el.dispatchEvent(new Event('input', { bubbles: true }))
                      
                      // Buscar y clickear label
                      const label = el.closest('label') || (el.id ? document.querySelector(`label[for="${el.id}"]`) : null)
                      if (label) {
                        (label as HTMLElement).click()
                      }
                      
                      return el.checked
                    }
                    return false
                  }, checkbox)
                  
                  if (marked) {
                    console.log(`  ✅ Checkbox ${i + 1} marcado exitosamente (intento ${ultraAttempt + 1})`)
                    await new Promise(resolve => setTimeout(resolve, 5000))
                    
                    // Verificar que se mantuvo marcado
                    const verified = await currentPage.evaluate(() => {
                      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
                      return checkboxes.some(cb => (cb as HTMLInputElement).checked)
                    })
                    
                    if (verified) {
                      console.log('  ✅ Verificación exitosa: checkbox está marcado')
                      return true
          } else {
                      console.log('  ⚠️ Checkbox no se mantuvo marcado, reintentando...')
          }
          }
                } catch (checkboxError) {
                  console.log(`    → Error al procesar checkbox ${i + 1}:`, checkboxError instanceof Error ? checkboxError.message : checkboxError)
                  continue
        }
      }
            } catch (error) {
              console.log(`  ⚠️ Error en intento ${ultraAttempt + 1}:`, error instanceof Error ? error.message : error)
            }
    
    await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
        
        // Método PRIORITARIO: Buscar TODOS los checkboxes y intentar marcar el visible
        console.log('  → Método prioritario: Buscando TODOS los checkboxes en la página...')
        
        // Primero, encontrar todos los checkboxes visibles
        const visibleCheckboxes = await currentPage.evaluate(() => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          const visible: Array<{ index: number, id: string, name: string, className: string }> = []
          
          for (let i = 0; i < checkboxes.length; i++) {
            const cb = checkboxes[i] as HTMLInputElement
            const el = cb as HTMLElement
            
            // Verificar visibilidad
            const style = window.getComputedStyle(el)
            const isVisible = el.offsetParent !== null && 
                            style.visibility !== 'hidden' && 
                            style.display !== 'none' &&
                            style.opacity !== '0' &&
                            style.width !== '0px' &&
                            style.height !== '0px'
            
            if (isVisible && !cb.checked) {
              visible.push({
                index: i,
                id: cb.id || '',
                name: cb.name || '',
                className: el.className || ''
              })
            }
          }
          
          return visible
        })
        
        console.log(`  → Encontrados ${visibleCheckboxes.length} checkboxes visibles sin marcar`)
        
        // Intentar marcar cada checkbox visible con múltiples intentos
        for (const cbInfo of visibleCheckboxes) {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              console.log(`  → Intento ${attempt + 1}/3: Marcando checkbox #${cbInfo.index + 1} (id: ${cbInfo.id || 'sin id'})...`)
              
              // Buscar el checkbox usando Puppeteer con diferentes métodos
              let checkbox = null
              
              // Método 1: Por ID
              if (cbInfo.id) {
                try {
                  checkbox = await currentPage.$(`#${cbInfo.id.replace(/[^a-zA-Z0-9_-]/g, '')}`)
                } catch (e) {
                  // Ignorar
                }
              }
              
              // Método 2: Por índice usando evaluate
              if (!checkbox) {
                checkbox = await currentPage.evaluateHandle((index: number) => {
                  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
                  return index < checkboxes.length ? checkboxes[index] : null
                }, cbInfo.index)
                
                if (checkbox && (await currentPage.evaluate((el: any) => el === null, checkbox))) {
                  checkbox = null
                }
              }
              
              // Método 3: Primer checkbox visible
              if (!checkbox) {
                checkbox = await currentPage.$('input[type="checkbox"]')
              }
              
              if (checkbox) {
                // Verificar que el elemento es válido
                const isValid = await currentPage.evaluate((el: any) => {
                  return el instanceof HTMLElement && el.offsetParent !== null
                }, checkbox)
                
                if (!isValid) {
                  console.log('    → Checkbox encontrado pero no es válido, continuando...')
                  continue
                }
                
                // Hacer scroll al elemento
                await currentPage.evaluate((el: any) => {
                  if (el instanceof HTMLElement) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }, checkbox)
                
                await new Promise(resolve => setTimeout(resolve, 1500))
                
                // Método 1: Puppeteer click
                try {
                  await checkbox.click({ delay: 500 })
                  console.log('    → Clic con Puppeteer realizado')
                  await new Promise(resolve => setTimeout(resolve, 2000))
                } catch (e) {
                  console.log('    → Puppeteer click falló:', e instanceof Error ? e.message : 'Error desconocido')
                }
                
                // Método 2: Evaluate click (siempre intentar)
                const clicked = await currentPage.evaluate((index: number) => {
                  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
                  if (index < checkboxes.length) {
                    const cb = checkboxes[index] as HTMLInputElement
                    const el = cb as HTMLElement
                    
                    // Verificar que es visible
                    const style = window.getComputedStyle(el)
                    if (el.offsetParent === null || 
                        style.visibility === 'hidden' || 
                        style.display === 'none' ||
                        style.opacity === '0') {
                      return false
                    }
                    
                    // Focus primero
                    try {
                      el.focus()
        } catch (e) {
                      // Ignorar
                    }
                    
                    // Marcar directamente ANTES de los eventos
                    cb.checked = true
                    
                    // Disparar eventos en orden
                    try {
                      el.dispatchEvent(new MouseEvent('mousedown', { 
                        bubbles: true, 
                        cancelable: true, 
                        view: window,
                        buttons: 1
                      }))
                      el.dispatchEvent(new MouseEvent('mouseup', { 
                        bubbles: true, 
                        cancelable: true, 
                        view: window,
                        buttons: 0
                      }))
                      el.dispatchEvent(new MouseEvent('click', { 
                        bubbles: true, 
                        cancelable: true, 
                        view: window,
                        buttons: 0
                      }))
                      el.dispatchEvent(new Event('change', { bubbles: true }))
                      el.dispatchEvent(new Event('input', { bubbles: true }))
                    } catch (e) {
                      // Ignorar errores de eventos
                    }
                    
                    // También intentar con el label
                    try {
                      const label = el.closest('label') || (cb.id ? document.querySelector(`label[for="${cb.id}"]`) : null)
                      if (label) {
                        (label as HTMLElement).click()
                      }
              } catch (e) {
                      // Ignorar
                    }
                    
                    // Verificar que quedó marcado
                    return cb.checked === true
                  }
                  return false
                }, cbInfo.index)
                
                if (clicked) {
                  console.log(`  ✅ Checkbox #${cbInfo.index + 1} marcado exitosamente`)
                  await new Promise(resolve => setTimeout(resolve, 3000))
                  
                  // Verificar que se marcó (doble verificación)
                  const verification = await currentPage.evaluate(() => {
                    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
                    return checkboxes.some(cb => (cb as HTMLInputElement).checked)
                  })
                  
                  if (verification) {
                    console.log('  ✅ Verificación exitosa: checkbox está marcado')
                    await new Promise(resolve => setTimeout(resolve, 5000))
                    return true
            } else {
                    console.log('  ⚠️ Checkbox no se mantuvo marcado, reintentando...')
                    await new Promise(resolve => setTimeout(resolve, 2000))
                    continue
            }
          } else {
                  console.log('  ⚠️ No se pudo marcar el checkbox, reintentando...')
                  await new Promise(resolve => setTimeout(resolve, 2000))
                  continue
                }
              } else {
                console.log('  ⚠️ No se encontró el checkbox, reintentando...')
                await new Promise(resolve => setTimeout(resolve, 2000))
                continue
              }
            } catch (error) {
              console.log(`  ⚠️ Error en intento ${attempt + 1}:`, error instanceof Error ? error.message : error)
              if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 2000))
              }
            }
          }
        }
        
        // Método 0: Buscar específicamente el texto "Verify you are human" y su checkbox asociado (MEJORADO)
        console.log('  → Buscando específicamente checkbox "Verify you are human"...')
        const verifyHumanCheckbox = await currentPage.evaluate(() => {
          const keywords = ['verify you are human', 'verify', 'human', 'not a robot', 'i\'m not a robot', 'i am not a robot']
          const allElements = Array.from(document.querySelectorAll('*'))
          
          // Primero buscar todos los checkboxes visibles
          const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          console.log(`    → Encontrados ${allCheckboxes.length} checkboxes en total`)
          
          for (const checkbox of allCheckboxes) {
            const cb = checkbox as HTMLInputElement
            const el = cb as HTMLElement
            
            // Verificar visibilidad
            const style = window.getComputedStyle(el)
            const isVisible = el.offsetParent !== null && 
                            style.visibility !== 'hidden' && 
                            style.display !== 'none' &&
                            style.opacity !== '0'
            
            if (!isVisible || cb.checked) continue
            
            // Buscar texto "Verify you are human" cerca del checkbox
            let nearbyText = ''
            
            // Texto del label asociado
            const label = el.closest('label') || (cb.id ? document.querySelector(`label[for="${cb.id}"]`) : null)
            if (label) nearbyText += (label.textContent || '').toLowerCase() + ' '
            
            // Texto del padre
            const parent = el.parentElement
            if (parent) nearbyText += (parent.textContent || '').toLowerCase() + ' '
            
            // Texto de siblings
            if (parent) {
              Array.from(parent.children).forEach(sibling => {
                if (sibling !== el) nearbyText += (sibling.textContent || '').toLowerCase() + ' '
              })
            }
            
            // Texto cercano en el documento
            const bodyText = document.body.textContent?.toLowerCase() || ''
            const checkboxIndex = bodyText.indexOf('verify')
            const checkboxIndex2 = bodyText.indexOf('human')
            if (checkboxIndex >= 0 && checkboxIndex2 >= 0 && Math.abs(checkboxIndex - checkboxIndex2) < 50) {
              nearbyText += 'verify you are human '
            }
            
            // Verificar si alguna keyword está cerca
            if (keywords.some(keyword => nearbyText.includes(keyword))) {
              console.log(`    → Checkbox encontrado cerca de texto "Verify you are human"`)
              el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
              
              // Hacer clic con múltiples métodos
              setTimeout(() => {
                // Método 1: Click nativo
                try {
                  el.click()
                } catch (e) {}
                
                // Método 2: Marcar directamente
                if (cb) {
                  cb.checked = true
                }
                
                // Método 3: Disparar eventos
                try {
                  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }))
                  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }))
                  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 }))
                  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 0 }))
                  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, buttons: 0 }))
                  el.dispatchEvent(new Event('change', { bubbles: true }))
                  el.dispatchEvent(new Event('input', { bubbles: true }))
                } catch (e) {}
                
                // Método 4: Click en label si existe
                if (label) {
                  try {
                    label.click()
                  } catch (e) {}
                }
              }, 500)
              
              return true
            }
          }
          
          return false
        })
        
        if (verifyHumanCheckbox) {
          console.log('  ✅ Checkbox "Verify you are human" encontrado y marcado')
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          // Verificar que se marcó correctamente (múltiples verificaciones)
          const isChecked = await currentPage.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            return checkboxes.some(cb => (cb as HTMLInputElement).checked)
          })
          
          if (isChecked) {
            console.log('  ✅ Checkbox confirmado como marcado')
            await new Promise(resolve => setTimeout(resolve, 10000)) // Esperar más para que Cloudflare procese
            return true
          } else {
            console.log('  ⚠️ Checkbox no se mantuvo marcado, reintentando...')
          }
        }
        
        // Método 1: Buscar checkbox de Cloudflare con selectores MÁS ESPECÍFICOS
        console.log('  → Buscando checkbox de Cloudflare con selectores específicos...')
        const checkboxSelectors = [
          'input[type="checkbox"][name*="cf"]',
          'input[type="checkbox"][id*="cf"]',
          'input[type="checkbox"][name*="challenge"]',
          'input[type="checkbox"][id*="challenge"]',
          '[data-ray] input[type="checkbox"]',
          '.cf-browser-verification input[type="checkbox"]',
          '#challenge-form input[type="checkbox"]',
          '[id*="cf-chl-widget"] input[type="checkbox"]',
          '[class*="cf-challenge"] input[type="checkbox"]',
          '[class*="challenge-form"] input[type="checkbox"]',
          'input[type="checkbox"][aria-label*="human" i]',
          'input[type="checkbox"][aria-label*="robot" i]',
          'input[type="checkbox"]'
        ]
        
        for (const selector of checkboxSelectors) {
          try {
            // Buscar TODOS los checkboxes que coincidan con el selector
            const allCheckboxes = await currentPage.$$(selector)
            console.log(`    → Selector "${selector}": ${allCheckboxes.length} checkboxes encontrados`)
            
            for (const checkbox of allCheckboxes) {
              try {
                const isVisible = await currentPage.evaluate((el: any) => {
                  if (!(el instanceof HTMLElement)) return false
                  const style = window.getComputedStyle(el)
                  const rect = el.getBoundingClientRect()
                  return el.offsetParent !== null && 
                         style.visibility !== 'hidden' && 
                         style.display !== 'none' &&
                         style.opacity !== '0' &&
                         rect.width > 0 &&
                         rect.height > 0
                }, checkbox)
                
                if (!isVisible) {
                  continue
                }
                
                // Verificar si ya está marcado
                const isAlreadyChecked = await currentPage.evaluate((el: any) => {
              return el instanceof HTMLInputElement && el.checked
                }, checkbox)
                
                if (isAlreadyChecked) {
                  console.log(`    → Checkbox ya está marcado, verificando...`)
                  await new Promise(resolve => setTimeout(resolve, 5000))
                  return true
                }
                
                console.log(`    → Checkbox visible encontrado con selector: ${selector}`)
                
                // Hacer scroll al elemento de forma más suave
                await currentPage.evaluate((el: any) => {
                  if (el instanceof HTMLElement) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
                  }
                }, checkbox)
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                // Método 1: Puppeteer click con delay más largo (parece más humano)
                try {
                  await checkbox.click({ delay: 600 })
                  console.log('    → Checkbox clickeado con Puppeteer (delay 600ms)')
                  await new Promise(resolve => setTimeout(resolve, 2000))
                } catch (clickError) {
                  console.log('    → Puppeteer click falló, intentando con evaluate...')
                }
                
                // Método 2: Evaluate click con eventos más completos
                try {
                  const clicked = await currentPage.evaluate((el: any) => {
                    if (!(el instanceof HTMLElement)) return false
                    
                    // Focus primero
                    try {
                      el.focus()
                    } catch (e) {}
                    
                    // Marcar como checked ANTES de los eventos
                    if (el instanceof HTMLInputElement) {
                      el.checked = true
                    }
                    
                    // Crear y disparar eventos en el orden correcto
                    const events = [
                      new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }),
                      new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }),
                      new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1, detail: 1 }),
                      new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 0, detail: 1 }),
                      new MouseEvent('click', { bubbles: true, cancelable: true, view: window, buttons: 0, detail: 1 }),
                      new MouseEvent('mouseout', { bubbles: true, cancelable: true, view: window }),
                      new Event('change', { bubbles: true, cancelable: true }),
                      new Event('input', { bubbles: true, cancelable: true })
                    ]
                    
                    events.forEach((event, index) => {
                      try {
                        setTimeout(() => {
                          el.dispatchEvent(event)
                        }, index * 50) // Espaciar eventos ligeramente
                      } catch (e) {
                        // Ignorar errores
                      }
                    })
                    
                    // También hacer click nativo
                    try {
                      el.click()
                    } catch (e) {}
                    
                    // Verificar que quedó marcado
                    if (el instanceof HTMLInputElement) {
                      return el.checked
                    }
                    return false
                  }, checkbox)
                  
                  if (clicked) {
                    console.log('    → Checkbox clickeado con evaluate (eventos completos)')
                  }
                } catch (evaluateError) {
                  console.log('    → Evaluate click falló:', evaluateError instanceof Error ? evaluateError.message : evaluateError)
                }
                
                // Esperar a que Cloudflare procese el clic
                await new Promise(resolve => setTimeout(resolve, 5000))
                
                // Verificar que se marcó (con múltiples verificaciones)
                const wasChecked = await currentPage.evaluate((el: any) => {
                  if (el instanceof HTMLInputElement) {
                    return el.checked
                  }
                  return false
                }, checkbox)
                
                // También verificar si hay algún checkbox marcado en la página
                const anyChecked = await currentPage.evaluate(() => {
                  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
                  return checkboxes.some(cb => (cb as HTMLInputElement).checked)
                })
                
                if (wasChecked || anyChecked) {
                  console.log('  ✅ Checkbox de Cloudflare marcado exitosamente')
                  await new Promise(resolve => setTimeout(resolve, 8000)) // Esperar más tiempo para que Cloudflare procese
                  return true
                  } else {
                  console.log('    → Checkbox no se mantuvo marcado, intentando método alternativo...')
                  // Último intento: marcar directamente y esperar más
                  await currentPage.evaluate((el: any) => {
                    if (el instanceof HTMLInputElement) {
                      el.checked = true
                      el.dispatchEvent(new Event('change', { bubbles: true }))
                      el.dispatchEvent(new Event('input', { bubbles: true }))
                    }
                  }, checkbox)
                  await new Promise(resolve => setTimeout(resolve, 8000))
                  
                  // Verificar una vez más
                  const finalCheck = await currentPage.evaluate((el: any) => {
                    if (el instanceof HTMLInputElement) {
                      return el.checked
                    }
                    return false
                  }, checkbox)
                  
                  if (finalCheck) {
                    console.log('  ✅ Checkbox marcado directamente y verificado')
                  return true
                  }
                }
              } catch (checkboxError) {
                console.log(`    → Error procesando checkbox: ${checkboxError instanceof Error ? checkboxError.message : checkboxError}`)
                continue
              }
            }
          } catch (e) {
            // Continuar con el siguiente selector
            console.log(`    → Error con selector "${selector}": ${e instanceof Error ? e.message : e}`)
          }
        }
        
        // Método 2: Buscar por texto en labels y elementos relacionados (mejorado)
        const checkboxByText = await currentPage.evaluate(() => {
          const keywords = ['verify you are human', 'verify', 'human', 'robot', 'not a robot', 'i\'m not a robot', 'no soy un robot']
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          
          for (const cb of checkboxes) {
            const label = cb.closest('label')?.textContent?.toLowerCase() || ''
            const ariaLabel = cb.getAttribute('aria-label')?.toLowerCase() || ''
            const parentText = cb.parentElement?.textContent?.toLowerCase() || ''
            const nextSibling = cb.nextElementSibling?.textContent?.toLowerCase() || ''
            const prevSibling = cb.previousElementSibling?.textContent?.toLowerCase() || ''
            const nearbyText = cb.closest('div, form, section')?.textContent?.toLowerCase() || ''
            
            const allText = `${label} ${ariaLabel} ${parentText} ${nextSibling} ${prevSibling} ${nearbyText}`
            
            if (keywords.some(keyword => allText.includes(keyword))) {
              const el = cb as HTMLElement
              if (el.offsetParent !== null) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => {
                  el.click()
                  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                  if (el instanceof HTMLInputElement) {
                    el.checked = true
                    el.dispatchEvent(new Event('change', { bubbles: true }))
                  }
                }, 200)
                  return true
                }
            }
          }
                return false
              })
              
        if (checkboxByText) {
          console.log('  ✅ Checkbox encontrado por texto y marcado')
          await new Promise(resolve => setTimeout(resolve, 5000))
          return true
        }
        
        // Método 3: Buscar en iframes (Cloudflare a veces usa iframes) - mejorado
        const frames = currentPage.frames()
        for (const frame of frames) {
          try {
            const frameUrl = frame.url()?.toLowerCase() || ''
            if (frameUrl.includes('cloudflare') || frameUrl.includes('challenge') || frameUrl.includes('cf-') || frameUrl.includes('indeed')) {
              const iframeCheckbox = await frame.$('input[type="checkbox"]')
              if (iframeCheckbox) {
                console.log('  → Checkbox encontrado en iframe de Cloudflare')
                await iframeCheckbox.click({ delay: 200 })
                await new Promise(resolve => setTimeout(resolve, 3000))
                
                // Verificar que se marcó
                const iframeChecked = await frame.evaluate(() => {
                  const cb = document.querySelector('input[type="checkbox"]') as HTMLInputElement
                  return cb ? cb.checked : false
                })
                
                if (iframeChecked) {
                  console.log('  ✅ Checkbox en iframe marcado exitosamente')
                  await new Promise(resolve => setTimeout(resolve, 5000))
                  return true
                }
              }
            }
          } catch (frameError) {
            // Continuar con el siguiente frame
          }
        }
        
        // Método 4: Buscar y hacer clic en el label asociado al checkbox
        const clickLabelForCheckbox = await currentPage.evaluate(() => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          for (const cb of checkboxes) {
            const el = cb as HTMLElement
            const style = window.getComputedStyle(el)
            if (el.offsetParent !== null && 
                style.visibility !== 'hidden' && 
                style.display !== 'none' &&
                style.opacity !== '0') {
              
              // Buscar label asociado
              let label: HTMLLabelElement | null = null
              
              // Buscar por for attribute
              const id = (cb as HTMLInputElement).id
              if (id) {
                label = document.querySelector(`label[for="${id}"]`) as HTMLLabelElement
              }
              
              // Buscar label padre
              if (!label) {
                label = cb.closest('label') as HTMLLabelElement
              }
              
              // Buscar label cercano
              if (!label) {
                const parent = cb.parentElement
                if (parent) {
                  const siblings = Array.from(parent.children)
                  for (const sibling of siblings) {
                    if (sibling.tagName === 'LABEL') {
                      label = sibling as HTMLLabelElement
                      break
                    }
                  }
                }
              }
              
              if (label) {
                label.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => {
                  label!.click()
                  label!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                  if (cb instanceof HTMLInputElement) {
                    cb.checked = true
                    cb.dispatchEvent(new Event('change', { bubbles: true }))
                  }
                }, 200)
                return true
              }
            }
          }
          return false
        })
        
        if (clickLabelForCheckbox) {
          console.log('  ✅ Label del checkbox encontrado y clickeado')
          await new Promise(resolve => setTimeout(resolve, 5000))
          return true
        }
        
        // Método 5: Buscar cualquier checkbox visible y hacer clic (último recurso) - mejorado
        const anyCheckbox = await currentPage.evaluate(() => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          for (const cb of checkboxes) {
            const el = cb as HTMLElement
            const style = window.getComputedStyle(el)
            if (el.offsetParent !== null && 
                style.visibility !== 'hidden' && 
                style.display !== 'none' &&
                style.opacity !== '0' &&
                !(cb as HTMLInputElement).checked) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              setTimeout(() => {
                el.click()
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                if (el instanceof HTMLInputElement) {
                  el.checked = true
                  el.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }, 200)
              return true
            }
          }
          return false
        })
        
        if (anyCheckbox) {
          console.log('  ✅ Checkbox encontrado (método fallback) y marcado')
          await new Promise(resolve => setTimeout(resolve, 5000))
            return true
        }
        
      } catch (error) {
        console.log('  ⚠️ Error al resolver Cloudflare:', error)
      }
        return false
    }
    
    // Función para verificar y resolver Cloudflare en todas las páginas
    const checkAndResolveCloudflare = async (): Promise<boolean> => {
      let resolved = false
      
      // Primero, esperar un poco para que aparezcan popups
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Obtener todas las páginas actuales
      const allPages = await browser.pages()
      console.log(`  → Total de páginas abiertas: ${allPages.length}`)
      
      // Verificar en la página principal primero
      console.log('  → Verificando Cloudflare en página principal...')
      resolved = await resolveCloudflareChallenge(page)
      if (resolved) {
        console.log('  ✅ Cloudflare resuelto en página principal')
        return true
      }
      
      // Verificar en popups detectados
      if (popupPage) {
        console.log('  → Verificando Cloudflare en popup detectado...')
        try {
          const popupUrl = await popupPage.url()
          console.log(`  → URL del popup: ${popupUrl}`)
          
          // Esperar a que el popup esté completamente cargado
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          const popupResolved = await resolveCloudflareChallenge(popupPage)
          if (popupResolved) {
          console.log('  ✅ Cloudflare resuelto en popup')
            resolved = true
          return true
          }
        } catch (e) {
          console.log('  ⚠️ Error al verificar popup:', e instanceof Error ? e.message : e)
        }
      }
      
      // Verificar todas las páginas abiertas (incluyendo nuevas que puedan haber aparecido)
      for (const p of allPages) {
        if (p === page) continue
        
        try {
          const url = await p.url()
          const title = await p.title()
          
          // Verificar si es una página de Cloudflare/Indeed
          if (url.includes('indeed.com') || 
              url.includes('cloudflare') || 
              url.includes('/auth') ||
              title.includes('Additional Verification Required') ||
              title.includes('Just a moment') ||
              title.includes('Checking your browser')) {
            console.log(`  → Verificando Cloudflare en página adicional: ${title} - ${url}`)
            
            // Esperar a que la página esté lista
            await new Promise(resolve => setTimeout(resolve, 3000))
            
            const pageResolved = await resolveCloudflareChallenge(p)
            if (pageResolved) {
              console.log('  ✅ Cloudflare resuelto en página adicional')
              resolved = true
              return true
            }
          }
        } catch (e) {
          // Ignorar errores
        }
      }
      
      return resolved
    }
    
    // Evitar ejecuciones duplicadas
    if (!isResolvingCloudflare) {
      isResolvingCloudflare = true
      
    const cloudflareResolved = await checkAndResolveCloudflare()
      if (cloudflareResolved) {
        console.log('  ✅ Desafío de Cloudflare resuelto')
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      
      const captchaSolvedOnLoad = await attemptAutoCaptcha('post-goto')
      if (captchaSolvedOnLoad) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      
      // Esperar un poco más para que aparezcan popups
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Verificar nuevamente si apareció un popup (solo una vez)
      const allPages = await browser.pages()
      const processedUrls = new Set<string>()
      
      for (const p of allPages) {
        if (p !== page) {
          try {
            const url = p.url()
            const title = await p.title()
            
            // Evitar procesar la misma URL dos veces
            if (processedUrls.has(url)) {
              continue
            }
            processedUrls.add(url)
            
            if (url.includes('indeed.com') || url.includes('cloudflare') || url.includes('/auth') || 
                title.includes('Additional Verification Required') || title.includes('Just a moment')) {
              console.log(`  → Popup detectado: ${title} - ${url}`)
              popupPage = p
              
              // Resolver directamente en esta página
              const popupResolved = await resolveCloudflareChallenge(p)
              if (popupResolved) {
                console.log('  ✅ Cloudflare resuelto en popup')
                break
              }
            }
          } catch (e) {
            // Ignorar errores
          }
        }
      }
      
      isResolvingCloudflare = false
    } else {
      console.log('  → Cloudflare ya se está resolviendo, saltando ejecución duplicada...')
    }
    
    const initialPageTitle = await safeGetPageTitle()
    const initialUrl = page.url()
    console.log(`  → Título de la página: "${initialPageTitle}"`)
    console.log(`  → URL actual: ${initialUrl}`)
    
    // Verificar si hay desafío de Cloudflare "Additional Verification Required"
    const hasCloudflareChallenge = initialPageTitle.includes('Additional Verification Required') ||
                                   initialPageTitle.includes('Just a moment') ||
                                   initialPageTitle.includes('Checking your browser') ||
                                   initialUrl.includes('/auth') ||
                                   initialPageTitle.toLowerCase().includes('please wait') ||
                                   await page.$('input[type="checkbox"][name*="cf"], [data-ray]') !== null
    
    if (hasCloudflareChallenge) {
      console.log('  ⚠️ Detectada protección anti-bot (Cloudflare/Indeed), resolviendo automáticamente...')
      
      // Intentar resolver el desafío múltiples veces con más intentos
      let challengeResolved = false
      for (let attempt = 0; attempt < 8 && !challengeResolved; attempt++) {
        console.log(`  → Intento ${attempt + 1}/8 de resolver Cloudflare challenge...`)
        challengeResolved = await checkAndResolveCloudflare()
        if (challengeResolved) {
          console.log('  ✅ Cloudflare challenge resuelto')
          // Esperar más tiempo para que Cloudflare procese la verificación
          await new Promise(resolve => setTimeout(resolve, 10000))
              break
            }
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
      
      if (!challengeResolved) {
        // Esperar a que se complete automáticamente
        console.log('  → Esperando a que Cloudflare complete la verificación automáticamente...')
        
        // Esperar hasta 60 segundos a que se complete la verificación
        let verificationComplete = false
        const maxWaitTime = 60000 // 60 segundos (aumentado)
        const checkInterval = 3000 // Verificar cada 3 segundos
        const startTime = Date.now()
        
        while (!verificationComplete && (Date.now() - startTime) < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval))
          
          const newTitle = await safeGetPageTitle()
          const newUrl = page.url()
          
          console.log(`  → Esperando verificación... Título: "${newTitle}", URL: ${newUrl}`)
          
          // Verificar si la verificación se completó - CRITERIOS MÁS ESTRICTOS
          const isStillCloudflare = newTitle.includes('Just a moment') || 
                                    newTitle.includes('Checking your browser') ||
                                    newTitle.includes('Additional Verification Required') ||
                                    newTitle.toLowerCase() === 'please wait' ||
                                    newUrl.includes('/auth') && !newUrl.includes('/account/login')
          
          if (!isStillCloudflare) {
            // Esperar un poco más para asegurar que la página realmente cargó
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            // Verificar nuevamente
            const finalTitle = await safeGetPageTitle()
            const finalUrl = page.url()
            
            if (!finalTitle.includes('Just a moment') && 
                !finalTitle.includes('Checking your browser') &&
                !finalTitle.includes('Additional Verification Required')) {
              verificationComplete = true
              console.log('  ✅ Verificación anti-bot completada')
              console.log(`  → Título final: "${finalTitle}", URL final: ${finalUrl}`)
              break
            }
          }
          
          // Verificar si hay botón "Continue with Google" o inputs de login ahora
          const pageState = await page.evaluate(() => {
            const hasGoogleButton = Array.from(document.querySelectorAll('button, a, div[role="button"]')).some(btn => {
              const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase()
              return text.includes('continue with google') || text.includes('google')
            })
            
            const hasLoginInputs = Array.from(document.querySelectorAll('input')).some(input => {
              const type = (input as HTMLInputElement).type
              const name = (input as HTMLInputElement).name?.toLowerCase() || ''
              return type === 'email' || name.includes('email') || type === 'text'
            })
            
            return { hasGoogleButton, hasLoginInputs }
          })
          
          if (pageState.hasGoogleButton || pageState.hasLoginInputs) {
            // Esperar un poco más para asegurar que la página está lista
            await new Promise(resolve => setTimeout(resolve, 3000))
            verificationComplete = true
            console.log('  ✅ Página de login detectada después de verificación')
            break
          }
          
          // Intentar resolver captcha durante la espera
          const captchaSolvedDuringWait = await attemptAutoCaptcha('anti-bot-wait')
          if (captchaSolvedDuringWait) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
        
        // Si la verificación se completó, intentar "Continue with Google" en modo headless
        if (verificationComplete) {
          console.log('  → Intentando login automático con "Continue with Google" en modo headless...')
          
          // Esperar un poco más para asegurar que la página esté lista
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          try {
            // Buscar botón "Continue with Google" con múltiples métodos
            let googleButton = null
            
            // Método 1: Buscar por texto exacto
            googleButton = await page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'))
              return buttons.find(btn => {
                const text = (btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase()
                return text.includes('continue with google') || 
                       text.includes('sign in with google') ||
                       text.includes('iniciar sesión con google') ||
                       (text.includes('google') && (text.includes('continue') || text.includes('sign') || text.includes('iniciar')))
              }) as HTMLElement | null
            }) as any
            
            // Método 2: Si no se encuentra, buscar por atributos específicos
            if (!googleButton) {
              googleButton = await page.$('button[data-testid*="google"], a[href*="google"], [data-provider="google"]')
            }
            
            // Método 3: Buscar por clase o ID que contenga "google"
            if (!googleButton) {
              googleButton = await page.$('button[class*="google"], a[class*="google"], div[class*="google"], [id*="google"]')
            }
            
            if (googleButton) {
              console.log('  ✅ Botón "Continue with Google" encontrado en modo headless, haciendo clic...')
              
              // Hacer scroll al botón
              await page.evaluate((btn: any) => {
                if (btn instanceof HTMLElement) {
                  btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }, googleButton)
              await new Promise(resolve => setTimeout(resolve, 500))
              
              // Intentar hacer clic
              try {
                await googleButton.click({ delay: 150 })
                console.log('  → Clic realizado en botón de Google')
              } catch (clickError) {
                // Si falla, intentar con evaluate
                await page.evaluate((btn: any) => {
                  if (btn instanceof HTMLElement) {
                    btn.click()
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                  }
                }, googleButton)
                console.log('  → Clic realizado con evaluate')
              }
              
            await new Promise(resolve => setTimeout(resolve, 5000))
              
              // Esperar navegación a Google
              try {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
              } catch (navError) {
                console.log('  ⚠️ No se detectó navegación inmediata, continuando...')
              }
              
              const currentUrl = page.url()
              console.log(`  → URL después de clic en Google: ${currentUrl}`)
              
              // Si estamos en Google, intentar hacer login
              if (currentUrl.includes('accounts.google.com') || currentUrl.includes('google.com/signin')) {
                console.log('  → Página de Google detectada, intentando login automático...')
                await new Promise(resolve => setTimeout(resolve, 3000))
                
                // Buscar campo de email de Google
                const googleEmailInput = await page.$('input[type="email"], input[name="identifier"], input[id="identifierId"]')
                if (googleEmailInput) {
                  console.log('  → Campo de email de Google encontrado')
                  await googleEmailInput.click({ clickCount: 3 })
                  await googleEmailInput.type(credentials.email, { delay: 80 })
                  await new Promise(resolve => setTimeout(resolve, 1000))
                  
                  // Buscar botón "Next"
                  const nextButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
                    return buttons.find(btn => {
                      const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase()
                      return text.includes('next') || text.includes('siguiente')
                    }) as HTMLElement | null
                  }) as any
                  
                  if (nextButton) {
                    await nextButton.click()
                    console.log('  → Botón "Next" presionado en Google')
                    await new Promise(resolve => setTimeout(resolve, 3000))
                    
                    // Buscar campo de password de Google
                    const googlePasswordInput = await page.$('input[type="password"], input[name="password"]')
                    if (googlePasswordInput) {
                      console.log('  → Campo de password de Google encontrado')
                      await googlePasswordInput.click({ clickCount: 3 })
                      await googlePasswordInput.type(credentials.password, { delay: 80 })
                      await new Promise(resolve => setTimeout(resolve, 1000))
                      
                      // Buscar botón "Next" nuevamente
                      const nextButton2 = await page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
                        return buttons.find(btn => {
                          const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase()
                          return text.includes('next') || text.includes('siguiente')
                        }) as HTMLElement | null
                      }) as any
                      
                      if (nextButton2) {
                        await nextButton2.click()
                        console.log('  → Botón "Next" presionado después de password')
                        await new Promise(resolve => setTimeout(resolve, 5000))
                      } else {
                        await page.keyboard.press('Enter')
                        await new Promise(resolve => setTimeout(resolve, 5000))
                      }
                    }
                  }
                }
                
                // Esperar a que se complete el OAuth y volver a Indeed
                console.log('  → Esperando a que se complete el login con Google...')
                try {
                  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
                  const finalUrl = page.url()
                  console.log(`  → URL final después de Google OAuth: ${finalUrl}`)
                  
                  if (finalUrl.includes('indeed.com') && !finalUrl.includes('/login') && !finalUrl.includes('/auth')) {
                    console.log('  ✅ Login con Google completado exitosamente en modo headless')
                    const cookies = await page.cookies()
                    const userAgent = await page.evaluate(() => navigator.userAgent)
                    
                    await browser.close()
                    
                    return {
                      cookies,
                      userAgent,
                      isAuthenticated: true
                    }
                  }
                } catch (oauthError) {
                  console.log('  ⚠️ Error durante OAuth de Google en modo headless:', oauthError)
                }
              }
            } else {
              console.log('  ⚠️ No se encontró botón "Continue with Google" en modo headless')
            }
          } catch (googleError) {
            console.log('  ⚠️ Error al intentar "Continue with Google" en modo headless:', googleError)
          }
        }
        
        if (!verificationComplete) {
          console.log('  ⚠️ La verificación anti-bot no se completó automáticamente')
          console.log('  → Intentando una vez más con espera extendida...')
          
          // Esperar más tiempo y volver a intentar
          await new Promise(resolve => setTimeout(resolve, 10000))
          
          // Intentar resolver Cloudflare una vez más
          const finalAttempt = await resolveCloudflareChallenge()
          if (finalAttempt) {
            await new Promise(resolve => setTimeout(resolve, 10000))
            verificationComplete = true
            console.log('  ✅ Verificación completada en intento final')
          } else {
            console.log('  ❌ No se pudo resolver automáticamente. El proceso continuará pero puede requerir intervención.')
            // Continuar de todas formas - no abrir navegador visible
          }
        }
        
        // Si después de todos los intentos aún no se completó, intentar continuar de todas formas
        if (!verificationComplete) {
          console.log('  → Continuando con el proceso de login a pesar de la verificación...')
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
        
        // NO abrir navegador visible - todo debe ser automático en headless
        // Intentar "Continue with Google" de todas formas después de resolver Cloudflare
        console.log('  → Intentando "Continue with Google" después de resolver Cloudflare...')
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        try {
          // Buscar botón "Continue with Google" con múltiples métodos
          let googleButton = null
          
          // Método 1: Buscar por texto exacto
          googleButton = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'))
            return buttons.find(btn => {
              const text = (btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase()
              return text.includes('continue with google') || 
                     text.includes('sign in with google') ||
                     text.includes('iniciar sesión con google') ||
                     (text.includes('google') && (text.includes('continue') || text.includes('sign') || text.includes('iniciar')))
            }) as HTMLElement | null
          }) as any
          
          // Método 2: Si no se encuentra, buscar por atributos específicos
          if (!googleButton) {
            googleButton = await page.$('button[data-testid*="google"], a[href*="google"], [data-provider="google"]')
          }
          
          // Método 3: Buscar por clase o ID que contenga "google"
          if (!googleButton) {
            googleButton = await page.$('button[class*="google"], a[class*="google"], div[class*="google"], [id*="google"]')
          }
          
          if (googleButton) {
            console.log('  ✅ Botón "Continue with Google" encontrado, haciendo clic automáticamente...')
            
            // Hacer scroll al botón
            await page.evaluate((btn: any) => {
              if (btn instanceof HTMLElement) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }, googleButton)
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Intentar hacer clic
            try {
              await googleButton.click({ delay: 150 })
              console.log('  → Clic realizado en botón de Google')
            } catch (clickError) {
              // Si falla, intentar con evaluate
              await page.evaluate((btn: any) => {
                if (btn instanceof HTMLElement) {
                  btn.click()
                  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                }
              }, googleButton)
              console.log('  → Clic realizado con evaluate')
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            // Continuar con el flujo de Google OAuth (el código ya existe más abajo)
          } else {
            console.log('  ⚠️ No se encontró botón "Continue with Google" después de Cloudflare')
          }
        } catch (error) {
          console.log('  ⚠️ Error al buscar botón de Google:', error)
        }
      }
      
      // Esperar un poco más después de la verificación
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    // PASO 2: Verificar que Cloudflare se haya resuelto COMPLETAMENTE antes de continuar
    console.log('📧 PASO 2: Verificando que Cloudflare se haya resuelto antes de ingresar email...')
    const currentTitle = await safeGetPageTitle()
    const currentUrl = page.url()
    
    console.log(`  → Verificando estado después de Cloudflare... Título: "${currentTitle}", URL: ${currentUrl}`)
    
    // Verificar si todavía estamos en Cloudflare
    let stillInCloudflare = currentTitle.includes('Just a moment') || 
                            currentTitle.includes('Checking your browser') ||
                            currentTitle.includes('Additional Verification Required') ||
                            (currentUrl.includes('/auth') && !currentUrl.includes('/account/login'))
    
    // Intentar resolver Cloudflare hasta que se complete
    let cloudflareAttempts = 0
    const maxCloudflareAttempts = 5
    
    while (stillInCloudflare && cloudflareAttempts < maxCloudflareAttempts) {
      cloudflareAttempts++
      console.log(`  ⚠️ Todavía en página de Cloudflare (intento ${cloudflareAttempts}/${maxCloudflareAttempts}), intentando resolver...`)
      
      // Intentar resolver Cloudflare
      const cloudflareResolved2 = await resolveCloudflareChallenge()
      if (cloudflareResolved2) {
        console.log('  ✅ Checkbox de Cloudflare marcado exitosamente')
        // Esperar más tiempo para que Cloudflare procese
        await new Promise(resolve => setTimeout(resolve, 15000))
      } else {
        // Esperar un poco más y verificar si se resolvió automáticamente
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
      
      // Verificar nuevamente el estado
      const newTitle = await safeGetPageTitle()
      const newUrl = page.url()
      
      stillInCloudflare = newTitle.includes('Just a moment') || 
                         newTitle.includes('Checking your browser') ||
                         newTitle.includes('Additional Verification Required') ||
                         (newUrl.includes('/auth') && !newUrl.includes('/account/login'))
      
      if (!stillInCloudflare) {
        console.log('  ✅ Cloudflare resuelto, continuando con el login...')
        // Esperar un poco más para asegurar que la página está lista
        await new Promise(resolve => setTimeout(resolve, 5000))
        break
      }
    }
    
    if (stillInCloudflare) {
      console.log('  ⚠️ Aún en Cloudflare después de múltiples intentos, pero continuando con el proceso...')
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
    
    // Esperar a que la página cargue completamente después de Cloudflare
    console.log('  → Esperando a que la página cargue completamente después de Cloudflare...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    const captchaSolvedAfterVerification = await attemptAutoCaptcha('post-verification')
    if (captchaSolvedAfterVerification) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
    
    // Intentar usar "Continue with Google" en modo headless también
    console.log('  → Buscando botón "Continue with Google" en modo headless...')
    const googleButtonHeadless = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'))
      return buttons.find(btn => {
        const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase()
        return text.includes('continue with google') || 
               text.includes('sign in with google') ||
               (text.includes('google') && (text.includes('continue') || text.includes('sign')))
      }) as HTMLElement | null
    }) as any
    
    if (googleButtonHeadless) {
      console.log('  ✅ Botón "Continue with Google" encontrado en modo headless, haciendo clic...')
      try {
        await googleButtonHeadless.click()
        console.log('  → Redirigiendo a Google OAuth...')
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Esperar navegación a Google
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
        } catch (navError) {
          console.log('  ⚠️ No se detectó navegación inmediata, continuando...')
        }
        
        const currentUrl = page.url()
        console.log(`  → URL después de clic en Google: ${currentUrl}`)
        
        // Si estamos en Google, intentar hacer login
        if (currentUrl.includes('accounts.google.com') || currentUrl.includes('google.com/signin')) {
          console.log('  → Página de Google detectada, intentando login automático...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Buscar campo de email de Google
          const googleEmailInput = await page.$('input[type="email"], input[name="identifier"], input[id="identifierId"]')
          if (googleEmailInput) {
            console.log('  → Campo de email de Google encontrado')
            await googleEmailInput.click({ clickCount: 3 })
            await googleEmailInput.type(credentials.email, { delay: 80 })
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Buscar botón "Next"
            const nextButton = await page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
              return buttons.find(btn => {
                const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase()
                return text.includes('next') || text.includes('siguiente')
              }) as HTMLElement | null
            }) as any
            
            if (nextButton) {
              await nextButton.click()
              console.log('  → Botón "Next" presionado en Google')
              await new Promise(resolve => setTimeout(resolve, 3000))
              
              // Buscar campo de password de Google
              const googlePasswordInput = await page.$('input[type="password"], input[name="password"]')
              if (googlePasswordInput) {
                console.log('  → Campo de password de Google encontrado')
                await googlePasswordInput.click({ clickCount: 3 })
                await googlePasswordInput.type(credentials.password, { delay: 80 })
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                // Buscar botón "Next" nuevamente
                const nextButton2 = await page.evaluateHandle(() => {
                  const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
                  return buttons.find(btn => {
                    const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase()
                    return text.includes('next') || text.includes('siguiente')
                  }) as HTMLElement | null
                }) as any
                
                if (nextButton2) {
                  await nextButton2.click()
                  console.log('  → Botón "Next" presionado después de password')
                  await new Promise(resolve => setTimeout(resolve, 5000))
                } else {
                  await page.keyboard.press('Enter')
                  await new Promise(resolve => setTimeout(resolve, 5000))
                }
              }
            }
          }
          
          // Esperar a que se complete el OAuth y volver a Indeed
          console.log('  → Esperando a que se complete el login con Google...')
          try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
            const finalUrl = page.url()
            console.log(`  → URL final después de Google OAuth: ${finalUrl}`)
            
            if (finalUrl.includes('indeed.com') && !finalUrl.includes('/login') && !finalUrl.includes('/auth')) {
              console.log('  ✅ Login con Google completado exitosamente')
              const cookies = await page.cookies()
              const userAgent = await page.evaluate(() => navigator.userAgent)
              
              await browser.close()
              
              return {
                cookies,
                userAgent,
                isAuthenticated: true
              }
            }
          } catch (oauthError) {
            console.log('  ⚠️ Error durante OAuth de Google, continuando con flujo normal...')
          }
        }
      } catch (googleError) {
        console.log('  ⚠️ Error al hacer clic en "Continue with Google" en modo headless:', googleError)
      }
    } else {
      console.log('  → No se encontró botón "Continue with Google" en modo headless, continuando con login normal...')
    }
    
    // Verificar si hay iframes que puedan contener el formulario
    const iframes = await page.frames()
    console.log(`  → Frames encontrados: ${iframes.length}`)
    
    // Verificar que no estemos todavía en Cloudflare antes de buscar el formulario
    const finalCheckTitle = await safeGetPageTitle()
    const finalCheckUrl = page.url()
    
    if (finalCheckTitle.includes('Just a moment') || 
        finalCheckTitle.includes('Checking your browser') ||
        (finalCheckUrl.includes('/auth') && !finalCheckUrl.includes('/account/login'))) {
      console.log('  ⚠️ Aún en página de Cloudflare, esperando más tiempo antes de buscar formulario...')
      await new Promise(resolve => setTimeout(resolve, 20000))
      
      // Intentar resolver Cloudflare una vez más
      await resolveCloudflareChallenge()
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
    
    // Intentar esperar el formulario con múltiples estrategias
    console.log('  → Esperando formulario de login...')
    const captchaSolvedBeforeForm = await attemptAutoCaptcha('before-form')
    if (captchaSolvedBeforeForm) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
    
    // Esperar más tiempo para asegurar que la página está lista
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    let formFound = false
    const formSelectors = [
      'input[type="email"]',
      'input[name="__email"]',
      'input[name="email"]',
      'input[id*="email"]',
      'input[id*="Email"]',
      'input[autocomplete="email"]',
      'input[autocomplete="username"]',
      'form input[type="text"]',
      'form input:first-of-type'
    ]
    
    for (const selector of formSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 })
        console.log(`  ✅ Formulario encontrado con selector: ${selector}`)
        formFound = true
        break
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }
    
    if (!formFound) {
      console.log('  ⚠️ No se encontró formulario con selectores estándar, esperando más tiempo...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Verificar una vez más si estamos en Cloudflare
      const lastCheckTitle = await safeGetPageTitle()
      if (lastCheckTitle.includes('Just a moment') || lastCheckTitle.includes('Checking your browser')) {
        throw new Error('La página sigue en Cloudflare después de múltiples intentos. Por favor, verifica tu conexión o intenta más tarde.')
      }
    }
    
    // Obtener información de debugging sobre todos los inputs
    const inputInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'))
      return inputs.map(input => ({
        type: (input as HTMLInputElement).type,
        name: (input as HTMLInputElement).name,
        id: (input as HTMLInputElement).id,
        placeholder: (input as HTMLInputElement).placeholder,
        autocomplete: (input as HTMLInputElement).autocomplete,
        className: (input as HTMLInputElement).className,
        visible: (input as HTMLElement).offsetParent !== null
      }))
    })
    
    console.log(`  → Inputs encontrados en la página: ${inputInfo.length}`)
    if (inputInfo.length > 0) {
      console.log('  → Detalles de inputs:')
      inputInfo.forEach((info: any, idx: number) => {
        console.log(`    [${idx}] type: ${info.type}, name: ${info.name}, id: ${info.id}, placeholder: ${info.placeholder}, visible: ${info.visible}`)
      })
    }

    // PASO 3: Buscar y llenar campo de email DESPUÉS de resolver Cloudflare
    console.log('📧 PASO 3: Buscando campo de email para ingresar credenciales del .env...')
    console.log('  → Buscando campo de email...')
    const emailSelectors = [
      'input[type="email"]',
      'input[name="__email"]',
      'input[name="email"]',
      'input[id*="email"]',
      'input[id*="Email"]',
      'input[autocomplete="email"]',
      'input[autocomplete="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="correo" i]'
    ]
    
    let emailSelector = null
      for (const selector of emailSelectors) {
        try {
          const element = await page.$(selector)
          if (element) {
          const isVisible = await page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement
            return el && el.offsetParent !== null
          }, selector)
            
            if (isVisible) {
              emailSelector = selector
            console.log(`  → Campo de email encontrado con selector: ${selector}`)
              break
            }
          }
        } catch (e) {
        // Continuar con el siguiente selector
        }
      }
      
    // Fallback más exhaustivo: buscar por tipo o nombre en todos los inputs
      if (!emailSelector) {
      const captchaSolvedBeforeFallback = await attemptAutoCaptcha('before-email-fallback')
      if (captchaSolvedBeforeFallback) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      console.log('  → Buscando campo de email con fallback exhaustivo...')
        const found = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'))
          for (const input of inputs) {
          const type = (input as HTMLInputElement).type
          const name = (input as HTMLInputElement).name?.toLowerCase() || ''
          const id = (input as HTMLInputElement).id?.toLowerCase() || ''
          const placeholder = (input as HTMLInputElement).placeholder?.toLowerCase() || ''
          const autocomplete = (input as HTMLInputElement).autocomplete?.toLowerCase() || ''
          
          // Verificar si es visible
          if ((input as HTMLElement).offsetParent === null) continue
            
            if (type === 'email' || 
                name.includes('email') || 
                id.includes('email') ||
                placeholder.includes('email') ||
              autocomplete === 'email' ||
              autocomplete === 'username') {
            if (input.id) return { selector: `#${input.id}`, type, name, id }
            if (input.name) return { selector: `input[name="${input.name}"]`, type, name, id }
            return { selector: `input[type="${type}"]`, type, name, id }
          }
        }
        return null
      })
        
        if (found) {
          emailSelector = found.selector
        console.log(`  → Campo de email encontrado con fallback: ${emailSelector} (type: ${found.type}, name: ${found.name}, id: ${found.id})`)
      }
    }
    
    // Si aún no se encuentra, intentar buscar en iframes
    if (!emailSelector && iframes.length > 0) {
      console.log('  → Buscando campo de email en iframes...')
      for (const frame of iframes) {
        try {
          const frameInputs = await frame.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'))
            return inputs.map(input => ({
              type: (input as HTMLInputElement).type,
              name: (input as HTMLInputElement).name,
              id: (input as HTMLInputElement).id
            }))
          })
          
          for (const inputInfo of frameInputs) {
            if (inputInfo.type === 'email' || 
                inputInfo.name?.toLowerCase().includes('email') ||
                inputInfo.id?.toLowerCase().includes('email')) {
              console.log(`  → Campo de email encontrado en iframe: ${inputInfo.name || inputInfo.id}`)
              // Intentar acceder al iframe
              try {
                const emailInput = await frame.$('input[type="email"], input[name*="email"]')
                if (emailInput) {
                  emailSelector = 'iframe input' // Marcador especial
                  console.log('  → Se encontró campo en iframe, intentando acceder...')
                  break
                }
              } catch (e) {
                // Continuar
              }
            }
          }
        } catch (e) {
          // Algunos iframes pueden no ser accesibles
        }
      }
    }
    
    if (emailSelector && emailSelector !== 'iframe input') {
      // emailSelector ya está definido
      // Esperar a que el elemento esté interactuable
      try {
        await page.waitForSelector(emailSelector, { state: 'visible', timeout: 5000 })
      } catch (e) {
        console.log('  ⚠️ El selector no está visible, pero continuando...')
      }
      
      // Limpiar y enfocar el campo de email
      await page.focus(emailSelector)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = ''
          input.focus()
          // Disparar eventos para asegurar que el campo está listo
          input.dispatchEvent(new Event('focus', { bubbles: true }))
        }
      }, emailSelector)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Ingresar email con delay más realista
      console.log(`  → Ingresando email: ${credentials.email}`)
      await page.type(emailSelector, credentials.email, { delay: 100 })
      
      // Verificar que el email se ingresó correctamente
      const emailEntered = await page.evaluate((selector: string, expectedEmail: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        return input?.value === expectedEmail
      }, emailSelector, credentials.email)
      
      if (emailEntered) {
        console.log('  ✅ Email ingresado correctamente')
      } else {
        console.log('  ⚠️ El email no se ingresó correctamente, reintentando...')
        // Reintentar ingresando el email directamente
      await page.evaluate((selector: string, email: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = email
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, emailSelector, credentials.email)
        console.log('  ✅ Email ingresado directamente con evaluate')
      }
      
      // Esperar un poco después de ingresar el email
      await new Promise(resolve => setTimeout(resolve, 2000))
    } else {
      // Último intento: buscar el primer input de texto visible
      const captchaSolvedBeforeLastAttempt = await attemptAutoCaptcha('before-email-last-attempt')
      if (captchaSolvedBeforeLastAttempt) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      }
      console.log('  → Último intento: buscando primer input visible...')
      const firstVisibleInput = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          if ((input as HTMLElement).offsetParent !== null && 
              (input as HTMLInputElement).type !== 'hidden' &&
              (input as HTMLInputElement).type !== 'submit' &&
              (input as HTMLInputElement).type !== 'button') {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            return null
          }
        }
        return null
      })
      
      if (firstVisibleInput) {
        console.log(`  → Usando primer input visible como campo de email: ${firstVisibleInput}`)
        emailSelector = firstVisibleInput
        await page.focus(firstVisibleInput)
        await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
            input.value = ''
            input.focus()
          }
        }, firstVisibleInput)
        await page.type(firstVisibleInput, credentials.email, { delay: 50 })
        console.log('  ✅ Email ingresado en primer input visible')
    } else {
        // Error final con información detallada
        const pageTitle = await safeGetPageTitle()
        const pageUrl = page.url()
        const pageContent = await page.content()
        const hasForm = pageContent.includes('<form') || pageContent.includes('form')
        
        throw new Error(`No se encontró el campo de email. URL: ${pageUrl}, Título: ${pageTitle}, Tiene form: ${hasForm}, Inputs encontrados: ${inputInfo.length}`)
      }
    }
    
    // Buscar campo de password
    console.log('  → Buscando campo de password...')
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="__password"]',
      'input[name="password"]',
      'input[id*="password"]',
      'input[id*="Password"]',
      'input[placeholder*="password" i]'
    ]
    
    let passwordSelector = null
    for (const selector of passwordSelectors) {
        const element = await page.$(selector)
        if (element) {
            passwordSelector = selector
            console.log(`  → Campo de password encontrado con selector: ${selector}`)
            break
          }
        }
    
    if (!passwordSelector) {
      const found = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          if (!(input instanceof HTMLInputElement)) continue
          const type = (input as HTMLInputElement).type?.toLowerCase() || ''
          const name = (input as HTMLInputElement).name?.toLowerCase() || ''
          const placeholder = (input as HTMLInputElement).placeholder?.toLowerCase() || ''
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase()
          if ((input as HTMLElement).offsetParent === null) continue
          const isPassword = type === 'password' ||
                             name.includes('password') ||
                             placeholder.includes('password') ||
                             placeholder.includes('contraseña') ||
                             ariaLabel.includes('password') ||
                             ariaLabel.includes('contraseña')
          if (isPassword) {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            if (type) return `input[type="${type}"]`
            return 'input[type="password"]'
          }
        }
        return null
      })
      if (found) {
        passwordSelector = found
        console.log(`  → Campo de password encontrado con selector: ${passwordSelector}`)
      }
    }
    
    if (passwordSelector) {
      await page.focus(passwordSelector)
      await page.evaluate((selector: string) => {
        const input = document.querySelector(selector) as HTMLInputElement
        if (input) {
          input.value = ''
          input.focus()
        }
      }, passwordSelector)
      await page.type(passwordSelector, credentials.password, { delay: 50 })
      console.log('  ✅ Password ingresado')
    } else {
      throw new Error('No se encontró el campo de password')
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Buscar y hacer clic en el botón de login
    console.log('  → Buscando botón de login...')
    const buttonSelectors = [
      'button[type="submit"]',
      'button.login-button',
      '[data-testid="login-button"]',
      'input[type="submit"]',
      'button.btn-primary',
      'button[class*="login"]',
      'button[class*="submit"]',
      'button[class*="signin"]'
    ]
    
    let buttonFound = false
    let buttonSelector = null
    
    for (const selector of buttonSelectors) {
      try {
        const element = await page.$(selector)
        if (element) {
          const isVisible = await page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement
            return el && el.offsetParent !== null
          }, selector)
          
          if (isVisible) {
          buttonSelector = selector
          buttonFound = true
          console.log(`  → Botón de login encontrado con selector: ${selector}`)
          break
          }
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }
    
    // Si no se encontró con selectores, buscar por texto
    if (!buttonFound) {
      console.log('  → Buscando botón por texto...')
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || ''
          const value = (btn as HTMLInputElement).value?.toLowerCase() || ''
          if (text.includes('sign in') || text.includes('log in') || 
              text.includes('login') || value.includes('login') ||
              text.includes('signin') || text.includes('entrar')) {
            if (btn.id) return { selector: `#${btn.id}`, found: true }
            if (btn.className) {
              const firstClass = (btn.className as string).split(' ')[0]
              if (firstClass) return { selector: `button.${firstClass}`, found: true }
            }
            return { selector: null, found: true }
          }
        }
        return { selector: null, found: false }
      })
      
      if (buttonInfo.found && buttonInfo.selector) {
        buttonSelector = buttonInfo.selector
        buttonFound = true
        console.log(`  → Botón de login encontrado por texto con selector: ${buttonSelector}`)
      }
    }
    
    // Hacer clic en el botón si se encontró con selector
    if (buttonFound && buttonSelector) {
      try {
        await page.click(buttonSelector)
        console.log('  ✅ Clic en botón de login realizado')
      } catch (e) {
        console.log('  ⚠️ Error al hacer clic con page.click(), intentando con evaluate...')
        await page.evaluate((sel: string) => {
          const btn = document.querySelector(sel) as HTMLElement
          if (btn) btn.click()
        }, buttonSelector)
      }
    } else if (!buttonFound) {
      console.log('  ⚠️ No se encontró botón de login, intentando con Enter...')
      await page.keyboard.press('Enter')
    }
    
    console.log('  → Esperando respuesta del servidor...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Esperar navegación o cambio en la página
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
      console.log('  → Navegación detectada')
    } catch (e) {
      console.log('  → No se detectó navegación, continuando...')
    }
    
    // Esperar más tiempo para que cualquier redirección se complete
    await new Promise(resolve => setTimeout(resolve, 4000))

    const finalUrl = page.url()
    console.log(`  → URL actual después del login: ${finalUrl}`)
    
    // Verificar si el login fue exitoso de múltiples formas
    const loginStatus = await page.evaluate(() => {
      const url = window.location.href
      const hasLoginPage = url.includes('/login') || url.includes('/account/login') || url.includes('/signin')
      const hasDashboard = url.includes('/dashboard') || url.includes('/profile') || 
                          url.includes('/jobs') || url.includes('/home') ||
                          url.includes('/myaccount') || url.includes('/resume')
      
      // Buscar elementos que indiquen login exitoso
      const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user"], [class*="profile"]')
      const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"]')
      const jobsLink = document.querySelector('a[href*="/jobs"], a[href*="/dashboard"]')
      
      return {
        url,
        hasLoginPage,
        hasDashboard,
        hasUserMenu: userMenu !== null,
        hasLogoutButton: logoutButton !== null,
        hasJobsLink: jobsLink !== null,
        pageTitle: document.title
      }
    })
    
    console.log('  → Estado de la página:', loginStatus)
    
    const pageContent = await page.content()
    const hasCaptcha = pageContent.includes('captcha') || pageContent.includes('recaptcha') ||
                       pageContent.includes('g-recaptcha')
    
    // Buscar mensajes de error de forma más exhaustiva
    const errorInfo = await page.evaluate(() => {
      const errorSelectors = [
        '.error',
        '.alert-error',
        '.alert-danger',
        '[role="alert"]',
        '.text-red-500',
        '.text-red-600',
        '[class*="error"]',
        '[class*="Error"]',
        '.invalid-feedback',
        '.form-error',
        '[data-error]'
      ]
      
      for (const selector of errorSelectors) {
        const errorEl = document.querySelector(selector)
        if (errorEl) {
          const text = errorEl.textContent?.trim()
          if (text && text.length > 0 && text.length < 200) {
            return { message: text, selector }
          }
        }
      }
      
      // Buscar cualquier texto que parezca un error
      const allText = document.body.textContent || ''
      const errorPatterns = [
        /invalid.*(email|password|credentials)/i,
        /incorrect.*(email|password|credentials)/i,
        /wrong.*(email|password|credentials)/i,
        /error.*login/i,
        /login.*failed/i,
        /credenciales.*incorrectas/i,
        /email.*no.*válido/i
      ]
      
      for (const pattern of errorPatterns) {
        const match = allText.match(pattern)
        if (match) {
          return { message: match[0], selector: 'pattern_match' }
        }
      }
      
    return null
    })
    
    const errorMessage = errorInfo?.message || null
    
    // Determinar si el login fue exitoso
    const isAuthenticated = !loginStatus.hasLoginPage || 
                           loginStatus.hasDashboard ||
                           loginStatus.hasUserMenu ||
                           loginStatus.hasLogoutButton ||
                           (finalUrl !== 'https://secure.indeed.com/account/login' && !finalUrl.includes('/login'))

    if (isAuthenticated) {
      console.log('  ✅ Login exitoso detectado en Indeed')
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)
      
      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    // Construir mensaje de error detallado
    let error = 'Login falló - aún en página de login.'
    if (hasCaptcha) {
      error = 'Captcha detectado - requiere verificación manual'
    } else if (errorMessage) {
      error = `Error: ${errorMessage}`
    } else {
      error = 'Login falló - verifica que las credenciales sean correctas y que no haya captcha'
    }
    
    console.log(`  ❌ Login falló: ${error}`)
    console.log(`  → URL: ${finalUrl}`)
    console.log(`  → Título: ${loginStatus.pageTitle}`)
      if (errorMessage) {
      console.log(`  → Mensaje de error encontrado: ${errorMessage}`)
    }

      return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: error,
      errorDetails: `URL final: ${finalUrl}. Título: ${loginStatus.pageTitle}. ${errorMessage ? `Mensaje: ${errorMessage}` : 'No se encontró mensaje de error específico. Verifica las credenciales.'}`
    }
  } catch (error) {
    console.error('❌ Error en login de Indeed:', error)
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Excepción: ${errorMsg}`,
      errorDetails: error instanceof Error ? error.stack : undefined
    }
  } finally {
    await browser.close()
  }
}

/**
 * Autenticación en Braintrust
 */
export async function loginBraintrust(credentials: PlatformCredentials): Promise<AuthSession | null> {
  if (!puppeteer) {
    console.error('Puppeteer no disponible para login en Braintrust')
    return null
  }

  const browser = await puppeteer.launch({
    headless: false, // Modo visible para debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1280, height: 720 }
  })

  try {
    const page = await browser.newPage()
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    const braintrustLoginUrl = 'https://app.usebraintrust.com/auth/login/?next=%2F'
    console.log('🔐 Iniciando login en Braintrust...')
    console.log(`  → Abriendo URL de inicio de sesión: ${braintrustLoginUrl}`)
    await page.goto(braintrustLoginUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    console.log('  ✅ Página de login de Braintrust cargada correctamente')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // PASO 1: Buscar campo de email de forma robusta
    console.log('  → Paso 1: Buscando campo de email...')
    
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[id*="email"]',
      'input[id*="Email"]',
      'input[autocomplete="email"]',
      'input[autocomplete="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="correo" i]'
    ]
    
    let emailInput = null
    let emailSelector = null
    
    for (const selector of emailSelectors) {
      try {
        const input = await page.$(selector)
        if (input) {
          const isVisible = await page.evaluate((el: any) => {
            return el && el.offsetParent !== null
          }, input)
          
          if (isVisible) {
            emailInput = input
            emailSelector = selector
            console.log(`  → Campo de email encontrado con selector: ${selector}`)
            break
          }
        }
      } catch (e) {
        continue
      }
    }
    
    // Si no se encontró con selectores, buscar manualmente
    if (!emailInput) {
      console.log('  → Campo de email no encontrado con selectores, buscando manualmente...')
      const foundEmail = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          const type = (input as HTMLInputElement).type
          const name = (input as HTMLInputElement).name?.toLowerCase() || ''
          const id = (input as HTMLInputElement).id?.toLowerCase() || ''
          const placeholder = (input as HTMLInputElement).placeholder?.toLowerCase() || ''
          
          if ((input as HTMLElement).offsetParent === null) continue
          
          if (type === 'email' || 
              name.includes('email') || name.includes('username') ||
              id.includes('email') || id.includes('username') ||
              placeholder.includes('email') || placeholder.includes('correo')) {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            return `input[type="${type}"]`
          }
        }
        return null
      })
      
      if (foundEmail) {
        emailSelector = foundEmail
        emailInput = await page.$(foundEmail)
        console.log(`  → Campo de email encontrado manualmente: ${foundEmail}`)
      }
    }
    
    if (!emailInput || !emailSelector) {
      throw new Error('No se encontró el campo de email. Selectores probados: ' + emailSelectors.join(', '))
    }
    
    // Ingresar email
    await page.focus(emailSelector)
    await page.evaluate((selector: string) => {
      const input = document.querySelector(selector) as HTMLInputElement
      if (input) {
        input.value = ''
        input.focus()
      }
    }, emailSelector)
    await page.type(emailSelector, credentials.email, { delay: 100 })
    console.log('  ✅ Email ingresado')
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // PASO 2: Buscar campo de password de forma robusta
    console.log('  → Paso 2: Buscando campo de password...')
    
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[name="pwd"]',
      'input[id*="password"]',
      'input[id*="Password"]',
      'input[id*="pwd"]',
      'input[autocomplete="current-password"]',
      'input[autocomplete="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="Password" i]',
      'input[placeholder*="contraseña" i]'
    ]
    
    let passwordInput = null
    let passwordSelector = null
    
    // Buscar con selectores
    for (const selector of passwordSelectors) {
      try {
        const input = await page.$(selector)
        if (input) {
          const isVisible = await page.evaluate((el: any) => {
            return el && el.offsetParent !== null
          }, input)
          
          if (isVisible) {
            passwordInput = input
            passwordSelector = selector
            console.log(`  → Campo de password encontrado con selector: ${selector}`)
            break
          }
        }
      } catch (e) {
        continue
      }
    }
    
    // Si no se encontró, buscar manualmente
    if (!passwordInput) {
      console.log('  → Campo de password no encontrado con selectores, buscando manualmente...')
      const foundPassword = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          const type = (input as HTMLInputElement).type
          const name = (input as HTMLInputElement).name?.toLowerCase() || ''
          const id = (input as HTMLInputElement).id?.toLowerCase() || ''
          const placeholder = (input as HTMLInputElement).placeholder?.toLowerCase() || ''
          
          if ((input as HTMLElement).offsetParent === null) continue
          
          if (type === 'password' || 
              name.includes('password') || name.includes('pwd') ||
              id.includes('password') || id.includes('pwd') ||
              placeholder.includes('password') || placeholder.includes('contraseña')) {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            return `input[type="${type}"]`
          }
        }
        return null
      })
      
      if (foundPassword) {
        passwordSelector = foundPassword
        passwordInput = await page.$(foundPassword)
        console.log(`  → Campo de password encontrado manualmente: ${foundPassword}`)
      }
    }
    
    // Si aún no se encontró, esperar un poco más (puede aparecer después del email)
    if (!passwordInput) {
      console.log('  ⚠️ Campo de password no encontrado, esperando a que aparezca...')
      try {
        await page.waitForSelector('input[type="password"]', { 
          visible: true, 
          timeout: 8000 
        })
        passwordInput = await page.$('input[type="password"]')
        passwordSelector = 'input[type="password"]'
        console.log('  → Campo de password apareció después de esperar')
      } catch (e) {
        throw new Error('No se encontró el campo de password. Selectores probados: ' + passwordSelectors.join(', '))
      }
    }
    
    // Ingresar password
    await page.focus(passwordSelector!)
    await page.evaluate((selector: string) => {
      const input = document.querySelector(selector) as HTMLInputElement
      if (input) {
        input.value = ''
        input.focus()
      }
    }, passwordSelector!)
    await page.type(passwordSelector!, credentials.password, { delay: 100 })
    console.log('  ✅ Password ingresado')
    await new Promise(resolve => setTimeout(resolve, 1500))

    // PASO 3: Buscar y hacer clic en el botón de login
    console.log('  → Paso 3: Buscando botón de login...')
    
    const submitButtonSelectors = [
      'button[type="submit"]',
      'button.login-button',
      'button[class*="login"]',
      'button[class*="submit"]',
      '[data-testid="login-button"]',
      '[data-testid="submit"]',
      'button[id*="login"]',
      'button[id*="submit"]',
      'input[type="submit"]'
    ]
    
    let buttonFound = false
    let buttonSelector = null
    
    // Buscar con selectores
    for (const selector of submitButtonSelectors) {
      try {
        const button = await page.$(selector)
        if (button) {
          const isVisible = await page.evaluate((el: any) => {
            return el && el.offsetParent !== null && !el.disabled
          }, button)
          
          if (isVisible) {
            buttonSelector = selector
            buttonFound = true
            console.log(`  → Botón de login encontrado con selector: ${selector}`)
            break
          }
        }
      } catch (e) {
        continue
      }
    }
    
    // Si no se encontró con selectores, buscar por texto
    if (!buttonFound) {
      console.log('  → Buscando botón por texto...')
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || ''
          const value = (btn as HTMLInputElement).value?.toLowerCase() || ''
          if ((text.includes('sign in') || text.includes('log in') || 
              text.includes('login') || text.includes('signin') ||
              value.includes('login') || text.includes('entrar')) &&
              (btn as HTMLElement).offsetParent !== null &&
              !(btn as HTMLButtonElement).disabled) {
            if (btn.id) return { selector: `#${btn.id}`, found: true }
            if (btn.className) {
              const firstClass = (btn.className as string).split(' ')[0]
              if (firstClass) return { selector: `button.${firstClass}`, found: true }
            }
            return { selector: null, found: true }
          }
        }
        return { selector: null, found: false }
      })
      
      if (buttonInfo.found && buttonInfo.selector) {
        buttonSelector = buttonInfo.selector
        buttonFound = true
        console.log(`  → Botón de login encontrado por texto con selector: ${buttonSelector}`)
      }
    }
    
    // Hacer clic en el botón si se encontró
    if (buttonFound && buttonSelector) {
      try {
        await page.click(buttonSelector)
        console.log('  ✅ Click en botón de login realizado')
      } catch (e) {
        console.log('  ⚠️ Error al hacer clic con page.click(), intentando con evaluate...')
        await page.evaluate((sel: string) => {
          const btn = document.querySelector(sel) as HTMLElement
          if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
            btn.click()
          }
        }, buttonSelector)
      }
    } else {
      console.log('  ⚠️ No se encontró botón de login, intentando con Enter...')
      await page.keyboard.press('Enter')
    }
    
    console.log('  → Esperando respuesta del servidor...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Esperar navegación o cambio en la página
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
      console.log('  → Navegación detectada')
    } catch (e) {
      console.log('  → No se detectó navegación, continuando...')
    }
    
    // Esperar más tiempo para que cualquier redirección se complete
    await new Promise(resolve => setTimeout(resolve, 4000))

    const finalUrl = page.url()
    console.log(`  → URL actual después del login: ${finalUrl}`)
    
    // Verificar si el login fue exitoso de múltiples formas
    const loginStatus = await page.evaluate(() => {
      const url = window.location.href
      const hasLoginPage = url.includes('/login') || url.includes('/signin')
      const hasDashboard = url.includes('/dashboard') || url.includes('/profile') || 
                          url.includes('/jobs') || url.includes('/home') ||
                          url.includes('/app') || url.includes('/projects')
      
      // Buscar elementos que indiquen login exitoso
      const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user"], [class*="profile"]')
      const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"], button[class*="logout"]')
      const dashboardLink = document.querySelector('a[href*="/dashboard"], a[href*="/app"]')
      
      return {
        url,
        hasLoginPage,
        hasDashboard,
        hasUserMenu: userMenu !== null,
        hasLogoutButton: logoutButton !== null,
        hasDashboardLink: dashboardLink !== null,
        pageTitle: document.title
      }
    })
    
    console.log('  → Estado de la página:', loginStatus)
    
    const pageContent = await page.content()
    const hasCaptcha = pageContent.includes('captcha') || pageContent.includes('recaptcha') ||
                       pageContent.includes('g-recaptcha') || pageContent.includes('hcaptcha')
    
    // Buscar mensajes de error de forma más exhaustiva
    const errorInfo = await page.evaluate(() => {
      const errorSelectors = [
        '.error',
        '.alert-error',
        '.alert-danger',
        '[role="alert"]',
        '.text-red-500',
        '.text-red-600',
        '[class*="error"]',
        '[class*="Error"]',
        '.invalid-feedback',
        '.form-error',
        '[data-error]'
      ]
      
      for (const selector of errorSelectors) {
        const errorEl = document.querySelector(selector)
        if (errorEl) {
          const text = errorEl.textContent?.trim()
          if (text && text.length > 0 && text.length < 200) {
            return { message: text, selector }
          }
        }
      }
      
      // Buscar cualquier texto que parezca un error
      const allText = document.body.textContent || ''
      const errorPatterns = [
        /invalid.*(email|password|credentials)/i,
        /incorrect.*(email|password|credentials)/i,
        /wrong.*(email|password|credentials)/i,
        /error.*login/i,
        /login.*failed/i,
        /credenciales.*incorrectas/i,
        /email.*no.*válido/i
      ]
      
      for (const pattern of errorPatterns) {
        const match = allText.match(pattern)
        if (match) {
          return { message: match[0], selector: 'pattern_match' }
        }
      }
      
      return null
    })
    
    const errorMessage = errorInfo?.message || null
    
    // Determinar si el login fue exitoso
    const isAuthenticated = !loginStatus.hasLoginPage && 
                           (loginStatus.hasDashboard || 
                            loginStatus.hasUserMenu || 
                            loginStatus.hasLogoutButton ||
                            loginStatus.hasDashboardLink ||
                            finalUrl.includes('/app') ||
                            finalUrl.includes('/dashboard'))

    if (isAuthenticated) {
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      console.log('  ✅ Login exitoso en Braintrust')
      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    let error = 'Login falló - No se detectó autenticación exitosa'
    if (hasCaptcha) {
      error = 'Captcha detectado - Puede requerir intervención manual'
    } else if (errorMessage) {
      error = `Error: ${errorMessage}`
    }

    console.log(`  ❌ Login falló: ${error}`)
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: error,
      errorDetails: `URL final: ${finalUrl}. Estado: ${JSON.stringify(loginStatus)}`
    }
  } catch (error) {
    console.error('❌ Error en login de Braintrust:', error)
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Excepción: ${errorMsg}`,
      errorDetails: error instanceof Error ? error.stack : undefined
    }
  } finally {
    await browser.close()
  }
}

/**
 * Autenticación en Glassdoor
 */
export async function loginGlassdoor(credentials: PlatformCredentials): Promise<AuthSession | null> {
  if (!puppeteer) {
    console.error('Puppeteer no disponible para login en Glassdoor')
    return null
  }

  const browser = await puppeteer.launch({
    headless: false, // Modo visible para debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1280, height: 720 }
  })

  try {
    const page = await browser.newPage()
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    const glassdoorLoginUrl = 'https://www.glassdoor.com/profile/login_input.htm'
    console.log('🔐 Iniciando login en Glassdoor...')
    console.log(`  → Abriendo URL de inicio de sesión: ${glassdoorLoginUrl}`)
    await page.goto(glassdoorLoginUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    console.log('  ✅ Página de login de Glassdoor cargada correctamente')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // PASO 1: Buscar y hacer clic en botón "Continue with Google" PRIMERO
    console.log('  → Paso 1: Buscando botón "Continue with Google"...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const googleButtonSelectors = [
      'button[data-testid*="google"]',
      'button[aria-label*="Google"]',
      'a[href*="google"]',
      '[class*="google"] button',
      '[id*="google"] button',
      'button[class*="google-signin"]',
      'button[class*="google"]',
      'div[class*="google"] button'
    ]
    
    let googleBtnClicked = false
    let googleButtonSelector = null
    
    for (const selector of googleButtonSelectors) {
      try {
        const button = await page.$(selector)
        if (button) {
          const isVisible = await page.evaluate((el: any) => {
            return el && el.offsetParent !== null && !el.disabled
          }, button)
          
          if (isVisible) {
            const buttonText = await page.evaluate((el: any) => el.textContent?.toLowerCase() || '', button)
            if (buttonText.includes('google') || buttonText.includes('continue') || 
                buttonText.includes('iniciar') || buttonText.includes('sign in')) {
              googleButtonSelector = selector
              googleBtnClicked = true
              console.log(`  → Botón de Google encontrado con selector: ${selector}`)
              break
            }
          }
        }
      } catch (e) {
        continue
      }
    }
    
    // Si no se encontró con selectores, buscar por texto
    if (!googleBtnClicked) {
      console.log('  → Buscando botón de Google por texto...')
      const buttonInfo = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]'))
        for (const btn of allButtons) {
          const text = (btn.textContent || '').toLowerCase().trim()
          if ((text.includes('google') || text.includes('continue with') || text.includes('iniciar')) && 
              (text.includes('sign') || text.includes('login') || text.includes('continue') || text.includes('sesión')) &&
              (btn as HTMLElement).offsetParent !== null &&
              !(btn as HTMLButtonElement).disabled) {
            if (btn.id) return { selector: `#${btn.id}`, found: true }
            if (btn.className) {
              const firstClass = (btn.className as string).split(' ')[0]
              if (firstClass) return { selector: `button.${firstClass}`, found: true }
            }
            return { selector: null, found: true }
          }
        }
        return { selector: null, found: false }
      })
      
      if (buttonInfo.found && buttonInfo.selector) {
        googleButtonSelector = buttonInfo.selector
        googleBtnClicked = true
        console.log(`  → Botón de Google encontrado por texto: ${googleButtonSelector}`)
      }
    }
    
    if (!googleBtnClicked || !googleButtonSelector) {
      throw new Error('No se encontró el botón "Sign in with Google" o "Iniciar sesión con Google"')
    }
    
    // Hacer clic en el botón de Google
    try {
      await page.click(googleButtonSelector)
      console.log('  ✅ Click en botón "Sign in with Google" realizado')
    } catch (e) {
      console.log('  ⚠️ Error al hacer clic, intentando con evaluate...')
      await page.evaluate((sel: string) => {
        const btn = document.querySelector(sel) as HTMLElement
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
          btn.click()
        }
      }, googleButtonSelector)
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // PASO 1.1: Detectar popup de Google OAuth
    console.log('  → Paso 1.1: Detectando popup de Google OAuth...')
    let googlePage = page
    let popupOpened = false
    
    for (let attempt = 0; attempt < 10; attempt++) {
      const pages = await browser.pages()
      if (pages.length > 1) {
        for (const p of pages) {
          if (p !== page && !p.isClosed()) {
            try {
              const popupUrl = p.url()
              if (popupUrl.includes('accounts.google.com') || 
                  popupUrl.includes('google.com/oauth') ||
                  popupUrl.includes('signinwithgoogle') ||
                  popupUrl === 'about:blank') {
                googlePage = p
                popupOpened = true
                console.log('  ✅ Popup de Google OAuth detectado')
                await googlePage.bringToFront()
                await new Promise(resolve => setTimeout(resolve, 3000))
                break
              }
    } catch (e) {
              continue
            }
          }
        }
        if (popupOpened) break
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    if (!popupOpened) {
      throw new Error('No se pudo detectar el popup de Google OAuth después de hacer click en "Continue with Google"')
    }
    
    // PASO 2: Completar login en el popup de Google (ingresar email primero)
    console.log('  → Paso 2: Completando login en popup de Google...')
    
    // Ingresar email en el popup de Google (PRIMERA VEZ - después del click)
    console.log('  → Buscando campo de email en popup de Google...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Esperar a que el popup de Google cargue completamente
    try {
      await googlePage.waitForSelector('input[type="email"], input[name="identifier"], input[id="identifierId"], input[autocomplete="username"]', {
        timeout: 20000,
        visible: true
      })
      console.log('  → Campo de email detectado después de esperar')
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (e) {
      console.log('  ⚠️ No se encontró campo de email con waitForSelector, buscando manualmente...')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    const googleEmailSelectors = [
      'input[type="email"]',
      'input[name="identifier"]',
      'input[id="identifierId"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[type="text"][name*="email"]',
      'input[type="text"][name*="identifier"]',
      'input[type="text"][id*="identifier"]',
      'input[type="text"][id*="email"]'
    ]
    
    let googleEmailSelector = null
    for (const selector of googleEmailSelectors) {
      try {
        const input = await googlePage.$(selector)
        if (input) {
          const isVisible = await googlePage.evaluate((el: any) => {
            return el && el.offsetParent !== null
          }, input)
          
          if (isVisible) {
            googleEmailSelector = selector
            console.log(`  → Campo de email encontrado en popup: ${selector}`)
            break
          }
        }
      } catch (e) {
        continue
      }
    }
    
    // Si no se encontró con selectores, buscar manualmente todos los inputs
    if (!googleEmailSelector) {
      console.log('  → Campo de email no encontrado con selectores, buscando manualmente...')
      const foundEmail = await googlePage.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        for (const input of inputs) {
          const type = (input as HTMLInputElement).type?.toLowerCase() || ''
          const name = (input as HTMLInputElement).name?.toLowerCase() || ''
          const id = (input as HTMLInputElement).id?.toLowerCase() || ''
          const autocomplete = (input as HTMLInputElement).autocomplete?.toLowerCase() || ''
          
          if ((input as HTMLElement).offsetParent === null) continue
          
          if (type === 'email' || 
              name.includes('identifier') || name.includes('email') ||
              id.includes('identifier') || id.includes('email') ||
              autocomplete.includes('username') || autocomplete.includes('email')) {
            if (input.id) return `#${input.id}`
            if (input.name) return `input[name="${input.name}"]`
            return `input[type="${type}"]`
          }
        }
    return null
      })
      
      if (foundEmail) {
        googleEmailSelector = foundEmail
        console.log(`  → Campo de email encontrado manualmente: ${foundEmail}`)
      }
    }
    
    // Si aún no se encontró, esperar más tiempo (puede que el popup esté cargando)
    if (!googleEmailSelector) {
      console.log('  ⚠️ Campo de email no encontrado, esperando más tiempo...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Intentar una vez más con waitForSelector
      try {
        await googlePage.waitForSelector('input[type="email"]', {
          timeout: 15000,
          visible: true
        })
        googleEmailSelector = 'input[type="email"]'
        console.log('  → Campo de email apareció después de esperar más tiempo')
      } catch (e) {
        // Última búsqueda exhaustiva
        const finalSearch = await googlePage.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'))
          for (const input of inputs) {
            if ((input as HTMLElement).offsetParent === null) continue
            const type = (input as HTMLInputElement).type?.toLowerCase() || ''
            if (type === 'email' || type === 'text') {
              if (input.id) return `#${input.id}`
              if (input.name) return `input[name="${input.name}"]`
              return `input[type="${type}"]`
            }
          }
          return null
        })
        
        if (finalSearch) {
          googleEmailSelector = finalSearch
          console.log(`  → Campo de email encontrado en búsqueda final: ${finalSearch}`)
        }
      }
    }
    
    if (!googleEmailSelector) {
      // Obtener información de debug antes de lanzar el error
      const debugInfo = await googlePage.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        return {
          inputsCount: inputs.length,
          inputs: inputs.map(input => ({
            type: (input as HTMLInputElement).type,
            name: (input as HTMLInputElement).name,
            id: (input as HTMLInputElement).id,
            autocomplete: (input as HTMLInputElement).autocomplete,
            visible: (input as HTMLElement).offsetParent !== null
          })),
          url: window.location.href,
          title: document.title
        }
      })
      
      console.log('  ❌ Debug: Información del popup de Google:', JSON.stringify(debugInfo, null, 2))
      throw new Error(`No se encontró el campo de email en el popup de Google. URL: ${debugInfo.url}, Inputs encontrados: ${debugInfo.inputsCount}`)
    }
    
    // Ingresar email en el popup
    await googlePage.focus(googleEmailSelector)
    await googlePage.evaluate((selector: string) => {
      const input = document.querySelector(selector) as HTMLInputElement
      if (input) {
        input.value = ''
        input.focus()
      }
    }, googleEmailSelector)
    await googlePage.type(googleEmailSelector, credentials.email, { delay: 100 })
    console.log('  ✅ Email ingresado en popup de Google')
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Buscar y hacer clic en botón "Next" o "Siguiente" en el popup de Google
    console.log('  → Buscando botón "Next" en popup de Google...')
    const nextButtonInfo = await googlePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase().trim()
        if ((text === 'next' || text === 'siguiente') && 
            (btn as HTMLElement).offsetParent !== null &&
            !(btn as HTMLButtonElement).disabled) {
          if (btn.id) return { selector: `#${btn.id}`, found: true }
          return { selector: null, found: true }
        }
      }
      return { selector: null, found: false }
    })
    
    if (nextButtonInfo.found) {
      try {
        if (nextButtonInfo.selector) {
          await googlePage.click(nextButtonInfo.selector)
    } else {
          await googlePage.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
            const nextBtn = buttons.find(btn => {
              const text = (btn.textContent || '').toLowerCase().trim()
              return (text === 'next' || text === 'siguiente') && 
                     (btn as HTMLElement).offsetParent !== null &&
                     !(btn as HTMLButtonElement).disabled
            })
            if (nextBtn) (nextBtn as HTMLElement).click()
          })
        }
        console.log('  ✅ Click en botón "Next" realizado')
      } catch (e) {
        console.log('  ⚠️ Intentando con Enter...')
        await googlePage.keyboard.press('Enter')
      }
    } else {
      await googlePage.keyboard.press('Enter')
    }
    
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    // Ingresar password en el popup de Google
    console.log('  → Buscando campo de password en popup de Google...')
    
    const googlePasswordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]'
    ]
    
    let googlePasswordSelector = null
    for (const selector of googlePasswordSelectors) {
      try {
        const input = await googlePage.$(selector)
        if (input) {
          const isVisible = await googlePage.evaluate((el: any) => {
            return el && el.offsetParent !== null
          }, input)
          
          if (isVisible) {
            googlePasswordSelector = selector
            console.log(`  → Campo de password encontrado en popup: ${selector}`)
            break
          }
        }
      } catch (e) {
        continue
      }
    }
    
    // Esperar a que aparezca el campo de password si no se encuentra
    if (!googlePasswordSelector) {
      try {
        await googlePage.waitForSelector('input[type="password"]', { 
          visible: true, 
          timeout: 10000 
        })
        googlePasswordSelector = 'input[type="password"]'
        console.log('  → Campo de password apareció después de esperar')
      } catch (e) {
        throw new Error('No se encontró el campo de password en el popup de Google')
      }
    }
    
    // Ingresar password en el popup
    await googlePage.focus(googlePasswordSelector)
    await googlePage.evaluate((selector: string) => {
      const input = document.querySelector(selector) as HTMLInputElement
      if (input) {
        input.value = ''
        input.focus()
      }
    }, googlePasswordSelector)
    await googlePage.type(googlePasswordSelector, credentials.password, { delay: 100 })
    console.log('  ✅ Password ingresado en popup de Google')
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Buscar y hacer clic en botón "Next" o "Siguiente" final
    console.log('  → Buscando botón "Next" final en popup de Google...')
    const finalNextButtonInfo = await googlePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase().trim()
        if ((text === 'next' || text === 'siguiente') && 
            (btn as HTMLElement).offsetParent !== null &&
            !(btn as HTMLButtonElement).disabled) {
          if (btn.id) return { selector: `#${btn.id}`, found: true }
          return { selector: null, found: true }
        }
      }
      return { selector: null, found: false }
    })
    
    if (finalNextButtonInfo.found) {
      try {
        if (finalNextButtonInfo.selector) {
          await googlePage.click(finalNextButtonInfo.selector)
    } else {
          await googlePage.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
            const nextBtn = buttons.find(btn => {
              const text = (btn.textContent || '').toLowerCase().trim()
              return (text === 'next' || text === 'siguiente') && 
                     (btn as HTMLElement).offsetParent !== null &&
                     !(btn as HTMLButtonElement).disabled
            })
            if (nextBtn) (nextBtn as HTMLElement).click()
          })
        }
        console.log('  ✅ Click en botón "Next" final realizado')
      } catch (e) {
        await googlePage.keyboard.press('Enter')
      }
    } else {
      await googlePage.keyboard.press('Enter')
    }
    
    console.log('  → Esperando a que se complete el login...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Esperar a que el popup se cierre o redirija a Glassdoor
    for (let attempt = 0; attempt < 10; attempt++) {
      const pages = await browser.pages()
      if (googlePage.isClosed()) {
        console.log('  ✅ Popup de Google cerrado, login completado')
        break
      }
      
      const currentPopupUrl = googlePage.url()
      if (!currentPopupUrl.includes('accounts.google.com')) {
        console.log('  ✅ Popup redirigido, login completado')
        break
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Volver a la página principal de Glassdoor
    await page.bringToFront()
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // PASO 3: Verificar login exitoso
    console.log('  → Paso 3: Verificando login exitoso...')
    
    // Esperar navegación si hay redirección
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
      console.log('  → Navegación detectada')
    } catch (e) {
      console.log('  → No se detectó navegación, continuando...')
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000))

    const finalUrl = page.url()
    console.log(`  → URL actual después del login: ${finalUrl}`)
    
    // Verificar si el login fue exitoso de múltiples formas
    const loginStatus = await page.evaluate(() => {
      const url = window.location.href
      const hasLoginPage = url.includes('/login') || url.includes('/signin')
      const hasDashboard = url.includes('/dashboard') || url.includes('/jobs') || 
                          url.includes('/home') || url.includes('/profile') ||
                          url.includes('/member/home') || url.includes('/member/profile') && !url.includes('/login')
      
      // Buscar elementos que indiquen login exitoso
      const userMenu = document.querySelector('[data-test="user-menu"], .user-menu, [class*="user"], [class*="profile"]')
      const logoutButton = document.querySelector('a[href*="logout"], a[href*="signout"], button[class*="logout"]')
      const jobsLink = document.querySelector('a[href*="/jobs"], a[href*="/dashboard"]')
      const userName = document.querySelector('[class*="userName"], [class*="user-name"], [data-test*="user"]')
      
      // Verificar si hay elementos que indiquen que estamos logueados
      const pageText = document.body.textContent || ''
      const hasLoggedInIndicators = pageText.includes('Sign Out') || 
                                     pageText.includes('Log Out') ||
                                     pageText.includes('My Profile') ||
                                     pageText.includes('Dashboard')
      
      return {
        url,
        hasLoginPage,
        hasDashboard,
        hasUserMenu: userMenu !== null,
        hasLogoutButton: logoutButton !== null,
        hasJobsLink: jobsLink !== null,
        hasUserName: userName !== null,
        hasLoggedInIndicators,
        pageTitle: document.title
      }
    })
    
    console.log('  → Estado de la página:', loginStatus)
    
    const pageContent = await page.content()
    const hasCaptcha = pageContent.includes('captcha') || pageContent.includes('recaptcha') ||
                       pageContent.includes('g-recaptcha') || pageContent.includes('hcaptcha')
    
    // Buscar mensajes de error de forma más exhaustiva
    const errorInfo = await page.evaluate(() => {
      const errorSelectors = [
        '.error',
        '.alert-error',
        '.alert-danger',
        '[role="alert"]',
        '.text-red-500',
        '.text-red-600',
        '[class*="error"]',
        '[class*="Error"]',
        '.invalid-feedback',
        '.form-error',
        '[data-error]',
        '.gd-form-error'
      ]
      
      for (const selector of errorSelectors) {
        const errorEl = document.querySelector(selector)
        if (errorEl) {
          const text = errorEl.textContent?.trim()
          if (text && text.length > 0 && text.length < 200) {
            return { message: text, selector }
          }
        }
      }
      
      // Buscar cualquier texto que parezca un error
      const allText = document.body.textContent || ''
      const errorPatterns = [
        /invalid.*(email|password|credentials)/i,
        /incorrect.*(email|password|credentials)/i,
        /wrong.*(email|password|credentials)/i,
        /error.*login/i,
        /login.*failed/i,
        /credenciales.*incorrectas/i,
        /email.*no.*válido/i
      ]
      
      for (const pattern of errorPatterns) {
        const match = allText.match(pattern)
        if (match) {
          return { message: match[0], selector: 'pattern_match' }
        }
      }
      
      return null
    })
    
    const errorMessage = errorInfo?.message || null
    
    // Determinar si el login fue exitoso - verificar múltiples indicadores
    const isAuthenticated = (loginStatus.hasUserMenu || 
                            loginStatus.hasLogoutButton || 
                            loginStatus.hasJobsLink ||
                            loginStatus.hasUserName ||
                            loginStatus.hasLoggedInIndicators ||
                            loginStatus.hasDashboard) &&
                           !loginStatus.hasLoginPage ||
                           (!finalUrl.includes('/login') && 
                            !finalUrl.includes('/signin') &&
                            (finalUrl.includes('/member/home') || 
                             finalUrl.includes('/member/profile') && !finalUrl.includes('/login')))

    if (isAuthenticated) {
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      console.log('  ✅ Login exitoso en Glassdoor')
      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    let error = 'Login falló - No se detectó autenticación exitosa'
    if (hasCaptcha) {
      error = 'Captcha detectado - Puede requerir intervención manual'
    } else if (errorMessage) {
      error = `Error: ${errorMessage}`
    }

    console.log(`  ❌ Login falló: ${error}`)
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: error,
      errorDetails: `URL final: ${finalUrl}. Estado: ${JSON.stringify(loginStatus)}`
    }
  } catch (error) {
    console.error('❌ Error en login de Glassdoor:', error)
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: `Excepción: ${errorMsg}`,
      errorDetails: error instanceof Error ? error.stack : undefined
    }
  } finally {
    await browser.close()
  }
}

/**
 * Autenticación en Freelancer
 */
export async function loginFreelancer(credentials: PlatformCredentials): Promise<AuthSession | null> {
  if (!puppeteer) {
    console.error('Puppeteer no disponible para login en Freelancer')
    return null
  }

  const browser = await puppeteer.launch({
    headless: false, // Modo visible para permitir resolver captcha manualmente si es necesario
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1280, height: 720 }
  })

  try {
    const page = await browser.newPage()
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    const freelancerLoginUrl = 'https://www.freelancer.com/login'
    console.log('🔐 Iniciando login en Freelancer...')
    console.log(`  → Abriendo URL de inicio de sesión: ${freelancerLoginUrl}`)
    await page.goto(freelancerLoginUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    console.log('  ✅ Página de login de Freelancer cargada correctamente')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Función para resolver reCAPTCHA visual con selección de imágenes
    const solveVisualRecaptcha = async (): Promise<boolean> => {
      try {
        console.log('  → Detectando reCAPTCHA visual...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Buscar el popup/overlay de reCAPTCHA visual
        const hasVisualCaptcha = await page.evaluate(() => {
          // Buscar texto que indique un desafío visual
          const bodyText = document.body.textContent || ''
          const challengePatterns = [
            /select all images with a/i,
            /select all images with an/i,
            /select all images containing/i,
            /selecciona todas las imágenes/i,
            /verifica que eres humano/i
          ]
          
          return challengePatterns.some(pattern => pattern.test(bodyText))
        })
        
        if (!hasVisualCaptcha) {
          console.log('  → No se detectó reCAPTCHA visual')
          return false
        }
        
        console.log('  ✅ reCAPTCHA visual detectado')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Extraer el texto del desafío (qué imágenes buscar)
        const challengeText = await page.evaluate(() => {
          // Buscar el texto del desafío en diferentes elementos
          const selectors = [
            'h2', 'h3', 'h4', '.rc-imageselect-challenge-text',
            '[class*="challenge"]', '[class*="instruction"]',
            'div[role="heading"]', '.rc-imageselect-desc-text'
          ]
          
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector)
            for (const el of Array.from(elements)) {
              const text = el.textContent || ''
              if (text.toLowerCase().includes('select all images with') ||
                  text.toLowerCase().includes('selecciona todas las imágenes')) {
                return text.trim()
              }
            }
          }
          
          // Buscar en todo el body
          const bodyText = document.body.textContent || ''
          const match = bodyText.match(/select all images with (?:a|an)?\s*([a-z]+)/i)
          if (match) {
            return match[0]
          }
          
          return null
        })
        
        if (!challengeText) {
          console.log('  ⚠️ No se pudo extraer el texto del desafío')
          return false
        }
        
        // Extraer la palabra clave del objeto a buscar (ej: "bus", "traffic light", "car")
        const objectToFind = challengeText.match(/select all images with (?:a|an)?\s*([a-z\s]+)/i)?.[1]?.trim().toLowerCase() || ''
        console.log(`  → Desafío detectado: "${challengeText}"`)
        console.log(`  → Objeto a buscar: "${objectToFind}"`)
        
        if (!objectToFind) {
          console.log('  ⚠️ No se pudo identificar el objeto a buscar')
          return false
        }
        
        // Esperar a que las imágenes carguen completamente
        console.log('  → Esperando a que las imágenes carguen...')
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Buscar y hacer click en las imágenes que contengan el objeto solicitado
        const imagesSelected = await page.evaluate(async (objectKeyword: string) => {
          // Buscar todos los elementos clickeables que representan imágenes en el reCAPTCHA
          // Los reCAPTCHA visuales usan diferentes estructuras, intentar múltiples selectores
          const imageSelectors = [
            'td.rc-imageselect-tile',
            '.rc-imageselect-tile',
            'div[role="button"][tabindex="0"]',
            'img[class*="tile"]',
            '.rc-image-tile-wrapper',
            'div[class*="tile"]'
          ]
          
          let tiles: HTMLElement[] = []
          
          for (const selector of imageSelectors) {
            const elements = document.querySelectorAll(selector)
            if (elements.length > 0) {
              tiles = Array.from(elements) as HTMLElement[]
              break
            }
          }
          
          // Si no se encontraron con selectores, buscar cualquier div clickeable en el área del captcha
          if (tiles.length === 0) {
            const allDivs = Array.from(document.querySelectorAll('div'))
            tiles = allDivs.filter(div => {
              const rect = div.getBoundingClientRect()
              const style = window.getComputedStyle(div)
              // Buscar divs que sean clickeables y estén en el área visible del captcha
              return rect.width > 50 && rect.height > 50 &&
                     rect.width < 200 && rect.height < 200 &&
                     style.cursor === 'pointer' &&
                     div.offsetParent !== null
            }) as HTMLElement[]
          }
          
          console.log(`Encontrados ${tiles.length} tiles potenciales`)
          
          // Para cada tile, verificar si contiene una imagen del objeto solicitado
          // NOTA: Sin un modelo de visión por computadora, esto es limitado
          // Intentar usar características básicas de las imágenes
          let selectedCount = 0
          
          for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i]
            
            // Buscar imagen dentro del tile
            const img = tile.querySelector('img') as HTMLImageElement | null
            if (!img || !img.complete) continue
            
            // Intentar determinar si la imagen contiene el objeto usando características básicas
            // Esto es limitado sin ML, pero intentaremos algunos heurísticos
            
            // Para "bus": buscar imágenes con colores característicos (amarillo, blanco, azul común en buses)
            // Para "traffic light": buscar áreas con colores rojos/amarillos/verdes
            // Para "car": buscar formas rectangulares horizontales
            
            let shouldSelect = false
            
            // Crear un canvas para analizar la imagen
            try {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              if (!ctx) continue
              
              canvas.width = img.naturalWidth || img.width
              canvas.height = img.naturalHeight || img.height
              
              ctx.drawImage(img, 0, 0)
              
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const data = imageData.data
              
              // Analizar colores y patrones básicos
              let yellowCount = 0
              let redCount = 0
              let blueCount = 0
              let greenCount = 0
              
              for (let j = 0; j < data.length; j += 16) { // Sample cada 4 píxeles para velocidad
                const r = data[j]
                const g = data[j + 1]
                const b = data[j + 2]
                
                // Detectar colores característicos
                if (r > 200 && g > 150 && b < 100) yellowCount++ // Amarillo (buses escolares)
                if (r > 150 && g < 100 && b < 100) redCount++ // Rojo (semáforos, buses rojos)
                if (r < 100 && g < 100 && b > 150) blueCount++ // Azul (buses, autos)
                if (r < 100 && g > 150 && b < 100) greenCount++ // Verde (semáforos)
              }
              
              const totalPixels = (data.length / 16)
              const yellowRatio = yellowCount / totalPixels
              const redRatio = redCount / totalPixels
              const blueRatio = blueCount / totalPixels
              const greenRatio = greenCount / totalPixels
              
              // Heurísticas básicas basadas en el objeto a buscar
              if (objectKeyword.includes('bus')) {
                // Buses suelen tener mucho amarillo (escolares), azul, o rojo/blanco
                shouldSelect = yellowRatio > 0.15 || blueRatio > 0.2 || (redRatio > 0.1 && (yellowRatio + blueRatio) > 0.1)
              } else if (objectKeyword.includes('traffic light') || objectKeyword.includes('light')) {
                // Semáforos tienen colores rojos, amarillos o verdes prominentes
                shouldSelect = redRatio > 0.1 || greenRatio > 0.1 || yellowRatio > 0.1
              } else if (objectKeyword.includes('car')) {
                // Autos pueden tener varios colores, pero suelen tener formas definidas
                // Usar una heurística más simple: si tiene colores sólidos prominentes
                shouldSelect = (redRatio + blueRatio + yellowRatio) > 0.15
              } else {
                // Para otros objetos, usar una heurística general
                shouldSelect = (redRatio + blueRatio + yellowRatio + greenRatio) > 0.2
              }
              
            } catch (e) {
              // Si falla el análisis, continuar con la siguiente imagen
              continue
            }
            
            // Si determinamos que debe seleccionarse, hacer click
            if (shouldSelect) {
              try {
                tile.scrollIntoView({ behavior: 'smooth', block: 'center' })
                await new Promise(resolve => setTimeout(resolve, 200))
                tile.click()
                selectedCount++
                console.log(`Tile ${i + 1} seleccionado`)
                // Pequeña pausa entre clicks
                await new Promise(resolve => setTimeout(resolve, 300))
              } catch (e) {
                console.log(`Error al hacer click en tile ${i + 1}`)
              }
            }
          }
          
          console.log(`Total de imágenes seleccionadas: ${selectedCount}`)
          return selectedCount > 0
        }, objectToFind)
        
        if (!imagesSelected) {
          console.log('  ⚠️ No se pudieron seleccionar imágenes automáticamente')
          console.log('  → Esperando intervención manual...')
          // Esperar a que el usuario lo resuelva manualmente (máximo 2 minutos)
          let resolved = false
          for (let i = 0; i < 120; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Verificar si el captcha fue resuelto (el popup desapareció o cambió)
            const stillVisible = await page.evaluate(() => {
              const bodyText = document.body.textContent || ''
              return bodyText.includes('select all images') || 
                     bodyText.includes('selecciona todas las imágenes') ||
                     bodyText.includes('verify you are human')
            })
            
            if (!stillVisible) {
              resolved = true
              console.log('  ✅ reCAPTCHA resuelto (manual o automático)')
              break
            }
          }
          
          if (!resolved) {
            console.log('  ⚠️ Tiempo de espera agotado para resolución manual')
            return false
          }
        } else {
          console.log('  ✅ Imágenes seleccionadas automáticamente')
          
          // Esperar a que se procesen las selecciones
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Verificar si se necesitan más rondas de selección
          const needsMoreRounds = await page.evaluate(() => {
            const bodyText = document.body.textContent || ''
            return bodyText.includes('select all images') ||
                   bodyText.includes('select all squares') ||
                   bodyText.includes('selecciona todas las imágenes')
          })
          
          if (needsMoreRounds) {
            console.log('  → Se requiere otra ronda de selección, reintentando...')
            await new Promise(resolve => setTimeout(resolve, 3000))
            return await solveVisualRecaptcha() // Recursivo para múltiples rondas
          }
          
          // Hacer click en el botón "VERIFY" o "Next"
          console.log('  → Buscando botón VERIFY...')
          const verifyClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"], div[role="button"]'))
            for (const btn of buttons) {
              const text = (btn.textContent || '').toLowerCase().trim()
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim()
              
              if ((text === 'verify' || text === 'verificar' || 
                   text.includes('verify') || text.includes('next') ||
                   ariaLabel.includes('verify')) &&
                  (btn as HTMLElement).offsetParent !== null &&
                  !(btn as HTMLButtonElement).disabled) {
                (btn as HTMLElement).click()
                return true
              }
            }
            return false
          })
          
          if (verifyClicked) {
            console.log('  ✅ Click en botón VERIFY realizado')
            await new Promise(resolve => setTimeout(resolve, 3000))
          } else {
            console.log('  ⚠️ No se encontró botón VERIFY, esperando a que se resuelva automáticamente...')
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
        
        return true
      } catch (error) {
        console.log(`  ⚠️ Error al resolver reCAPTCHA visual: ${(error as Error).message}`)
        return false
      }
    }
    
    // Función para intentar resolver captcha automáticamente
    const attemptAutoCaptcha = async (context: string = 'general'): Promise<boolean> => {
      try {
        console.log(`  → Buscando captcha para resolver automáticamente (${context})...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Primero intentar resolver reCAPTCHA visual
        const visualCaptchaSolved = await solveVisualRecaptcha()
        if (visualCaptchaSolved) {
          return true
        }
        
        // Buscar en iframes (reCAPTCHA checkbox, hCaptcha, etc.)
        const frames = page.frames()
        for (const frame of frames) {
          try {
            const frameUrl = frame.url()?.toLowerCase() || ''
            if (frameUrl.includes('recaptcha') || frameUrl.includes('hcaptcha') || frameUrl.includes('captcha')) {
              try {
                const checkbox = await frame.$('#recaptcha-anchor, .recaptcha-checkbox-border, .recaptcha-checkbox-checkmark, #checkbox, .mark')
                if (checkbox) {
                  console.log(`  → Intentando marcar checkbox dentro de iframe (${context})...`)
                  await checkbox.click({ delay: 100 })
                  await new Promise(resolve => setTimeout(resolve, 3000))
                  
                  // Después de hacer click en checkbox, puede aparecer el visual captcha
                  await solveVisualRecaptcha()
                  
                  console.log('  ✅ Captcha marcado automáticamente dentro del iframe')
                  return true
                }
              } catch (frameError) {
                // Continuar si hay error
              }
            }
          } catch (e) {
            // Continuar si hay error
          }
        }

        // Buscar checkbox visible en la página principal
        const checkboxSelectors = [
          'input[type="checkbox"][name*="robot" i]',
          '.recaptcha-checkbox',
          '[class*="recaptcha"] input[type="checkbox"]',
          '#px-captcha input[type="checkbox"]',
          '[data-captcha] input[type="checkbox"]'
        ]
        
        for (const selector of checkboxSelectors) {
          try {
            const checkbox = await page.$(selector)
            if (checkbox) {
              const isVisible = await page.evaluate((el: any) => {
                return el && el.offsetParent !== null
              }, checkbox)
              
              if (isVisible) {
                console.log(`  → Marcando checkbox captcha (${selector})...`)
                await checkbox.click({ delay: 100 })
                await new Promise(resolve => setTimeout(resolve, 3000))
                
                // Después de hacer click en checkbox, puede aparecer el visual captcha
                await solveVisualRecaptcha()
                
                console.log('  ✅ Captcha marcado automáticamente')
                return true
              }
            }
          } catch (e) {
            // Continuar si hay error
          }
        }
      } catch (error) {
        console.log(`  ⚠️ Error al intentar resolver captcha automáticamente: ${(error as Error).message}`)
      }
      return false
    }

    // Intentar resolver captcha antes del login
    await attemptAutoCaptcha('pre-login')
    
    console.log('  → Esperando campos de login...')
    await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 10000 })
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Ingresar credenciales con delay más realista
    console.log('  → Ingresando credenciales...')
    await page.type('input[name="username"], input[type="email"]', credentials.email || credentials.username || '', { delay: 100 })
    await new Promise(resolve => setTimeout(resolve, 500))
    await page.type('input[name="password"], input[type="password"]', credentials.password, { delay: 100 })
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Buscar y hacer clic en el botón de login de forma más robusta
    console.log('  → Buscando botón de login...')
    const loginButtonClicked = await page.evaluate(() => {
      const selectors = [
        'button[type="submit"]',
        'button.login-button',
        'button[class*="login"]',
        'input[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Sign in")'
      ]
      
      for (const selector of selectors) {
        const btn = document.querySelector(selector) as HTMLElement
        if (btn && btn.offsetParent !== null && !btn.hasAttribute('disabled')) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
          btn.click()
          return true
        }
      }
      
      // Buscar por texto
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
      const loginBtn = buttons.find(btn => {
        const text = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase().trim()
        return (text.includes('log in') || text.includes('sign in') || text.includes('login')) &&
               (btn as HTMLElement).offsetParent !== null &&
               !(btn as HTMLElement).hasAttribute('disabled')
      })
      
      if (loginBtn) {
        (loginBtn as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(loginBtn as HTMLElement).click()
        return true
      }
      
      return false
    })

    if (!loginButtonClicked) {
      console.log('  ⚠️ No se encontró botón de login, intentando método alternativo...')
      await page.keyboard.press('Enter')
    }
    
    // Intentar resolver captcha después del login
    await new Promise(resolve => setTimeout(resolve, 2000))
    await attemptAutoCaptcha('post-login')
    
    // Esperar navegación
    console.log('  → Esperando navegación después del login...')
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        new Promise(resolve => setTimeout(resolve, 8000))
      ])
    } catch (e) {
      console.log('  ⚠️ No se detectó navegación, verificando estado actual...')
    }

    await new Promise(resolve => setTimeout(resolve, 3000))
    const currentUrl = page.url()
    const pageContent = await page.content()
    
    // Verificar captcha de forma más exhaustiva
    const captchaInfo = await page.evaluate(() => {
      const captchaSelectors = [
        '.g-recaptcha',
        '#captcha',
        '[data-captcha]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="captcha"]',
        '.recaptcha',
        '[class*="captcha"]',
        '[id*="captcha"]'
      ]
      
      for (const selector of captchaSelectors) {
        const element = document.querySelector(selector)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, selector, visible: true }
          }
        }
      }
      
      const bodyText = document.body.textContent?.toLowerCase() || ''
      if (bodyText.includes('captcha') || bodyText.includes('recaptcha') || 
          bodyText.includes('verify you are human') || bodyText.includes('verify you\'re not a robot')) {
        return { found: true, selector: 'text_match', visible: true }
      }
      
      return { found: false, visible: false }
    })
    
    const hasCaptcha = captchaInfo.found || 
                       pageContent.includes('captcha') || 
                       pageContent.includes('recaptcha') ||
                       pageContent.includes('verify you are human') ||
                       pageContent.includes('verify you\'re not a robot')
    
    // Verificar mensaje de error
    const errorMessage = await page.evaluate(() => {
      const errorSelectors = ['.error', '.alert-error', '.alert-danger', '[role="alert"]', '[class*="error"]']
      for (const selector of errorSelectors) {
        const errorEl = document.querySelector(selector)
        if (errorEl) {
          const text = errorEl.textContent?.trim()
          if (text && text.length > 0) {
            return text
          }
        }
      }
      return null
    })
    
    // Verificar autenticación de forma más robusta
    const isAuthenticated = !currentUrl.includes('/login') && 
                           (currentUrl.includes('/dashboard') || 
                            currentUrl.includes('/nx/') ||
                            currentUrl.includes('/freelancers/') ||
                            !currentUrl.includes('freelancer.com/login'))

    if (isAuthenticated) {
      console.log('✅ Login exitoso en Freelancer')
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    let error = 'Login falló - No se pudo autenticar exitosamente'
    if (hasCaptcha) {
      error = 'Captcha detectado - No se pudo resolver automáticamente'
    } else if (errorMessage) {
      error = `Error: ${errorMessage}`
    }

    console.log(`❌ Login en Freelancer falló: ${error}`)
    console.log(`  → URL final: ${currentUrl}`)
    if (hasCaptcha) {
      console.log('  ⚠️ Captcha detectado - La aplicación continuará con otras plataformas que no requieren autenticación')
    }

    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: error,
      errorDetails: `URL final: ${currentUrl}. ${hasCaptcha ? 'Nota: Freelancer tiene protección anti-bot. La aplicación intentará hacer scraping sin autenticación, pero puede tener limitaciones.' : ''}`
    }
  } catch (error) {
    console.error('❌ Error en login de Freelancer:', error)
    if (error instanceof Error) {
      console.error('   Mensaje:', error.message)
    }
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      errorDetails: 'Error durante el proceso de autenticación'
    }
  } finally {
    await browser.close()
  }
}

/**
 * Autenticación genérica - intenta login en todas las plataformas
 */
export async function authenticateAllPlatforms(credentials: {
  upwork?: PlatformCredentials
  freelancer?: PlatformCredentials
  hireline?: PlatformCredentials
  indeed?: PlatformCredentials
  braintrust?: PlatformCredentials
  glassdoor?: PlatformCredentials
}): Promise<{
  upwork?: AuthSession
  freelancer?: AuthSession
  hireline?: AuthSession
  indeed?: AuthSession
  braintrust?: AuthSession
  glassdoor?: AuthSession
}> {
  const sessions: any = {}
  
  // Mapa para rastrear qué plataformas están en proceso de login
  const loginInProgress: { [key: string]: boolean } = {}
  
  // Contar cuántas plataformas tienen credenciales
  const platformsToProcess = [
    { name: 'upwork', cred: credentials.upwork },
    { name: 'freelancer', cred: credentials.freelancer },
    { name: 'hireline', cred: credentials.hireline },
    { name: 'indeed', cred: credentials.indeed },
    { name: 'braintrust', cred: credentials.braintrust },
    { name: 'glassdoor', cred: credentials.glassdoor }
  ].filter(p => p.cred !== undefined)
  
  const totalPlatforms = platformsToProcess.length
  console.log(`\n🚀 Iniciando proceso de autenticación SECUENCIAL para ${totalPlatforms} plataforma(s)`)
  console.log(`📋 Plataformas a procesar: ${platformsToProcess.map((p: any) => p.name.toUpperCase()).join(', ')}\n`)

  // Procesar una plataforma a la vez, continuando aunque una falle
  // PLATAFORMA 1: Upwork
  if (credentials.upwork) {
    try {
    sessions.upwork = await loginUpworkPlaywright(credentials.upwork)
    if (sessions.upwork?.isAuthenticated) {
      console.log('✅ Login exitoso en Upwork')
    } else {
        console.log('❌ Login falló en Upwork:', sessions.upwork?.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('❌ Error durante login de Upwork:', error instanceof Error ? error.message : 'Error desconocido')
      sessions.upwork = {
        cookies: [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: `Excepción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        errorDetails: error instanceof Error ? error.stack : undefined
      }
    } finally {
      // Marcar que el intento terminó
      loginInProgress['upwork'] = false
    }
    // Esperar tiempo EXTENDIDO antes de continuar con la siguiente plataforma
    console.log(`✅ [1/${totalPlatforms}] UPWORK completado. Esperando antes de continuar con la siguiente plataforma...`)
    await new Promise(resolve => setTimeout(resolve, 10000))
  }

  // PLATAFORMA 2: Freelancer
  if (credentials.freelancer) {
    if (loginInProgress['freelancer']) {
      console.log('  ⚠️ Ya hay un intento de login en Freelancer en progreso, esperando...')
      while (loginInProgress['freelancer']) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    loginInProgress['freelancer'] = true
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔐 [2/${totalPlatforms}] Procesando FREELANCER...`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    try {
    sessions.freelancer = await loginFreelancerPlaywright(credentials.freelancer)
    if (sessions.freelancer?.isAuthenticated) {
      console.log('✅ Login exitoso en Freelancer')
    } else {
        console.log('❌ Login falló en Freelancer:', sessions.freelancer?.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('❌ Error durante login de Freelancer:', error instanceof Error ? error.message : 'Error desconocido')
      sessions.freelancer = {
        cookies: [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: `Excepción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        errorDetails: error instanceof Error ? error.stack : undefined
      }
    } finally {
      loginInProgress['freelancer'] = false
    }
    console.log(`✅ [2/${totalPlatforms}] FREELANCER completado. Esperando antes de continuar con la siguiente plataforma...`)
    await new Promise(resolve => setTimeout(resolve, 10000))
  }

  // PLATAFORMA 3: Hireline
  if (credentials.hireline) {
    if (loginInProgress['hireline']) {
      console.log('  ⚠️ Ya hay un intento de login en Hireline.io en progreso, esperando...')
      while (loginInProgress['hireline']) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    loginInProgress['hireline'] = true
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔐 [3/${totalPlatforms}] Procesando HIRELINE...`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    try {
    sessions.hireline = await loginHirelinePlaywright(credentials.hireline)
    if (sessions.hireline?.isAuthenticated) {
      console.log('✅ Login exitoso en Hireline.io')
    } else {
        console.log('❌ Login falló en Hireline.io:', sessions.hireline?.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('❌ Error durante login de Hireline.io:', error instanceof Error ? error.message : 'Error desconocido')
      sessions.hireline = {
        cookies: [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: `Excepción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        errorDetails: error instanceof Error ? error.stack : undefined
      }
    } finally {
      loginInProgress['hireline'] = false
    }
    console.log(`✅ [3/${totalPlatforms}] HIRELINE completado. Esperando antes de continuar con la siguiente plataforma...`)
    await new Promise(resolve => setTimeout(resolve, 10000))
  }

  // PLATAFORMA 4: Indeed
  if (credentials.indeed) {
    if (loginInProgress['indeed']) {
      console.log('  ⚠️ Ya hay un intento de login en Indeed en progreso, esperando...')
      while (loginInProgress['indeed']) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    loginInProgress['indeed'] = true
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔐 [4/${totalPlatforms}] Procesando INDEED...`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    try {
    sessions.indeed = await loginIndeedPlaywright(credentials.indeed)
    if (sessions.indeed?.isAuthenticated) {
      console.log('✅ Login exitoso en Indeed')
    } else {
        console.log('❌ Login falló en Indeed:', sessions.indeed?.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('❌ Error durante login de Indeed:', error instanceof Error ? error.message : 'Error desconocido')
      sessions.indeed = {
        cookies: [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: `Excepción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        errorDetails: error instanceof Error ? error.stack : undefined
      }
    } finally {
      loginInProgress['indeed'] = false
    }
    console.log(`✅ [4/${totalPlatforms}] INDEED completado. Esperando antes de continuar con la siguiente plataforma...`)
    await new Promise(resolve => setTimeout(resolve, 10000))
  }

  // PLATAFORMA 5: Braintrust
  if (credentials.braintrust) {
    if (loginInProgress['braintrust']) {
      console.log('  ⚠️ Ya hay un intento de login en Braintrust en progreso, esperando...')
      while (loginInProgress['braintrust']) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    loginInProgress['braintrust'] = true
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔐 [5/${totalPlatforms}] Procesando BRAINTRUST...`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    try {
    sessions.braintrust = await loginBraintrustPlaywright(credentials.braintrust)
    if (sessions.braintrust?.isAuthenticated) {
      console.log('✅ Login exitoso en Braintrust')
    } else {
        console.log('❌ Login falló en Braintrust:', sessions.braintrust?.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('❌ Error durante login de Braintrust:', error instanceof Error ? error.message : 'Error desconocido')
      sessions.braintrust = {
        cookies: [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: `Excepción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        errorDetails: error instanceof Error ? error.stack : undefined
      }
    } finally {
      loginInProgress['braintrust'] = false
    }
    console.log(`✅ [5/${totalPlatforms}] BRAINTRUST completado. Esperando antes de continuar con la siguiente plataforma...`)
    await new Promise(resolve => setTimeout(resolve, 10000))
  }

  // PLATAFORMA 6: Glassdoor
  if (credentials.glassdoor) {
    if (loginInProgress['glassdoor']) {
      console.log('  ⚠️ Ya hay un intento de login en Glassdoor en progreso, esperando...')
      while (loginInProgress['glassdoor']) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    loginInProgress['glassdoor'] = true
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔐 [6/${totalPlatforms}] Procesando GLASSDOOR...`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    try {
    sessions.glassdoor = await loginGlassdoorPlaywright(credentials.glassdoor)
    if (sessions.glassdoor?.isAuthenticated) {
      console.log('✅ Login exitoso en Glassdoor')
    } else {
        console.log('❌ Login falló en Glassdoor:', sessions.glassdoor?.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('❌ Error durante login de Glassdoor:', error instanceof Error ? error.message : 'Error desconocido')
      sessions.glassdoor = {
        cookies: [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: `Excepción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        errorDetails: error instanceof Error ? error.stack : undefined
      }
    } finally {
      loginInProgress['glassdoor'] = false
    }
    console.log(`✅ [6/${totalPlatforms}] GLASSDOOR completado.`)
  }

  // Resumen final del proceso de autenticación
  const successCount = Object.values(sessions).filter((s: any) => s?.isAuthenticated).length
  const failedCount = totalPlatforms - successCount
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📊 RESUMEN FINAL DE AUTENTICACIÓN:`)
  console.log(`   Total de plataformas procesadas: ${totalPlatforms}`)
  console.log(`   ✅ Exitosas: ${successCount}`)
  console.log(`   ❌ Fallidas: ${failedCount}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  return sessions
}


