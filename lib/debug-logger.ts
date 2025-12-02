/**
 * Sistema de logging para debug de autenticación
 * Los logs se almacenan en memoria global y se pueden leer via SSE
 */

export interface DebugLog {
  timestamp: string
  type: 'info' | 'success' | 'error' | 'warning' | 'step'
  message: string
  platform?: string
  details?: string
}

/**
 * Función helper para enviar logs de debug
 * Se puede usar desde cualquier parte del código del servidor
 */
export function sendDebugLog(log: Omit<DebugLog, 'timestamp'>) {
  // Inicializar array de logs si no existe
  if (typeof (global as any).authDebugLogs === 'undefined') {
    (global as any).authDebugLogs = []
  }
  
  // Agregar log con timestamp
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    type: log.type,
    message: log.message,
    platform: log.platform,
    details: log.details
  } as DebugLog
  
  (global as any).authDebugLogs.push(logEntry)
  
  // Mantener solo los últimos 200 logs
  if ((global as any).authDebugLogs.length > 200) {
    (global as any).authDebugLogs = (global as any).authDebugLogs.slice(-200)
  }
  
  // También log en consola del servidor con formato bonito
  const prefix = log.platform ? `[${log.platform}]` : '[AUTH]'
  const icon = log.type === 'success' ? '✅' : 
               log.type === 'error' ? '❌' : 
               log.type === 'warning' ? '⚠️' : 
               log.type === 'step' ? '→' : 'ℹ️'
  
  const consoleMethod = log.type === 'error' ? 'error' : 
                       log.type === 'warning' ? 'warn' : 'log'
  
  console[consoleMethod](`${prefix} ${icon} ${log.message}`)
  if (log.details) {
    console[consoleMethod](`  ${log.details}`)
  }
}

/**
 * Limpiar logs de debug
 */
export function clearDebugLogs() {
  if (typeof (global as any).authDebugLogs !== 'undefined') {
    (global as any).authDebugLogs = []
  }
  (global as any).lastDebugLogIndex = 0
}

/**
 * Obtener logs de debug
 */
export function getDebugLogs(): DebugLog[] {
  if (typeof (global as any).authDebugLogs === 'undefined') {
    return []
  }
  return (global as any).authDebugLogs
}

