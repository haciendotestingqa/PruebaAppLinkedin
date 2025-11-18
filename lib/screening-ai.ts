import OpenAI from 'openai'
import { QAProfile, ScreeningQuestion } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

export async function generateScreeningAnswer(
  question: ScreeningQuestion,
  profile: QAProfile
): Promise<string> {
  const questionText = question.question
  const questionType = question.type
  
  // Build context about the profile
  const profileContext = `
    Professional Profile:
    - Total Experience: ${profile.totalExperience} years
    - Skills: ${profile.skills.map(s => `${s.name} (${s.years}y)`).join(', ')}
    - Availability: ${profile.availability}
    - Location: ${profile.location}
  `
  
  try {
    // Handle different question types
    if (questionType === 'yes_no') {
      return generateYesNoAnswer(questionText, profileContext)
    }
    
    if (questionType === 'experience_years') {
      return generateExperienceAnswer(questionText, profile)
    }
    
    if (questionType === 'multiple_choice' && question.options) {
      return generateMultipleChoiceAnswer(questionText, question.options, profileContext)
    }
    
    // Generic text answer
    return await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are helping a QA Engineer respond to job application screening questions. 
                   Be professional, concise, and highlight relevant experience. 
                   Keep answers brief (1-2 sentences for simple questions, max 3 for complex ones).`
        },
        {
          role: 'user',
          content: `${profileContext}\n\nQuestion: ${questionText}\n\nProvide a professional, concise answer:`
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    }).then(response => response.choices[0]?.message?.content || 'Yes')
    
  } catch (error) {
    console.error('Error generating screening answer:', error)
    return getFallbackAnswer(questionType)
  }
}

function generateYesNoAnswer(question: string, context: string): string {
  // Simple yes/no questions
  const lowerQuestion = question.toLowerCase()
  
  if (lowerQuestion.includes('authorized to work')) return 'Yes'
  if (lowerQuestion.includes('require sponsorship')) return 'No'
  if (lowerQuestion.includes('available to start')) return 'Yes, immediately'
  if (lowerQuestion.includes('relocate')) return 'No, remote only'
  
  return 'Yes'
}

function generateExperienceAnswer(question: string, profile: QAProfile): string {
  const lowerQuestion = question.toLowerCase()
  
  // Extract what skill/technology they're asking about
  const skillsMap: Record<string, number> = {}
  profile.skills.forEach(skill => {
    skillsMap[skill.name.toLowerCase()] = skill.years
  })
  
  // Try to match skill in question
  for (const [skillName, years] of Object.entries(skillsMap)) {
    if (lowerQuestion.includes(skillName)) {
      return `${years} years`
    }
  }
  
  // Default to total experience if no specific skill match
  return `${profile.totalExperience} years`
}

function generateMultipleChoiceAnswer(
  question: string, 
  options: string[], 
  context: string
): string {
  // For multiple choice, we need to intelligently select the best option
  // This would require more sophisticated logic or AI
  // For now, return first option or most relevant one
  
  const lowerOptions = options.map(opt => opt.toLowerCase())
  
  // Prefer "Yes" or positive options
  const positiveOptions = lowerOptions.filter(opt => 
    opt.includes('yes') || opt.includes('immediate') || opt.includes('available')
  )
  
  if (positiveOptions.length > 0) {
    const index = lowerOptions.indexOf(positiveOptions[0])
    return options[index]
  }
  
  // Return first option as fallback
  return options[0]
}

async function getFallbackAnswer(questionType: string): Promise<string> {
  const fallbacks: Record<string, string> = {
    'yes_no': 'Yes',
    'experience_years': '3+ years',
    'multiple_choice': 'Yes',
    'text': 'I have relevant experience in this area.'
  }
  
  return fallbacks[questionType] || 'Yes'
}

// Mock screening questions parser
export function parseScreeningQuestions(html: string): ScreeningQuestion[] {
  // This would parse LinkedIn's Easy Apply form
  // For now, return mock questions
  return [
    {
      id: '1',
      question: 'How many years of QA experience do you have?',
      type: 'experience_years',
      required: true
    },
    {
      id: '2',
      question: 'Are you authorized to work in the country?',
      type: 'yes_no',
      required: true
    },
    {
      id: '3',
      question: 'When can you start?',
      type: 'multiple_choice',
      required: true,
      options: ['Immediately', '2 weeks', '1 month', '2+ months']
    }
  ]
}


















