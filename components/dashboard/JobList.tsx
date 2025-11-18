'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LinkedInJob, Skill } from '@/types'
import { MatchResult } from '@/lib/job-matcher'
import { MapPin, Building2, Calendar, ExternalLink, DollarSign, AlertCircle, Globe } from 'lucide-react'

interface JobCardProps {
  job: LinkedInJob
  matchScore?: number
  onApply?: (jobId: string) => void
  isApplied?: boolean
  userSkills?: Skill[]
}

export function JobCard({ job, matchScore, onApply, isApplied, userSkills = [] }: JobCardProps) {
  // Identificar skills que el usuario NO tiene
  const userSkillNames = userSkills.map(s => s.name.toLowerCase())
  const missingSkills = job.skills.filter(skill => !userSkillNames.includes(skill.toLowerCase()))
  
  // Formatear salario
  const formatSalary = () => {
    if (!job.salary) return null
    if (job.salary.text) return job.salary.text
    if (job.salary.min && job.salary.max) {
      return `${job.salary.currency || '$'}${job.salary.min.toLocaleString()} - ${job.salary.currency || '$'}${job.salary.max.toLocaleString()}/${job.salary.period === 'yearly' ? 'yr' : job.salary.period || 'yr'}`
    }
    if (job.salary.min) {
      return `${job.salary.currency || '$'}${job.salary.min.toLocaleString()}+/${job.salary.period === 'yearly' ? 'yr' : job.salary.period || 'yr'}`
    }
    return null
  }
  
  // Mapear fuente a color
  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'linkedin': return 'bg-blue-500'
      case 'upwork': return 'bg-green-600'
      case 'freelancer': return 'bg-indigo-500'
      case 'indeed': return 'bg-sky-600'
      case 'hireline': return 'bg-emerald-600'
      case 'braintrust': return 'bg-rose-600'
      case 'glassdoor': return 'bg-orange-500'
      case 'remoteco': return 'bg-teal-600'
      case 'wellfound': return 'bg-purple-600'
      case 'stackoverflow': return 'bg-yellow-600'
      case 'remotecom': return 'bg-cyan-600'
      default: return 'bg-gray-500'
    }
  }
  
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'linkedin': return 'LinkedIn'
      case 'upwork': return 'Upwork'
      case 'freelancer': return 'Freelancer'
      case 'indeed': return 'Indeed'
      case 'hireline': return 'Hireline'
      case 'braintrust': return 'Braintrust'
      case 'glassdoor': return 'Glassdoor'
      case 'remoteco': return 'Remote.co'
      case 'wellfound': return 'Wellfound'
      case 'stackoverflow': return 'Stack Overflow'
      case 'remotecom': return 'Remote.com'
      default: return source
    }
  }
  
  const getJobTypeBadge = (jobType?: string) => {
    if (!jobType) return null
    
    const badges: any = {
      'full-time': { label: 'Full-time', color: 'bg-blue-600' },
      'part-time': { label: 'Part-time', color: 'bg-yellow-600' },
      'contract': { label: 'Contract', color: 'bg-orange-600' },
      'temporary': { label: 'Temporary', color: 'bg-red-600' },
      'freelance': { label: 'Freelance', color: 'bg-purple-600' },
      'project': { label: 'Project', color: 'bg-indigo-600' }
    }
    
    const badge = badges[jobType.toLowerCase()]
    if (badge) {
      return <Badge className={badge.color}>{badge.label}</Badge>
    }
    return null
  }
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{job.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              <span>{job.company}</span>
              <Badge className={getSourceBadgeColor(job.source)}>
                <Globe className="h-3 w-3 mr-1" />
                {getSourceLabel(job.source)}
              </Badge>
              {getJobTypeBadge(job.jobType)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <MapPin className="h-4 w-4" />
              <span>{job.location}</span>
              {job.isRemote && (
                <Badge variant="secondary">Remote</Badge>
              )}
            </div>
          </div>
          {matchScore !== undefined && (
            <Badge className={`${matchScore >= 80 ? 'bg-green-500' : matchScore >= 60 ? 'bg-yellow-500' : 'bg-orange-500'}`}>
              {matchScore}% Match
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Salario */}
          {job.salary && formatSalary() && (
            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
              <DollarSign className="h-4 w-4" />
              <span>{formatSalary()}</span>
            </div>
          )}
          
          {/* Ubicaciones permitidas */}
          {job.allowedLocations && job.allowedLocations.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="italic">
                Available in: {job.allowedLocations.join(', ')}
              </span>
            </div>
          )}
          
          {/* Skills requeridas */}
          {job.skills.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2 text-muted-foreground">
                Skills Requeridas:
              </div>
              <div className="flex flex-wrap gap-2">
                {job.skills.slice(0, 8).map((skill, idx) => {
                  const hasSkill = userSkillNames.includes(skill.toLowerCase())
                  return (
                    <Badge 
                      key={idx} 
                      variant={hasSkill ? "default" : "destructive"}
                      className={hasSkill ? "" : "opacity-75"}
                    >
                      {hasSkill ? "✓" : <AlertCircle className="h-3 w-3" />} {skill}
                    </Badge>
                  )
                })}
                {job.skills.length > 8 && (
                  <Badge variant="outline">+{job.skills.length - 8} more</Badge>
                )}
              </div>
            </div>
          )}
          
          {missingSkills.length > 0 && userSkills.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                <AlertCircle className="h-3 w-3" />
                Skills Faltantes ({missingSkills.length}):
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-300">
                {missingSkills.slice(0, 5).join(', ')}
                {missingSkills.length > 5 && ` y ${missingSkills.length - 5} más...`}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Posted {new Date(job.postedDate).toLocaleDateString()}</span>
          </div>
          
          <div className="flex gap-2 mt-4">
            {job.applicationUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(job.applicationUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Job
              </Button>
            )}
            {onApply && !isApplied && (
              <Button
                size="sm"
                onClick={() => onApply(job.id)}
                disabled={isApplied}
              >
                {isApplied ? 'Applied' : 'Apply Now'}
              </Button>
            )}
            {isApplied && (
              <Button size="sm" variant="outline" disabled>
                ✓ Applied
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface JobListProps {
  jobs: MatchResult[]
  onApply?: (jobId: string) => void
  onApplyAll?: () => void
  appliedJobIds?: string[]
  userSkills?: Skill[]
}

export function JobList({ jobs, onApply, onApplyAll, appliedJobIds = [], userSkills = [] }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No jobs found matching your criteria</p>
        </CardContent>
      </Card>
    )
  }
  
  const notAppliedCount = jobs.filter(result => !appliedJobIds.includes(result.job.id)).length
  
  return (
    <div className="space-y-4">
      {/* Botón Apply All */}
      {notAppliedCount > 0 && onApplyAll && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">Apply to All Jobs</p>
              <p className="text-sm text-muted-foreground">
                {notAppliedCount} job{notAppliedCount > 1 ? 's' : ''} available to apply
              </p>
            </div>
            <Button onClick={onApplyAll} size="lg" className="bg-primary hover:bg-primary/90">
              Apply to All ({notAppliedCount})
            </Button>
          </CardContent>
        </Card>
      )}
      
      {jobs.map((result) => (
        <JobCard
          key={result.job.id}
          job={result.job}
          matchScore={result.score}
          onApply={onApply}
          isApplied={appliedJobIds.includes(result.job.id)}
          userSkills={userSkills}
        />
      ))}
    </div>
  )
}








