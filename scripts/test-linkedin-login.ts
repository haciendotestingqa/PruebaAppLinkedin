#!/usr/bin/env ts-node

/**
 * Script para probar el login de LinkedIn grabado con Playwright Codegen
 * Incluye manejo especial para popups que puedan aparecer
 */

import { loginToLinkedin } from './generated/linkedin-login-recorded'
import * as dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

async function testLinkedinLogin() {
  console.log('\n💼 ======================================')
  console.log('💼 PRUEBA LOGIN LINKEDIN CON POPUPS')
  console.log('💼 ======================================\n')

  // Obtener credenciales
  const email = process.env.LINKEDIN_EMAIL
  const password = process.env.LINKEDIN_PASSWORD

  if (!email || !password) {
    console.error('❌ Error: No se encontraron credenciales de LinkedIn en el .env')
    console.log('Asegúrate de configurar:')
    console.log('- LINKEDIN_EMAIL=tu-email@linkedin.com')
    console.log('- LINKEDIN_PASSWORD=tu-password')
    console.log('')
    console.log('O ejecuta: npm run setup')
    process.exit(1)
  }

  console.log(`📧 Email configurado: ${email.substring(0, 3)}***@linkedin.com`)
  console.log(`🔑 Password configurado: ${password.substring(0, 3)}***`)

  const { chromium } = require('playwright')
  let browser = null

  try {
    console.log('\n🚀 Iniciando prueba de login de LinkedIn...')
    console.log('💡 Si hay popups durante el proceso, deberían manejarse automáticamente')

    browser = await chromium.launch({ headless: false }) // Visible para debugging

    const startTime = Date.now()
    const page = await loginToLinkedin(browser, email, password)
    const endTime = Date.now()

    console.log(`\n⏱️ Tiempo total: ${(endTime - startTime) / 1000}s`)

    // Verificar que estamos logueados
    const currentUrl = page.url()
    console.log(`📍 URL final: ${currentUrl}`)

    const isLoggedIn = currentUrl.includes('linkedin.com') &&
                      !currentUrl.includes('/login') &&
                      !currentUrl.includes('/checkpoint')

    if (isLoggedIn) {
      console.log('✅ ¡LOGIN EXITOSO! LinkedIn autenticado correctamente')

      // Obtener información adicional
      const cookies = await page.context().cookies()
      console.log(`🍪 Cookies obtenidas: ${cookies.length}`)

      // Verificar elementos de usuario logueado
      const userInfo = await page.evaluate(() => {
        const profileLink = document.querySelector('a[href*="/in/"]')
        const navUser = document.querySelector('[data-control-name="nav.settings_and_privacy"]')
        const feedContent = document.querySelector('[data-testid="feed-content"]')

        return {
          hasProfileLink: !!profileLink,
          hasNavUser: !!navUser,
          hasFeedContent: !!feedContent,
          title: document.title
        }
      })

      console.log(`👤 Elementos de usuario detectados:`)
      console.log(`   Profile Link: ${userInfo.hasProfileLink}`)
      console.log(`   Nav User: ${userInfo.hasNavUser}`)
      console.log(`   Feed Content: ${userInfo.hasFeedContent}`)
      console.log(`   Page Title: "${userInfo.title}"`)

    } else {
      console.log('⚠️ Login completado pero no se detectó como logueado')
      console.log('💡 Puede que el login haya funcionado pero la verificación falló')
      console.log('💡 Revisa si estás en la página correcta de LinkedIn')
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error instanceof Error ? error.message : 'Error desconocido')

    // Intentar tomar screenshot si es posible
    try {
      if (browser) {
        const pages = browser.contexts()[0]?.pages() || []
        if (pages.length > 0) {
          await pages[0].screenshot({ path: 'linkedin-test-error.png', fullPage: true })
          console.log('📸 Screenshot guardado: linkedin-test-error.png')
        }
      }
    } catch (screenshotError) {
      console.log('No se pudo guardar screenshot:', screenshotError)
    }

  } finally {
    if (browser) {
      console.log('\n🗂️ Cerrando navegador...')
      await browser.close()
      console.log('✅ Navegador cerrado')
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testLinkedinLogin().catch(console.error)
}


