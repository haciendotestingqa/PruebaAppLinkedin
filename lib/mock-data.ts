import { LinkedInJob } from '@/types'

export const mockJobs: LinkedInJob[] = [
  {
    id: 'job-1',
    title: 'Senior QA Engineer - Automation',
    company: 'TechCorp Inc.',
    companyLogo: undefined,
    location: 'Remote - Americas',
    isRemote: true,
    description: 'We are looking for an experienced QA Engineer with expertise in test automation, API testing, and CI/CD integration.',
    requirements: [
      '5+ years of QA experience',
      'Strong knowledge of Selenium and Cypress',
      'Experience with API testing (Postman/REST)',
      'Knowledge of CI/CD pipelines',
      'Agile/Scrum experience'
    ],
    skills: ['Selenium', 'Cypress', 'API Testing', 'Python', 'Jenkins', 'Agile'],
    postedDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    applicationUrl: 'https://linkedin.com/jobs/view/123',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-2',
    title: 'QA Automation Engineer',
    company: 'StartupXYZ',
    companyLogo: undefined,
    location: 'Remote - Latin America',
    isRemote: true,
    description: 'Join our growing QA team to build and maintain automated test frameworks. Remote position with flexible hours.',
    requirements: [
      '3+ years of automation testing experience',
      'Proficiency in JavaScript/TypeScript',
      'Experience with Playwright or Cypress',
      'Understanding of web technologies',
      'Good communication skills'
    ],
    skills: ['JavaScript', 'TypeScript', 'Playwright', 'Cypress', 'Git'],
    postedDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/456',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-3',
    title: 'QA Test Engineer',
    company: 'GlobalSolutions',
    companyLogo: undefined,
    location: 'Venezuela / Remote',
    isRemote: true,
    description: 'Looking for a QA Engineer to join our distributed team. Must have experience in manual and automated testing.',
    requirements: [
      '2+ years QA experience',
      'Knowledge of testing methodologies',
      'Experience with test management tools',
      'Good analytical skills',
      'Fluent in English'
    ],
    skills: ['Manual Testing', 'Automation Testing', 'TestRail', 'Jira', 'SQL'],
    postedDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/789',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-4',
    title: 'Automation QA Lead',
    company: 'BigTech Corp',
    companyLogo: undefined,
    location: 'Remote - Anywhere in Americas',
    isRemote: true,
    description: 'Lead our QA automation efforts. Responsible for building robust test frameworks and mentoring junior engineers.',
    requirements: [
      '7+ years of QA experience',
      'Strong leadership skills',
      'Experience with Selenium, Cypress, or Playwright',
      'Experience with CI/CD tools',
      'Experience with cloud platforms (AWS/Azure)'
    ],
    skills: ['Selenium', 'Cypress', 'Playwright', 'Jenkins', 'AWS', 'Leadership'],
    postedDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
    applicationUrl: 'https://linkedin.com/jobs/view/101',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-5',
    title: 'QA Engineer - API & Performance Testing',
    company: 'API Masters',
    companyLogo: undefined,
    location: 'Remote - Worldwide',
    isRemote: true,
    description: 'Specialize in API testing and performance testing. Work with cutting-edge tools and technologies.',
    requirements: [
      '4+ years QA experience',
      'Strong API testing experience',
      'Experience with performance testing tools (JMeter, LoadRunner)',
      'Knowledge of REST and GraphQL',
      'Understanding of microservices architecture'
    ],
    skills: ['API Testing', 'JMeter', 'Postman', 'REST', 'GraphQL', 'Performance Testing'],
    postedDate: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/202',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-6',
    title: 'QA Engineer',
    company: 'CloudSoft',
    companyLogo: undefined,
    location: 'Hybrid - Caracas, Venezuela',
    isRemote: false,
    description: 'QA position in Caracas with some remote work options. Perfect for local candidates.',
    requirements: [
      '3+ years QA experience',
      'Manual and automation testing',
      'Experience with Agile methodologies',
      'Located in or near Caracas',
      'Good English and Spanish'
    ],
    skills: ['Manual Testing', 'Automation', 'Agile', 'Scrum', 'Spanish'],
    postedDate: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/303',
    easyApply: false,
    source: 'linkedin' as const
  },
  {
    id: 'job-7',
    title: 'Senior Test Automation Engineer',
    company: 'DevOps Pro',
    companyLogo: undefined,
    location: 'Remote - Latin America',
    isRemote: true,
    description: 'Senior QA role focusing on test automation infrastructure and CI/CD integration.',
    requirements: [
      '6+ years of experience',
      'Expertise in Python or Java',
      'Experience with Docker and Kubernetes',
      'Strong understanding of DevOps practices',
      'Experience with cloud platforms'
    ],
    skills: ['Python', 'Java', 'Docker', 'Kubernetes', 'DevOps', 'CI/CD', 'Selenium'],
    postedDate: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/404',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-8',
    title: 'QA Specialist - Mobile Testing',
    company: 'MobileFirst',
    companyLogo: undefined,
    location: 'Remote - Americas',
    isRemote: true,
    description: 'Specialized role for mobile application testing. Experience with iOS and Android required.',
    requirements: [
      '4+ years mobile QA experience',
      'Experience with Appium or similar',
      'Knowledge of iOS and Android platforms',
      'Understanding of mobile performance',
      'Creative problem-solving skills'
    ],
    skills: ['Mobile Testing', 'Appium', 'iOS', 'Android', 'Manual Testing', 'Automation'],
    postedDate: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/505',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-9',
    title: 'QA Engineer - E-commerce',
    company: 'ShopGlobal',
    companyLogo: undefined,
    location: 'Remote - Worldwide',
    isRemote: true,
    description: 'QA Engineer for e-commerce platform. Experience with payment systems and checkout flows required.',
    requirements: [
      '3+ years e-commerce QA experience',
      'Understanding of payment systems',
      'Experience with web and mobile testing',
      'Knowledge of SQL for database testing',
      'Attention to detail'
    ],
    skills: ['E-commerce', 'Payment Systems', 'Web Testing', 'SQL', 'Manual Testing', 'API Testing'],
    postedDate: new Date(Date.now() - 14 * 60 * 60 * 1000), // 14 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/606',
    easyApply: true,
    source: 'linkedin' as const
  },
  {
    id: 'job-10',
    title: 'QA Automation Engineer',
    company: 'FinTech Solutions',
    companyLogo: undefined,
    location: 'Remote - LATAM',
    isRemote: true,
    description: 'QA Engineer for financial technology platform. Security and compliance knowledge important.',
    requirements: [
      '5+ years QA experience',
      'Experience with financial systems',
      'Strong automation skills',
      'Understanding of security testing',
      'Attention to compliance requirements'
    ],
    skills: ['Selenium', 'API Testing', 'Security Testing', 'Python', 'Financial Systems', 'Agile'],
    postedDate: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 hours ago
    applicationUrl: 'https://linkedin.com/jobs/view/707',
    easyApply: true,
    source: 'linkedin' as const
  }
]











