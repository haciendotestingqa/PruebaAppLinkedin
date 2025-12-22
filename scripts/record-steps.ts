#!/usr/bin/env ts-node

import { execSync } from 'child_process'

const platform = process.argv[2]

if (!platform) {
  console.error('Uso: npm run record:steps <platform>')
  console.error('Plataformas disponibles: upwork, glassdoor, indeed, hireline')
  process.exit(1)
}

const urls: Record<string, string> = {
  upwork: 'https://www.upwork.com/ab/account-security/login',
  glassdoor: 'https://www.glassdoor.com/profile/login_input.htm',
  indeed: 'https://secure.indeed.com/account/login',
  hireline: 'https://hireline.io/login'
}

const url = urls[platform.toLowerCase()]

if (!url) {
  console.error(`Plataforma no reconocida: ${platform}`)
  console.error('Plataformas disponibles:', Object.keys(urls).join(', '))
  process.exit(1)
}

console.log(`🎬 Iniciando grabación de pasos para ${platform}...`)
console.log(`📍 URL: ${url}`)
console.log('📝 Instrucciones:')
console.log('1. El navegador se abrirá con Playwright Codegen')
console.log('2. Navega manualmente a la página de login si no estás ahí')
console.log('3. Haz login normalmente (email, contraseña, etc.)')
console.log('4. Una vez logueado, puedes hacer otras acciones si quieres')
console.log('5. Cierra la ventana de Codegen cuando termines')
console.log('6. El código se guardará en scripts/generated/')
console.log('')

try {
  // Ejecutar Playwright Codegen
  execSync(`npx playwright codegen --target=typescript --output=scripts/generated/${platform}-login-recorded.ts ${url}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  })

  console.log('')
  console.log('✅ Grabación completada!')
  console.log(`📄 Código generado en: scripts/generated/${platform}-login-recorded.ts`)
  console.log('')
  console.log('🔧 Próximos pasos:')
  console.log('1. Revisa el código generado')
  console.log('2. Copia las partes relevantes a lib/platform-auth.ts')
  console.log('3. Ajusta las credenciales para usar variables de entorno')

} catch (error) {
  console.error('❌ Error durante la grabación:', error)
  process.exit(1)
}






