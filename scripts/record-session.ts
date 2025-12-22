#!/usr/bin/env ts-node

import puppeteer from 'puppeteer-core'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const platformName = process.argv[2]

if (!platformName) {
  console.error('Uso: npm run record:session <platform>')
  console.error('Plataformas: upwork, glassdoor, indeed, hireline, linkedin')
  process.exit(1)
}

const urls: Record<string, string> = {
  upwork: 'https://www.upwork.com/ab/account-security/login',
  glassdoor: 'https://www.glassdoor.com/profile/login_input.htm',
  indeed: 'https://secure.indeed.com/account/login',
  hireline: 'https://hireline.io/login',
  linkedin: 'https://www.linkedin.com/login'
}

const url = urls[platformName.toLowerCase()]

if (!url) {
  console.error(`Plataforma no reconocida: ${platformName}`)
  console.error('Plataformas disponibles:', Object.keys(urls).join(', '))
  process.exit(1)
}

async function recordSession() {
  console.log(`🎬 Conectándose a Chrome para registrar sesión de ${platformName}...`)
  console.log('📝 Asegúrate de que Chrome esté abierto con --remote-debugging-port=9222')
  console.log('')

  let browser
  let page

  try {
    // Conectar a Chrome ya abierto
    browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: { width: 1280, height: 720 }
    })

    // Obtener páginas abiertas
    const pages = await browser.pages()
    page = pages[0] // Usar la primera página (donde el usuario hizo login)

    console.log('✅ Conectado a Chrome exitosamente')
    console.log(`📍 Página actual: ${page.url()}`)
    console.log('')

    // Esperar a que el usuario confirme que está listo
    console.log('🤔 ¿Ya hiciste login manualmente?')
    console.log('   - Si SÍ, presiona Enter para continuar')
    console.log('   - Si NO, haz login primero y luego presiona Enter')
    console.log('')

    // Aquí podríamos agregar una pausa interactiva, pero por ahora continuaremos
    await new Promise(resolve => setTimeout(resolve, 3000)) // Esperar 3 segundos

    console.log('🔍 Analizando la página actual...')

    // Obtener cookies de sesión
    const cookies = await page.cookies()
    console.log(`🍪 Encontradas ${cookies.length} cookies`)

    // Obtener localStorage si está disponible
    let localStorageData: Record<string, string> = {}
    try {
      localStorageData = await page.evaluate(() => {
        const items: Record<string, string> = {}
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key) {
            const value = window.localStorage.getItem(key)
            if (value) {
              items[key] = value
            }
          }
        }
        return items
      })
      console.log(`💾 Encontrados ${Object.keys(localStorageData).length} items en localStorage`)
    } catch (e) {
      console.log('💾 No se pudo acceder a localStorage (puede estar vacío)')
    }

    // Obtener sessionStorage si está disponible
    let sessionStorageData: Record<string, string> = {}
    try {
      sessionStorageData = await page.evaluate(() => {
        const items: Record<string, string> = {}
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i)
          if (key) {
            const value = window.sessionStorage.getItem(key)
            if (value) {
              items[key] = value
            }
          }
        }
        return items
      })
      console.log(`💾 Encontrados ${Object.keys(sessionStorageData).length} items en sessionStorage`)
    } catch (e) {
      console.log('💾 No se pudo acceder a sessionStorage (puede estar vacío)')
    }

    // Crear directorio si no existe
    const outputDir = join(process.cwd(), 'scripts', 'generated')
    mkdirSync(outputDir, { recursive: true })

    // Generar código de login basado en la sesión
    const loginCode = generateLoginCode(platformName, url, cookies, localStorageData, sessionStorageData)

    // Guardar el código generado
    const outputPath = join(outputDir, `${platformName}-session-recorded.ts`)
    writeFileSync(outputPath, loginCode)

    console.log('')
    console.log('✅ Sesión registrada exitosamente!')
    console.log(`📄 Código generado en: ${outputPath}`)
    console.log('')
    console.log('🔧 El código generado incluye:')
    console.log('   - Cookies de autenticación')
    console.log('   - Headers necesarios')
    console.log('   - Configuración de navegador')
    console.log('')
    console.log('📝 Próximos pasos:')
    console.log('1. Revisa el código generado')
    console.log('2. Prueba el login automático')
    console.log('3. Ajusta si es necesario')

  } catch (error) {
    console.error('❌ Error al registrar la sesión:', error)
    console.log('')
    console.log('💡 Posibles soluciones:')
    console.log('1. Asegúrate de que Chrome esté abierto con: npm run open:chrome ' + platformName)
    console.log('2. Verifica que no cerraste Chrome')
    console.log('3. Intenta de nuevo')
  } finally {
    if (browser) {
      await browser.disconnect()
    }
  }
}

function generateLoginCode(platformName: string, url: string, cookies: any[], localStorageData: Record<string, string>, sessionStorageData: Record<string, string>): string {
  const capitalizedPlatform = platformName.charAt(0).toUpperCase() + platformName.slice(1)
  const mainUrl = url.replace('/login', '').replace('/ab/account-security/login', '')

  let code = 'import { Browser, Page, Cookie } from \'playwright\'\n\n'
  code += 'export async function loginTo' + capitalizedPlatform + '(\n'
  code += '  browser: Browser,\n'
  code += '  email: string,\n'
  code += '  password: string\n'
  code += '): Promise<Page> {\n'
  code += '  console.log(\'🚀 Iniciando login a ' + capitalizedPlatform + ' usando sesión registrada...\')\n\n'
  code += '  const context = await browser.newContext({\n'
  code += '    userAgent: \'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\',\n'
  code += '    viewport: { width: 1280, height: 720 }\n'
  code += '  })\n\n'
  code += '  const page = await context.newPage()\n\n'
  code += '  try {\n'
  code += '    // Establecer cookies de la sesión registrada\n'
  code += '    const sessionCookies: Cookie[] = ' + JSON.stringify(cookies, null, 2) + '\n\n'
  code += '    await context.addCookies(sessionCookies)\n'
  code += '    console.log(\'🍪 Cookies de sesión establecidas\')\n'

  // Agregar localStorage si hay datos
  if (Object.keys(localStorageData).length > 0) {
    code += '\n    // Establecer localStorage\n'
    code += '    await page.evaluate(() => {\n'
    code += '      const lsData = ' + JSON.stringify(localStorageData, null, 6) + '\n'
    code += '      Object.entries(lsData).forEach(([key, value]) => {\n'
    code += '        localStorage.setItem(key, value as string)\n'
    code += '      })\n'
    code += '    })\n'
    code += '    console.log(\'💾 localStorage establecido\')\n'
  }

  // Agregar sessionStorage si hay datos
  if (Object.keys(sessionStorageData).length > 0) {
    code += '\n    // Establecer sessionStorage\n'
    code += '    await page.evaluate(() => {\n'
    code += '      const ssData = ' + JSON.stringify(sessionStorageData, null, 6) + '\n'
    code += '      Object.entries(ssData).forEach(([key, value]) => {\n'
    code += '        sessionStorage.setItem(key, value as string)\n'
    code += '      })\n'
    code += '    })\n'
    code += '    console.log(\'💾 sessionStorage establecido\')\n'
  }

  code += '\n    // Intentar navegar a la página principal (debería estar autenticado)\n'
  code += '    console.log(\'📍 Navegando a la página principal...\')\n'
  code += '    await page.goto(\'' + mainUrl + '\', {\n'
  code += '      waitUntil: \'networkidle\',\n'
  code += '      timeout: 30000\n'
  code += '    })\n\n'
  code += '    // Verificar si estamos autenticados\n'
  code += '    const currentUrl = page.url()\n'
  code += '    if (currentUrl.includes(\'login\') || currentUrl.includes(\'signin\')) {\n'
  code += '      throw new Error(\'La sesión expiró. Necesitas hacer login manual nuevamente.\')\n'
  code += '    }\n\n'
  code += '    console.log(\'✅ Login exitoso usando sesión registrada!\')\n'
  code += '    console.log(`📍 URL actual: ${currentUrl}`)\n'
  code += '    return page\n\n'
  code += '  } catch (error) {\n'
  code += '    console.error(\'❌ Error durante el login usando sesión registrada:\', error)\n\n'
  code += '    // Si falla, intentar login manual como fallback\n'
  code += '    console.log(\'🔄 Intentando login manual como fallback...\')\n'
  code += '    return await loginManual' + capitalizedPlatform + '(browser, email, password)\n'
  code += '  }\n'
  code += '}\n\n'
  code += '// Fallback: Login manual si la sesión expiró\n'
  code += 'async function loginManual' + capitalizedPlatform + '(\n'
  code += '  browser: Browser,\n'
  code += '  email: string,\n'
  code += '  password: string\n'
  code += '): Promise<Page> {\n'
  code += '  console.log(\'🔄 Realizando login manual...\')\n\n'
  code += '  const context = await browser.newContext({\n'
  code += '    userAgent: \'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\',\n'
  code += '    viewport: { width: 1280, height: 720 }\n'
  code += '  })\n\n'
  code += '  const page = await context.newPage()\n\n'
  code += '  // Navegar a login\n'
  code += '  await page.goto(\'' + url + '\', { waitUntil: \'networkidle\' })\n\n'
  code += '  // TODO: Implementar login manual aquí\n'
  code += '  // Este código necesita ser completado con los pasos específicos de login\n\n'
  code += '  throw new Error(\'Login manual no implementado. Usa Playwright Codegen para grabar los pasos.\')\n'
  code += '}\n\n'
  code += '// Información de la sesión registrada:\n'
  code += '/*\n'
  code += 'Plataforma: ' + capitalizedPlatform + '\n'
  code += 'URL de login: ' + url + '\n'
  code += 'Cookies encontradas: ' + cookies.length + '\n'
  code += 'LocalStorage items: ' + Object.keys(localStorageData).length + '\n'
  code += 'SessionStorage items: ' + Object.keys(sessionStorageData).length + '\n'
  code += 'Fecha de registro: ' + new Date().toISOString() + '\n'
  code += '*/\n'

  return code
}

recordSession().catch(console.error)
