#!/usr/bin/env ts-node

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const platform = process.argv[2]

if (!platform) {
  console.error('Uso: npm run create-login-script <platform>')
  console.error('Plataformas disponibles: upwork, glassdoor, indeed, hireline')
  process.exit(1)
}

const templates: Record<string, string> = {
  upwork: `import { Browser, Page } from 'playwright'

export async function loginToUpwork(browser: Browser, email: string, password: string): Promise<Page> {
  console.log('🚀 Iniciando login a Upwork...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a la página de login de Upwork...')
    await page.goto('https://www.upwork.com/ab/account-security/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // Esperar a que aparezca el formulario de login
    await page.waitForSelector('input[type="email"], input[name="email"], [data-cy="login-username"]', {
      timeout: 10000
    })

    // Hacer clic en "Continue with Email" si está disponible
    try {
      const emailButton = await page.locator('text=/Continue with Email|Use Email/i').first()
      if (await emailButton.isVisible({ timeout: 3000 })) {
        await emailButton.click()
        await page.waitForTimeout(1000)
      }
    } catch (e) {
      console.log('Botón "Continue with Email" no encontrado, continuando...')
    }

    // Ingresar email
    console.log('📧 Ingresando email...')
    const emailInput = page.locator('input[type="email"], input[name="email"], [data-cy="login-username"]').first()
    await emailInput.fill(email)
    await page.waitForTimeout(500)

    // Hacer clic en "Continue" o "Next"
    const continueButton = page.locator('button[type="submit"], [data-cy="login-continue"], text=/Continue|Next/i').first()
    await continueButton.click()

    // Esperar a que aparezca el campo de contraseña
    await page.waitForSelector('input[type="password"], input[name="password"]', {
      timeout: 15000
    })

    // Ingresar contraseña
    console.log('🔒 Ingresando contraseña...')
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await passwordInput.fill(password)
    await page.waitForTimeout(500)

    // Hacer clic en "Sign In" o "Login"
    const signInButton = page.locator('button[type="submit"], [data-cy="login-submit"], text=/Sign In|Login|Log In/i').first()
    await signInButton.click()

    // Esperar a que se complete el login
    console.log('⏳ Esperando que se complete el login...')
    await page.waitForURL('**/hire/**', { timeout: 30000 })

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
}`,

  glassdoor: `import { Browser, Page } from 'playwright'

export async function loginToGlassdoor(browser: Browser, email: string, password: string): Promise<Page> {
  console.log('🚀 Iniciando login a Glassdoor...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a la página de login de Glassdoor...')
    await page.goto('https://www.glassdoor.com/profile/login_input.htm', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // Esperar a que aparezca el formulario de login
    await page.waitForSelector('input[type="email"], input[name="username"]', {
      timeout: 10000
    })

    // Ingresar email
    console.log('📧 Ingresando email...')
    const emailInput = page.locator('input[type="email"], input[name="username"]').first()
    await emailInput.fill(email)
    await page.waitForTimeout(500)

    // Ingresar contraseña
    console.log('🔒 Ingresando contraseña...')
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await passwordInput.fill(password)
    await page.waitForTimeout(500)

    // Hacer clic en "Sign In"
    const signInButton = page.locator('button[type="submit"], text=/Sign In|Login/i').first()
    await signInButton.click()

    // Esperar a que se complete el login
    console.log('⏳ Esperando que se complete el login...')
    await page.waitForURL('**/member/**', { timeout: 30000 })

    console.log('✅ Login exitoso a Glassdoor!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login a Glassdoor:', error)

    // Tomar screenshot para debugging
    try {
      await page.screenshot({ path: 'glassdoor-login-error.png', fullPage: true })
      console.log('📸 Screenshot guardado: glassdoor-login-error.png')
    } catch (screenshotError) {
      console.log('No se pudo guardar screenshot:', screenshotError)
    }

    throw error
  }
}`,

  indeed: `import { Browser, Page } from 'playwright'

export async function loginToIndeed(browser: Browser, email: string, password: string): Promise<Page> {
  console.log('🚀 Iniciando login a Indeed...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a la página de login de Indeed...')
    await page.goto('https://secure.indeed.com/account/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // Esperar a que aparezca el formulario de login
    await page.waitForSelector('input[type="email"], input[name="email"]', {
      timeout: 10000
    })

    // Ingresar email
    console.log('📧 Ingresando email...')
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await emailInput.fill(email)
    await page.waitForTimeout(500)

    // Hacer clic en "Continue"
    const continueButton = page.locator('button[type="submit"], text=/Continue|Next/i').first()
    await continueButton.click()

    // Esperar a que aparezca el campo de contraseña
    await page.waitForSelector('input[type="password"]', {
      timeout: 15000
    })

    // Ingresar contraseña
    console.log('🔒 Ingresando contraseña...')
    const passwordInput = page.locator('input[type="password"]').first()
    await passwordInput.fill(password)
    await page.waitForTimeout(500)

    // Hacer clic en "Sign In"
    const signInButton = page.locator('button[type="submit"], text=/Sign In|Login/i').first()
    await signInButton.click()

    // Esperar a que se complete el login
    console.log('⏳ Esperando que se complete el login...')
    await page.waitForURL('**/myjobs/**', { timeout: 30000 })

    console.log('✅ Login exitoso a Indeed!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login a Indeed:', error)

    // Tomar screenshot para debugging
    try {
      await page.screenshot({ path: 'indeed-login-error.png', fullPage: true })
      console.log('📸 Screenshot guardado: indeed-login-error.png')
    } catch (screenshotError) {
      console.log('No se pudo guardar screenshot:', screenshotError)
    }

    throw error
  }
}`,

  hireline: `import { Browser, Page } from 'playwright'

export async function loginToHireline(browser: Browser, email: string, password: string): Promise<Page> {
  console.log('🚀 Iniciando login a Hireline...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a la página de login de Hireline...')
    await page.goto('https://hireline.io/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // Esperar a que aparezca el formulario de login
    await page.waitForSelector('input[type="email"], input[name="email"]', {
      timeout: 10000
    })

    // Ingresar email
    console.log('📧 Ingresando email...')
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await emailInput.fill(email)
    await page.waitForTimeout(500)

    // Ingresar contraseña
    console.log('🔒 Ingresando contraseña...')
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await passwordInput.fill(password)
    await page.waitForTimeout(500)

    // Hacer clic en "Sign In" o "Login"
    const signInButton = page.locator('button[type="submit"], text=/Sign In|Login|Log In/i').first()
    await signInButton.click()

    // Esperar a que se complete el login
    console.log('⏳ Esperando que se complete el login...')
    await page.waitForURL('**/dashboard/**', { timeout: 30000 })

    console.log('✅ Login exitoso a Hireline!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login a Hireline:', error)

    // Tomar screenshot para debugging
    try {
      await page.screenshot({ path: 'hireline-login-error.png', fullPage: true })
      console.log('📸 Screenshot guardado: hireline-login-error.png')
    } catch (screenshotError) {
      console.log('No se pudo guardar screenshot:', screenshotError)
    }

    throw error
  }
}`
}

const template = templates[platform.toLowerCase()]

if (!template) {
  console.error(\`Plataforma no reconocida: \${platform}\`)
  console.error('Plataformas disponibles:', Object.keys(templates).join(', '))
  process.exit(1)
}

// Crear directorio si no existe
const outputDir = join(process.cwd(), 'scripts', 'generated')
mkdirSync(outputDir, { recursive: true })

// Generar archivo
const outputPath = join(outputDir, \`\${platform}-login-recorded.ts\`)
writeFileSync(outputPath, template)

console.log(\`✅ Script de login generado para \${platform}\`)
console.log(\`📄 Archivo creado: \${outputPath}\`)
console.log('')
console.log('🔧 Próximos pasos:')
console.log('1. Revisa el código generado')
console.log('2. Ajusta los selectores si es necesario')
console.log('3. Copia las partes relevantes a lib/platform-auth.ts')








