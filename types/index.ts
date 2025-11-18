export interface QAProfile {
  id: string
  name: string
  email: string
  resume: string
  skills: Skill[]
  totalExperience: number
  availability: 'immediate' | '2 weeks' | '1 month' | 'other'
  location: string
  preferredLocations: string[]
  salaryRange?: {
    min: number
    max: number
    currency: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface Skill {
  name: string
  years: number
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  category: 'testing' | 'automation' | 'programming' | 'tools' | 'methodology' | 'other'
}

export interface JobApplication {
  id: string
  jobId: string
  jobTitle: string
  company: string
  location: string
  appliedAt: Date
  status: 'pending' | 'application_sent' | 'interview_scheduled' | 'rejected' | 'offer_received'
  matchScore: number
  requirements: string[]
  questionsAnswered: boolean
}

export type JobSource = 
  | 'linkedin'
  | 'upwork'
  | 'freelancer'
  | 'indeed'
  | 'hireline'
  | 'braintrust'
  | 'glassdoor'
  | 'remoteco'
  | 'wellfound'
  | 'stackoverflow'
  | 'remotecom'

export type JobType = 'full-time' | 'part-time' | 'contract' | 'temporary' | 'freelance' | 'project'

export interface LinkedInJob {
  id: string
  title: string
  company: string
  companyLogo?: string
  location: string
  isRemote: boolean
  description: string
  requirements: string[]
  skills: string[]
  postedDate: Date
  applicationUrl: string
  easyApply: boolean
  jobType?: JobType // Tipo de trabajo
  salary?: {
    min?: number
    max?: number
    currency?: string
    text?: string // "€30,000 - €40,000 per year"
    period?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  }
  allowedLocations?: string[] // Países permitidos para aplicar
  source: JobSource // De dónde viene la oferta
}

export interface MatchingCriteria {
  requiredSkills: string[]
  preferredSkills: string[]
  minExperience: number
  remoteOnly: boolean
  maxApplicationsPerDay: number
  regions: string[]
}

export interface ScreeningQuestion {
  id: string
  question: string
  type: 'text' | 'yes_no' | 'multiple_choice' | 'experience_years'
  required: boolean
  options?: string[]
}

export interface ScreeningAnswer {
  questionId: string
  answer: string
}

export interface ApplicationMetrics {
  totalApplied: number
  pending: number
  interviews: number
  rejections: number
  offers: number
  todayApplied: number
  successRate: number
  averageMatchScore: number
}

export interface AutomationConfig {
  isActive: boolean
  dailyLimit: number
  currentDayCount: number
  lastResetDate: Date
  rateLimiting: {
    requestsPerMinute: number
    applicationsPerHour: number
  }
}








