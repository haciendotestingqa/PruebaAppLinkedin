#!/usr/bin/env ts-node

/**
 * Script para probar específicamente la funcionalidad de cancelar passkey
 */

import { loginUpworkPlaywright } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testPasskeyCancel() {
  console.log('\n🔐 ======================================')
  console.log('🔐 PRUEBA CANCELACIÓN DE PASSKEY')
  console.log('🔐 ======================================\n')

  console.log('📋 Esta prueba verificará que:')
  console.log('1. Se detecta correctamente la pantalla de passkey')
  console.log('2. Se hace click en "Cancel" en lugar de "Try another way"')
  console.log('3. El flujo continúa correctamente\n')

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

  console.log('\n🚀 Iniciando prueba...')
  console.log('💡 Si aparece una pantalla de passkey, se hará click en "Cancel"\n')

  try {
    const session = await loginUpworkPlaywright(credentials, false)

    if (session?.isAuthenticated) {
      console.log('\n✅ ¡PRUEBA EXITOSA!')
      console.log('🎉 El sistema manejó correctamente la pantalla de passkey')
      console.log(`🍪 Cookies obtenidas: ${session.cookies?.length || 0}`)
    } else {
      console.log('\n❌ Prueba falló')
      console.log(`📝 Error: ${session?.error || 'Error desconocido'}`)

      // Mensajes específicos para diferentes tipos de error
      if (session?.error?.includes('passkey') || session?.error?.includes('Verifying it is you')) {
        console.log('\n💡 La pantalla de passkey apareció pero no se manejó correctamente')
        console.log('Verifica que el botón "Cancel" sea detectable')
      }
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testPasskeyCancel().catch(console.error)
}






