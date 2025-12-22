#!/usr/bin/env node

/**
 * Script simple para registrar los pasos manuales del login de Upwork
 */

const playwright = require('playwright')
const fs = require('fs')
const path = require('path')

// Cargar variables de entorno
require('dotenv').config()

async function recordUpworkLoginSteps() {
  console.log('\n🎬 =====================================================')
  console.log('🎬 REGISTRO DE PASOS PARA LOGIN DE UPWORK')
  console.log('🎬 =====================================================\n')

  console.log('📋 INSTRUCCIONES:')
  console.log('1. Se abrirá un navegador')
  console.log('2. Ve a https://www.upwork.com/ab/account-security/login')
  console.log('3. Completa el proceso de login MANUALMENTE')
  console.log('4. Haz todos los clicks y completa todos los campos')
  console.log('5. El sistema registrará tus acciones')
  console.log('6. Cuando termines, escribe "FIN" en la consola')
  console.log('')

  if (!playwright) {
    console.error('❌ Playwright no disponible')
    return
  }

  let browser
  let context
  let page

  try {
    // Lanzar navegador en modo no headless para que sea visible
    browser = await playwright.chromium.launch({
      headless: false, // Modo visible para que el usuario vea lo que hace
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    })

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    page = await context.newPage()
    await page.setViewportSize({ width: 1280, height: 800 })

    // Esperar un poco antes de navegar
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('🌐 Navegando a Upwork...')
    await page.goto('https://www.upwork.com/ab/account-security/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // Esperar un poco más para que la página se estabilice completamente
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verificar que la página cargó correctamente
    const pageTitle = await page.title()
    console.log(`📄 Título de página: "${pageTitle}"`)

    if (pageTitle.includes('Upwork') || page.url().includes('upwork.com')) {
      console.log('✅ Página de Upwork cargada correctamente. Ahora completa el login manualmente.')
      console.log('🎯 El sistema registrará tus acciones automáticamente...')
    } else {
      console.log('⚠️ La página puede no haber cargado correctamente, pero continuando...')
      console.log('🎯 Completa el login manualmente cuando puedas.')
    }

    // Array para almacenar los pasos registrados
    const recordedSteps = []

    // Registrar navegación inicial
    recordedSteps.push({
      type: 'navigation',
      url: 'https://www.upwork.com/ab/account-security/login',
      timestamp: new Date().toISOString()
    })

    // Escuchar eventos de click
    page.on('click', async (event) => {
      try {
        const element = event.target
        if (element) {
          // Generar selector único para el elemento
          let selector = element.tagName.toLowerCase()
          if (element.id) {
            selector = `#${element.id}`
          } else if (element.className) {
            selector = `.${element.className.split(' ').join('.')}`
          }

          recordedSteps.push({
            type: 'click',
            selector: selector,
            text: element.textContent?.substring(0, 50) || '',
            timestamp: new Date().toISOString()
          })

          console.log(`🖱️ Click registrado: ${selector}`)
        }
      } catch (e) {
        console.log('⚠️ Error registrando click:', e.message)
      }
    })

    // Escuchar cambios de URL
    let currentUrl = page.url()
    const checkUrlChange = () => {
      setTimeout(async () => {
        try {
          const newUrl = page.url()
          if (newUrl !== currentUrl) {
            recordedSteps.push({
              type: 'navigation',
              url: newUrl,
              from: currentUrl,
              timestamp: new Date().toISOString()
            })
            console.log(`🔗 Navegación registrada: ${newUrl}`)
            currentUrl = newUrl
          }
          if (!page.isClosed()) checkUrlChange()
        } catch (e) {
          // Página cerrada, detener
        }
      }, 1000)
    }
    checkUrlChange()

    // Esperar hasta que el usuario escriba "FIN" en consola
    console.log('\n⏳ Esperando que completes el proceso manualmente...')
    console.log('Cuando termines, escribe "FIN" en esta consola para guardar los pasos registrados.')

    // Función para esperar input del usuario
    const waitForUserInput = () => {
      return new Promise((resolve) => {
        const readline = require('readline')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        })

        rl.question('Escribe "FIN" cuando termines: ', (answer) => {
          rl.close()
          resolve(answer.toLowerCase().trim())
        })
      })
    }

    const userInput = await waitForUserInput()

    if (userInput === 'fin') {
      console.log('\n📝 PASOS REGISTRADOS:')
      console.log('==================')

      recordedSteps.forEach((step, index) => {
        console.log(`${index + 1}. [${step.type.toUpperCase()}] ${step.timestamp}`)
        if (step.type === 'click') {
          console.log(`   Selector: ${step.selector}`)
          console.log(`   Texto: "${step.text}"`)
        } else if (step.type === 'navigation') {
          console.log(`   URL: ${step.url}`)
          if (step.from) console.log(`   Desde: ${step.from}`)
        }
        console.log('')
      })

      // Guardar los pasos en un archivo para referencia futura
      const stepsFile = path.join(process.cwd(), 'upwork-login-steps.json')
      fs.writeFileSync(stepsFile, JSON.stringify(recordedSteps, null, 2))
      console.log(`💾 Pasos guardados en: ${stepsFile}`)

      console.log('\n✅ REGISTRO COMPLETADO')
      console.log('Ahora podemos crear un script automatizado basado en estos pasos.')
    }

  } catch (error) {
    console.error('❌ Error durante el registro:', error.message)
  } finally {
    if (browser) {
      await browser.close()
      console.log('🗂️ Navegador cerrado.')
    }
  }
}

// Ejecutar la función
recordUpworkLoginSteps().catch(console.error)
