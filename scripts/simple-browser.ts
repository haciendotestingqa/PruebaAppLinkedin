#!/usr/bin/env node

/**
 * Script simple para abrir navegador y navegar a Upwork
 * Permite hacer login manualmente sin registro automático
 */

const playwright = require('playwright')

async function openBrowserForManualLogin() {
  console.log('\n🌐 ======================================')
  console.log('🌐 NAVEGADOR MANUAL PARA UPWORK')
  console.log('🌐 ======================================\n')

  console.log('📋 INSTRUCCIONES:')
  console.log('1. Se abrirá un navegador')
  console.log('2. Navega manualmente a: https://www.upwork.com/ab/account-security/login')
  console.log('3. Completa el login con tus credenciales')
  console.log('4. Cuando termines, cierra el navegador')
  console.log('')

  let browser
  let page

  try {
    console.log('🚀 Iniciando navegador...')

    // Configuración simple y robusta
    browser = await playwright.chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    page = await context.newPage()
    await page.setViewportSize({ width: 1280, height: 720 })

    console.log('✅ Navegador abierto exitosamente')
    console.log('🌐 Abre esta URL manualmente: https://www.upwork.com/ab/account-security/login')
    console.log('⏳ Esperando que completes el login...')

    // Mantener el navegador abierto
    // El usuario debe cerrarlo manualmente cuando termine

  } catch (error) {
    console.error('❌ Error al abrir navegador:', error.message)
  }

  // No cerrar automáticamente el navegador
  console.log('\n💡 El navegador permanecerá abierto para que completes el login manualmente.')
  console.log('🔒 Cierra el navegador cuando termines.')
}

// Ejecutar el script
openBrowserForManualLogin().catch(console.error)
