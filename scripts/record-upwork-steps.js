#!/usr/bin/env ts-node

/**
 * Script para registrar los pasos manuales del login de Upwork
 */

import { recordUpworkLoginSteps } from '../lib/platform-auth'

// Cargar variables de entorno
require('dotenv').config()

async function main() {
  try {
    await recordUpworkLoginSteps()
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Ejecutar directamente
main()
