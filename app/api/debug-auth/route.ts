import { NextRequest } from 'next/server'
import { sendDebugLog } from '@/lib/debug-logger'

/**
 * GET /api/debug-auth
 * Endpoint SSE para recibir logs de debug en tiempo real durante la autenticación
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      // Función para enviar un mensaje SSE
      const send = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }
      
      // Enviar mensaje inicial
      send({ type: 'connected', message: 'Conexión establecida para debug' })
      
      // Intentar leer logs desde un archivo temporal o variable global
      // Por ahora, enviamos logs simulados para testing
      try {
        // Aquí podríamos leer desde un archivo temporal o memoria compartida
        // Por ahora, usaremos una variable global (en producción usar Redis o similar)
        if (typeof (global as any).authDebugLogs !== 'undefined') {
          const logs = (global as any).authDebugLogs
          logs.forEach((log: any) => {
            send(log)
          })
        }
        
        // Mantener la conexión abierta para nuevos logs
        const interval = setInterval(() => {
          // Verificar nuevos logs periódicamente
          if (typeof (global as any).authDebugLogs !== 'undefined') {
            const logs = (global as any).authDebugLogs
            const lastSent = (global as any).lastDebugLogIndex || 0
            
            if (logs.length > lastSent) {
              for (let i = lastSent; i < logs.length; i++) {
                send(logs[i])
              }
              (global as any).lastDebugLogIndex = logs.length
            }
          }
        }, 500) // Verificar cada 500ms
        
        // Limpiar cuando se cierre la conexión
        request.signal.addEventListener('abort', () => {
          clearInterval(interval)
          controller.close()
        })
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : 'Error desconocido' })
        controller.close()
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * POST /api/debug-auth
 * Para agregar logs de debug desde el servidor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      type: 'info' | 'success' | 'error' | 'warning' | 'step'
      message: string
      platform?: string
      details?: string
    }
    
    // Usar el helper para agregar el log
    sendDebugLog({
      type: body.type,
      message: body.message,
      platform: body.platform,
      details: body.details
    })
    
    // Mantener solo los últimos 100 logs
    if ((global as any).authDebugLogs.length > 100) {
      (global as any).authDebugLogs = (global as any).authDebugLogs.slice(-100)
    }
    
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }, { status: 500 })
  }
}

