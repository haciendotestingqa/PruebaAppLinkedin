import { Browser, Page } from 'playwright'

export async function loginToLinkedin(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  console.log('🚀 Iniciando login a Linkedin...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a https://www.linkedin.com/login...')
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // TODO: Agregar aquí los pasos de login grabados con Playwright Codegen
    // 1. Esperar elementos del formulario
    // 2. Ingresar email
    // 3. Ingresar contraseña
    // 4. Hacer clic en botones
    // 5. Esperar redirección

    console.log('✅ Login exitoso a Linkedin!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login a Linkedin:', error)

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

// Instrucciones para usar Playwright Codegen:
/*
1. En tu máquina local (con navegador gráfico), ejecuta:
   npx playwright codegen --target=typescript https://www.linkedin.com/login

2. En el navegador que se abre, haz login manualmente

3. Copia el código generado y reemplaza el TODO arriba

4. Ajusta los selectores y agrega manejo de errores según sea necesario
*/
