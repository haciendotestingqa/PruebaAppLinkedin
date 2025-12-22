#!/usr/bin/env ts-node

/**
 * Script para probar específicamente el manejo de verificación humana
 * "VERIFYING YOU ARE HUMAN" con checkbox que se refresca
 */

import { loginUpworkPlaywright } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testHumanVerification() {
  console.log('\n🤖 ======================================')
  console.log('🤖 PRUEBA VERIFICACIÓN HUMANA')
  console.log('🤖 ======================================\n')

  console.log('📋 Mejoras implementadas para "VERIFYING YOU ARE HUMAN":')
  console.log('✅ Detección automática de pantalla de verificación')
  console.log('✅ Múltiples intentos de marcar checkbox')
  console.log('✅ Espera extendida para completar verificación')
  console.log('✅ Verificación de éxito antes de continuar\n')

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

  console.log('\n🚀 Iniciando prueba de verificación humana...')
  console.log('💡 El sistema detectará automáticamente "VERIFYING YOU ARE HUMAN"')
  console.log('💡 Marcará el checkbox y esperará la verificación\n')

  try {
    const session = await loginUpworkPlaywright(credentials, false)

    if (session?.isAuthenticated) {
      console.log('\n✅ ¡PRUEBA EXITOSA!')
      console.log('🎉 El sistema manejó correctamente la verificación humana')
      console.log(`🍪 Cookies obtenidas: ${session.cookies?.length || 0}`)
    } else {
      console.log('\n❌ Prueba falló')
      console.log(`📝 Error: ${session?.error || 'Error desconocido'}`)

      // Mensajes específicos para verificación humana
      if (session?.error?.includes('human') || session?.error?.includes('verification')) {
        console.log('\n💡 Si aún hay problemas con la verificación humana:')
        console.log('1. Asegúrate de marcar el checkbox cuando aparezca')
        console.log('2. Espera a que se complete la verificación (puede tomar tiempo)')
        console.log('3. Si se refresca la página, el sistema lo intentará nuevamente')
      }
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testHumanVerification().catch(console.error)
}






