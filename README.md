# LinkedIn QA Automation Platform

A comprehensive web application for automating QA job applications on LinkedIn. This platform helps QA Engineers efficiently search, match, and apply to relevant remote job opportunities.

## Features

### 🎯 Core Functionality

- **CV Parsing**: Automatically extract skills and experience from PDF/DOCX CVs
- **LinkedIn Scraping**: Extract real job listings directly from LinkedIn (⚠️ educational use only)
- **Job Matching**: Intelligent matching algorithm based on skills, location, and requirements
- **Automated Applications**: Apply to up to 25 jobs per day with rate limiting
- **Screening Answers**: AI-powered automatic responses to screening questions
- **Analytics Dashboard**: Track applications, interviews, and success rates

### 📊 Dashboard

- Real-time metrics and statistics
- Automation control with configurable limits
- Job search with filtering
- Application history tracking

### 🤖 Automation

- Daily application limits (configurable)
- Rate limiting to avoid LinkedIn blocks
- Queue system for distributed applications
- Smart matching to avoid low-quality applications

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Modern styling
- **shadcn/ui** - Component library
- **Lucide React** - Icons

### Backend
- **Next.js API Routes** - Serverless API
- **OpenAI API** - AI screening responses
- **LocalStorage** - Data persistence (can be upgraded to database)

### Libraries
- `pdf-parse` - PDF CV parsing
- `mammoth` - DOCX CV parsing
- `openai` - AI question answering
- `recharts` - Data visualization
- `cheerio` - HTML parsing for web scraping
- `axios` - HTTP requests

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. **Upload CV**: Go to Profile tab and upload your CV (PDF or DOCX)
2. **Review Profile**: Check and edit extracted information
3. **Search Jobs**: Use the Job Search tab to find matching positions
4. **Enable Automation**: Turn on automation in Dashboard to apply automatically
5. **Track Progress**: Monitor metrics and application status

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main dashboard page
│   └── globals.css       # Global styles
├── components/
│   ├── dashboard/        # Dashboard components
│   ├── forms/            # Form components
│   └── ui/               # Reusable UI components
├── lib/
│   ├── cv-parser.ts      # CV parsing logic
│   ├── job-matcher.ts    # Job matching algorithm
│   ├── screening-ai.ts   # AI question answering
│   └── storage.ts        # Data storage layer
├── types/
│   └── index.ts          # TypeScript types
└── public/               # Static assets
```

## Key Features Explained

### CV Parsing
Extracts key information from resumes:
- Personal details (name, email, phone)
- Skills (QA frameworks, tools, languages)
- Work experience timeline
- Education background

### Job Matching
Scoring algorithm considers:
- **Remote availability** (30 points)
- **Skill match** (40 points)
- **QA relevance** (20 points)
- **Experience level** (10 points)

### Automation
- Respects LinkedIn rate limits
- Applies only to high-match jobs (60%+ score)
- Distributes applications throughout the day
- Automatic resume submission

### AI Screening
Answers common questions:
- Years of experience in specific technologies
- Authorization to work
- Availability to start
- Job-specific requirements

## Future Enhancements

- [ ] LinkedIn API integration (official)
- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] Email notifications
- [ ] Advanced filtering options
- [ ] Cover letter generation
- [ ] Interview prep resources
- [ ] Calendar integration

## Important Notes

⚠️ **LinkedIn Scraping**: The web scraping functionality is for **educational purposes only**. LinkedIn does not officially allow scraping. See `LINKEDIN_SCRAPING.md` for details and risks. For production, use LinkedIn's official API or third-party services.

⚠️ **LinkedIn Terms of Service**: This application is for educational purposes. Be mindful of LinkedIn's terms when using automation features.

⚠️ **Fallback to Mock Data**: By default, the system uses mock job data to avoid legal issues. LinkedIn scraping can be enabled but is not recommended for production.

⚠️ **Privacy**: Your CV and personal information are stored in localStorage. Consider upgrading to a secure database for production use.

## Contributing

This is a personal project for job automation. Feel free to fork and adapt for your own use.

## License

MIT License - feel free to use this project for your job search.

## Support

For issues or questions, please check the codebase comments or create an issue in the repository.

