'use client'

import { useState, useEffect } from 'react'
import { MetricsOverview } from '@/components/dashboard/MetricsCard'
import { JobList } from '@/components/dashboard/JobList'
import { AutomationControl } from '@/components/dashboard/AutomationControl'
import { PlatformStatusCard } from '@/components/dashboard/PlatformStatus'
import { CVUploadForm } from '@/components/forms/CVUploadForm'
import { ProfileForm } from '@/components/forms/ProfileForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { QAProfile, ApplicationMetrics, AutomationConfig, JobApplication } from '@/types'
import { MatchResult } from '@/lib/job-matcher'
import { RefreshCw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type AuthStatus = {
  credentials: Record<string, boolean>
  authenticated: Record<string, boolean>
}

export default function Home() {
  const [profile, setProfile] = useState<QAProfile | null>(null)
  const [metrics, setMetrics] = useState<ApplicationMetrics>({
    totalApplied: 0,
    pending: 0,
    interviews: 0,
    rejections: 0,
    offers: 0,
    todayApplied: 0,
    successRate: 0,
    averageMatchScore: 0,
  })
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig>({
    isActive: false,
    dailyLimit: 25,
    currentDayCount: 0,
    lastResetDate: new Date(),
    rateLimiting: {
      requestsPerMinute: 30,
      applicationsPerHour: 10,
    },
  })
  const [jobs, setJobs] = useState<MatchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'jobs'>('dashboard')
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const response = await fetch('/api/applications')
        if (response.ok) {
          const applications: JobApplication[] = await response.json()
          setAppliedJobIds(applications.map(app => app.jobId))
        }
      } catch (error) {
        console.error('Error loading applications:', error)
      }
    }
    loadApplications()
  }, [metrics])

  const loadData = async () => {
    console.log('🔄 Loading data...')
    
    // Load profile
    const profileRes = await fetch('/api/profile')
    if (profileRes.ok) {
      const profileData = await profileRes.json()
      console.log('✅ Profile loaded:', profileData ? 'Yes' : 'No')
      setProfile(profileData)
    } else {
      console.log('❌ Failed to load profile')
    }
    
    // Load metrics
    const metricsRes = await fetch('/api/metrics')
    if (metricsRes.ok) {
      const metricsData = await metricsRes.json()
      setMetrics(metricsData)
    }
    
    // Load automation config
    const automationRes = await fetch('/api/automation')
    if (automationRes.ok) {
      const automationData = await automationRes.json()
      setAutomationConfig(automationData)
    }
  }

  const handleSearchJobs = async () => {
    if (!profile) {
      alert('Please upload your CV and create a profile first')
      return
    }

    setSearching(true)
    try {
      // Obtener trabajos de LinkedIn (NO mock data)
      const linkedInResponse = await fetch('/api/linkedin-jobs')
      const linkedInData = await linkedInResponse.json()
      
      if (!linkedInResponse.ok || !linkedInData.success) {
        throw new Error(linkedInData.message || 'Error obteniendo trabajos de LinkedIn')
      }
      
      console.log(`📊 Trabajos obtenidos de LinkedIn: ${linkedInData.count}`)
      
      // Luego hacer matching con el perfil
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          minScore: 60, 
          profile: profile,
          excludedJobIds: appliedJobIds // Excluir trabajos ya aplicados
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to search jobs'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorData.details || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setJobs(data.jobs)
      
      // Mostrar mensaje de éxito
      const sourcesSummary = data.sources
        ? Object.entries(data.sources)
            .map(([source, count]) => `${source}: ${count}`)
            .join(', ')
        : 'LinkedIn'
      alert(`✅ Found ${data.jobs.length} matching jobs! Sources → ${sourcesSummary}`)
    } catch (error) {
      console.error('Error searching jobs:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error searching for jobs'
      
      // Mensaje más detallado
      const detailedMessage = errorMessage.includes('Failed to search jobs') 
        ? `Error obteniendo trabajos de LinkedIn.\n\nPosibles causas:\n- LinkedIn bloqueó el acceso\n- Problemas de conexión\n- LinkedIn cambió su estructura\n\nRevisa la consola del navegador (F12) para más detalles.`
        : errorMessage
        
      alert(detailedMessage)
      setJobs([])
    } finally {
      setSearching(false)
    }
  }

  const handleApplyToJob = async (jobId: string) => {
    const jobMatch = jobs.find(j => j.job.id === jobId)
    if (!jobMatch) return

    try {
      const application: JobApplication = {
        id: `app-${Date.now()}`,
        jobId,
        jobTitle: jobMatch.job.title,
        company: jobMatch.job.company,
        location: jobMatch.job.location,
        appliedAt: new Date(),
        status: 'application_sent',
        matchScore: jobMatch.score,
        requirements: jobMatch.job.requirements,
        questionsAnswered: true,
      }

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      })

      if (!response.ok) throw new Error('Failed to apply')

      alert(`Application submitted to ${jobMatch.job.company}!`)
      setAppliedJobIds([...appliedJobIds, jobId])
      loadData()
    } catch (error) {
      console.error('Error applying to job:', error)
      alert('Error applying to job')
    }
  }

  const handleApplyToAll = async () => {
    const jobsToApply = jobs.filter(j => !appliedJobIds.includes(j.job.id))
    
    if (jobsToApply.length === 0) {
      alert('No jobs available to apply')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to apply to ${jobsToApply.length} jobs?`
    )

    if (!confirmed) return

    let successCount = 0
    let failCount = 0

    for (const jobMatch of jobsToApply) {
      try {
        const application: JobApplication = {
          id: `app-${Date.now()}-${Math.random()}`,
          jobId: jobMatch.job.id,
          jobTitle: jobMatch.job.title,
          company: jobMatch.job.company,
          location: jobMatch.job.location,
          appliedAt: new Date(),
          status: 'application_sent',
          matchScore: jobMatch.score,
          requirements: jobMatch.job.requirements,
          questionsAnswered: true,
        }

        const response = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(application),
        })

        if (response.ok) {
          successCount++
          setAppliedJobIds(prev => [...prev, jobMatch.job.id])
        } else {
          failCount++
        }

        // Delay pequeño entre requests
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Error applying to job:', jobMatch.job.title, error)
        failCount++
      }
    }

    alert(`Applied to ${successCount} jobs successfully${failCount > 0 ? `, ${failCount} failed` : ''}!`)
    loadData()
  }

  const handleProfileSave = async (updatedProfile: QAProfile) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile),
      })

      if (!response.ok) throw new Error('Failed to save profile')

      setProfile(updatedProfile)
      alert('Profile saved successfully!')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Error saving profile')
    }
  }

  const handleToggleAutomation = async (active: boolean) => {
    const updated = { ...automationConfig, isActive: active }
    
    try {
      const response = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })

      if (!response.ok) throw new Error('Failed to update automation')

      setAutomationConfig(updated)
    } catch (error) {
      console.error('Error updating automation:', error)
      alert('Error updating automation')
    }
  }

  const handleUpdateAutomationConfig = async (updates: Partial<AutomationConfig>) => {
    const updated = { ...automationConfig, ...updates }
    
    try {
      const response = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })

      if (!response.ok) throw new Error('Failed to update automation')

      setAutomationConfig(updated)
    } catch (error) {
      console.error('Error updating automation:', error)
      alert('Error updating automation')
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">LinkedIn QA Automation</h1>
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b pb-2">
          <Button
            type="button"
            variant={activeTab === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </Button>
          <Button
            type="button"
            variant={activeTab === 'profile' ? 'default' : 'outline'}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </Button>
          <Button
            type="button"
            variant={activeTab === 'jobs' ? 'default' : 'outline'}
            onClick={() => setActiveTab('jobs')}
          >
            Job Search
          </Button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {!profile && (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center space-y-4">
                    <h2 className="text-xl font-semibold">Welcome to LinkedIn QA Automation</h2>
                    <p className="text-muted-foreground">
                      Start by uploading your CV to begin automating your job applications
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {profile && (
              <>
                <MetricsOverview metrics={metrics} />
                <AutomationControl
                  config={automationConfig}
                  onToggle={handleToggleAutomation}
                  onUpdateConfig={handleUpdateAutomationConfig}
                />
              </>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <CVUploadForm onUploadSuccess={loadData} />
            {profile && <ProfileForm profile={profile} onSave={handleProfileSave} />}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <PlatformStatusCard />
            
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Find QA Jobs</h2>
                    <p className="text-muted-foreground">
                      Search for remote QA positions matching your profile
                    </p>
                  </div>
                  <Button onClick={handleSearchJobs} disabled={searching || !profile}>
                    <Search className="h-4 w-4 mr-2" />
                    {searching ? 'Searching...' : 'Search Jobs'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {jobs.length > 0 && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">
                    Found {jobs.length} matching jobs
                  </h3>
                </div>
                <JobList
                  jobs={jobs}
                  onApply={handleApplyToJob}
                  onApplyAll={handleApplyToAll}
                  appliedJobIds={appliedJobIds}
                  userSkills={profile?.skills || []}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

