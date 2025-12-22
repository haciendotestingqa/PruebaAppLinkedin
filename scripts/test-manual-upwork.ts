#!/usr/bin/env ts-node

/**
 * Script para probar el login completamente manual de Upwork
 * Permite al usuario hacer todo manualmente mientras registra las acciones
 */

import { manualLoginUpwork } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testManualUpworkLogin() {
  console.log('\n🎬 ======================================')
  console.log('🎬 PRUEBA LOGIN MANUAL - UPWORK')
  console.log('🎬 ======================================\n')

  console.log('📋 Esta prueba te permitirá:')
  console.log('✅ Hacer TODO el proceso de login manualmente')
  console.log('✅ Resolver captchas, verificaciones, etc.')
  console.log('✅ El sistema registrará TODAS tus acciones')
  console.log('✅ Al final tendrás un archivo con los pasos')
  console.log('✅ Se podrá crear automatización basada en tus pasos\n')

  console.log('🚀 IMPORTANTE:')
  console.log('• Se abrirá un navegador visible')
  console.log('• Ve manualmente a Upwork y completa el login')
  console.log('• El sistema registra clicks, inputs, navegación')
  console.log('• Escribe "FIN" cuando termines\n')

  try {
    const session = await manualLoginUpwork()

    if (session?.isAuthenticated) {
      console.log('\n✅ ¡LOGIN MANUAL COMPLETADO!')
      console.log('🎉 Estás logueado exitosamente en Upwork')
      console.log(`🍪 Cookies obtenidas: ${session.cookies?.length || 0}`)
      console.log('📄 Archivo de pasos guardado para automatización futura')
    } else {
      console.log('\n⚠️ Login manual no completado')
      if (session?.error) {
        console.log(`📝 Motivo: ${session.error}`)
      }
      console.log('💡 Puedes revisar el archivo de pasos guardado')
    }

  } catch (error) {
    console.error('\n❌ Error durante el login manual:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testManualUpworkLogin().catch(console.error)
}






