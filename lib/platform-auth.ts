/**
 * Platform Authentication
 * Maneja el login en diferentes plataformas de trabajo freelance
 * Usa Puppeteer para simular un navegador real
 */

let puppeteer: any

if (typeof window === 'undefined') {
  try {
    puppeteer = require('puppeteer')
  } catch (e) {
    console.warn('Puppeteer not available')
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
 * Autenticación en Upwork
 */
export async function loginUpwork(credentials: PlatformCredentials, interactive: boolean = false): Promise<AuthSession | null> {
  if (!puppeteer) {
    console.error('Puppeteer no disponible para login en Upwork')
    return null
  }

  // Si se solicita modo interactivo o si detectamos captcha, usar modo visible
  const browser = await puppeteer.launch({
    headless: interactive ? false : true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: interactive ? { width: 1280, height: 720 } : null
  })

  try {
    let page = await browser.newPage()
    
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

      // Intentar más veces y esperar más tiempo entre intentos
      const maxAttempts = 20
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (await isPasswordFieldVisible()) {
          console.log(`  ✅ Campo de password detectado después de continuar (intento ${attempt + 1})`)
          // Esperar un poco más para asegurar que el campo esté completamente cargado
          await new Promise(resolve => setTimeout(resolve, 1500))
          return
        }
        
        // Cada 5 intentos, intentar hacer clic en continuar de nuevo o presionar Enter
        if (attempt > 0 && attempt % 5 === 0) {
          console.log(`  → Reintentando hacer clic en continuar... (intento ${attempt + 1}/${maxAttempts})`)
          try {
            const clicked = await clickContinueToRevealPassword()
            if (!clicked) {
              await page.keyboard.press('Enter')
            }
            await new Promise(resolve => setTimeout(resolve, 2000))
          } catch (error) {
            // Ignorar errores
          }
        } else {
          console.log(`  → Esperando campo de password... (intento ${attempt + 1}/${maxAttempts})`)
        }
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      console.log('  ⚠️ El campo de password no apareció después de los intentos de continuar')
      // No lanzar error aquí, continuar con el flujo normal
    }
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    console.log('  → Navegando a página de login de Upwork...')
    
    // Usar Promise.race para evitar timeout infinito
    // Intentar con domcontentloaded primero (más rápido), luego con load como fallback
    try {
      await Promise.race([
        page.goto('https://www.upwork.com/ab/account-security/login', {
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
          page.goto('https://www.upwork.com/ab/account-security/login', {
            waitUntil: 'load',
            timeout: 20000
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout en goto')), 25000)
          )
        ])
        console.log('  → Página cargada (load)')
      } catch (loadError) {
        // Si ambos fallan, verificar si la página al menos cargó parcialmente
        const currentUrl = page.url()
        if (currentUrl.includes('upwork.com')) {
          console.log('  ⚠️ La página cargó parcialmente, continuando...')
          // Esperar un poco para que los elementos críticos carguen
          await new Promise(resolve => setTimeout(resolve, 3000))
        } else {
          throw new Error(`No se pudo cargar la página de Upwork. Error: ${gotoError instanceof Error ? gotoError.message : 'Desconocido'}`)
        }
      }
    }

    // Esperar a que cargue el formulario
    console.log('  → Esperando formulario de login...')
    try {
      await page.waitForSelector('input[name="login[username]"], input[type="email"], #login_username', { timeout: 15000 })
      console.log('  ✅ Formulario encontrado')
    } catch (e) {
      console.log('  ⚠️ Selector estándar no encontrado, buscando alternativas...')
      // Esperar un poco más y buscar cualquier input
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
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
      await page.evaluate(() => {
        window.scrollTo(0, 0)
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
      // Si hay captcha y no estamos en modo interactivo, intentar modo interactivo
      if (hasCaptcha && !interactive) {
        console.log('  🔄 Captcha detectado - cerrando navegador headless y abriendo modo interactivo...')
        await browser.close()
        
        console.log('  👤 Abriendo navegador en modo visible para resolver captcha manualmente...')
        console.log('  📋 INSTRUCCIONES:')
        console.log('     1. Se abrirá una ventana del navegador')
        console.log('     2. Resuelve el captcha manualmente')
        console.log('     3. Completa el login si es necesario')
        console.log('     4. Espera a que la aplicación detecte el login exitoso')
        console.log('     5. La ventana se cerrará automáticamente')
        
        // Abrir navegador en modo visible
        const interactiveBrowser = await puppeteer.launch({
          headless: false,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
          defaultViewport: { width: 1280, height: 720 }
        })
        
        try {
          const interactivePage = await interactiveBrowser.newPage()
          
          // Ocultar que es un bot
          await interactivePage.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
              get: () => false,
            })
          })
          
          await interactivePage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
          
          console.log('  → Navegando a página de login de Upwork (modo interactivo)...')
          
          // Navegar a la página de login
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
              const currentUrl = interactivePage.url()
              if (!currentUrl.includes('upwork.com')) {
                throw new Error(`No se pudo cargar la página de Upwork. Error: ${gotoError instanceof Error ? gotoError.message : 'Desconocido'}`)
              }
              await new Promise(resolve => setTimeout(resolve, 3000))
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
              
              await interactiveBrowser.close()
              
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
          await interactiveBrowser.close()
          
          return {
            cookies: [],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            isAuthenticated: false,
            error: 'Timeout esperando resolución manual del captcha',
            errorDetails: 'El usuario no completó el login dentro del tiempo límite (5 minutos)'
          }
        } catch (interactiveError) {
          await interactiveBrowser.close()
          throw interactiveError
        }
      }
      
      // Si no hay captcha o ya estamos en modo interactivo, retornar error normal
      let error = 'Login falló - URL no cambió después del login'
      if (hasCaptcha) {
        error = 'Captcha detectado - Upwork tiene protección anti-bot muy fuerte. La aplicación intentará hacer scraping sin autenticación, pero puede tener limitaciones.'
      } else if (errorMessage) {
        error = `Error de login: ${errorMessage}`
      } else {
        error = 'Login falló - verifica que las credenciales sean correctas'
      }
      
      console.log(`  ❌ Login en Upwork falló: ${error}`)
      console.log(`  → URL final: ${currentUrl}`)
      if (hasCaptcha) {
        console.log('  ⚠️ Captcha detectado - la aplicación continuará con otras plataformas')
      }
      
      // Aún así, intentar obtener cookies por si acaso (puede que el captcha se resolvió después)
      const cookies = await page.cookies()
      
      return {
        cookies: cookies.length > 0 ? cookies : [],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isAuthenticated: false,
        error: error,
        errorDetails: `URL final: ${currentUrl}. ${hasCaptcha ? 'Nota: La aplicación continuará funcionando con otras plataformas (LinkedIn, Freelancer, etc.) que no requieren autenticación o tienen APIs públicas.' : ''}`
      }
    }
  } catch (error) {
    console.error('❌ Error en login de Upwork:', error)
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

      const maxAttempts = 6
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (await isPasswordFieldVisible()) {
          console.log('  → Campo de password detectado después de continuar')
          return
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      console.log('  ⚠️ El campo de password no apareció después de los intentos de continuar')
    }
    
    // Ocultar que es un bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
    })
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    console.log('  → Navegando a página de login de Hireline...')
    await page.goto('https://hireline.io/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

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
    
    console.log('  → Navegando a página de login de Indeed...')
    
    // Usar Promise.race para evitar timeout infinito
    try {
      await Promise.race([
        page.goto('https://secure.indeed.com/account/login', {
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
    
    // Listener para detectar nuevas páginas/popups
    let popupPage: any = null
    const popupPages: any[] = []
    let isResolvingCloudflare = false // Bandera para evitar ejecuciones duplicadas
    
    browser.on('targetcreated', async (target: any) => {
      const newPage = await target.page()
      if (newPage) {
        popupPage = newPage
        popupPages.push(newPage)
        try {
          const url = await newPage.url()
          console.log('  → Nueva página/popup detectado:', url)
          
          // Si es la página de auth de Indeed, intentar resolver inmediatamente
          if (url.includes('/auth') && !isResolvingCloudflare) {
            isResolvingCloudflare = true
            console.log('  → Popup de auth detectado, esperando a que cargue...')
            setTimeout(async () => {
              try {
                await resolveCloudflareChallenge(newPage)
              } catch (e) {
                console.log('  ⚠️ Error al resolver en popup:', e)
              } finally {
                isResolvingCloudflare = false
              }
            }, 8000) // Esperar 8 segundos para que cargue completamente
          }
        } catch (e) {
          console.log('  → Nueva página/popup detectado (URL no disponible aún)')
        }
      }
    })
    
    // Verificar si hay protección anti-bot (Cloudflare "Just a moment...")
    await new Promise(resolve => setTimeout(resolve, 3000))
    
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
        
        // Esperar a que la página cargue completamente
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Intentar esperar a que aparezca el checkbox usando waitForSelector
        console.log('  → Esperando a que aparezca el checkbox de Cloudflare...')
        let checkboxFound = false
        try {
          // Esperar hasta 10 segundos a que aparezca el checkbox
          await currentPage.waitForSelector('input[type="checkbox"]', { 
            visible: true, 
            timeout: 10000 
          })
          checkboxFound = true
          console.log('  ✅ Checkbox encontrado en la página')
        } catch (e) {
          console.log('  ⚠️ No se encontró checkbox con waitForSelector, continuando con búsqueda manual...')
        }
        
        // Esperar un poco más para asegurar que está completamente cargado
        await new Promise(resolve => setTimeout(resolve, 2000))
        
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
        
        // Método 0: Buscar específicamente el texto "Verify you are human" y su checkbox asociado
        const verifyHumanCheckbox = await currentPage.evaluate(() => {
          const keywords = ['verify you are human', 'verify', 'human', 'not a robot', 'i\'m not a robot']
          const allElements = Array.from(document.querySelectorAll('*'))
          
          // Buscar el texto "Verify you are human"
          for (const element of allElements) {
            const text = (element.textContent || '').toLowerCase().trim()
            if (keywords.some(keyword => text.includes(keyword))) {
              // Buscar checkbox cercano
              let checkbox: HTMLInputElement | null = null
              
              // Buscar en el mismo elemento o padre
              const parent = element.parentElement
              if (parent) {
                checkbox = parent.querySelector('input[type="checkbox"]') as HTMLInputElement
              }
              
              // Si no está en el padre, buscar en el mismo elemento
              if (!checkbox && element instanceof HTMLElement) {
                checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement
              }
              
              // Si no está, buscar en siblings
              if (!checkbox && element.parentElement) {
                const siblings = Array.from(element.parentElement.children)
                for (const sibling of siblings) {
                  checkbox = sibling.querySelector('input[type="checkbox"]') as HTMLInputElement
                  if (checkbox) break
                }
              }
              
              // Si encontramos un checkbox, hacer clic
              if (checkbox) {
                const el = checkbox as HTMLElement
                const style = window.getComputedStyle(el)
                if (el.offsetParent !== null && 
                    style.visibility !== 'hidden' && 
                    style.display !== 'none' &&
                    style.opacity !== '0') {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  setTimeout(() => {
                    el.click()
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                    // También intentar cambiar el checked directamente
                    if (el instanceof HTMLInputElement) {
                      el.checked = true
                    }
                  }, 200)
                  return true
                }
              }
            }
          }
          return false
        })
        
        if (verifyHumanCheckbox) {
          console.log('  ✅ Checkbox "Verify you are human" encontrado y marcado')
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Verificar que se marcó correctamente
          const isChecked = await currentPage.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            return checkboxes.some(cb => (cb as HTMLInputElement).checked)
          })
          
          if (isChecked) {
            console.log('  ✅ Checkbox confirmado como marcado')
            await new Promise(resolve => setTimeout(resolve, 5000))
            return true
          }
        }
        
        // Método 1: Buscar checkbox con múltiples selectores mejorados
        const checkboxSelectors = [
          'input[type="checkbox"][name*="cf"]',
          'input[type="checkbox"][id*="cf"]',
          'input[type="checkbox"][name*="challenge"]',
          'input[type="checkbox"][id*="challenge"]',
          '[data-ray] input[type="checkbox"]',
          '.cf-browser-verification input[type="checkbox"]',
          '#challenge-form input[type="checkbox"]',
          'label:has-text("Verify") input[type="checkbox"]',
          'label:has-text("human") input[type="checkbox"]',
          'input[type="checkbox"]'
        ]
        
        for (const selector of checkboxSelectors) {
          try {
            const checkbox = await currentPage.$(selector)
            if (checkbox) {
              const isVisible = await currentPage.evaluate((el: any) => {
                if (!(el instanceof HTMLElement)) return false
                const style = window.getComputedStyle(el)
                return el.offsetParent !== null && 
                       style.visibility !== 'hidden' && 
                       style.display !== 'none' &&
                       style.opacity !== '0'
              }, checkbox)
              
              if (isVisible) {
                console.log(`  → Checkbox encontrado con selector: ${selector}`)
                // Hacer scroll al elemento
                await currentPage.evaluate((el: any) => {
                  if (el instanceof HTMLElement) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }, checkbox)
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                // Intentar hacer clic múltiples veces con diferentes métodos
                try {
                  // Método 1: Puppeteer click
                  await checkbox.click({ delay: 300 })
                  console.log('  → Checkbox clickeado con Puppeteer')
                  await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (clickError) {
                  console.log('  → Puppeteer click falló, intentando con evaluate...')
                }
                
                // Método 2: Evaluate click (siempre intentar)
                try {
                  await currentPage.evaluate((el: any) => {
                    if (el instanceof HTMLElement) {
                      el.click()
                      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                      if (el instanceof HTMLInputElement) {
                        el.checked = true
                      }
                    }
                  }, checkbox)
                  console.log('  → Checkbox clickeado con evaluate')
                } catch (evaluateError) {
                  console.log('  → Evaluate click falló')
                }
                
                // Verificar que se marcó
                await new Promise(resolve => setTimeout(resolve, 3000))
                const wasChecked = await currentPage.evaluate((el: any) => {
                  return el instanceof HTMLInputElement && el.checked
                }, checkbox)
                
                if (wasChecked) {
                  console.log('  ✅ Checkbox marcado exitosamente')
                  await new Promise(resolve => setTimeout(resolve, 5000))
                  return true
                } else {
                  // Intentar marcar directamente
                  console.log('  → Checkbox no estaba marcado, marcando directamente...')
                  await currentPage.evaluate((el: any) => {
                    if (el instanceof HTMLInputElement) {
                      el.checked = true
                      el.dispatchEvent(new Event('change', { bubbles: true }))
                    }
                  }, checkbox)
                  console.log('  → Checkbox marcado directamente')
                  await new Promise(resolve => setTimeout(resolve, 5000))
                  return true
                }
              }
            }
          } catch (e) {
            // Continuar con el siguiente selector
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

    // Verificar que Cloudflare se haya resuelto antes de continuar
    const currentTitle = await safeGetPageTitle()
    const currentUrl = page.url()
    
    console.log(`  → Verificando estado después de Cloudflare... Título: "${currentTitle}", URL: ${currentUrl}`)
    
    // Si todavía estamos en Cloudflare, esperar más
    if (currentTitle.includes('Just a moment') || 
        currentTitle.includes('Checking your browser') ||
        currentTitle.includes('Additional Verification Required') ||
        (currentUrl.includes('/auth') && !currentUrl.includes('/account/login'))) {
      console.log('  ⚠️ Todavía en página de Cloudflare, esperando más tiempo...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Intentar resolver Cloudflare una vez más
      const cloudflareResolved2 = await resolveCloudflareChallenge()
      if (cloudflareResolved2) {
        console.log('  ✅ Desafío de Cloudflare resuelto (segunda verificación)')
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
      
      // Verificar nuevamente
      const newTitle = await safeGetPageTitle()
      const newUrl = page.url()
      
      if (newTitle.includes('Just a moment') || 
          newTitle.includes('Checking your browser') ||
          (newUrl.includes('/auth') && !newUrl.includes('/account/login'))) {
        console.log('  ⚠️ Aún en Cloudflare después de esperar, pero continuando...')
        // Esperar un poco más
        await new Promise(resolve => setTimeout(resolve, 15000))
      }
    }
    
    // Esperar a que la página cargue completamente
    console.log('  → Esperando a que la página cargue completamente...')
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

    // Buscar campo de email con múltiples estrategias
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
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    await page.goto('https://app.usebraintrust.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 })
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Llenar formulario de login de forma más robusta
    const emailInput = await page.$('input[type="email"], input[name="email"]')
    if (emailInput) {
      await emailInput.type(credentials.email, { delay: 50 })
    } else {
      throw new Error('No se encontró el campo de email')
    }
    
    const passwordInput = await page.$('input[type="password"], input[name="password"]')
    if (passwordInput) {
      await passwordInput.type(credentials.password, { delay: 50 })
    } else {
      throw new Error('No se encontró el campo de password')
    }

    await new Promise(resolve => setTimeout(resolve, 500))

    // Buscar y hacer clic en el botón de login usando evaluate
    await page.evaluate(() => {
      const selectors = ['button[type="submit"]', 'button.login-button', '[data-testid="login-button"]']
      for (const selector of selectors) {
        const btn = document.querySelector(selector) as HTMLElement
        if (btn && btn.offsetParent !== null) {
          btn.click()
          return true
        }
      }
      const buttons = Array.from(document.querySelectorAll('button'))
      const loginBtn = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || ''
        return text.includes('log in') || text.includes('sign in')
      })
      if (loginBtn) {
        (loginBtn as HTMLElement).click()
        return true
      }
      return false
    })
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Esperar un tiempo razonable para que el login se procese
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Verificar si la URL cambió
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
        new Promise(resolve => setTimeout(resolve, 3000))
      ])
    } catch (e) {
      // Continuar de todas formas
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))

    await new Promise(resolve => setTimeout(resolve, 2000))
    const currentUrl = page.url()
    const pageContent = await page.content()
    
    const hasCaptcha = pageContent.includes('captcha') || pageContent.includes('recaptcha')
    const errorMessage = await page.evaluate(() => {
      const errorEl = document.querySelector('.error, .alert-error, [role="alert"]')
      return errorEl?.textContent?.trim() || null
    })
    
    const isAuthenticated = !currentUrl.includes('/login')

    if (isAuthenticated) {
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    let error = 'Login falló - URL no cambió después del login'
    if (hasCaptcha) {
      error = 'Captcha detectado'
    } else if (errorMessage) {
      error = `Error: ${errorMessage}`
    }
    
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: error,
      errorDetails: `URL final: ${currentUrl}`
    }
  } catch (error) {
    console.error('❌ Error en login de Braintrust:', error)
    if (error instanceof Error) {
      console.error('   Mensaje:', error.message)
    }
    return null
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
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    await page.goto('https://www.glassdoor.com/profile/login_input.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 10000 })
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Llenar formulario de login de forma más robusta
    const emailInput = await page.$('input[type="email"], input[name="username"]')
    if (emailInput) {
      await emailInput.type(credentials.email, { delay: 50 })
    } else {
      throw new Error('No se encontró el campo de email/username')
    }
    
    const passwordInput = await page.$('input[type="password"], input[name="password"]')
    if (passwordInput) {
      await passwordInput.type(credentials.password, { delay: 50 })
    } else {
      throw new Error('No se encontró el campo de password')
    }

    await new Promise(resolve => setTimeout(resolve, 500))

    // Buscar y hacer clic en el botón de login de forma más robusta
    const submitButton = await page.$('button[type="submit"], button.login-button')
    if (submitButton) {
      await page.waitForFunction(
        (selector: string) => {
          const btn = document.querySelector(selector)
          return btn && (btn as HTMLElement).offsetParent !== null
        },
        { timeout: 5000 },
        'button[type="submit"], button.login-button'
      )
      await submitButton.click()
    } else {
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"], button.login-button') as HTMLElement
        if (btn) btn.click()
      })
    }
    
    // Esperar navegación con timeout más corto
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
    } catch (e) {
      console.log('⚠️ No se detectó navegación, verificando estado actual...')
    }

    await new Promise(resolve => setTimeout(resolve, 2000))
    const currentUrl = page.url()
    const isAuthenticated = !currentUrl.includes('/login') && !currentUrl.includes('/profile/login')

    if (isAuthenticated) {
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: 'Login falló - URL no cambió después del login',
      errorDetails: `URL final: ${currentUrl}`
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
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    await page.goto('https://www.freelancer.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 10000 })
    await page.type('input[name="username"], input[type="email"]', credentials.email || credentials.username || '', { delay: 50 })
    await page.type('input[name="password"], input[type="password"]', credentials.password, { delay: 50 })

    // Hacer clic usando evaluate
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"], button.login-button') as HTMLElement
      if (btn) btn.click()
    })
    
    // Esperar navegación con timeout más corto
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
    } catch (e) {
      console.log('⚠️ No se detectó navegación, verificando estado actual...')
    }

    await new Promise(resolve => setTimeout(resolve, 2000))
    const currentUrl = page.url()
    const pageContent = await page.content()
    
    const hasCaptcha = pageContent.includes('captcha') || pageContent.includes('recaptcha')
    const errorMessage = await page.evaluate(() => {
      const errorEl = document.querySelector('.error, .alert-error, [role="alert"]')
      return errorEl?.textContent?.trim() || null
    })
    
    const isAuthenticated = !currentUrl.includes('/login')

    if (isAuthenticated) {
      const cookies = await page.cookies()
      const userAgent = await page.evaluate(() => navigator.userAgent)

      return {
        cookies,
        userAgent,
        isAuthenticated: true
      }
    }

    let error = 'Login falló - URL no cambió después del login'
    if (hasCaptcha) {
      error = 'Captcha detectado'
    } else if (errorMessage) {
      error = `Error: ${errorMessage}`
    }
    
    return {
      cookies: [],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isAuthenticated: false,
      error: error,
      errorDetails: `URL final: ${currentUrl}`
    }
  } catch (error) {
    console.error('❌ Error en login de Freelancer:', error)
    if (error instanceof Error) {
      console.error('   Mensaje:', error.message)
    }
    return null
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

  if (credentials.upwork) {
    console.log('🔐 Intentando login en Upwork...')
    sessions.upwork = await loginUpwork(credentials.upwork)
    if (sessions.upwork?.isAuthenticated) {
      console.log('✅ Login exitoso en Upwork')
    } else {
      console.log('❌ Login falló en Upwork')
    }
  }

  if (credentials.freelancer) {
    console.log('🔐 Intentando login en Freelancer...')
    sessions.freelancer = await loginFreelancer(credentials.freelancer)
    if (sessions.freelancer?.isAuthenticated) {
      console.log('✅ Login exitoso en Freelancer')
    } else {
      console.log('❌ Login falló en Freelancer')
    }
  }

  if (credentials.hireline) {
    console.log('🔐 Intentando login en Hireline.io...')
    sessions.hireline = await loginHireline(credentials.hireline)
    if (sessions.hireline?.isAuthenticated) {
      console.log('✅ Login exitoso en Hireline.io')
    } else {
      console.log('❌ Login falló en Hireline.io')
    }
  }

  if (credentials.indeed) {
    console.log('🔐 Intentando login en Indeed...')
    sessions.indeed = await loginIndeed(credentials.indeed)
    if (sessions.indeed?.isAuthenticated) {
      console.log('✅ Login exitoso en Indeed')
    } else {
      console.log('❌ Login falló en Indeed')
    }
  }

  if (credentials.braintrust) {
    console.log('🔐 Intentando login en Braintrust...')
    sessions.braintrust = await loginBraintrust(credentials.braintrust)
    if (sessions.braintrust?.isAuthenticated) {
      console.log('✅ Login exitoso en Braintrust')
    } else {
      console.log('❌ Login falló en Braintrust')
    }
  }

  if (credentials.glassdoor) {
    console.log('🔐 Intentando login en Glassdoor...')
    sessions.glassdoor = await loginGlassdoor(credentials.glassdoor)
    if (sessions.glassdoor?.isAuthenticated) {
      console.log('✅ Login exitoso en Glassdoor')
    } else {
      console.log('❌ Login falló en Glassdoor')
    }
  }

  return sessions
}
