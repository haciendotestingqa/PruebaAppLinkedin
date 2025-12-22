// Código base para login de Upwork
// Generado con: npm run record:upwork

import { Browser, Page } from 'playwright'

export async function loginToUpwork(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  console.log('🚀 Iniciando login a Upwork...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a https://www.upwork.com/ab/account-security/login...')
    await page.goto('https://www.upwork.com/ab/account-security/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // TODO: Reemplazar con código generado por Playwright Codegen
    // 1. Hacer click en "Continue with Google"
    // 2. Manejar popup de Google OAuth
    // 3. Completar login

    console.log('✅ Login exitoso a Upwork!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login a Upwork:', error)

    // Tomar screenshot para debugging
    try {
      await page.screenshot({ path: 'upwork-login-error.png', fullPage: true })
      console.log('📸 Screenshot guardado: upwork-login-error.png')
    } catch (screenshotError) {
      console.log('No se pudo guardar screenshot:', screenshotError)
    }

    throw error
  }
}


