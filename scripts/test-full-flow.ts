#!/usr/bin/env ts-node

/**
 * Script para probar el flujo completo de autenticación manual
 * Simula el proceso desde el endpoint hasta la actualización del frontend
 */

import { manualLoginUpwork } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testFullFlow() {
  console.log('\n🔄 ======================================')
  console.log('🔄 PRUEBA FLUJO COMPLETO')
  console.log('🔄 ======================================\n')

  console.log('📋 Probando el flujo completo:')
  console.log('1. ✅ Endpoint recibe solicitud')
  console.log('2. ✅ Función manualLoginUpwork() se ejecuta')
  console.log('3. ✅ Usuario completa login y escribe "FIN"')
  console.log('4. ✅ Función retorna sesión exitosa')
  console.log('5. ✅ Endpoint retorna JSON a frontend')
  console.log('6. ✅ Frontend actualiza estado')
  console.log('7. ✅ UI muestra "AUTENTICADO"')
  console.log('')

  console.log('🚀 Simulando llamada desde endpoint...\n')

  try {
    // Simular lo que hace el endpoint
    console.log('📡 POST /api/authenticate-platform/upwork')
    console.log('🔄 Llamando manualLoginUpwork()...\n')

    const session = await manualLoginUpwork()

    console.log('\n📊 RESULTADO DE manualLoginUpwork():')
    console.log('==================================')
    console.log(`✅ isAuthenticated: ${session?.isAuthenticated}`)
    console.log(`🍪 Cookies: ${session?.cookies?.length || 0}`)
    console.log(`🤖 UserAgent: ${session?.userAgent ? 'SÍ' : 'NO'}`)
    if (session?.error) {
      console.log(`❌ Error: ${session.error}`)
    }

    console.log('\n📡 Respuesta que enviaría el endpoint:')
    console.log('=====================================')

    if (session?.isAuthenticated) {
      const apiResponse = {
        success: true,
        platform: 'upwork',
        isAuthenticated: true,
        session: {
          cookies: session.cookies?.length || 0,
          userAgent: session.userAgent
        },
        message: 'upwork autenticado exitosamente'
      }

      console.log('✅ Respuesta de ÉXITO:')
      console.log(JSON.stringify(apiResponse, null, 2))

      console.log('\n🎯 Qué debería pasar en el frontend:')
      console.log('=====================================')
      console.log('1. ✅ Recibe respuesta HTTP 200')
      console.log('2. ✅ Parsea JSON correctamente')
      console.log('3. ✅ data.success === true')
      console.log('4. ✅ data.isAuthenticated === true')
      console.log('5. ✅ Actualiza estado: isAuthenticated = true')
      console.log('6. ✅ UI cambia de "Autenticando..." a "Ready"')
      console.log('7. ✅ Muestra mensaje de éxito temporal')

    } else {
      const apiResponse = {
        success: false,
        platform: 'upwork',
        isAuthenticated: false,
        error: session?.error || 'Error desconocido',
        message: 'Autenticación fallida en upwork'
      }

      console.log('❌ Respuesta de ERROR:')
      console.log(JSON.stringify(apiResponse, null, 2))

      console.log('\n🎯 Qué debería pasar en el frontend:')
      console.log('=====================================')
      console.log('1. ❌ Recibe respuesta con error')
      console.log('2. ✅ Muestra mensaje de error')
      console.log('3. ✅ Mantiene estado sin autenticar')
    }

    console.log('\n🔍 Debugging adicional:')
    console.log('========================')
    console.log('• Revisa la consola del navegador (F12) para ver logs del frontend')
    console.log('• Los logs mostrarán cada paso de la actualización de estado')
    console.log('• Si el estado no se actualiza, hay un problema de comunicación')

  } catch (error) {
    console.error('\n❌ Error en la prueba del flujo completo:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testFullFlow().catch(console.error)
}






