// Simple in-memory storage for demo purposes
// In production, this would use a proper database (PostgreSQL, MongoDB, etc.)

import { QAProfile, JobApplication, ApplicationMetrics, AutomationConfig, LinkedInJob } from '@/types'

interface StorageData {
  profile: QAProfile | null
  applications: JobApplication[]
  jobs: LinkedInJob[]
  metrics: ApplicationMetrics
  automationConfig: AutomationConfig
}

let storage: StorageData = {
  profile: null,
  applications: [],
  jobs: [],
  metrics: {
    totalApplied: 0,
    pending: 0,
    interviews: 0,
    rejections: 0,
    offers: 0,
    todayApplied: 0,
    successRate: 0,
    averageMatchScore: 0,
  },
  automationConfig: {
    isActive: false,
    dailyLimit: 25,
    currentDayCount: 0,
    lastResetDate: new Date(),
    rateLimiting: {
      requestsPerMinute: 30,
      applicationsPerHour: 10,
    },
  },
}

export const db = {
  profile: {
    get: (): QAProfile | null => {
      // En el servidor, retornar el storage en memoria
      // En el cliente, intentar localStorage primero, luego storage en memoria
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('qa_profile')
        if (stored) {
          const parsed = JSON.parse(stored)
          // También actualizar el storage en memoria del servidor
          storage.profile = parsed
          return parsed
        }
      }
      return storage.profile
    },
    
    set: (profile: QAProfile): void => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('qa_profile', JSON.stringify(profile))
      }
      storage.profile = profile
    },
    
    delete: (): void => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('qa_profile')
      }
      storage.profile = null
    },
  },
  
  applications: {
    getAll: (): JobApplication[] => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('job_applications')
        return stored ? JSON.parse(stored) : []
      }
      return storage.applications
    },
    
    add: (application: JobApplication): void => {
      const apps = db.applications.getAll()
      apps.push(application)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('job_applications', JSON.stringify(apps))
      }
      storage.applications = apps
    },
    
    update: (id: string, updates: Partial<JobApplication>): void => {
      const apps = db.applications.getAll()
      const index = apps.findIndex(app => app.id === id)
      
      if (index !== -1) {
        apps[index] = { ...apps[index], ...updates }
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('job_applications', JSON.stringify(apps))
        }
        storage.applications = apps
      }
    },
    
    getByStatus: (status: JobApplication['status']): JobApplication[] => {
      return db.applications.getAll().filter(app => app.status === status)
    },
  },
  
  jobs: {
    getAll: (): LinkedInJob[] => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('linkedin_jobs')
        return stored ? JSON.parse(stored) : []
      }
      return storage.jobs
    },
    
    set: (jobs: LinkedInJob[]): void => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('linkedin_jobs', JSON.stringify(jobs))
      }
      storage.jobs = jobs
    },
    
    add: (job: LinkedInJob): void => {
      const jobs = db.jobs.getAll()
      jobs.push(job)
      db.jobs.set(jobs)
    },
  },
  
  metrics: {
    get: (): ApplicationMetrics => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('application_metrics')
        return stored ? JSON.parse(stored) : storage.metrics
      }
      return storage.metrics
    },
    
    update: (updates: Partial<ApplicationMetrics>): void => {
      const metrics = { ...db.metrics.get(), ...updates }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('application_metrics', JSON.stringify(metrics))
      }
      storage.metrics = metrics
    },
    
    refresh: (): ApplicationMetrics => {
      const apps = db.applications.getAll()
      
      const metrics: ApplicationMetrics = {
        totalApplied: apps.length,
        pending: apps.filter(a => a.status === 'pending').length,
        interviews: apps.filter(a => a.status === 'interview_scheduled').length,
        rejections: apps.filter(a => a.status === 'rejected').length,
        offers: apps.filter(a => a.status === 'offer_received').length,
        todayApplied: apps.filter(a => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          return new Date(a.appliedAt) >= today
        }).length,
        successRate: apps.length > 0 
          ? Math.round((apps.filter(a => a.status === 'interview_scheduled' || a.status === 'offer_received').length / apps.length) * 100)
          : 0,
        averageMatchScore: apps.length > 0
          ? Math.round(apps.reduce((sum, a) => sum + a.matchScore, 0) / apps.length)
          : 0,
      }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('application_metrics', JSON.stringify(metrics))
      }
      storage.metrics = metrics
      
      return metrics
    },
  },
  
  automationConfig: {
    get: (): AutomationConfig => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('automation_config')
        return stored ? JSON.parse(stored) : storage.automationConfig
      }
      return storage.automationConfig
    },
    
    update: (updates: Partial<AutomationConfig>): void => {
      const config = { ...db.automationConfig.get(), ...updates }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('automation_config', JSON.stringify(config))
      }
      storage.automationConfig = config
    },
  },
}

