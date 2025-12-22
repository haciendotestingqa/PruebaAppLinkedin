#!/usr/bin/env ts-node

/**
 * Script específico para probar el login de Upwork con Google OAuth
 * con configuraciones avanzadas para evadir detección
 */

import { loginUpworkPlaywright } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testUpworkGoogleLogin() {
  console.log('\n🔐 ======================================')
  console.log('🔐 PRUEBA LOGIN UPWORK + GOOGLE OAUTH')
  console.log('🔐 ======================================\n')

  // Obtener credenciales
  const email = process.env.UPWORK_EMAIL || process.env.GOOGLE_EMAIL
  const password = process.env.UPWORK_PASSWORD || process.env.GOOGLE_PASSWORD

  if (!email || !password) {
    console.error('❌ Error: No se encontraron credenciales de Upwork/Google en el .env')
    console.log('Necesitas configurar:')
    console.log('- UPWORK_EMAIL o GOOGLE_EMAIL')
    console.log('- UPWORK_PASSWORD o GOOGLE_PASSWORD')
    process.exit(1)
  }

  console.log(`📧 Email configurado: ${email.substring(0, 3)}***`)
  console.log(`🔑 Password configurado: ${password.substring(0, 3)}***`)

  const credentials = {
    email: email,
    password: password
  }

  console.log('\n🚀 Iniciando prueba de login...')
  console.log('💡 El navegador se abrirá con configuraciones avanzadas para evadir detección de Google')
  console.log('💡 Si aparece "This browser or app may not be secure", las mejoras deberían ayudar\n')

  try {
    const session = await loginUpworkPlaywright(credentials, false)

    if (session?.isAuthenticated) {
      console.log('\n✅ ¡LOGIN EXITOSO!')
      console.log(`🍪 Cookies obtenidas: ${session.cookies?.length || 0}`)
      console.log('🎉 El sistema pudo evadir la detección de Google OAuth')
    } else {
      console.log('\n❌ Login falló')
      console.log(`📝 Error: ${session?.error || 'Error desconocido'}`)

      if (session?.error?.includes('secure') || session?.error?.includes('browser')) {
        console.log('\n💡 Sugerencias para solucionar el error de "browser not secure":')
        console.log('1. Asegúrate de que tus credenciales de Google sean correctas')
        console.log('2. Verifica que no tengas verificación de 2 factores activada')
        console.log('3. Intenta desde una VPN o ubicación diferente')
        console.log('4. Usa un navegador real en lugar del automatizado')
      }
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testUpworkGoogleLogin().catch(console.error)
}






