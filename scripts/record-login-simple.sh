#!/bin/bash

# Script simple para usar Playwright Codegen para grabar el flujo de login

PLATFORM=$1

if [ -z "$PLATFORM" ]; then
    echo "Uso: ./scripts/record-login-simple.sh <platform>"
    echo "Plataformas disponibles: upwork, glassdoor, indeed, hireline, linkedin"
    exit 1
fi

case $PLATFORM in
    upwork)
        URL="https://www.upwork.com/ab/account-security/login"
        ;;
    glassdoor)
        URL="https://www.glassdoor.com/profile/login_input.htm"
        ;;
    indeed)
        URL="https://secure.indeed.com/account/login"
        ;;
    hireline)
        URL="https://hireline.io/login"
        ;;
    linkedin)
        URL="https://www.linkedin.com/login"
        ;;
    *)
        echo "Plataforma no reconocida: $PLATFORM"
        echo "Plataformas disponibles: upwork, glassdoor, indeed, hireline, linkedin"
        exit 1
        ;;
esac

echo "🔧 Generando plantilla de código para $PLATFORM..."
echo "📝 Esta plantilla te servirá como base para implementar el login"
echo ""

# Crear directorio si no existe
mkdir -p scripts/generated

# Generar plantilla básica
cat > scripts/generated/${PLATFORM}-login-recorded.ts << EOF
import { Browser, Page } from 'playwright'

export async function loginTo${PLATFORM^}(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  console.log('🚀 Iniciando login a ${PLATFORM^}...')

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  })

  const page = await context.newPage()

  try {
    // Navegar a la página de login
    console.log('📍 Navegando a $URL...')
    await page.goto('$URL', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // TODO: Agregar aquí los pasos de login grabados con Playwright Codegen
    // 1. Esperar elementos del formulario
    // 2. Ingresar email
    // 3. Ingresar contraseña
    // 4. Hacer clic en botones
    // 5. Esperar redirección

    console.log('✅ Login exitoso a ${PLATFORM^}!')
    return page

  } catch (error) {
    console.error('❌ Error durante el login a ${PLATFORM^}:', error)

    // Tomar screenshot para debugging
    try {
      await page.screenshot({ path: '${PLATFORM}-login-error.png', fullPage: true })
      console.log('📸 Screenshot guardado: ${PLATFORM}-login-error.png')
    } catch (screenshotError) {
      console.log('No se pudo guardar screenshot:', screenshotError)
    }

    throw error
  }
}

// Instrucciones para usar Playwright Codegen:
/*
1. En tu máquina local (con navegador gráfico), ejecuta:
   npx playwright codegen --target=typescript $URL

2. En el navegador que se abre, haz login manualmente

3. Copia el código generado y reemplaza el TODO arriba

4. Ajusta los selectores y agrega manejo de errores según sea necesario
*/
EOF

echo ""
echo "✅ Plantilla generada!"
echo "📄 Archivo creado: scripts/generated/${PLATFORM}-login-recorded.ts"
echo ""
echo "🔧 Para grabar los pasos reales:"
echo "1. En tu máquina local con navegador gráfico, ejecuta:"
echo "   npx playwright codegen --target=typescript $URL"
echo "2. Haz login manualmente en el navegador que se abre"
echo "3. Copia el código generado al archivo de plantilla"
echo "4. Integra el código en lib/platform-auth.ts"

echo "\n✅ Grabación completada!"
echo "📄 Código generado en: scripts/generated/${PLATFORM}-login-recorded.ts"





