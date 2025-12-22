#!/usr/bin/env ts-node

/**
 * Script para probar específicamente el timing mejorado del manejo de passkey
 */

import { loginUpworkPlaywright } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testTimingPasskey() {
  console.log('\n🔐 ======================================')
  console.log('🔐 PRUEBA TIMING MEJORADO - PASSKEY')
  console.log('🔐 ======================================\n')

  console.log('📋 Mejoras de timing implementadas:')
  console.log('✅ Espera inicial aumentada: 3s → 5s')
  console.log('✅ Múltiples intentos de detección: hasta 3 veces')
  console.log('✅ Múltiples intentos de click: hasta 5 veces')
  console.log('✅ Verificación mejorada de visibilidad de botones')
  console.log('✅ Espera extendida después de click: 3s → 4s')
  console.log('✅ Fallback mejorado con múltiples intentos\n')

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

  console.log(`📧 Email: ${email.substring(0, 3)}***`)
  console.log(`🔑 Password: ${password.substring(0, 3)}***`)

  const credentials = {
    email: email,
    password: password
  }

  console.log('\n🚀 Iniciando prueba con timing mejorado...')
  console.log('💡 El sistema esperará más tiempo para que el popup se estabilice\n')

  try {
    const session = await loginUpworkPlaywright(credentials, false)

    if (session?.isAuthenticated) {
      console.log('\n✅ ¡PRUEBA EXITOSA!')
      console.log('🎉 El sistema manejó correctamente el timing del popup de passkey')
      console.log(`🍪 Cookies obtenidas: ${session.cookies?.length || 0}`)
    } else {
      console.log('\n❌ Prueba falló')
      console.log(`📝 Error: ${session?.error || 'Error desconocido'}`)

      // Mensajes específicos para problemas de timing
      if (session?.error?.includes('passkey') || session?.error?.includes('timeout')) {
        console.log('\n💡 Si aún hay problemas de timing, considera:')
        console.log('1. Aumentar manualmente los tiempos de espera')
        console.log('2. Verificar la velocidad de tu conexión')
        console.log('3. Probar en diferentes momentos del día')
      }
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testTimingPasskey().catch(console.error)
}
