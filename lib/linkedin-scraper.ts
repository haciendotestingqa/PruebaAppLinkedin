import axios from 'axios'
import { LinkedInJob, JobType } from '@/types'

// Dynamic imports (server-side only)
let cheerio: any
let puppeteer: any

if (typeof window === 'undefined') {
  try {
    cheerio = require('cheerio')
    puppeteer = require('puppeteer')
  } catch (e) {
    console.warn('Dependencies not available')
  }
}

/**
 * LinkedIn Jobs Scraper
 * Extrae ofertas de trabajo directamente de LinkedIn
 * 
 * ⚠️ IMPORTANTE: LinkedIn no permite scraping oficial.
 * Este código es solo para fines educativos.
 * Para producción, usar LinkedIn Jobs API oficial.
 */

export interface LinkedInSearchParams {
  keywords: string           // "QA Engineer", "Quality Assurance"
  location?: string          // "Remote", "Venezuela"
  experience?: string        // "2,3,4" años de experiencia
  jobType?: string           // "F" (full-time), "C" (contract)
  datePosted?: string        // "24h", "7d", "30d"
  remote?: boolean           // true para solo remotos
}

export class LinkedInScraper {
  private baseUrl = 'https://www.linkedin.com/jobs/search'
  private rateLimitDelay = 2000 // 2 segundos entre requests

  /**
   * Busca trabajos en LinkedIn
   */
  async searchJobs(params: LinkedInSearchParams): Promise<LinkedInJob[]> {
    try {
      console.log('🔍 Buscando trabajos en LinkedIn...', params)
      
      const url = this.buildSearchUrl(params)
      console.log('📡 URL:', url)

      // Intentar con Puppeteer primero (más robusto)
      if (puppeteer) {
        try {
          const jobs = await this.searchWithPuppeteer(url)
          if (jobs.length > 0) {
            console.log(`✅ Encontrados ${jobs.length} trabajos con Puppeteer`)
            return jobs
          }
        } catch (error) {
          console.log('⚠️ Puppeteer falló, intentando con axios...', error)
        }
      }

      // Fallback a axios
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      })

      const jobs = this.parseJobListings(response.data)
      console.log(`✅ Encontrados ${jobs.length} trabajos con axios`)

      if (jobs.length === 0) {
        throw new Error('No se encontraron trabajos en LinkedIn')
      }

      return jobs
    } catch (error) {
      console.error('❌ Error buscando trabajos en LinkedIn:', error)
      throw error // No usar datos mock, lanzar error
    }
  }

  /**
   * Construye URL de búsqueda de LinkedIn
   */
  private buildSearchUrl(params: LinkedInSearchParams): string {
    const queryParams = new URLSearchParams({
      keywords: params.keywords || 'QA Engineer',
      location: params.location || 'Remote',
    })

    if (params.remote) {
      queryParams.set('f_TPR', params.datePosted || 'r86400') // Últimas 24h
      queryParams.set('f_WT', '2') // Solo trabajo remoto
    }

    if (params.experience) {
      // Filtros de experiencia: 2,3,4 = más de 2 años
      queryParams.set('f_E', params.experience)
    }

    if (params.jobType) {
      queryParams.set('f_JT', params.jobType) // F = Full-time
    }

    queryParams.set('f_AL', 'true') // Easy Apply
    queryParams.set('sortBy', 'DD') // Ordenar por fecha

    return `${this.baseUrl}?${queryParams.toString()}`
  }

  /**
   * Parsea el HTML de LinkedIn para extraer job listings
   */
  private parseJobListings(html: string): LinkedInJob[] {
    if (!cheerio) {
      console.warn('Cheerio not available')
      throw new Error('Cheerio not available for parsing HTML')
    }

    const $ = cheerio.load(html)
    const jobs: LinkedInJob[] = []
    
    // Guardar HTML para debugging
    console.log('📄 HTML length:', html.length)
    console.log('📄 First 500 chars:', html.substring(0, 500))

    // Intentar múltiples selectores comunes de LinkedIn
    const selectors = [
      '.jobs-search__results-list li',
      '.job-result-card',
      '.result-card',
      '[data-entity-urn*="urn:li:job"]'
    ]

    let foundElements = false

    for (const selector of selectors) {
      const elements = $(selector)
      console.log(`🔍 Selector "${selector}": encontró ${elements.length} elementos`)
      
      if (elements.length > 0) {
        foundElements = true
        elements.each((_: any, element: any) => {
          try {
            const jobId = $(element).find('[data-job-id]').attr('data-job-id') || 
                         $(element).attr('data-entity-urn')?.split(':').pop() ||
                         Math.random().toString(36).substring(7)
            
            const title = $(element).find('.job-result-card__title, .base-search-card__title, .job-title').first().text().trim()
            const company = $(element).find('.job-result-card__subtitle, .base-search-card__subtitle, .job-result-card__company').first().text().trim()
            const location = $(element).find('.job-result-card__location, .job-search-card__location').first().text().trim()
            const postedDate = $(element).find('[datetime], time').attr('datetime') || 
                              new Date().toISOString()
            
            // Detectar si es remoto: en location o en título
            const isRemote = location.toLowerCase().includes('remote') || 
                            location.toLowerCase().includes('remoto') ||
                            title.toLowerCase().includes('remote') ||
                            title.toLowerCase().includes('remoto') ||
                            title.toLowerCase().includes('100% remoto')
            
            const easyApply = $(element).find('.job-result-card__easy-apply-label, .simple-badge').length > 0
            
            // Obtener URL de la aplicación
            const linkElement = $(element).find('a').first()
            let applicationUrl = linkElement.attr('href') || ''
            
            if (applicationUrl && !applicationUrl.startsWith('http')) {
              applicationUrl = `https://linkedin.com${applicationUrl}`
            }

            // Extraer skills/description
            const description = $(element).find('.job-result-card__snippet, .job-snippet').first().text().trim()
            
            // Si no hay descripción, usar título para extraer skills
            const textForSkills = description || title
            const skills = this.extractSkills(textForSkills)
            
            // Extraer salario
            const salary = this.extractSalary(element, $)
            
            // Extraer ubicaciones permitidas (usa título si no hay descripción)
            const allowedLocations = this.extractAllowedLocations(description || '', title)
            
            // Detectar tipo de trabajo
            const jobType = this.detectJobType(title, description || '')

            if (title && company && title.length > 3 && company.length > 1) {
              jobs.push({
                id: `linkedin-${jobId}`,
                title,
                company,
                companyLogo: undefined,
                location: location || 'Remote',
                isRemote,
                description: description || 'No description available',
                requirements: this.extractRequirements(description),
                skills,
                postedDate: new Date(postedDate),
                applicationUrl: applicationUrl || 'https://linkedin.com/jobs',
                easyApply,
                salary,
                allowedLocations,
                source: 'linkedin' as const,
                jobType,
              })
            }
          } catch (error) {
            console.error('Error parsing job listing:', error)
          }
        })
        break // Usar el primer selector que funcione
      }
    }

    if (!foundElements) {
      console.error('❌ No se encontraron elementos con ningún selector')
      console.log('📄 Sample HTML structure:', html.substring(0, 2000))
      throw new Error('No se pudieron encontrar trabajos en el HTML de LinkedIn. La estructura puede haber cambiado.')
    }

    console.log(`✅ Parseados ${jobs.length} trabajos`)
    return jobs
  }

  /**
   * Extrae skills del texto de la descripción
   */
  private extractSkills(text: string): string[] {
    const skills: string[] = []
    const lowerText = text.toLowerCase()

    const commonSkills = [
      'selenium', 'cypress', 'playwright', 'jest', 'mocha', 'python', 'javascript',
      'typescript', 'java', 'api testing', 'automation', 'manual testing', 'sql',
      'git', 'jenkins', 'docker', 'aws', 'azure', 'agile', 'scrum', 'appium',
      'postman', 'rest', 'graphql', 'performance testing', 'security testing',
      'bdd', 'tdd', 'ci/cd', 'devops', 'mongodb', 'postgresql', 'mysql'
    ]

    commonSkills.forEach(skill => {
      if (lowerText.includes(skill)) {
        skills.push(skill.charAt(0).toUpperCase() + skill.slice(1))
      }
    })

    return [...new Set(skills)] // Remove duplicates
  }

  /**
   * Extrae requirements del texto
   */
  private extractRequirements(text: string): string[] {
    const requirements: string[] = []
    
    // Buscar frases que parecen requirements
    const lines = text.split('\n').filter(line => line.trim().length > 10)
    
    lines.forEach(line => {
      if (line.match(/\d+\+?\s*(years?|yrs?|años?)/i) || 
          line.toLowerCase().includes('required') ||
          line.toLowerCase().includes('experience')) {
        requirements.push(line.trim())
      }
    })

    return requirements.slice(0, 5) // Max 5 requirements
  }

  /**
   * Extrae información de salario del trabajo
   */
  private extractSalary(element: any, $: any): any {
    try {
      // Buscar salario en varios lugares
      const salaryText = $(element).find('.job-result-card__salary, .job-salary, [data-testid*="salary"]').first().text().trim()
      
      if (!salaryText) {
        return undefined
      }

      // Parsear diferentes formatos de salario
      // Ejemplos: "$50,000 - $70,000", "€30k-€40k", "£40,000/year"
      const salaryRegex = /([$€£¥₹])\s*([0-9,]+(?:k)?)\s*-?\s*([$€£¥₹])\s*([0-9,]+(?:k)?)?/i
      const match = salaryText.match(salaryRegex)
      
      if (match) {
        const currency = match[1] || match[3]
        const minStr = match[2]
        const maxStr = match[4]
        
        const parseAmount = (str: string): number => {
          const amount = parseInt(str.replace(/[^0-9]/g, ''))
          return str.toLowerCase().includes('k') ? amount * 1000 : amount
        }
        
        const min = parseAmount(minStr)
        const max = maxStr ? parseAmount(maxStr) : undefined
        
        let period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'yearly'
        const lowerText = salaryText.toLowerCase()
        if (lowerText.includes('hour')) period = 'hourly'
        else if (lowerText.includes('day')) period = 'daily'
        else if (lowerText.includes('week')) period = 'weekly'
        else if (lowerText.includes('month')) period = 'monthly'
        
        return {
          min,
          max,
          currency,
          period,
          text: salaryText
        }
      }
      
      return { text: salaryText }
    } catch (error) {
      console.error('Error extracting salary:', error)
      return undefined
    }
  }

  /**
   * Parsea texto de salario a objeto estructurado
   */
  private parseSalaryText(salaryText: string): any {
    if (!salaryText || !salaryText.trim()) {
      return undefined
    }

    const text = salaryText.trim()
    const salaryRegex = /([$€£¥₹])\s*([0-9,]+(?:k|K)?)\s*-?\s*([$€£¥₹])\s*([0-9,]+(?:k|K)?)?/i
    const match = text.match(salaryRegex)
    
    if (match) {
      const currency = match[1] || match[3]
      const minStr = match[2]
      const maxStr = match[4]
      
      const parseAmount = (str: string): number => {
        const amount = parseInt(str.replace(/[^0-9]/g, ''))
        return str.toLowerCase().includes('k') ? amount * 1000 : amount
      }
      
      const min = parseAmount(minStr)
      const max = maxStr ? parseAmount(maxStr) : undefined
      
      let period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'yearly'
      const lowerText = text.toLowerCase()
      if (lowerText.includes('hour')) period = 'hourly'
      else if (lowerText.includes('day')) period = 'daily'
      else if (lowerText.includes('week')) period = 'weekly'
      else if (lowerText.includes('month')) period = 'monthly'
      
      return { min, max, currency, period, text }
    }
    
    return { text }
  }

  /**
   * Extrae países permitidos para aplicar
   */
  private extractAllowedLocations(description: string, title: string): string[] {
    try {
      const locations: string[] = []
      const fullText = (title + ' ' + description).toLowerCase()
      
      // Lista de países de LATAM
      const latamCountries = [
        'argentina', 'bolivia', 'brasil', 'chile', 'colombia', 'costa rica',
        'cuba', 'ecuador', 'el salvador', 'guatemala', 'honduras', 'méxico',
        'nicaragua', 'panamá', 'paraguay', 'perú', 'república dominicana',
        'uruguay', 'venezuela'
      ]
      
      // Buscar países mencionados
      latamCountries.forEach(country => {
        if (fullText.includes(country) || fullText.includes(country.replace('á', 'a'))) {
          locations.push(country)
        }
      })
      
      // Buscar patrones específicos
      if (fullText.includes('latin america') || fullText.includes('latam') || fullText.includes('latinoamérica')) {
        locations.push('Latin America')
      }
      
      if (fullText.includes('south america') || fullText.includes('sudamérica')) {
        locations.push('South America')
      }
      
      return [...new Set(locations)] // Remove duplicates
    } catch (error) {
      console.error('Error extracting allowed locations:', error)
      return []
    }
  }

  /**
   * Detecta el tipo de trabajo desde título y descripción
   */
  private detectJobType(title: string, description: string): JobType {
    const fullText = (title + ' ' + description).toLowerCase()
    
    // Freelance
    if (fullText.includes('freelance') || fullText.includes('freelancer')) {
      return 'freelance'
    }
    
    // Project
    if (fullText.includes('project') || fullText.includes('proyecto')) {
      return 'project'
    }
    
    // Contract / Temporary
    if (fullText.includes('contract') || fullText.includes('contrato') || 
        fullText.includes('temporary') || fullText.includes('temporal')) {
      return 'contract'
    }
    
    // Part-time
    if (fullText.includes('part-time') || fullText.includes('medio tiempo') || 
        fullText.includes('parcial')) {
      return 'part-time'
    }
    
    // Full-time (default)
    return 'full-time'
  }

  /**
   * Búsqueda con Puppeteer (navegador real)
   */
  private async searchWithPuppeteer(url: string): Promise<LinkedInJob[]> {
    console.log('🤖 Iniciando Puppeteer...')
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })

    try {
      const page = await browser.newPage()
      
      // Headers reales
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      
      // Navegar a la URL
      console.log('📡 Navegando a LinkedIn...')
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      })
      
      // Esperar a que carguen los job listings
      console.log('⏳ Esperando que carguen los trabajos...')
      await page.waitForSelector('.jobs-search__results-list', { timeout: 30000 })
      
      // Scroll para cargar más trabajos
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })
      await this.delay(2000)
      
      // Obtener HTML
      const html = await page.content()
      
      // Guardar HTML para debugging
      const fs = require('fs')
      fs.writeFileSync('/tmp/linkedin-debug.html', html)
      console.log('📄 HTML guardado en /tmp/linkedin-debug.html')
      
      // Parsear con Cheerio
      const jobs = this.parseJobListings(html)
      
      return jobs
    } finally {
      await browser.close()
    }
  }

  /**
   * Enriquece trabajos con información detallada de cada página
   */
  private async enrichJobsWithDetails(jobs: LinkedInJob[]): Promise<LinkedInJob[]> {
    console.log(`📊 Enriqueciendo ${jobs.length} trabajos con detalles...`)
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })

    try {
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      
      const enrichedJobs: LinkedInJob[] = []
      
      // Procesar máximo 20 trabajos para evitar timeout
      const jobsToProcess = jobs.slice(0, 20)
      
      for (let i = 0; i < jobsToProcess.length; i++) {
        const job = jobsToProcess[i]
        console.log(`📄 [${i + 1}/${jobsToProcess.length}] Extrayendo: ${job.title}`)
        
        try {
          await page.goto(job.applicationUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          })
          
          await this.delay(2000) // Esperar a que cargue
          
          const html = await page.content()
          
          // Extraer información detallada
          const details = this.extractDetailedInfo(html)
          
          // Actualizar job con detalles
          enrichedJobs.push({
            ...job,
            description: details.description || job.description,
            skills: details.skills.length > 0 ? details.skills : job.skills,
            salary: details.salary || job.salary,
            requirements: details.requirements.length > 0 ? details.requirements : job.requirements,
          })
          
        } catch (error) {
          console.error(`❌ Error extrayendo ${job.title}:`, error)
          enrichedJobs.push(job) // Mantener job original
        }
        
        // Rate limiting: esperar entre requests
        if (i < jobsToProcess.length - 1) {
          await this.delay(3000) // 3 segundos entre cada oferta
        }
      }
      
      // Agregar jobs no procesados
      enrichedJobs.push(...jobs.slice(20))
      
      return enrichedJobs
    } finally {
      await browser.close()
    }
  }

  /**
   * Extrae información detallada de una página de trabajo
   */
  private extractDetailedInfo(html: string): any {
    const $ = cheerio.load(html)
    
    // Extraer descripción completa
    const description = $('.show-more-less-html__markup, .jobs-box__html-content, .description__text').first().text().trim()
    
    // Extraer skills
    const skillsText = $('.jobs-description__job-criteria-list, .job-criteria-list').first().text()
    const skillsFromCriteria = this.extractSkillsFromCriteria(skillsText)
    const skillsFromDescription = this.extractSkills(description)
    const skills = [...new Set([...skillsFromCriteria, ...skillsFromDescription])]
    
    // Extraer salario
    const salaryText = $('.job-criteria__text:contains("Salary"), .salary').first().text()
    const salary = this.parseSalaryText(salaryText)
    
    // Extraer requirements
    const requirements = this.extractRequirements(description)
    
    return {
      description,
      skills,
      salary,
      requirements
    }
  }

  /**
   * Extrae skills de la sección de criterios de LinkedIn
   */
  private extractSkillsFromCriteria(text: string): string[] {
    const skills: string[] = []
    const lowerText = text.toLowerCase()
    
    const skillPatterns = [
      'selenium', 'cypress', 'playwright', 'jest', 'mocha', 'python', 'javascript',
      'typescript', 'java', 'c#', 'ruby', 'go', 'php', 'sql', 'postgresql',
      'mongodb', 'mysql', 'api testing', 'rest', 'graphql', 'postman', 'soapui',
      'automation', 'manual testing', 'jira', 'git', 'jenkins', 'docker',
      'aws', 'azure', 'agile', 'scrum', 'bdd', 'tdd', 'appium', 'testng',
      'junit', 'mocha', 'chai', 'pytest', 'robot framework'
    ]
    
    skillPatterns.forEach(skill => {
      if (lowerText.includes(skill)) {
        skills.push(skill.charAt(0).toUpperCase() + skill.slice(1))
      }
    })
    
    return [...new Set(skills)]
  }


  /**
   * Busca trabajos QA remotos en Latinoamérica
   */
  async searchRemoteQAJobs(): Promise<LinkedInJob[]> {
    const jobs = await this.searchJobs({
      keywords: 'QA Engineer OR Quality Assurance OR Test Engineer',
      location: 'Latin America',
      remote: true,
      datePosted: '24h', // Últimas 24 horas
      jobType: 'F', // Full-time
      experience: '2,3,4', // 2-4 años de experiencia
    })
    
    // Enriquecer con detalles (solo para primeras 20 ofertas para evitar timeout)
    console.log('🔍 Enriqueciendo con detalles detallados...')
    try {
      const enriched = await this.enrichJobsWithDetails(jobs)
      return enriched
    } catch (error) {
      console.error('⚠️ Error enriqueciendo, usando jobs básicos:', error)
      return jobs
    }
  }

  /**
   * Rate limiting: espera entre requests
   */
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton instance
let scraperInstance: LinkedInScraper | null = null

export function getLinkedInScraper(): LinkedInScraper {
  if (!scraperInstance) {
    scraperInstance = new LinkedInScraper()
  }
  return scraperInstance
}

