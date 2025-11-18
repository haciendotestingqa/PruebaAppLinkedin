'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

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

export function PlatformStatusCard() {
  const [status, setStatus] = useState<PlatformStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug-platforms')
      if (response.ok) {
        const data = await response.json()
        setStatus(data.credentials)
      }
    } catch (error) {
      console.error('Error loading platform status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

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
    if (!status) return <Badge variant="outline">Unknown</Badge>
    
    if (status.isReady) {
      return <Badge className="bg-green-500">Ready</Badge>
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
          <p className="text-muted-foreground">Loading...</p>
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
        <div className="space-y-3">
          {(Object.keys(platformNames) as Array<keyof PlatformStatus>).map((platform) => {
            const platformStatus = getPlatformStatus(platform)
            return (
              <div key={platform} className="p-2 border rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(platform)}
                    <span className="font-medium">{platformNames[platform]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(platform)}
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
        <div className="mt-4 p-3 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Platforms marked as &quot;Ready&quot; will be scraped during job search. 
            Platforms without credentials or failed authentication will be skipped.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

