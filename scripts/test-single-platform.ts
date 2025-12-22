#!/usr/bin/env ts-node

/**
 * Script para probar login en una plataforma específica con Playwright
 * Uso: npm run test:platform upwork
 */

import {
  loginUpworkPlaywright,
  loginFreelancerPlaywright,
  loginHirelinePlaywright,
  loginIndeedPlaywright,
  loginBraintrustPlaywright,
  loginGlassdoorPlaywright,
  PlatformCredentials
} from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function testPlatform(platform: string) {
  console.log(`🔐 Probando login en ${platform.toUpperCase()} con Playwright...\n`)

  let credentials: PlatformCredentials | null = null

  // Obtener credenciales según la plataforma
  switch (platform) {
    case 'upwork':
      const upworkEmail = process.env.UPWORK_EMAIL
      const upworkPassword = process.env.UPWORK_PASSWORD
      if (googleEmail && googlePassword) {
        credentials = { email: googleEmail, password: googlePassword }
      }
      break
    case 'freelancer':
      if (process.env.FREELANCER_EMAIL && process.env.FREELANCER_PASSWORD) {
        credentials = {
          email: process.env.FREELANCER_EMAIL,
          password: process.env.FREELANCER_PASSWORD,
          username: process.env.FREELANCER_USERNAME
        }
      }
      break
    case 'hireline':
      if (process.env.HIRELINE_EMAIL && process.env.HIRELINE_PASSWORD) {
        credentials = { email: process.env.HIRELINE_EMAIL, password: process.env.HIRELINE_PASSWORD }
      }
      break
    case 'indeed':
      if (process.env.INDEED_EMAIL && process.env.INDEED_PASSWORD) {
        credentials = { email: process.env.INDEED_EMAIL, password: process.env.INDEED_PASSWORD }
      }
      break
    case 'braintrust':
      if (process.env.BRAINTRUST_EMAIL && process.env.BRAINTRUST_PASSWORD) {
        credentials = { email: process.env.BRAINTRUST_EMAIL, password: process.env.BRAINTRUST_PASSWORD }
      }
      break
    case 'glassdoor':
      if (process.env.GLASSDOOR_EMAIL && process.env.GLASSDOOR_PASSWORD) {
        credentials = { email: process.env.GLASSDOOR_EMAIL, password: process.env.GLASSDOOR_PASSWORD }
      }
      break
    default:
      console.error(`❌ Plataforma no reconocida: ${platform}`)
      console.log('Plataformas disponibles: upwork, freelancer, hireline, indeed, braintrust, glassdoor')
      process.exit(1)
  }

  if (!credentials) {
    console.error(`❌ No se encontraron credenciales para ${platform}`)
    console.log('Configura las variables de entorno en el archivo .env')
    process.exit(1)
  }

  console.log(`📧 Email: ${credentials.email.substring(0, 3)}***`)
  if (credentials.username) {
    console.log(`👤 Username: ${credentials.username}`)
  }
  console.log('')

  const startTime = Date.now()

  try {
    let session = null

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
    }

    const duration = Date.now() - startTime

    if (session?.isAuthenticated) {
      console.log(`\n✅ ¡LOGIN EXITOSO en ${platform.toUpperCase()}!`)
      console.log(`⏱️  Tiempo: ${duration}ms`)
      console.log(`🍪 Cookies obtenidas: ${session.cookies?.length || 0}`)
      console.log(`🖥️  User Agent: ${session.userAgent.substring(0, 50)}...`)
      process.exit(0)
    } else {
      console.log(`\n❌ LOGIN FALLIDO en ${platform.toUpperCase()}`)
      console.log(`⏱️  Tiempo: ${duration}ms`)
      console.log(`💥 Error: ${session?.error || 'Error desconocido'}`)
      if (session?.errorDetails) {
        console.log(`📋 Detalles: ${session.errorDetails}`)
      }
      process.exit(1)
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.log(`\n💥 ERROR CRÍTICO en ${platform.toUpperCase()}`)
    console.log(`⏱️  Tiempo: ${duration}ms`)
    console.log(`💥 Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    process.exit(1)
  }
}

// Obtener plataforma desde argumentos de línea de comandos
const platform = process.argv[2]

if (!platform) {
  console.log('Uso: npm run test:platform <plataforma>')
  console.log('Plataformas disponibles: upwork, freelancer, hireline, indeed, braintrust, glassdoor')
  console.log('')
  console.log('Ejemplos:')
  console.log('  npm run test:platform upwork')
  console.log('  npm run test:platform freelancer')
  process.exit(1)
}

testPlatform(platform.toLowerCase())
