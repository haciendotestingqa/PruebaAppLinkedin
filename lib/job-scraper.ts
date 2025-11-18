import { LinkedInJob, JobSource, JobType } from '@/types'
import { authenticateAllPlatforms, AuthSession } from './platform-auth'

let axios: any
let cheerio: any
let puppeteer: any

if (typeof window === 'undefined') {
  try {
    axios = require('axios')
    cheerio = require('cheerio')
    puppeteer = require('puppeteer')
  } catch (e) {
    console.warn('Dependencies not available')
  }
}

type AuthPlatform = 'upwork' | 'freelancer' | 'hireline' | 'indeed' | 'braintrust' | 'glassdoor'

const QA_PATTERNS = [
  /\bqa\b/i,
  /\bqa engineer\b/i,
  /\bqa analyst\b/i,
  /\bqa tester\b/i,
  /\bmanual qa\b/i,
  /\bquality assurance\b/i,
  /\bquality engineer\b/i,
  /\bsoftware tester\b/i,
  /\btest engineer\b/i,
  /\bautomation tester\b/i,
  /\bsdet\b/i
]

const LOCATION_KEYWORDS = [
  'remote',
  'anywhere',
  'global',
  'worldwide',
  'latin america',
  'latam',
  'venezuela',
  'south america',
  'central america'
]

export class JobScraper {
  private rateLimitDelay = 2000
  private authSessions: {
    upwork?: AuthSession
    freelancer?: AuthSession
    hireline?: AuthSession
    indeed?: AuthSession
    braintrust?: AuthSession
    glassdoor?: AuthSession
  } = {}
  private credentialPresence: Record<AuthPlatform, boolean> = {
    upwork: false,
    freelancer: false,
    hireline: false,
    indeed: false,
    braintrust: false,
    glassdoor: false
  }

  async initializeAuth(): Promise<void> {
    const credentials: any = {}

    if (process.env.UPWORK_EMAIL && process.env.UPWORK_PASSWORD) {
      credentials.upwork = {
        email: process.env.UPWORK_EMAIL,
        password: process.env.UPWORK_PASSWORD
      }
      console.log('✅ Credenciales de Upwork encontradas')
    } else {
      console.log('⚠️ Credenciales de Upwork NO encontradas')
    }

    if (process.env.FREELANCER_EMAIL && process.env.FREELANCER_PASSWORD) {
      credentials.freelancer = {
        email: process.env.FREELANCER_EMAIL,
        password: process.env.FREELANCER_PASSWORD,
        username: process.env.FREELANCER_USERNAME
      }
      console.log('✅ Credenciales de Freelancer encontradas')
    } else {
      console.log('⚠️ Credenciales de Freelancer NO encontradas')
    }

    if (process.env.HIRELINE_EMAIL && process.env.HIRELINE_PASSWORD) {
      credentials.hireline = {
        email: process.env.HIRELINE_EMAIL,
        password: process.env.HIRELINE_PASSWORD
      }
      console.log('✅ Credenciales de Hireline encontradas')
    } else {
      console.log('⚠️ Credenciales de Hireline NO encontradas')
    }

    if (process.env.INDEED_EMAIL && process.env.INDEED_PASSWORD) {
      credentials.indeed = {
        email: process.env.INDEED_EMAIL,
        password: process.env.INDEED_PASSWORD
      }
      console.log('✅ Credenciales de Indeed encontradas')
    } else {
      console.log('⚠️ Credenciales de Indeed NO encontradas')
    }

    if (process.env.BRAINTRUST_EMAIL && process.env.BRAINTRUST_PASSWORD) {
      credentials.braintrust = {
        email: process.env.BRAINTRUST_EMAIL,
        password: process.env.BRAINTRUST_PASSWORD
      }
      console.log('✅ Credenciales de Braintrust encontradas')
    } else {
      console.log('⚠️ Credenciales de Braintrust NO encontradas')
    }

    if (process.env.GLASSDOOR_EMAIL && process.env.GLASSDOOR_PASSWORD) {
      credentials.glassdoor = {
        email: process.env.GLASSDOOR_EMAIL,
        password: process.env.GLASSDOOR_PASSWORD
      }
      console.log('✅ Credenciales de Glassdoor encontradas')
    } else {
      console.log('⚠️ Credenciales de Glassdoor NO encontradas')
    }

    const platformList: AuthPlatform[] = ['upwork', 'freelancer', 'hireline', 'indeed', 'braintrust', 'glassdoor']
    this.credentialPresence = platformList.reduce((acc, platform) => {
      acc[platform] = Boolean(credentials[platform])
      return acc
    }, {
      upwork: false,
      freelancer: false,
      hireline: false,
      indeed: false,
      braintrust: false,
      glassdoor: false
    } as Record<AuthPlatform, boolean>)

    if (Object.keys(credentials).length > 0) {
      console.log(`🔐 Inicializando autenticación para ${Object.keys(credentials).length} plataforma(s)...`)
      this.authSessions = await authenticateAllPlatforms(credentials)
      
      // Log del estado de autenticación
      console.log('📊 Estado de autenticación:')
      Object.entries(this.authSessions).forEach(([platform, session]: [string, any]) => {
        if (session?.isAuthenticated) {
          console.log(`  ✅ ${platform}: Autenticado`)
        } else {
          console.log(`  ❌ ${platform}: No autenticado`)
        }
      })
    } else {
      console.log('⚠️ No hay credenciales configuradas en variables de entorno')
    }
  }

  private authInitialized = false

  getAuthStatus() {
    return {
      sessions: this.authSessions,
      credentialPresence: this.credentialPresence,
      initialized: this.authInitialized
    }
  }

  async searchAllPlatforms(): Promise<LinkedInJob[]> {
    // Solo inicializar auth una vez, a menos que no haya sesiones
    if (!this.authInitialized || Object.keys(this.authSessions).length === 0) {
      await this.initializeAuth()
      this.authInitialized = true
    }
    
    const allJobs: LinkedInJob[] = []

    console.log('🔍 Buscando en múltiples plataformas con autenticación...')

    try {
      const upworkJobs = await this.searchUpwork()
      allJobs.push(...upworkJobs)
      console.log(`✅ Upwork: ${upworkJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Upwork:', error)
    }

    try {
      const freelancerJobs = await this.searchFreelancer()
      allJobs.push(...freelancerJobs)
      console.log(`✅ Freelancer: ${freelancerJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Freelancer:', error)
    }

    try {
      const hirelineJobs = await this.searchHireline()
      allJobs.push(...hirelineJobs)
      console.log(`✅ Hireline.io: ${hirelineJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Hireline.io:', error)
    }

    try {
      const indeedJobs = await this.searchIndeed()
      allJobs.push(...indeedJobs)
      console.log(`✅ Indeed: ${indeedJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Indeed:', error)
    }

    try {
      const braintrustJobs = await this.searchBraintrust()
      allJobs.push(...braintrustJobs)
      console.log(`✅ Braintrust: ${braintrustJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Braintrust:', error)
    }

    try {
      const glassdoorJobs = await this.searchGlassdoor()
      allJobs.push(...glassdoorJobs)
      console.log(`✅ Glassdoor: ${glassdoorJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Glassdoor:', error)
    }

    try {
      const remotecoJobs = await this.searchRemoteCo()
      allJobs.push(...remotecoJobs)
      console.log(`✅ Remote.co: ${remotecoJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Remote.co:', error)
    }

    try {
      const wellfoundJobs = await this.searchWellfound()
      allJobs.push(...wellfoundJobs)
      console.log(`✅ Wellfound: ${wellfoundJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Wellfound:', error)
    }

    try {
      const stackoverflowJobs = await this.searchStackOverflow()
      allJobs.push(...stackoverflowJobs)
      console.log(`✅ Stack Overflow: ${stackoverflowJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Stack Overflow:', error)
    }

    try {
      const remotecomJobs = await this.searchRemoteCom()
      allJobs.push(...remotecomJobs)
      console.log(`✅ Remote.com: ${remotecomJobs.length} trabajos`)
    } catch (error) {
      console.error('❌ Error en Remote.com:', error)
    }

    console.log(`\n📊 RESUMEN ANTES DE FILTRAR:`)
    const beforeFilter = allJobs.reduce<Record<JobSource, number>>((acc, job) => {
      acc[job.source] = (acc[job.source] || 0) + 1
      return acc
    }, {} as Record<JobSource, number>)
    console.log(`  Total trabajos: ${allJobs.length}`)
    console.log(`  Por plataforma:`, beforeFilter)

    const filtered = this.filterJobs(allJobs)
    console.log(`\n🔍 DESPUÉS DE FILTRAR (QA + Location):`)
    const afterFilter = filtered.reduce<Record<JobSource, number>>((acc, job) => {
      acc[job.source] = (acc[job.source] || 0) + 1
      return acc
    }, {} as Record<JobSource, number>)
    console.log(`  Total trabajos: ${filtered.length} (${allJobs.length - filtered.length} eliminados)`)
    console.log(`  Por plataforma:`, afterFilter)

    const deduped = this.dedupeJobs(filtered)
    console.log(`\n🔄 DESPUÉS DE DEDUPLICAR:`)
    const bySource = deduped.reduce<Record<JobSource, number>>((acc, job) => {
      acc[job.source] = (acc[job.source] || 0) + 1
      return acc
    }, {} as Record<JobSource, number>)
    console.log(`  Total trabajos: ${deduped.length} (${filtered.length - deduped.length} duplicados eliminados)`)
    console.log(`  Por plataforma:`, bySource)
    console.log(`\n✅ Total final: ${deduped.length} trabajos únicos y filtrados\n`)
    
    return deduped
  }

  private filterJobs(jobs: LinkedInJob[]): LinkedInJob[] {
    return jobs.filter(job => this.isQAJob(job) && this.matchesPreferredLocation(job))
  }

  private isQAJob(job: LinkedInJob): boolean {
    const combined = `${job.title} ${job.description} ${job.skills.join(' ')}`.toLowerCase()
    return QA_PATTERNS.some(pattern => pattern.test(combined))
  }

  private matchesPreferredLocation(job: LinkedInJob): boolean {
    if (job.isRemote) return true
    const combined = `${job.location} ${(job.allowedLocations || []).join(' ')}`.toLowerCase()
    return LOCATION_KEYWORDS.some(keyword => combined.includes(keyword))
  }

  private dedupeJobs(jobs: LinkedInJob[]): LinkedInJob[] {
    const seen = new Set<string>()
    return jobs.filter(job => {
      const key = (job.applicationUrl || '').toLowerCase() || `${job.company}-${job.title}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private async searchUpwork(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    const searchUrl = 'https://www.upwork.com/nx/search/jobs/?q=qa+engineer&sort=recency&t=0&category2_uid=531770282580668418'

    console.log('🔍 Buscando en Upwork...')
    console.log(`  - Sesión autenticada: ${this.authSessions.upwork?.isAuthenticated ? 'Sí' : 'No'}`)
    console.log(`  - Puppeteer disponible: ${puppeteer ? 'Sí' : 'No'}`)

    if (this.authSessions.upwork?.isAuthenticated && puppeteer) {
      console.log('  → Usando scraping autenticado')
      return await this.searchUpworkWithAuth(searchUrl, this.authSessions.upwork)
    } else if (puppeteer) {
      // Intentar scraping sin autenticación (puede funcionar para ver resultados públicos)
      console.log('  → Intentando scraping sin autenticación (puede tener limitaciones)')
      const unauthenticatedJobs = await this.searchUpworkWithAuth(searchUrl)
      if (unauthenticatedJobs.length > 0) {
        return unauthenticatedJobs
      }
      console.log('  ⚠️ Scraping sin autenticación no devolvió resultados')
    } else {
      console.log('  ⚠️ Puppeteer no disponible - retornando array vacío')
    }

    return jobs
  }

  private async searchUpworkWithAuth(searchUrl: string, session?: AuthSession): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) {
      console.log('  ⚠️ Puppeteer no disponible')
      return jobs
    }

    console.log('  → Iniciando navegador para Upwork...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    })

    try {
      const page = await browser.newPage()
      
      // Ocultar que es un bot
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        })
      })

      if (session?.cookies && session.cookies.length > 0) {
        console.log(`  → Configurando ${session.cookies.length} cookies de sesión`)
        await page.setCookie(...session.cookies)
      } else {
        console.log('  ⚠️ No hay cookies de sesión - intentando acceso público')
      }

      await page.setUserAgent(session?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      console.log(`  → Navegando a: ${searchUrl}`)
      
      try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 })
      } catch (e) {
        console.log('  ⚠️ Timeout en carga, intentando con domcontentloaded...')
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      }
      
      await this.delay(5000) // Más tiempo para que cargue

      // Verificar si hay captcha
      const pageContent = await page.content()
      const hasCaptcha = pageContent.includes('captcha') || pageContent.includes('recaptcha') || 
                         await page.$('.g-recaptcha, #captcha, [data-captcha]') !== null
      
      if (hasCaptcha) {
        console.log('  ⚠️ Captcha detectado en página - continuando de todas formas')
      }

      console.log('  → Extrayendo trabajos de la página...')
      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('[data-job-key], .job-tile, .up-card-section, .job-tile-content')
        const parsed: Array<{ title: string; url: string; company: string; rate: string }> = []

        jobElements.forEach((element) => {
          try {
            // Intentar múltiples formas de encontrar el título y link
            const titleSelectors = [
              'h2 a', 'h3 a', 'h4 a',
              '.job-title a',
              'a[data-ev-label="job_title"]',
              'a[href*="/jobs/"]',
              'a[href*="/job/"]',
              '.up-card-section a',
              'a'
            ]
            
            let titleEl: Element | null = null
            let title = ''
            let link: string | null = null
            
            for (const selector of titleSelectors) {
              titleEl = element.querySelector(selector)
              if (titleEl) {
                title = titleEl.textContent?.trim() || ''
                link = (titleEl as HTMLAnchorElement).href || titleEl.getAttribute('href')
                if (title && link) break
              }
            }
            
            // Si no encontramos título, intentar obtenerlo del texto del elemento
            if (!title) {
              title = element.textContent?.trim().split('\n')[0] || ''
            }
            
            const companyEl = element.querySelector('.client-name, .up-card-section .freelancer-name, .d-flex .freelancer-name, [data-test="client-name"]')
            const rateEl = element.querySelector('.budget, .job-rate, .text-right, [data-test="budget"]')

            if (title && link) {
              parsed.push({
                title: title.substring(0, 200), // Limitar longitud
                url: link.startsWith('http') ? link : `https://www.upwork.com${link}`,
                company: companyEl?.textContent?.trim() || 'Upwork Client',
                rate: rateEl?.textContent?.trim() || ''
              })
            }
          } catch (e) {
            // ignore individual parsing errors
          }
        })

        return parsed
      })

      console.log(`  → Listings extraídos: ${listings.length}`)

      for (const job of listings.slice(0, 20)) {
        jobs.push({
          id: `upwork-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: 'Remote',
          isRemote: true,
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: true,
          source: 'upwork',
          jobType: 'freelance',
          salary: this.parseUpworkRate(job.rate)
        })
      }
      
      console.log(`  ✅ Upwork: ${jobs.length} trabajos creados`)
    } catch (error) {
      console.error('❌ Error en scraping de Upwork (autenticado):', error)
      if (error instanceof Error) {
        console.error('   Mensaje:', error.message)
        console.error('   Stack:', error.stack)
      }
    } finally {
      await browser.close()
    }

    return jobs
  }

  private async searchFreelancer(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    
    console.log('🔍 Buscando en Freelancer...')
    console.log(`  - Axios disponible: ${axios ? 'Sí' : 'No'}`)
    
    if (!axios) {
      console.log('  ⚠️ Axios no disponible - retornando array vacío')
      return jobs
    }

    try {
      console.log('  → Haciendo request a API de Freelancer...')
      const response = await axios.get('https://www.freelancer.com/api/projects/0.1/projects/active/', {
        params: {
          query: 'qa engineer automation testing',
          job_details: true,
          limit: 25,
          compact: true,
          full_description: true
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      })

      console.log(`  → Respuesta recibida, status: ${response.status}`)
      const projects = response?.data?.result?.projects || []
      console.log(`  → Proyectos encontrados en API: ${projects.length}`)

      for (const project of projects) {
        try {
          if (!project?.title) {
            console.log('  ⚠️ Proyecto sin título, saltando...')
            continue
          }

          const description = project.preview_description || project.description || ''
          const skills = Array.isArray(project.jobs)
            ? project.jobs.map((j: any) => j.name).filter(Boolean)
            : []

          const job = {
            id: `freelancer-${project.id}`,
            title: project.title.trim(),
            company: 'Freelancer Client',
            location: 'Remote',
            isRemote: true,
            description: description.trim(),
            requirements: this.extractRequirementsFromText(description),
            skills,
            postedDate: project.time_submitted ? new Date(project.time_submitted * 1000) : new Date(),
            applicationUrl: project.seo_url
              ? `https://www.freelancer.com/projects/${project.seo_url}`
              : `https://www.freelancer.com/projects/${project.id}`,
            easyApply: true,
            source: 'freelancer' as JobSource,
            jobType: (project.type === 'hourly' ? 'contract' : 'project') as JobType,
            salary: this.parseFreelancerBudget(project),
            allowedLocations: ['Worldwide', 'Latin America']
          }

          jobs.push(job)
          console.log(`  ✅ Agregado: ${job.title}`)
        } catch (error) {
          console.error('  ❌ Error parsing Freelancer project:', error)
        }
      }
      
      console.log(`✅ Freelancer: ${jobs.length} trabajos parseados de ${projects.length} proyectos`)
    } catch (error) {
      console.error('❌ Error fetching Freelancer API:', error)
      if (error instanceof Error) {
        console.error('   Mensaje:', error.message)
        console.error('   Stack:', error.stack)
      }
    }

    return jobs
  }

  private async searchHireline(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    const searchUrl = 'https://hireline.io/jobs?q=qa+engineer&location=remote'

    console.log('🔍 Buscando en Hireline...')
    console.log(`  - Sesión autenticada: ${this.authSessions.hireline?.isAuthenticated ? 'Sí' : 'No'}`)
    console.log(`  - Puppeteer disponible: ${puppeteer ? 'Sí' : 'No'}`)

    if (this.authSessions.hireline?.isAuthenticated && puppeteer) {
      console.log('  → Usando scraping autenticado')
      return await this.searchHirelineWithAuth(searchUrl, this.authSessions.hireline)
    } else {
      console.log('  ⚠️ No se puede hacer scraping autenticado - retornando array vacío')
    }

    return jobs
  }

  private async searchHirelineWithAuth(searchUrl: string, session?: AuthSession): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) {
      console.log('  ⚠️ Puppeteer no disponible')
      return jobs
    }

    console.log('  → Iniciando navegador para Hireline...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()

      if (session?.cookies) {
        console.log(`  → Configurando ${session.cookies.length} cookies de sesión`)
        await page.setCookie(...session.cookies)
      } else {
        console.log('  ⚠️ No hay cookies de sesión disponibles')
      }

      await page.setUserAgent(session?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      console.log(`  → Navegando a: ${searchUrl}`)
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 })
      await this.delay(3000)

      console.log('  → Extrayendo trabajos de la página...')
      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('.job-card, .job-item, [data-job-id]')
        const parsed: Array<{ title: string; url: string; company: string; location: string }> = []

        jobElements.forEach((element) => {
          try {
            const titleEl = element.querySelector('h3, h4, .job-title')
            const title = titleEl?.textContent?.trim()
            const linkEl = element.querySelector('a')
            const link = linkEl ? linkEl.getAttribute('href') : null
            const companyEl = element.querySelector('.company-name, .company')
            const locationEl = element.querySelector('.location, .job-location')

            if (title && link) {
              parsed.push({
                title,
                url: link.startsWith('http') ? link : `https://hireline.io${link}`,
                company: companyEl?.textContent?.trim() || 'Hireline Client',
                location: locationEl?.textContent?.trim() || 'Remote'
              })
            }
          } catch (e) {
            // ignore
          }
        })

        return parsed
      })

      console.log(`  → Listings extraídos: ${listings.length}`)

      for (const job of listings.slice(0, 20)) {
        jobs.push({
          id: `hireline-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: job.location.toLowerCase().includes('remote'),
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: false,
          source: 'hireline',
          jobType: 'full-time'
        })
      }
      
      console.log(`  ✅ Hireline: ${jobs.length} trabajos creados`)
    } catch (error) {
      console.error('❌ Error en scraping de Hireline.io:', error)
      if (error instanceof Error) {
        console.error('   Mensaje:', error.message)
        console.error('   Stack:', error.stack)
      }
    } finally {
      await browser.close()
    }

    return jobs
  }

  private async searchIndeed(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    const searchUrl = 'https://www.indeed.com/jobs?q=qa+engineer&l=remote&radius=0'

    console.log('🔍 Buscando en Indeed...')
    console.log(`  - Sesión autenticada: ${this.authSessions.indeed?.isAuthenticated ? 'Sí' : 'No'}`)
    console.log(`  - Puppeteer disponible: ${puppeteer ? 'Sí' : 'No'}`)

    if (this.authSessions.indeed?.isAuthenticated && puppeteer) {
      console.log('  → Usando scraping autenticado')
      return await this.searchIndeedWithAuth(searchUrl, this.authSessions.indeed)
    } else if (puppeteer) {
      console.log('  → Intentando scraping sin autenticación')
      return await this.searchIndeedWithAuth(searchUrl)
    } else {
      console.log('  ⚠️ Puppeteer no disponible - retornando array vacío')
    }

    return jobs
  }

  private async searchIndeedWithAuth(searchUrl: string, session?: AuthSession): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) {
      console.log('  ⚠️ Puppeteer no disponible')
      return jobs
    }

    console.log('  → Iniciando navegador para Indeed...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()

      if (session?.cookies) {
        console.log(`  → Configurando ${session.cookies.length} cookies de sesión`)
        await page.setCookie(...session.cookies)
      } else {
        console.log('  ⚠️ No hay cookies de sesión - intentando sin autenticación')
      }

      await page.setUserAgent(session?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      console.log(`  → Navegando a: ${searchUrl}`)
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 })
      await this.delay(3000)

      console.log('  → Extrayendo trabajos de la página...')
      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('.job_seen_beacon, .jobsearch-SerpJobCard')
        const parsed: Array<{ title: string; url: string; company: string; location: string; salary: string }> = []

        jobElements.forEach((element) => {
          try {
            const titleEl = element.querySelector('h2 a, .jobTitle a')
            const title = titleEl?.textContent?.trim()
            const link = titleEl ? (titleEl as HTMLAnchorElement).href : null
            const companyEl = element.querySelector('.companyName, .company')
            const locationEl = element.querySelector('.companyLocation')
            const salaryEl = element.querySelector('.salary-snippet, .salaryText')

            if (title && link) {
              parsed.push({
                title,
                url: link.startsWith('http') ? link : `https://www.indeed.com${link}`,
                company: companyEl?.textContent?.trim() || 'Indeed Client',
                location: locationEl?.textContent?.trim() || 'Remote',
                salary: salaryEl?.textContent?.trim() || ''
              })
            }
          } catch (e) {
            // ignore
          }
        })

        return parsed
      })

      console.log(`  → Listings extraídos: ${listings.length}`)

      for (const job of listings.slice(0, 20)) {
        jobs.push({
          id: `indeed-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: job.location.toLowerCase().includes('remote'),
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: false,
          source: 'indeed',
          jobType: 'full-time',
          salary: this.parseUpworkRate(job.salary)
        })
      }
      
      console.log(`  ✅ Indeed: ${jobs.length} trabajos creados`)
    } catch (error) {
      console.error('❌ Error en scraping de Indeed:', error)
      if (error instanceof Error) {
        console.error('   Mensaje:', error.message)
        console.error('   Stack:', error.stack)
      }
    } finally {
      await browser.close()
    }

    return jobs
  }

  private async searchBraintrust(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    const searchUrl = 'https://app.usebraintrust.com/jobs?search=qa+engineer&location=remote'

    console.log('🔍 Buscando en Braintrust...')
    console.log(`  - Sesión autenticada: ${this.authSessions.braintrust?.isAuthenticated ? 'Sí' : 'No'}`)
    console.log(`  - Puppeteer disponible: ${puppeteer ? 'Sí' : 'No'}`)

    if (this.authSessions.braintrust?.isAuthenticated && puppeteer) {
      console.log('  → Usando scraping autenticado')
      return await this.searchBraintrustWithAuth(searchUrl, this.authSessions.braintrust)
    } else {
      console.log('  ⚠️ No se puede hacer scraping autenticado - retornando array vacío')
    }

    return jobs
  }

  private async searchBraintrustWithAuth(searchUrl: string, session?: AuthSession): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) {
      console.log('  ⚠️ Puppeteer no disponible')
      return jobs
    }

    console.log('  → Iniciando navegador para Braintrust...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()

      if (session?.cookies) {
        console.log(`  → Configurando ${session.cookies.length} cookies de sesión`)
        await page.setCookie(...session.cookies)
      } else {
        console.log('  ⚠️ No hay cookies de sesión disponibles')
      }

      await page.setUserAgent(session?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      console.log(`  → Navegando a: ${searchUrl}`)
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 })
      await this.delay(3000)

      console.log('  → Extrayendo trabajos de la página...')
      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('[data-testid="job-card"]')
        const parsed: Array<{ title: string; url: string; company: string; rate: string }> = []

        jobElements.forEach((element) => {
          try {
            const titleEl = element.querySelector('a[href*="/jobs/"]')
            const title = titleEl?.textContent?.trim()
            const link = titleEl ? (titleEl as HTMLAnchorElement).href : null
            const rateEl = element.querySelector('[data-testid="compensation-range"]')

            if (title && link) {
              parsed.push({
                title,
                url: link.startsWith('http') ? link : `https://app.usebraintrust.com${link}`,
                company: 'Braintrust',
                rate: rateEl?.textContent?.trim() || ''
              })
            }
          } catch (e) {
            // ignore
          }
        })

        return parsed
      })

      console.log(`  → Listings extraídos: ${listings.length}`)

      for (const job of listings.slice(0, 20)) {
        jobs.push({
          id: `braintrust-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: 'Remote',
          isRemote: true,
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: false,
          source: 'braintrust',
          jobType: 'contract',
          salary: this.parseUpworkRate(job.rate)
        })
      }
      
      console.log(`  ✅ Braintrust: ${jobs.length} trabajos creados`)
    } catch (error) {
      console.error('❌ Error en scraping de Braintrust:', error)
      if (error instanceof Error) {
        console.error('   Mensaje:', error.message)
        console.error('   Stack:', error.stack)
      }
    } finally {
      await browser.close()
    }

    return jobs
  }

  private async searchGlassdoor(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    const searchUrl = 'https://www.glassdoor.com/Job/remote-qa-engineer-jobs-SRCH_KO0,14_IP0.htm'

    console.log('🔍 Buscando en Glassdoor...')
    console.log(`  - Sesión autenticada: ${this.authSessions.glassdoor?.isAuthenticated ? 'Sí' : 'No'}`)
    console.log(`  - Puppeteer disponible: ${puppeteer ? 'Sí' : 'No'}`)

    if (this.authSessions.glassdoor?.isAuthenticated && puppeteer) {
      console.log('  → Usando scraping autenticado')
      return await this.searchGlassdoorWithAuth(searchUrl, this.authSessions.glassdoor)
    } else {
      console.log('  ⚠️ No se puede hacer scraping autenticado - retornando array vacío')
    }

    return jobs
  }

  private async searchGlassdoorWithAuth(searchUrl: string, session?: AuthSession): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) {
      console.log('  ⚠️ Puppeteer no disponible')
      return jobs
    }

    console.log('  → Iniciando navegador para Glassdoor...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()

      if (session?.cookies) {
        console.log(`  → Configurando ${session.cookies.length} cookies de sesión`)
        await page.setCookie(...session.cookies)
      } else {
        console.log('  ⚠️ No hay cookies de sesión disponibles')
      }

      await page.setUserAgent(session?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      console.log(`  → Navegando a: ${searchUrl}`)
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 })
      await this.delay(3000)

      console.log('  → Extrayendo trabajos de la página...')
      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('.react-job-listing, .jobContainer')
        const parsed: Array<{ title: string; url: string; company: string; location: string; salary: string }> = []

        jobElements.forEach((element) => {
          try {
            const titleEl = element.querySelector('a.jobLink, .jobTitle')
            const title = titleEl?.textContent?.trim()
            const link = titleEl ? (titleEl as HTMLAnchorElement).href : null
            const companyEl = element.querySelector('.employerName, .company')
            const locationEl = element.querySelector('.location, .loc')
            const salaryEl = element.querySelector('.salaryText, .salary')

            if (title && link) {
              parsed.push({
                title,
                url: link.startsWith('http') ? link : `https://www.glassdoor.com${link}`,
                company: companyEl?.textContent?.trim() || 'Glassdoor Client',
                location: locationEl?.textContent?.trim() || 'Remote',
                salary: salaryEl?.textContent?.trim() || ''
              })
            }
          } catch (e) {
            // ignore
          }
        })

        return parsed
      })

      console.log(`  → Listings extraídos: ${listings.length}`)

      for (const job of listings.slice(0, 20)) {
        jobs.push({
          id: `glassdoor-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: job.location.toLowerCase().includes('remote'),
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: false,
          source: 'glassdoor',
          jobType: 'full-time',
          salary: this.parseUpworkRate(job.salary)
        })
      }
      
      console.log(`  ✅ Glassdoor: ${jobs.length} trabajos creados`)
    } catch (error) {
      console.error('❌ Error en scraping de Glassdoor:', error)
      if (error instanceof Error) {
        console.error('   Mensaje:', error.message)
        console.error('   Stack:', error.stack)
      }
    } finally {
      await browser.close()
    }

    return jobs
  }

  private sanitizeText(text?: string): string {
    if (!text) return ''
    try {
      if (cheerio) {
        const $ = cheerio.load(text)
        return $.text().replace(/\s+/g, ' ').trim()
      }
    } catch (error) {
      console.error('Error sanitizing text with cheerio:', error)
    }
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  private extractRequirementsFromText(text?: string): string[] {
    if (!text) return []

    const cleaned = text.replace(/\r/g, '\n')
    const fragments = cleaned.split(/[\n•\-]/)
    const requirements: string[] = []

    for (const fragment of fragments) {
      const item = fragment.trim()
      if (!item || item.length < 10) continue

      if (
        /\d+\+?\s*(years?|yrs?|años?)/i.test(item) ||
        /\bexperience\b/i.test(item) ||
        /\brequired\b/i.test(item) ||
        /\bautomation\b/i.test(item) ||
        /\btesting\b/i.test(item)
      ) {
        requirements.push(item)
      }

      if (requirements.length >= 6) break
    }

    return requirements
  }

  private parseUpworkRate(rate: string): any {
    if (!rate) return undefined

    const hourlyMatch = rate.match(/\$?([\d,]+)\/hr/i)
    const rangeMatch = rate.match(/\$?([\d,]+)k?\s*-\s*\$?([\d,]+)k?/i)

    if (hourlyMatch) {
      return {
        min: parseInt(hourlyMatch[1].replace(/,/g, '')),
        currency: '$',
        period: 'hourly' as const,
        text: rate
      }
    }

    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1].replace(/,/g, '')) * (rangeMatch[1].toLowerCase().includes('k') ? 1000 : 1),
        max: parseInt(rangeMatch[2].replace(/,/g, '')) * (rangeMatch[2].toLowerCase().includes('k') ? 1000 : 1),
        currency: '$',
        period: 'yearly' as const,
        text: rate
      }
    }

    return { text: rate }
  }

  private parseFreelancerBudget(project: any): any {
    if (!project) return undefined

    const currencySign = project?.currency?.sign || '$'
    const budget = project?.budget || {}

    const min = typeof budget.minimum === 'number' ? budget.minimum : undefined
    const max = typeof budget.maximum === 'number' ? budget.maximum : undefined

    if (min || max) {
      const salary: any = {
        currency: currencySign,
        text: [min, max]
          .filter(v => typeof v === 'number')
          .map(v => `${currencySign}${(v as number).toLocaleString()}`)
          .join(' - ')
      }

      if (min !== undefined) salary.min = min
      if (max !== undefined) salary.max = max
      if (project.type === 'hourly') salary.period = 'hourly' as const

      return salary
    }

    return undefined
  }

  private async searchRemoteCo(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) return jobs

    const searchUrl = 'https://remote.co/remote-jobs/qa-engineer/'

    try {
      console.log('🔍 Buscando en Remote.co...')
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })
      await this.delay(2000)

      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('.job_listings article, .job-listing, .job-item')
        const parsed: Array<{ title: string; url: string; company: string; location: string }> = []

        jobElements.forEach((element) => {
          try {
            const titleEl = element.querySelector('h3 a, h2 a, .job-title a')
            const title = titleEl?.textContent?.trim()
            const link = titleEl ? (titleEl as HTMLAnchorElement).href : null
            const companyEl = element.querySelector('.company, .company-name')
            const locationEl = element.querySelector('.location, .job-location')

            if (title && link) {
              parsed.push({
                title,
                url: link.startsWith('http') ? link : `https://remote.co${link}`,
                company: companyEl?.textContent?.trim() || 'Remote Company',
                location: locationEl?.textContent?.trim() || 'Remote'
              })
            }
          } catch (e) {
            // ignore
          }
        })

        return parsed
      })

      for (const job of listings.slice(0, 15)) {
        jobs.push({
          id: `remoteco-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: true,
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: false,
          source: 'remoteco',
          jobType: 'full-time'
        })
      }

      await browser.close()
      console.log(`✅ Remote.co: ${jobs.length} trabajos encontrados`)
    } catch (error) {
      console.error('❌ Error en scraping de Remote.co:', error)
    }

    return jobs.filter(this.isQAJob)
  }

  private async searchWellfound(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) return jobs

    const searchUrl = 'https://wellfound.com/role/l/qa-engineer?remote=true'

    try {
      console.log('🔍 Buscando en Wellfound (AngelList)...')
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })
      await this.delay(3000)

      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('[data-test="JobCard"], .job-card, .job-listing')
        const parsed: Array<{ title: string; url: string; company: string; location: string }> = []

        jobElements.forEach((element) => {
          try {
            const titleEl = element.querySelector('a[href*="/jobs/"], .job-title a')
            const title = titleEl?.textContent?.trim()
            const link = titleEl ? (titleEl as HTMLAnchorElement).href : null
            const companyEl = element.querySelector('.company-name, [data-test="CompanyName"]')
            const locationEl = element.querySelector('.location, .job-location')

            if (title && link) {
              parsed.push({
                title,
                url: link.startsWith('http') ? link : `https://wellfound.com${link}`,
                company: companyEl?.textContent?.trim() || 'Startup',
                location: locationEl?.textContent?.trim() || 'Remote'
              })
            }
          } catch (e) {
            // ignore
          }
        })

        return parsed
      })

      for (const job of listings.slice(0, 15)) {
        jobs.push({
          id: `wellfound-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: true,
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: false,
          source: 'wellfound',
          jobType: 'full-time'
        })
      }

      await browser.close()
      console.log(`✅ Wellfound: ${jobs.length} trabajos encontrados`)
    } catch (error) {
      console.error('❌ Error en scraping de Wellfound:', error)
    }

    return jobs.filter(this.isQAJob)
  }

  private async searchStackOverflow(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!axios) return jobs

    try {
      console.log('🔍 Buscando en Stack Overflow Jobs...')
      // Stack Overflow Jobs API endpoint
      const searchUrl = 'https://stackoverflow.com/jobs/feed?q=qa+engineer&l=Remote&u=Km&d=20'

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      })

      if (response.data && cheerio) {
        const $ = cheerio.load(response.data, { xmlMode: true })
        const items = $('item')

        items.each((_idx: number, element: any) => {
          try {
            const title = $(element).find('title').text().trim()
            const link = $(element).find('link').text().trim()
            const company = $(element).find('a10\\:name, name').text().trim() || 'Company'
            const location = $(element).find('location').text().trim() || 'Remote'
            const description = $(element).find('description').text().trim() || ''

            if (title && link) {
              jobs.push({
                id: `stackoverflow-${Math.random().toString(36).substring(7)}`,
                title,
                company,
                location,
                isRemote: location.toLowerCase().includes('remote'),
                description,
                requirements: this.extractRequirementsFromText(description),
                skills: [],
                postedDate: new Date(),
                applicationUrl: link,
                easyApply: false,
                source: 'stackoverflow',
                jobType: 'full-time'
              })
            }
          } catch (e) {
            // ignore
          }
        })
      }

      console.log(`✅ Stack Overflow: ${jobs.length} trabajos encontrados`)
    } catch (error) {
      console.error('❌ Error en scraping de Stack Overflow:', error)
    }

    return jobs.filter(this.isQAJob).slice(0, 15)
  }

  private async searchRemoteCom(): Promise<LinkedInJob[]> {
    const jobs: LinkedInJob[] = []
    if (!puppeteer) return jobs

    const searchUrl = 'https://remote.com/jobs/qa-engineer'

    try {
      console.log('🔍 Buscando en Remote.com...')
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })
      await this.delay(3000)

      const listings = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('.job-card, .job-item, [data-job-id]')
        const parsed: Array<{ title: string; url: string; company: string; location: string }> = []

        jobElements.forEach((element) => {
          try {
            const titleEl = element.querySelector('h3 a, h2 a, .job-title a')
            const title = titleEl?.textContent?.trim()
            const link = titleEl ? (titleEl as HTMLAnchorElement).href : null
            const companyEl = element.querySelector('.company-name, .company')
            const locationEl = element.querySelector('.location, .job-location')

            if (title && link) {
              parsed.push({
                title,
                url: link.startsWith('http') ? link : `https://remote.com${link}`,
                company: companyEl?.textContent?.trim() || 'Remote Company',
                location: locationEl?.textContent?.trim() || 'Remote'
              })
            }
          } catch (e) {
            // ignore
          }
        })

        return parsed
      })

      for (const job of listings.slice(0, 15)) {
        jobs.push({
          id: `remotecom-${Math.random().toString(36).substring(7)}`,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: true,
          description: '',
          requirements: [],
          skills: [],
          postedDate: new Date(),
          applicationUrl: job.url,
          easyApply: false,
          source: 'remotecom',
          jobType: 'full-time'
        })
      }

      await browser.close()
      console.log(`✅ Remote.com: ${jobs.length} trabajos encontrados`)
    } catch (error) {
      console.error('❌ Error en scraping de Remote.com:', error)
    }

    return jobs.filter(this.isQAJob)
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

let scraperInstance: JobScraper | null = null

export function getAllJobsScraper(): JobScraper {
  if (!scraperInstance) {
    scraperInstance = new JobScraper()
  }
  return scraperInstance
}

