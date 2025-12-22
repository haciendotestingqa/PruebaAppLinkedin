#!/usr/bin/env ts-node

/**
 * Script para probar y demostrar cómo manejar el popup de Google OAuth en Upwork
 * Este script muestra el flujo completo: login → popup → completar autenticación
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

async function testGooglePopupFlow() {
  console.log('\n🔐 ======================================')
  console.log('🔐 PRUEBA FLUJO COMPLETO - UPWORK + GOOGLE POPUP')
  console.log('🔐 ======================================\n')

  // Obtener credenciales
  const email = process.env.UPWORK_EMAIL || process.env.GOOGLE_EMAIL
  const password = process.env.UPWORK_PASSWORD || process.env.GOOGLE_PASSWORD

  if (!email || !password) {
    console.error('❌ Error: No se encontraron credenciales en el .env')
    console.log('Necesitas configurar:')
    console.log('- UPWORK_EMAIL o GOOGLE_EMAIL')
    console.log('- UPWORK_PASSWORD o GOOGLE_PASSWORD')
    process.exit(1)
  }

  console.log(`📧 Email configurado: ${email.substring(0, 3)}***`)
  console.log(`🔑 Password configurado: ${password.substring(0, 3)}***`)

  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  try {
    console.log('\n🚀 Iniciando navegador para prueba del flujo...')

    // Configuración del navegador
    browser = await chromium.launch({
      headless: false, // Visible para que puedas ver el proceso
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    })

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    })

    page = await context.newPage()

    console.log('✅ Navegador abierto correctamente')
    console.log('📍 Navegando a Upwork...')

    // Paso 1: Ir a la página de login de Upwork
    await page.goto('https://www.upwork.com/ab/account-security/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    console.log('✅ Página de Upwork cargada')

    // Paso 2: Hacer click en "Continue with Google"
    console.log('🎯 Buscando botón "Continue with Google"...')

    // Buscar el botón de diferentes formas
    const googleButtonSelectors = [
      'button:has-text("Continue with Google")',
      'button:has-text("Sign in with Google")',
      '[data-cy="google-login-button"]',
      '.google-login-button',
      'button[data-provider="google"]'
    ]

    let googleButtonFound = false
    for (const selector of googleButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 })
        console.log(`✅ Botón encontrado con selector: ${selector}`)
        await page.click(selector)
        googleButtonFound = true
        break
      } catch (error) {
        console.log(`❌ Selector no funcionó: ${selector}`)
      }
    }

    if (!googleButtonFound) {
      console.log('❌ No se pudo encontrar el botón de Google')
      console.log('🔍 Intentando con locator más flexible...')

      // Intentar con locator de Playwright
      try {
        await page.getByRole('button', { name: /continue with google/i }).click()
        googleButtonFound = true
        console.log('✅ Botón encontrado con getByRole')
      } catch (error) {
        console.log('❌ Tampoco funcionó getByRole')
      }
    }

    if (!googleButtonFound) {
      throw new Error('No se pudo encontrar ni hacer click en el botón de Google')
    }

    console.log('✅ Click en "Continue with Google" realizado')

    // Paso 3: ESPERAR y manejar el popup de Google
    console.log('⏳ Esperando que se abra el popup de Google...')

    // Usar context.waitForEvent para detectar el popup
    const googlePopupPromise = context.waitForEvent('page')

    // Timeout de 10 segundos para que aparezca el popup
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout esperando popup de Google')), 10000)
    })

    // Esperar a que aparezca el popup o timeout
    const googlePopup = await Promise.race([googlePopupPromise, timeoutPromise]) as Page

    console.log('✅ ¡Popup de Google detectado!')

    // Cambiar el foco al popup
    await googlePopup.waitForLoadState()
    console.log('✅ Popup de Google cargado completamente')

    // Verificar que estamos en Google
    const popupUrl = googlePopup.url()
    console.log(`📍 URL del popup: ${popupUrl}`)

    if (!popupUrl.includes('google.com') && !popupUrl.includes('accounts.google.com')) {
      console.log('⚠️ El popup no parece ser de Google, pero continuamos...')
    }

    // Paso 4: Interactuar con el popup de Google
    console.log('🎯 Iniciando interacción con popup de Google...')

    try {
      // Intentar diferentes formas de ingresar el email
      console.log('📧 Ingresando email...')

      const emailSelectors = [
        'input[type="email"]',
        '#identifierId',
        'input[aria-label*="email" i]',
        'input[name="identifier"]'
      ]

      let emailFieldFound = false
      for (const selector of emailSelectors) {
        try {
          await googlePopup.waitForSelector(selector, { timeout: 3000 })
          await googlePopup.click(selector)
          await googlePopup.fill(selector, email)
          console.log(`✅ Email ingresado con selector: ${selector}`)
          emailFieldFound = true
          break
        } catch (error) {
          console.log(`❌ Selector de email no funcionó: ${selector}`)
        }
      }

      if (!emailFieldFound) {
        console.log('🔍 Intentando con getByLabel...')
        try {
          await googlePopup.getByLabel(/email/i).click()
          await googlePopup.getByLabel(/email/i).fill(email)
          emailFieldFound = true
          console.log('✅ Email ingresado con getByLabel')
        } catch (error) {
          console.log('❌ Tampoco funcionó getByLabel')
        }
      }

      if (!emailFieldFound) {
        throw new Error('No se pudo encontrar el campo de email en Google')
      }

      // Hacer click en "Next" o "Siguiente"
      console.log('🎯 Buscando botón "Next"...')

      const nextButtonSelectors = [
        '#identifierNext',
        'button:has-text("Next")',
        'button:has-text("Siguiente")',
        '[data-primary-action-label*="Next"]'
      ]

      let nextButtonFound = false
      for (const selector of nextButtonSelectors) {
        try {
          await googlePopup.waitForSelector(selector, { timeout: 3000 })
          await googlePopup.click(selector)
          console.log(`✅ Click en "Next" con selector: ${selector}`)
          nextButtonFound = true
          break
        } catch (error) {
          console.log(`❌ Selector de Next no funcionó: ${selector}`)
        }
      }

      if (!nextButtonFound) {
        console.log('🔍 Intentando con getByRole...')
        try {
          await googlePopup.getByRole('button', { name: /next/i }).click()
          nextButtonFound = true
          console.log('✅ Click en "Next" con getByRole')
        } catch (error) {
          console.log('❌ Tampoco funcionó getByRole')
        }
      }

      if (!nextButtonFound) {
        throw new Error('No se pudo hacer click en el botón "Next"')
      }

      // Esperar un poco y luego ingresar contraseña
      await googlePopup.waitForTimeout(2000)

      console.log('🔑 Ingresando contraseña...')

      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[aria-label*="password" i]',
        '#password'
      ]

      let passwordFieldFound = false
      for (const selector of passwordSelectors) {
        try {
          await googlePopup.waitForSelector(selector, { timeout: 5000 })
          await googlePopup.click(selector)
          await googlePopup.fill(selector, password)
          console.log(`✅ Contraseña ingresada con selector: ${selector}`)
          passwordFieldFound = true
          break
        } catch (error) {
          console.log(`❌ Selector de contraseña no funcionó: ${selector}`)
        }
      }

      if (!passwordFieldFound) {
        console.log('🔍 Intentando con getByLabel...')
        try {
          await googlePopup.getByLabel(/password/i).click()
          await googlePopup.getByLabel(/password/i).fill(password)
          passwordFieldFound = true
          console.log('✅ Contraseña ingresada con getByLabel')
        } catch (error) {
          console.log('❌ Tampoco funcionó getByLabel')
        }
      }

      if (!passwordFieldFound) {
        throw new Error('No se pudo encontrar el campo de contraseña')
      }

      // Hacer click en "Next" para la contraseña
      console.log('🎯 Confirmando contraseña...')

      let passwordNextFound = false
      for (const selector of nextButtonSelectors) {
        try {
          await googlePopup.waitForSelector(selector, { timeout: 3000 })
          await googlePopup.click(selector)
          console.log(`✅ Contraseña confirmada con selector: ${selector}`)
          passwordNextFound = true
          break
        } catch (error) {
          console.log(`❌ Selector de confirmación no funcionó: ${selector}`)
        }
      }

      if (!passwordNextFound) {
        try {
          await googlePopup.getByRole('button', { name: /next/i }).click()
          passwordNextFound = true
          console.log('✅ Contraseña confirmada con getByRole')
        } catch (error) {
          console.log('❌ Tampoco funcionó getByRole')
        }
      }

      if (!passwordNextFound) {
        throw new Error('No se pudo confirmar la contraseña')
      }

    } catch (error) {
      console.error('❌ Error durante la interacción con Google:', error.message)

      // Tomar screenshot para debugging
      try {
        await googlePopup.screenshot({ path: 'google-popup-error.png', fullPage: true })
        console.log('📸 Screenshot guardado: google-popup-error.png')
      } catch (screenshotError) {
        console.log('No se pudo guardar screenshot:', screenshotError)
      }

      throw error
    }

    // Paso 5: Esperar a que el popup se cierre y volver a Upwork
    console.log('⏳ Esperando que el popup se cierre y volver a Upwork...')

    // Esperar a que cambie la URL de la página principal
    await page.waitForURL('**/upwork.com/**', { timeout: 30000 })

    console.log('✅ ¡De vuelta en Upwork!')

    // Verificar que estamos logueados
    const finalUrl = page.url()
    console.log(`📍 URL final: ${finalUrl}`)

    // Verificar elementos que indican que estamos logueados
    const isLoggedIn = await page.evaluate(() => {
      const bodyText = document.body.textContent || ''
      return bodyText.includes('Find Work') ||
             bodyText.includes('Dashboard') ||
             bodyText.includes('My Stats') ||
             !!document.querySelector('[data-cy="user-menu"]') ||
             !!document.querySelector('a[href*="/profile/"]')
    })

    if (isLoggedIn) {
      console.log('✅ ¡LOGIN EXITOSO! Se detectó que estamos logueados en Upwork')

      // Obtener cookies para verificar
      const cookies = await context.cookies()
      console.log(`🍪 Cookies obtenidas: ${cookies.length}`)

      // Guardar el resultado
      console.log('\n🎉 PRUEBA COMPLETADA EXITOSAMENTE')
      console.log('✅ El flujo de Google OAuth popup funcionó correctamente')
      console.log('✅ Login completado exitosamente')

    } else {
      console.log('⚠️ No se pudo verificar automáticamente que estamos logueados')
      console.log('💡 Puede que el login haya funcionado pero la detección falló')
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error instanceof Error ? error.message : 'Error desconocido')

    // Tomar screenshot de la página principal si hay error
    if (page) {
      try {
        await page.screenshot({ path: 'upwork-login-error.png', fullPage: true })
        console.log('📸 Screenshot de error guardado: upwork-login-error.png')
      } catch (screenshotError) {
        console.log('No se pudo guardar screenshot:', screenshotError)
      }
    }

  } finally {
    // Cerrar el navegador
    if (browser) {
      console.log('🗂️ Cerrando navegador...')
      await browser.close()
      console.log('✅ Navegador cerrado')
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testGooglePopupFlow().catch(console.error)
}


