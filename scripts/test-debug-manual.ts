#!/usr/bin/env ts-node

/**
 * Script para debuggear el proceso de login manual completo
 */

import { manualLoginUpwork } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testDebugManual() {
  console.log('\n🔧 ======================================')
  console.log('🔧 DEBUG LOGIN MANUAL COMPLETO')
  console.log('🔧 ======================================\n')

  console.log('🧪 Este test verificará:')
  console.log('✅ Que se abra el navegador correctamente')
  console.log('✅ Que se registre el input del usuario')
  console.log('✅ Que se detecte el login correctamente')
  console.log('✅ Que se retornen los datos de sesión')
  console.log('✅ Que se actualice el estado en la app\n')

  console.log('⚠️ IMPORTANTE: Este es solo para testing')
  console.log('💡 En un test real, escribirías "FIN" cuando termines\n')

  try {
    console.log('🚀 Simulando llamada desde la app...')
    console.log('📡 POST /api/authenticate-platform/upwork\n')

    // Simular la llamada que hace la app
    const session = await manualLoginUpwork()

    console.log('\n📊 RESULTADO FINAL:')
    console.log('==================')
    console.log(`✅ isAuthenticated: ${session?.isAuthenticated}`)
    console.log(`🍪 Cookies: ${session?.cookies?.length || 0}`)
    console.log(`🤖 UserAgent: ${session?.userAgent ? 'PRESENTE' : 'AUSENTE'}`)
    if (session?.error) {
      console.log(`❌ Error: ${session.error}`)
    }

    if (session?.isAuthenticated) {
      console.log('\n🎉 ¡ÉXITO! La sesión se retornó correctamente')
      console.log('💡 La app debería actualizar el estado a "AUTENTICADO"')
    } else {
      console.log('\n⚠️ La sesión no se autenticó')
      console.log('💡 La app debería mostrar el error correspondiente')
    }

  } catch (error) {
    console.error('\n❌ Error en el test:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testDebugManual().catch(console.error)
}








