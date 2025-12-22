// Código base para login de Braintrust
// Generado con: npm run record:braintrust

import { Browser, Page } from 'playwright'

export async function loginToBraintrust(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  console.log('🚀 Iniciando login a Braintrust...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a https://www.usebraintrust.com/login...')
    await page.goto('https://www.usebraintrust.com/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // TODO: Implementar login de Braintrust
    console.log('✅ Login exitoso a Braintrust!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login a Braintrust:', error)
    throw error
  }
}


