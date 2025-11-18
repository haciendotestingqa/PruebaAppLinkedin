import { LinkedInJob, QAProfile, Skill } from '@/types'

export interface MatchResult {
  job: LinkedInJob
  score: number
  matchedSkills: string[]
  missingSkills: string[]
  reasons: string[]
}

export function calculateMatchScore(job: LinkedInJob, profile: QAProfile): MatchResult {
  const result: MatchResult = {
    job,
    score: 0,
    matchedSkills: [],
    missingSkills: [],
    reasons: [],
  }
  
  let score = 0
  const maxScore = 100
  
  // Validar que profile.skills existe
  if (!profile.skills || !Array.isArray(profile.skills)) {
    console.error('Profile skills is not valid:', profile.skills)
    return result
  }
  
  // Bonus para trabajos freelance/proyecto (5 puntos extra)
  if (job.jobType === 'freelance' || job.jobType === 'project' || job.jobType === 'contract' || job.jobType === 'temporary') {
    score += 5
    result.reasons.push('Oportunidad freelance/proyecto/contrato')
  }
  
  // 1. Remote work check (30 points)
  if (job.isRemote) {
    score += 30
    result.reasons.push('Trabajo remoto disponible')
  } else if (profile.preferredLocations && profile.preferredLocations.includes(job.location)) {
    score += 15
    result.reasons.push('Ubicación preferida')
  }
  
  // 2. Skills matching (40 points)
  const jobSkillsLower = (job.skills || []).map(s => s.toLowerCase())
  const profileSkillsLower = profile.skills.map(s => s.name.toLowerCase())
  
  let skillsMatched = 0
  
  // Si el trabajo tiene skills listadas, verificar matches
  if (job.skills && job.skills.length > 0) {
    for (const jobSkill of jobSkillsLower) {
      const profileSkill = profile.skills.find(s => s.name.toLowerCase() === jobSkill)
      if (profileSkill) {
        skillsMatched++
        result.matchedSkills.push(profileSkill.name)
      } else {
        result.missingSkills.push(jobSkill)
      }
    }
    const skillMatchRatio = skillsMatched / job.skills.length
    score += 40 * skillMatchRatio
    result.reasons.push(`${Math.round(skillMatchRatio * 100)}% de habilidades coinciden`)
  } else {
    // Si NO hay skills listadas, extraer del título y descripción
    const jobTextLower = (job.title + ' ' + job.description).toLowerCase()
    for (const profileSkillLower of profileSkillsLower) {
      if (jobTextLower.includes(profileSkillLower)) {
        skillsMatched++
        // Encontrar el skill completo para agregar el nombre correcto
        const profileSkill = profile.skills.find(s => s.name.toLowerCase() === profileSkillLower)
        if (profileSkill) {
          result.matchedSkills.push(profileSkill.name)
        }
      }
    }
    
    if (skillsMatched > 0) {
      // Damos 30 puntos si encontramos al menos 3 skills en el texto
      const bonusScore = Math.min(30, skillsMatched * 5)
      score += bonusScore
      result.reasons.push(`${skillsMatched} habilidades encontradas en descripción`)
    } else {
      // Si no hay skills, damos puntos por ser QA
      score += 20
      result.reasons.push('Posición de QA (sin skills específicas)')
    }
  }
  
  // 3. Title/Description keywords (20 points)
  const titleLower = job.title.toLowerCase()
  const descLower = job.description.toLowerCase()
  
  const qaKeywords = [
    'qa', 'quality assurance', 'quality engineer', 'test', 'tester',
    'testing', 'qa engineer', 'qa analyst', 'test engineer'
  ]
  
  const hasQAKeyword = qaKeywords.some(keyword => 
    titleLower.includes(keyword) || descLower.includes(keyword)
  )
  
  if (hasQAKeyword) {
    score += 20
    result.reasons.push('Posición de QA identificada')
  }
  
  // 4. Experience requirements (10 points)
  // This would need more sophisticated parsing from job description
  if (profile.totalExperience >= 2) {
    score += 10
    result.reasons.push('Experiencia suficiente')
  }
  
  result.score = Math.round(Math.min(score, maxScore))
  
  return result
}

export function filterJobsByCriteria(
  jobs: LinkedInJob[],
  profile: QAProfile,
  minScore: number = 50
): MatchResult[] {
  const results = jobs
    // Filtrar SOLO trabajos remotos
    .filter(job => job.isRemote === true)
    // Filtrar trabajos que aceptan SOLO Venezuela o remoto global
    .filter(job => {
      const locationLower = job.location.toLowerCase()
      const titleLower = job.title.toLowerCase()
      const remoteKeywords = [
        'remote',
        'worldwide',
        'global',
        'anywhere',
        'distributed',
        'work from anywhere',
        'any location',
        'latam',
        'latin america',
        'south america',
        'central america',
        'caribbean',
        'americas'
      ]
      
      // Lista de países excluidos (no queremos estos)
      const excludedCountries = [
        'mexico', 'méxico', 'argentina', 'peru', 'perú', 'chile', 'colombia',
        'brasil', 'brazil', 'costa rica', 'ecuador', 'guatemala', 'panamá',
        'paraguay', 'uruguay', 'bolivia', 'honduras', 'el salvador',
        'nicaragua', 'cuba', 'republica dominicana', 'república dominicana'
      ]
      
      // Excluir si el título o location mencionan otros países (excepto si también menciona Venezuela o worldwide)
      const mentionsOtherCountry = excludedCountries.some(country => 
        (titleLower.includes(country) || locationLower.includes(country)) &&
        !titleLower.includes('venezuela') && !locationLower.includes('venezuela') &&
        !titleLower.includes('worldwide') && !locationLower.includes('worldwide')
      )
      
      if (mentionsOtherCountry) {
        return false
      }
      
      // Verificar si tiene allowedLocations y si incluye Venezuela
      if (job.allowedLocations && job.allowedLocations.length > 0) {
        const allowedLower = job.allowedLocations.map(loc => loc.toLowerCase())
        // Permitir si incluye Venezuela o menciona keywords remotos/globales
        const mentionsRemote = allowedLower.some(loc =>
          remoteKeywords.some(keyword => loc.includes(keyword))
        )
        return allowedLower.includes('venezuela') || mentionsRemote
      }
      
      // Si no tiene allowedLocations, verificar si menciona Venezuela en título/location
      if (titleLower.includes('venezuela') || locationLower.includes('venezuela')) {
        return true
      }
      
      // Permitir trabajos remotos globales (worldwide, remote, global)
      if (
        remoteKeywords.some(keyword => titleLower.includes(keyword) || locationLower.includes(keyword)) ||
        locationLower.includes('remote -')
      ) {
        return true
      }
      
      // Si no menciona ningún país específico, permitirlo (trabajo 100% remoto sin restricción)
      return true
    })
    .map(job => calculateMatchScore(job, profile))
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
  
  return results
}

export function extractSkillsFromJobDescription(description: string): string[] {
  const commonSkills = [
    'selenium', 'cypress', 'playwright', 'jest', 'mocha', 'python', 'javascript',
    'typescript', 'java', 'api testing', 'automation', 'manual testing',
    'sql', 'git', 'jenkins', 'docker', 'aws', 'azure', 'agile', 'scrum'
  ]
  
  const foundSkills: string[] = []
  const lowerDesc = description.toLowerCase()
  
  commonSkills.forEach(skill => {
    if (lowerDesc.includes(skill)) {
      foundSkills.push(skill)
    }
  })
  
  return foundSkills
}

export function calculateYearsFromText(text: string): number {
  const yearsRegex = /(\d+)\s*(?:years?|yr|yrs|años?)/i
  const match = text.match(yearsRegex)
  
  if (match && match[1]) {
    return parseInt(match[1])
  }
  
  return 0
}
