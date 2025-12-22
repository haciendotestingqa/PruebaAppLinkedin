#!/usr/bin/env ts-node

import { exec } from 'child_process'
import { platform } from 'os'

const platformName = process.argv[2]

if (!platformName) {
  console.error('Uso: npm run open:chrome <platform>')
  console.error('Plataformas: upwork, glassdoor, indeed, hireline, linkedin, freelancer, braintrust')
  process.exit(1)
}

const urls: Record<string, string> = {
  upwork: 'https://www.upwork.com/ab/account-security/login',
  glassdoor: 'https://www.glassdoor.com/profile/login_input.htm',
  indeed: 'https://secure.indeed.com/account/login',
  hireline: 'https://hireline.io/login',
  linkedin: 'https://www.linkedin.com/login',
  freelancer: 'https://www.freelancer.com/login',
  braintrust: 'https://www.usebraintrust.com/login'
}

const url = urls[platformName.toLowerCase()]

if (!url) {
  console.error(`Plataforma no reconocida: ${platformName}`)
  console.error('Plataformas disponibles:', Object.keys(urls).join(', '))
  process.exit(1)
}

console.log(`🌐 Abriendo Chrome para ${platformName}...`)
console.log(`📍 URL: ${url}`)
console.log('')
console.log('📝 Instrucciones:')
console.log('1. Chrome se abrirá con la página de login')
console.log('2. Haz login manualmente (email, contraseña, etc.)')
console.log('3. Navega por la plataforma si quieres')
console.log('4. NO cierres Chrome todavía')
console.log('5. Cuando termines, ejecuta: npm run record:session ' + platformName)
console.log('')
console.log('⚠️  IMPORTANTE: Mantén Chrome abierto para el siguiente paso')
console.log('')

// Abrir Chrome con opciones de debugging remoto
const chromeCommand = platform() === 'win32'
  ? `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-${platformName} "${url}"`
  : platform() === 'darwin'
  ? `open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-${platformName} "${url}"`
  : `google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-${platformName} "${url}"`

console.log('Ejecutando:', chromeCommand)

exec(chromeCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('Error al abrir Chrome:', error)
    return
  }
  console.log('Chrome abierto exitosamente')
})
