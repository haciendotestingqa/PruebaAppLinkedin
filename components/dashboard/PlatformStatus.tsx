'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Video } from 'lucide-react'

interface PlatformStatus {
  upwork: {
    hasEmail: boolean
    hasPassword: boolean
    isAuthenticated: boolean
    error?: string | null
    errorDetails?: string | null
  }
  freelancer: {
    hasEmail: boolean
    hasPassword: boolean
    hasUsername: boolean
    isAuthenticated: boolean
    error?: string | null
    errorDetails?: string | null
  }
  hireline: {
    hasEmail: boolean
    hasPassword: boolean
    isAuthenticated: boolean
    error?: string | null
    errorDetails?: string | null
  }
  indeed: {
    hasEmail: boolean
    hasPassword: boolean
    isAuthenticated: boolean
    error?: string | null
    errorDetails?: string | null
  }
  braintrust: {
    hasEmail: boolean
    hasPassword: boolean
    isAuthenticated: boolean
    error?: string | null
    errorDetails?: string | null
  }
  glassdoor: {
    hasEmail: boolean
    hasPassword: boolean
    isAuthenticated: boolean
    error?: string | null
    errorDetails?: string | null
  }
}

interface DebugLog {
  timestamp: string
  type: 'info' | 'success' | 'error' | 'warning' | 'step'
  message: string
  platform?: string
  details?: string
}

export function PlatformStatusCard() {
  const [status, setStatus] = useState<PlatformStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [authenticatingPlatform, setAuthenticatingPlatform] = useState<string | null>(null)
  const [recordingPlatform, setRecordingPlatform] = useState<string | null>(null)
  const [recordedSessions, setRecordedSessions] = useState<Record<string, boolean>>({})
  const eventSourceRef = useRef<EventSource | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [debugLogs])

  const startDebugStream = () => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') {
      return () => {}
    }

    // Cerrar conexión anterior si existe
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Limpiar logs anteriores
    setDebugLogs([])

    try {
      // Crear nueva conexión SSE
      const eventSource = new EventSource('/api/debug-auth')
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const log = JSON.parse(event.data) as DebugLog
          setDebugLogs(prev => [...prev, log])
          
          // Log también en consola del navegador
          const consoleMethod = log.type === 'error' ? 'error' : 
                               log.type === 'warning' ? 'warn' : 
                               log.type === 'success' ? 'log' : 'info'
          console[consoleMethod](`[${log.platform || 'AUTH'}] ${log.message}`, log.details || '')
        } catch (e) {
          console.error('Error parsing debug log:', e)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        setDebugLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          type: 'error',
          message: 'Error de conexión con el servidor de debug'
        }])
      }

      // Retornar función de limpieza
      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
      }
    } catch (error) {
      console.error('Error creating EventSource:', error)
      return () => {}
    }
  }

  const stopDebugStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }

  useEffect(() => {
    if (showDebug && loading) {
      const cleanup = startDebugStream()
      return () => {
        stopDebugStream()
        if (cleanup && typeof cleanup === 'function') {
          cleanup()
        }
      }
    } else {
      stopDebugStream()
    }
  }, [showDebug, loading])

  const loadStatus = async () => {
    setLoading(true)
    setDebugLogs([])
    setShowDebug(false) // No mostrar logs automáticamente al cargar estado

    try {
      const response = await fetch('/api/debug-platforms')
      let initialStatus: PlatformStatus | null = null
      if (response.ok) {
        const data = await response.json()
        initialStatus = data.credentials
      }

      // Cargar estado de autenticación desde localStorage
      try {
        const savedAuthStatus = localStorage.getItem('platformAuthStatus')
        if (savedAuthStatus) {
          const parsedAuthStatus = JSON.parse(savedAuthStatus)
          if (initialStatus) {
            // Combinar estado de credenciales con estado de autenticación guardado
            initialStatus = {
              ...initialStatus,
              ...parsedAuthStatus
            }
          } else {
            initialStatus = parsedAuthStatus
          }
          console.log('📂 Estado de autenticación cargado desde localStorage:', parsedAuthStatus)
        }
      } catch (error) {
        console.warn('Error cargando estado desde localStorage:', error)
      }

      setStatus(initialStatus)

      // Verificar sesiones grabadas para todas las plataformas
      const sessionChecks = await Promise.all(
        ['upwork', 'freelancer', 'hireline', 'indeed', 'braintrust', 'glassdoor'].map(async (platform) => {
          try {
            const hasSession = await hasRecordedSession(platform)
            return { platform, hasSession }
          } catch (error) {
            console.warn(`Error verificando sesión para ${platform}:`, error)
            return { platform, hasSession: false }
          }
        })
      )

      const sessionMap: Record<string, boolean> = {}
      sessionChecks.forEach(({ platform, hasSession }) => {
        sessionMap[platform] = hasSession
      })

      setRecordedSessions(sessionMap)

    } catch (error) {
      console.error('Error loading platform status:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasRecordedSession = async (platform: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/has-recorded-session/${platform}`)
      const data = await response.json()
      return data.hasSession || false
    } catch (error) {
      console.warn(`Error verificando sesión grabada para ${platform}:`, error)
      return false
    }
  }

  const recordSession = async (platform: keyof PlatformStatus) => {
    // Verificar que no haya otra plataforma siendo grabada
    if (recordingPlatform) {
      alert(`Ya hay una sesión siendo grabada para: ${recordingPlatform}. Por favor espera a que termine.`)
      return
    }

    setRecordingPlatform(platform)

    try {
      console.log(`🎬 Iniciando proceso de grabación de sesión para ${platform}...`)

      // URLs de login para cada plataforma
      const loginUrls: Record<string, string> = {
        upwork: 'https://www.upwork.com/ab/account-security/login',
        glassdoor: 'https://www.glassdoor.com/profile/login_input.htm',
        indeed: 'https://secure.indeed.com/account/login',
        hireline: 'https://hireline.io/login',
        linkedin: 'https://www.linkedin.com/login',
        freelancer: 'https://www.freelancer.com/login',
        braintrust: 'https://www.usebraintrust.com/login'
      }

      const loginUrl = loginUrls[platform]

      // Paso 1: Abrir Chrome automáticamente
      console.log(`🌐 Abriendo Chrome para ${platform}...`)
      
      try {
        const openChromeResponse = await fetch(`/api/open-chrome/${platform}`, {
          method: 'POST'
        })

        const openChromeData = await openChromeResponse.json()

        if (!openChromeResponse.ok || !openChromeData.success) {
          throw new Error(openChromeData.error || 'Error abriendo Chrome')
        }

        console.log('✅ Chrome abierto exitosamente')
      } catch (error) {
        console.error('Error abriendo Chrome:', error)
        // Si falla abrir Chrome automáticamente, abrir en nueva ventana
        window.open(loginUrl, '_blank')
        console.log('📂 Abriendo URL en nueva ventana como fallback')
      }

      // Paso 2: Mostrar instrucciones y esperar confirmación del usuario
      const userReady = confirm(
        `Chrome debería haberse abierto con la página de login de ${platformNames[platform]}.\n\n` +
        `INSTRUCCIONES:\n` +
        `1. Si Chrome no se abrió, haz click en OK y se abrirá en una nueva ventana\n` +
        `2. Haz login MANUALMENTE en ${platformNames[platform]}\n` +
        `3. Navega por la plataforma si quieres verificar que funciona\n` +
        `4. NO cierres Chrome\n` +
        `5. Cuando termines el login, haz click en OK para continuar\n\n` +
        `¿Ya hiciste login manualmente y estás listo para grabar la sesión?`
      )

      if (!userReady) {
        setRecordingPlatform(null)
        return
      }

      // Paso 3: Esperar un poco para asegurar que Chrome esté listo
      console.log('⏳ Esperando 3 segundos para que Chrome esté listo...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Paso 4: Grabar la sesión
      console.log(`📹 Iniciando grabación de sesión para ${platform}...`)

      const response = await fetch(`/api/record-session/${platform}`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        console.log('✅ Sesión grabada exitosamente:', data)

        alert(`✅ Sesión grabada exitosamente para ${platformNames[platform]}!\n\nDetalles:\n- Cookies: ${data.details.cookiesCount}\n- LocalStorage: ${data.details.localStorageItems}\n- SessionStorage: ${data.details.sessionStorageItems}\n\nAhora puedes usar "Iniciar Sesión" para login automático sin necesidad de hacerlo manualmente.`)

        // Recargar el estado para reflejar los cambios
        await loadStatus()

      } else {
        console.error('❌ Error en grabación:', data)

        if (data.error === 'No se puede conectar a Chrome') {
          // Mostrar instrucciones específicas
          const instructions = data.instructions?.join('\n') || 'Asegúrate de que Chrome esté abierto con --remote-debugging-port=9222'
          alert(`❌ ${data.message}\n\nINSTRUCCIONES:\n${instructions}\n\nComando manual: npm run open:chrome ${platform}`)
        } else {
          alert(`❌ Error al grabar sesión: ${data.error || data.message}`)
        }
      }

    } catch (error) {
      console.error('❌ Error al grabar sesión:', error)
      alert(`❌ Error al grabar sesión: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setRecordingPlatform(null)
    }
  }

  const authenticatePlatform = async (platform: keyof PlatformStatus) => {
    // Verificar que no haya otra plataforma autenticándose
    if (authenticatingPlatform) {
      alert(`Ya hay una plataforma siendo autenticada: ${authenticatingPlatform}. Por favor espera a que termine.`)
      return
    }

    // Verificar que tenga credenciales
    const platformStatus = getPlatformStatus(platform)
    if (!platformStatus?.hasCredentials) {
      alert(`No hay credenciales configuradas para ${platformNames[platform]}. Por favor configura las variables de entorno.`)
      return
    }

    setAuthenticatingPlatform(platform)
    setDebugLogs([])
    setShowDebug(true)
    
    // Iniciar stream de debug
    startDebugStream()
    
    try {
      const response = await fetch(`/api/authenticate-platform/${platform}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Actualizar estado después de autenticación exitosa
        setStatus(prev => {
          if (!prev) return prev
          const updatedStatus = {
            ...prev,
            [platform]: {
              ...prev[platform],
              isAuthenticated: true,
              error: null,
              errorDetails: null
            }
          }
          console.log(`✅ Estado actualizado para ${platform}:`, updatedStatus[platform])

          // Guardar estado de autenticación en localStorage
          try {
            const authStatus = { ...updatedStatus }
            localStorage.setItem('platformAuthStatus', JSON.stringify(authStatus))
            console.log(`💾 Estado de autenticación guardado para ${platform}`)
          } catch (error) {
            console.warn('Error guardando estado en localStorage:', error)
          }

          return updatedStatus
        })
        
        setDebugLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          type: 'success',
          message: `${platformNames[platform]} autenticado exitosamente`,
          platform: platform
        }])
      } else {
        // Actualizar estado con error
        setStatus(prev => {
          if (!prev) return prev
          return {
            ...prev,
            [platform]: {
              ...prev[platform],
              isAuthenticated: false,
              error: data.error || 'Error desconocido',
              errorDetails: data.errorDetails || null
            }
          }
        })
        
        setDebugLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          type: 'error',
          message: `Error en autenticación de ${platformNames[platform]}`,
          platform: platform,
          details: data.error || 'Error desconocido'
        }])
      }
    } catch (error) {
      console.error(`Error authenticating ${platform}:`, error)
      setDebugLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Error al autenticar ${platformNames[platform]}`,
        platform: platform,
        details: error instanceof Error ? error.message : String(error)
      }])
    } finally {
      setAuthenticatingPlatform(null)
      // Mantener logs visibles por 5 segundos después de terminar
      setTimeout(() => {
        stopDebugStream()
      }, 5000)
    }
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getLogIcon = (type: DebugLog['type']) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'step':
        return '→'
      default:
        return 'ℹ️'
    }
  }

  const getLogColor = (type: DebugLog['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'step':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getPlatformStatus = (platform: keyof PlatformStatus) => {
    if (!status) return null
    
    const p = status[platform]
    const hasCredentials = p.hasEmail && p.hasPassword
    const isReady = hasCredentials && (p.isAuthenticated || platform === 'freelancer') // Freelancer no necesita auth
    
    return {
      hasCredentials,
      isReady,
      isAuthenticated: p.isAuthenticated
    }
  }

  const getStatusIcon = (platform: keyof PlatformStatus) => {
    const status = getPlatformStatus(platform)
    if (!status) return <AlertCircle className="h-4 w-4 text-gray-400" />
    
    if (status.isReady) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    } else if (status.hasCredentials) {
      return <XCircle className="h-4 w-4 text-yellow-500" />
    } else {
      return <XCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (platform: keyof PlatformStatus) => {
    const status = getPlatformStatus(platform)
    const hasRecordedSession = recordedSessions[platform] || false

    if (!status) return <Badge variant="outline">Unknown</Badge>

    // Prioridad: Autenticado > Sesión grabada > Credenciales > Sin credenciales
    if (status.isAuthenticated) {
      return <Badge className="bg-green-500">Ready</Badge>
    } else if (hasRecordedSession) {
      return <Badge className="bg-blue-500">Session Available</Badge>
    } else if (status.hasCredentials) {
      return <Badge className="bg-yellow-500">Auth Failed</Badge>
    } else {
      return <Badge variant="outline">No Credentials</Badge>
    }
  }

  const platformNames: Record<keyof PlatformStatus, string> = {
    upwork: 'Upwork',
    freelancer: 'Freelancer',
    hireline: 'Hireline',
    indeed: 'Indeed',
    braintrust: 'Braintrust',
    glassdoor: 'Glassdoor'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Platform Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Cargando estado de plataformas...</p>
            </div>
            
            {showDebug && debugLogs.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Logs de Debug:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDebug(false)}
                  >
                    Ocultar
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto bg-muted p-3 rounded-md space-y-2 text-xs font-mono">
                  {debugLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`${getLogColor(log.type)} border-l-3 pl-3 py-1 ${
                        log.type === 'error' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' :
                        log.type === 'warning' ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' :
                        log.type === 'success' ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' :
                        log.type === 'step' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' :
                        'border-gray-400 bg-gray-50/50 dark:bg-gray-950/20'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground whitespace-nowrap text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-base leading-none">{getLogIcon(log.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.platform && (
                              <span className="px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground text-[10px] font-semibold uppercase border">
                                {log.platform}
                              </span>
                            )}
                            <span className="font-medium break-words">{log.message}</span>
                          </div>
                          {log.details && (
                            <div className="mt-1.5 ml-8 text-[11px] text-muted-foreground opacity-90 whitespace-pre-wrap break-words bg-background/50 p-2 rounded border border-current/20">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
            
            {showDebug && debugLogs.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Esperando logs de debug...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Platform Status</CardTitle>
          <Button variant="outline" size="sm" onClick={loadStatus}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {debugLogs.length > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Últimos Logs de Debug:</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
              >
                {showDebug ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            {showDebug && (
              <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
                {debugLogs.slice(-10).map((log, index) => (
                  <div key={index} className={`${getLogColor(log.type)}`}>
                    <span className="text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {' '}
                    <span>{getLogIcon(log.type)}</span>
                    {' '}
                    {log.platform && (
                      <span className="font-semibold">[{log.platform}]</span>
                    )}
                    {' '}
                    <span>{log.message}</span>
                    {log.details && (
                      <div className="ml-6 text-muted-foreground text-xs">{log.details}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-3">
          {(Object.keys(platformNames) as Array<keyof PlatformStatus>).map((platform) => {
            const platformStatus = getPlatformStatus(platform)
            const isAuthenticating = authenticatingPlatform === platform
            const hasCredentials = platformStatus?.hasCredentials ?? false
            
            return (
              <div key={platform} className="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(platform)}
                    <span className="font-medium">{platformNames[platform]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(platform)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => recordSession(platform)}
                      disabled={recordingPlatform !== null || authenticatingPlatform !== null}
                      className="ml-2 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-950 border-red-300 text-red-700 dark:border-red-700 dark:text-red-300"
                    >
                      {recordingPlatform === platform ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Grabando...
                        </>
                      ) : (
                        <>
                          <Video className="h-3 w-3 mr-1" />
                          Grabar Sesión
                        </>
                      )}
                    </Button>
                    {hasCredentials && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => authenticatePlatform(platform)}
                        disabled={isAuthenticating || authenticatingPlatform !== null}
                        className="ml-2"
                      >
                        {isAuthenticating ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Autenticando...
                          </>
                        ) : (
                          'Iniciar Sesión'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {status?.[platform]?.error && (
                  <div className="mt-2 ml-7 text-xs text-red-600 dark:text-red-400">
                    <strong>Error:</strong> {status[platform].error}
                    {status[platform].errorDetails && (
                      <div className="text-muted-foreground mt-1">{status[platform].errorDetails}</div>
                    )}
                    {status[platform].error?.includes('Captcha') && (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                        <strong>💡 Solución:</strong> Upwork tiene protección anti-bot muy fuerte. 
                        La aplicación intentará hacer scraping sin autenticación, pero puede tener limitaciones. 
                        <strong>Freelancer y LinkedIn funcionan mejor</strong> porque no requieren autenticación o tienen APIs públicas.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>💡 Nota:</strong> Haz clic en &quot;Iniciar Sesión&quot; para autenticar cada plataforma individualmente. 
            Esto evitará que se dupliquen las ventanas y permitirá completar el proceso de inicio de sesión correctamente. 
            Solo puedes autenticar una plataforma a la vez.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

