'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AutomationConfig } from '@/types'
import { Play, Pause, Settings } from 'lucide-react'

interface AutomationControlProps {
  config: AutomationConfig
  onToggle: (active: boolean) => void
  onUpdateConfig: (config: Partial<AutomationConfig>) => void
}

export function AutomationControl({ config, onToggle, onUpdateConfig }: AutomationControlProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [dailyLimit, setDailyLimit] = useState(config.dailyLimit)
  
  const handleToggle = () => {
    onToggle(!config.isActive)
  }
  
  const handleSaveConfig = () => {
    onUpdateConfig({ dailyLimit })
    setIsEditing(false)
  }
  
  const getProgressPercentage = () => {
    if (config.dailyLimit === 0) return 0
    return Math.round((config.currentDayCount / config.dailyLimit) * 100)
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Automation Control</CardTitle>
            <CardDescription>
              Automatically apply to matching QA jobs
            </CardDescription>
          </div>
          <Badge variant={config.isActive ? 'default' : 'secondary'}>
            {config.isActive ? 'Active' : 'Paused'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleToggle}
            variant={config.isActive ? 'destructive' : 'default'}
            size="lg"
          >
            {config.isActive ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause Automation
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Automation
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
        
        {isEditing && (
          <div className="pt-4 border-t space-y-4">
            <div>
              <Label htmlFor="daily-limit">Daily Application Limit</Label>
              <Input
                id="daily-limit"
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
                min="1"
                max="50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of applications per day
              </p>
            </div>
            
            <Button onClick={handleSaveConfig} size="sm">
              Save Configuration
            </Button>
          </div>
        )}
        
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Today&apos;s Progress</span>
            <span className="text-sm text-muted-foreground">
              {config.currentDayCount} / {config.dailyLimit}
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Rate Limits: {config.rateLimiting.applicationsPerHour} apps/hour</p>
          <p>Last Reset: {new Date(config.lastResetDate).toLocaleDateString()}</p>
        </div>
      </CardContent>
    </Card>
  )
}







