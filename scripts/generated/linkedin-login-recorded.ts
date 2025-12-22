// 🎯 INSTRUCCIONES PARA GRABAR LOGIN DE LINKEDIN CON POPUPS
// =================================================================
//
// PASO 1: Ejecuta el comando
//   npx playwright codegen --target=typescript --output=scripts/generated/linkedin-login-recorded.ts https://www.linkedin.com/login
//
// PASO 2: En el navegador que se abre:
//   - Ingresa tu email de LinkedIn
//   - Ingresa tu contraseña
//   - Si aparece algún popup (verificación, CAPTCHA, etc.), complétalo
//   - Espera a que se complete el login completamente
//
// PASO 3: El código generado reemplazará automáticamente el contenido de este archivo
//
// 🔴 IMPORTANTE SOBRE POPUPS:
// Si LinkedIn abre popups durante el login, el código generado por Playwright Codegen
// NO capturará automáticamente las acciones dentro del popup. Tendrás que:
//
// 1. IDENTIFICAR dónde ocurre el popup en el código generado
// 2. AGREGAR manualmente el manejo del popup usando:
//
//    const popup = await context.waitForEvent('page')
//    await popup.waitForLoadState()
//    // Luego interactuar con elementos del popup
//
// Ejemplo de manejo de popup:
// ==========================================
// // Después del click que abre el popup:
// const popupPromise = context.waitForEvent('page')
// await page.click('button-que-abre-popup')
//
// const popup = await popupPromise
// await popup.waitForLoadState()
//
// // Interactuar con el popup
// await popup.fill('input[type="email"]', email)
// await popup.click('button[type="submit"]')
//
// // Esperar que se cierre y volver a página principal
// await page.waitForURL('**/linkedin.com/**')
// ==========================================

import { Browser, Page } from 'playwright'

export async function loginToLinkedin(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  console.log('🚀 Iniciando login completo a LinkedIn (con manejo de popups)...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login de LinkedIn
    console.log('📍 Navegando a https://www.linkedin.com/login...')
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // ⏳ ESPERANDO ACCIONES GRABADAS POR PLAYWRIGHT CODEGEN
    // =====================================================
    // Una vez que completes la grabación, el código generado aparecerá aquí
    // Si hay popups, necesitarás agregar el manejo manual como se explica arriba

    console.log('⚠️ Código aún no grabado - completa el proceso con Playwright Codegen')
    console.log('💡 Ejecuta: npx playwright codegen --target=typescript --output=scripts/generated/linkedin-login-recorded.ts https://www.linkedin.com/login')

    return page

  } catch (error) {
    console.error('❌ Error durante el login de LinkedIn:', error)

    // Tomar screenshot para debugging
    try {
      await page.screenshot({ path: 'linkedin-login-error.png', fullPage: true })
      console.log('📸 Screenshot guardado: linkedin-login-error.png')
    } catch (screenshotError) {
      console.log('No se pudo guardar screenshot:', screenshotError)
    }

    throw error
  }
}
