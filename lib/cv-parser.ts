// Dynamic imports to handle server-side only modules
let pdfParse: any
let mammoth: any

if (typeof window === 'undefined') {
  // Server-side only
  const pdfParseModule = require('pdf-parse')
  const mammothModule = require('mammoth')
  pdfParse = pdfParseModule.default || pdfParseModule
  mammoth = mammothModule.default || mammothModule
}

export interface ParsedCV {
  text: string
  name: string
  email: string
  phone?: string
  skills: string[]
  experience: string[]
  education: string[]
}

const QA_SKILLS_KEYWORDS = [
  // Testing Frameworks & Tools
  'Selenium', 'Cypress', 'Playwright', 'Jest', 'Mocha', 'Chai', 'Jasmine',
  'TestNG', 'JUnit', 'Pytest', 'PyTest', 'Robot Framework', 'Appium',
  'WebDriver', 'WebDriverIO', 'Nightwatch', 'Protractor',
  
  // Test Types
  'Manual Testing', 'Automation Testing', 'Automated Testing', 'API Testing', 
  'Performance Testing', 'Security Testing', 'Integration Testing', 
  'Regression Testing', 'Smoke Testing', 'UAT', 'User Acceptance Testing',
  'Functional Testing', 'Non-functional Testing', 'Black Box Testing',
  'White Box Testing', 'End-to-End Testing', 'E2E Testing',
  
  // Programming Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Ruby', 'Go', 'PHP',
  'C++', 'C', 'CSharp', 'VB.NET',
  
  // QA Tools
  'Postman', 'SoapUI', 'JMeter', 'LoadRunner', 'Katalon', 'TestRail', 'Jira',
  'Confluence', 'Bugzilla', 'Trello', 'Azure DevOps', 'GitHub', 'GitLab',
  'Bitbucket', 'Bug Tracking', 'Test Management', 'Mantis', 'Zephyr',
  
  // CI/CD
  'Jenkins', 'GitHub Actions', 'CircleCI', 'Travis CI', 'GitLab CI', 
  'Azure Pipelines', 'Bamboo', 'TeamCity', 'CodePipeline',
  
  // Methodologies
  'Agile', 'Scrum', 'Kanban', 'BDD', 'TDD', 'CI/CD', 'DevOps',
  'Waterfall', 'SAFe', 'Lean', 'Extreme Programming', 'XP',
  
  // Databases
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Oracle', 'SQL Server',
  'SQLite', 'Redis', 'Cassandra', 'DynamoDB', 'NoSQL',
  
  // Cloud & Infrastructure
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes',
  'Terraform', 'Ansible', 'Vagrant',
  
  // API & Web Services
  'REST', 'GraphQL', 'SOAP', 'Web Services', 'Microservices',
  'RESTful API', 'REST API', 'JSON', 'XML', 'HTTP', 'HTTPS',
  
  // Version Control
  'Git', 'SVN', 'Mercurial', 'Perforce',
  
  // Web Technologies
  'HTML', 'CSS', 'XPath', 'CSS Selectors', 'DOM',
  
  // Mobile Testing
  'Mobile Testing', 'iOS Testing', 'Android Testing', 'React Native',
  'Flutter', 'Xamarin',
  
  // Performance & Load
  'Performance Testing', 'Load Testing', 'Stress Testing', 'Volume Testing',
  'Spike Testing', 'Endurance Testing', 'Scalability Testing',
  
  // Security
  'Security Testing', 'Penetration Testing', 'Vulnerability Testing',
  'OWASP', 'Burp Suite',
  
  // Specific Apps & Tools
  'Visual Studio', 'IntelliJ', 'Eclipse', 'PyCharm', 'VS Code',
  'Fiddler', 'Charles Proxy', 'Browser DevTools', 'Developer Tools',
  
  // Test Design
  'Test Case', 'Test Plan', 'Test Strategy', 'Test Design',
  'Equivalence Partitioning', 'Boundary Value Analysis', 'State Transition',
  // Reporting & Documentation
  'Test Report', 'Bug Report', 'Defect Report', 'Test Documentation',

];

const SKILL_NORMALIZATION_MAP: Record<string, string> = {
  'javascrypt': 'JavaScript',
  'javascript': 'JavaScript',
  'vs code': 'VS Code',
  'vscode': 'VS Code',
  'cursor': 'Cursor',
  'meet': 'Google Meet',
  'google meet': 'Google Meet',
  'monday': 'Monday.com',
  'monday.com': 'Monday.com',
  'flowchart': 'Flowchart',
  'flow chart': 'Flowchart',
  'xray': 'XRay',
  'github': 'GitHub',
  'git hub': 'GitHub',
  'firebase': 'Firebase',
  'postgresql': 'PostgreSQL',
  'mariadb': 'MariaDB',
  'mysql': 'MySQL',
  'bruno': 'Bruno',
  'newman': 'Newman',
  'postman': 'Postman',
  'maestro': 'Maestro',
  'playwright': 'Playwright',
  'proxmox': 'Proxmox',
  'android studio': 'Android Studio',
  'aws device farm': 'AWS Device Farm',
  'n8n': 'n8n',
  'deepseek': 'DeepSeek',
  'chatgpt': 'ChatGPT',
  'gemini': 'Gemini',
  'notebooklm': 'NotebookLM',
  'discord': 'Discord',
  'slack': 'Slack',
  'hubstaff': 'Hubstaff',
  'notion': 'Notion',
  'jira': 'Jira',
  'confluence': 'Confluence',
  'freshdesk': 'Freshdesk',
  'figma': 'Figma',
  'mcp agents': 'MCP Agents'
}

const SKILL_STOP_WORDS = new Set<string>([
  'management',
  'knowledge',
  'tools',
  'tool',
  'platform',
  'platforms',
  'software',
  'configuration',
  'improvements',
  'experience',
  'project',
  'projects',
  'communication',
  'reporting',
  'tracking',
  'bugs',
  'free',
  'database',
  'databases',
  'testing',
  'automation',
  'agents',
  'and',
  'ide',
  'ides',
  'languages'
])

function toTitleCaseWord(word: string): string {
  if (!word) return word
  if (/^[a-z]{1,3}$/.test(word)) {
    return word.toUpperCase()
  }
  if (/^[A-Z0-9\-.]+$/.test(word)) {
    return word
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function normalizeSkillName(raw: string): string | null {
  if (!raw) return null

  let cleaned = raw
    .replace(/[••·]/g, ' ')
    .replace(/^[\s.\-_/()0-9]+/, '')
    .replace(/[:;.,\s]+$/, '')
    .trim()

  if (!cleaned) {
    return null
  }

  const lower = cleaned.toLowerCase()
  if (SKILL_STOP_WORDS.has(lower)) {
    return null
  }

  if (SKILL_NORMALIZATION_MAP[lower]) {
    return SKILL_NORMALIZATION_MAP[lower]
  }

  const words = cleaned.split(/\s+/).map(word => {
    const normalizedWord = SKILL_NORMALIZATION_MAP[word.toLowerCase()]
    if (normalizedWord) {
      return normalizedWord
    }
    if (/^[a-z]{1,3}$/.test(word)) {
      return word.toUpperCase()
    }
    if (/^[A-Z0-9\-.]+$/.test(word)) {
      return word
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })

  const normalized = words.join(' ').trim()
  if (!normalized || normalized.length < 2) {
    return null
  }

  if (SKILL_STOP_WORDS.has(normalized.toLowerCase())) {
    return null
  }

  return normalized
}


export async function parsePDF(buffer: Buffer): Promise<ParsedCV> {
  const data = await pdfParse(buffer)
  return parseText(data.text)
}

export async function parseDOCX(buffer: Buffer): Promise<ParsedCV> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return parseText(result.value)
}

function parseText(text: string): ParsedCV {
  const lines = text.split('\n').filter(line => line.trim())
  
  const parsed: ParsedCV = {
    text: text,
    name: extractName(lines),
    email: extractEmail(text),
    phone: extractPhone(text),
    skills: extractSkills(text),
    experience: extractExperience(text),
    education: extractEducation(text),
  }
  
  return parsed
}

function extractName(lines: string[]): string {
  // Typically the first 1-2 lines contain the name
  if (lines.length > 0) {
    const firstLine = lines[0].trim()
    if (!firstLine.includes('@') && !firstLine.match(/^\d/)) {
      return firstLine
    }
  }
  return 'Not specified'
}

function extractEmail(text: string): string {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = text.match(emailRegex)
  return emails ? emails[0] : 'Not specified'
}

function extractPhone(text: string): string | undefined {
  const phoneRegex = /[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}/g
  const phones = text.match(phoneRegex)
  return phones ? phones[0] : undefined
}

function extractSkills(text: string): string[] {
  const foundSkills: Set<string> = new Set()
  const lowerText = text.toLowerCase()

  const addSkill = (value: string) => {
    const normalized = normalizeSkillName(value)
    if (normalized) {
      foundSkills.add(normalized)
    }
  }

  QA_SKILLS_KEYWORDS.forEach(skill => {
    const skillLower = skill.toLowerCase()
    if (lowerText.includes(skillLower)) {
      addSkill(skill)
    }
  })

  const skillPatterns = [
    /\b(java|python|javascript|typescript|c\+\+|c#|ruby|go|php)\b/gi,
    /\b(selenium|cypress|playwright|jest|mocha|maestro)\b/gi,
    /\b(api|rest|graphql|soap)\b/gi,
    /\b(sql|mysql|postgresql|mariadb|mongodb|oracle)\b/gi,
    /\b(agile|scrum|kanban|devops|ci\/cd)\b/gi,
    /\b(git|github|gitlab|jenkins|docker|firebase)\b/gi,
    /\b(testing|automation|qa|quality)\b/gi,
    /\b(postman|jira|testrail|confluence|newman|bruno|dbeaver)\b/gi,
    /\b(discord|slack|notion|figma|proxmox|n8n)\b/gi,
  ]

  skillPatterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(match => addSkill(match))
    }
  })

  const parenthesesPattern = /\(([^)]+)\)/g
  let parenthesesMatch: RegExpExecArray | null
  while ((parenthesesMatch = parenthesesPattern.exec(text)) !== null) {
    const inside = parenthesesMatch[1].replace(/\band\b/gi, ',')
    inside.split(/[,;\n\t\/]+/).forEach(token => addSkill(token))
  }

  const experiencePattern = /(\d+)\s*\+?\s*years?\s*(?:of\s*)?experience\s*(?:with|in|using)?\s*([A-Za-z\s,\/-]+)/gi
  let match: RegExpExecArray | null
  while ((match = experiencePattern.exec(text)) !== null) {
    const technologies = match[2]
      .split(/[,-\/]+/)
      .map(t => t.trim())
      .filter(Boolean)

    technologies.forEach(tech => addSkill(tech))
  }

  return Array.from(foundSkills)
}


function extractExperience(text: string): string[] {
  const experience: string[] = []
  
  // Look for common section headers
  const expKeywords = ['experience', 'work experience', 'employment', 'professional experience']
  
  const lines = text.split('\n')
  let inExperienceSection = false
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim()
    
    // Check if we're entering experience section
    if (expKeywords.some(keyword => lowerLine.includes(keyword))) {
      inExperienceSection = true
      continue
    }
    
    // Stop if we hit another major section
    if (inExperienceSection && (
      lowerLine.includes('education') ||
      lowerLine.includes('skills') ||
      lowerLine.includes('certifications')
    )) {
      break
    }
    
    if (inExperienceSection && line.trim()) {
      experience.push(line.trim())
    }
  }
  
  return experience
}

function extractEducation(text: string): string[] {
  const education: string[] = []
  
  const lines = text.split('\n')
  let inEducationSection = false
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim()
    
    if (lowerLine.includes('education')) {
      inEducationSection = true
      continue
    }
    
    if (inEducationSection && (
      lowerLine.includes('skills') ||
      lowerLine.includes('certifications') ||
      lowerLine.includes('experience')
    )) {
      break
    }
    
    if (inEducationSection && line.trim()) {
      education.push(line.trim())
    }
  }
  
  return education
}

