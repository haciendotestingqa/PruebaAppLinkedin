#!/usr/bin/env ts-node

/**
 * Script para probar las funciones de login con Playwright
 * Ejecuta todas las plataformas una por una
 */

import {
  loginUpworkPlaywright,
  recordUpworkLoginSteps,
  loginFreelancerPlaywright,
  loginHirelinePlaywright,
  loginIndeedPlaywright,
  loginBraintrustPlaywright,
  loginGlassdoorPlaywright,
  PlatformCredentials
} from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

interface TestResult {
  platform: string
  success: boolean
  error?: string
  duration: number
}

async function testPlatform(platform: string, credentials: PlatformCredentials): Promise<TestResult> {
  const startTime = Date.now()

  console.log(`\n🔐 ========================================`)
  console.log(`🔐 PROBANDO LOGIN EN ${platform.toUpperCase()}`)
  console.log(`🔐 ========================================\n`)

  try {
    let session: any = null

    switch (platform) {
      case 'upwork':
        session = await loginUpworkPlaywright(credentials)
        break
      case 'freelancer':
        session = await loginFreelancerPlaywright(credentials)
        break
      case 'hireline':
        session = await loginHirelinePlaywright(credentials)
        break
      case 'indeed':
        session = await loginIndeedPlaywright(credentials)
        break
      case 'braintrust':
        session = await loginBraintrustPlaywright(credentials)
        break
      case 'glassdoor':
        session = await loginGlassdoorPlaywright(credentials)
        break
      default:
        throw new Error(`Plataforma no soportada: ${platform}`)
    }

    const duration = Date.now() - startTime

    if (session?.isAuthenticated) {
      console.log(`✅ ${platform.toUpperCase()} - LOGIN EXITOSO`)
      console.log(`   Cookies obtenidas: ${session.cookies?.length || 0}`)
      console.log(`   Tiempo: ${duration}ms`)

      return {
        platform,
        success: true,
        duration
      }
    } else {
      console.log(`❌ ${platform.toUpperCase()} - LOGIN FALLIDO`)
      console.log(`   Error: ${session?.error || 'Error desconocido'}`)
      console.log(`   Tiempo: ${duration}ms`)

      return {
        platform,
        success: false,
        error: session?.error || 'Error desconocido',
        duration
      }
    }

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

    console.log(`💥 ${platform.toUpperCase()} - ERROR CRÍTICO`)
    console.log(`   Error: ${errorMessage}`)
    console.log(`   Tiempo: ${duration}ms`)

    return {
      platform,
      success: false,
      error: errorMessage,
      duration
    }
  }
}

async function main() {
  console.log('🚀 INICIANDO PRUEBAS DE LOGIN CON PLAYWRIGHT\n')

  const platforms = [
    { name: 'upwork', email: process.env.UPWORK_EMAIL, password: process.env.UPWORK_PASSWORD },
    { name: 'freelancer', email: process.env.FREELANCER_EMAIL, password: process.env.FREELANCER_PASSWORD, username: process.env.FREELANCER_USERNAME },
    { name: 'hireline', email: process.env.HIRELINE_EMAIL, password: process.env.HIRELINE_PASSWORD },
    { name: 'indeed', email: process.env.INDEED_EMAIL, password: process.env.INDEED_PASSWORD },
    { name: 'braintrust', email: process.env.BRAINTRUST_EMAIL, password: process.env.BRAINTRUST_PASSWORD },
    { name: 'glassdoor', email: process.env.GLASSDOOR_EMAIL, password: process.env.GLASSDOOR_PASSWORD }
  ]

  const results: TestResult[] = []

  for (const platform of platforms) {
    if (platform.email && platform.password) {
      const credentials: PlatformCredentials = {
        email: platform.email,
        password: platform.password,
        username: platform.username
      }

      const result = await testPlatform(platform.name, credentials)
      results.push(result)

      // Pequeña pausa entre plataformas para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 2000))
    } else {
      console.log(`⏭️  ${platform.name.toUpperCase()} - SALTADO (credenciales faltantes)`)
      results.push({
        platform: platform.name,
        success: false,
        error: 'Credenciales faltantes',
        duration: 0
      })
    }
  }

  // Resumen final
  console.log('\n📊 ========================================')
  console.log('📊 RESUMEN DE PRUEBAS')
  console.log('📊 ========================================\n')

  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  console.log(`✅ Exitosos: ${successful.length}`)
  console.log(`❌ Fallidos: ${failed.length}`)
  console.log(`⏭️  Saltados: ${results.length - successful.length - failed.length}`)

  if (successful.length > 0) {
    console.log('\n✅ PLATAFORMAS EXITOSAS:')
    successful.forEach(r => {
      console.log(`   ${r.platform.toUpperCase()} - ${r.duration}ms`)
    })
  }

  if (failed.length > 0) {
    console.log('\n❌ PLATAFORMAS FALLIDAS:')
    failed.forEach(r => {
      console.log(`   ${r.platform.toUpperCase()} - ${r.error}`)
    })
  }

  console.log('\n🏁 PRUEBAS COMPLETADAS')
}

// Ejecutar si se llama directamente
if (require.main === module) {
  // Verificar si se solicita el modo de registro
  const args = process.argv.slice(2)
  if (args.includes('--record-upwork') || args.includes('-r')) {
    console.log('🎬 MODO REGISTRO ACTIVADO PARA UPWORK')
    console.log('=====================================\n')
    recordUpworkLoginSteps().catch(console.error)
  } else {
    main().catch(console.error)
  }
}

export { testPlatform }
