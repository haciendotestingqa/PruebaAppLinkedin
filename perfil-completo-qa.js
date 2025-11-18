// Perfil QA Completo con muchas skills y herramientas
// Copia este código en la consola del navegador (F12)

const profile = {
    id: 'profile-completo-qa',
    name: 'QA Engineer',
    email: 'qa@email.com',
    resume: 'QA Engineer con amplia experiencia en testing manual, automatización, API testing y metodologías ágiles.',
    
    skills: [
        // Testing Manual
        { name: 'Manual Testing', years: 4, level: 'advanced', category: 'testing' },
        { name: 'Test Case Design', years: 4, level: 'advanced', category: 'testing' },
        { name: 'Bug Reporting', years: 4, level: 'advanced', category: 'testing' },
        { name: 'Regression Testing', years: 3, level: 'intermediate', category: 'testing' },
        { name: 'Smoke Testing', years: 3, level: 'intermediate', category: 'testing' },
        { name: 'Integration Testing', years: 3, level: 'intermediate', category: 'testing' },
        
        // Automation Testing
        { name: 'Selenium', years: 3, level: 'intermediate', category: 'automation' },
        { name: 'Selenium WebDriver', years: 3, level: 'intermediate', category: 'automation' },
        { name: 'Cypress', years: 2, level: 'intermediate', category: 'automation' },
        { name: 'Playwright', years: 1, level: 'beginner', category: 'automation' },
        { name: 'Test Automation', years: 3, level: 'intermediate', category: 'automation' },
        { name: 'Page Object Model', years: 2, level: 'intermediate', category: 'automation' },
        
        // API Testing
        { name: 'API Testing', years: 3, level: 'intermediate', category: 'testing' },
        { name: 'Postman', years: 3, level: 'intermediate', category: 'tools' },
        { name: 'REST', years: 3, level: 'intermediate', category: 'tools' },
        { name: 'REST API', years: 3, level: 'intermediate', category: 'tools' },
        { name: 'SoapUI', years: 2, level: 'beginner', category: 'tools' },
        { name: 'GraphQL', years: 1, level: 'beginner', category: 'tools' },
        
        // Programming Languages
        { name: 'Python', years: 3, level: 'intermediate', category: 'programming' },
        { name: 'JavaScript', years: 2, level: 'intermediate', category: 'programming' },
        { name: 'TypeScript', years: 1, level: 'beginner', category: 'programming' },
        { name: 'Java', years: 2, level: 'beginner', category: 'programming' },
        
        // Testing Frameworks
        { name: 'Jest', years: 2, level: 'intermediate', category: 'testing' },
        { name: 'Mocha', years: 1, level: 'beginner', category: 'testing' },
        { name: 'Pytest', years: 2, level: 'intermediate', category: 'testing' },
        { name: 'TestNG', years: 1, level: 'beginner', category: 'testing' },
        { name: 'JUnit', years: 1, level: 'beginner', category: 'testing' },
        
        // Databases
        { name: 'SQL', years: 3, level: 'intermediate', category: 'tools' },
        { name: 'MySQL', years: 2, level: 'intermediate', category: 'tools' },
        { name: 'PostgreSQL', years: 1, level: 'beginner', category: 'tools' },
        { name: 'MongoDB', years: 1, level: 'beginner', category: 'tools' },
        
        // CI/CD & DevOps
        { name: 'Jenkins', years: 2, level: 'intermediate', category: 'tools' },
        { name: 'Git', years: 3, level: 'intermediate', category: 'tools' },
        { name: 'GitHub', years: 3, level: 'intermediate', category: 'tools' },
        { name: 'GitLab', years: 2, level: 'intermediate', category: 'tools' },
        { name: 'CI/CD', years: 2, level: 'intermediate', category: 'methodology' },
        { name: 'DevOps', years: 2, level: 'intermediate', category: 'methodology' },
        { name: 'Docker', years: 1, level: 'beginner', category: 'tools' },
        
        // Project Management & Methodology
        { name: 'Agile', years: 4, level: 'advanced', category: 'methodology' },
        { name: 'Scrum', years: 4, level: 'advanced', category: 'methodology' },
        { name: 'Kanban', years: 2, level: 'intermediate', category: 'methodology' },
        { name: 'BDD', years: 2, level: 'intermediate', category: 'methodology' },
        { name: 'TDD', years: 1, level: 'beginner', category: 'methodology' },
        
        // Tools & Platforms
        { name: 'Jira', years: 4, level: 'advanced', category: 'tools' },
        { name: 'TestRail', years: 2, level: 'intermediate', category: 'tools' },
        { name: 'Confluence', years: 2, level: 'intermediate', category: 'tools' },
        { name: 'Azure DevOps', years: 1, level: 'beginner', category: 'tools' },
        { name: 'Trello', years: 2, level: 'intermediate', category: 'tools' },
        
        // Cloud & Performance
        { name: 'AWS', years: 1, level: 'beginner', category: 'tools' },
        { name: 'Performance Testing', years: 2, level: 'beginner', category: 'testing' },
        { name: 'Load Testing', years: 1, level: 'beginner', category: 'testing' },
        { name: 'JMeter', years: 1, level: 'beginner', category: 'tools' },
        
        // Mobile Testing
        { name: 'Mobile Testing', years: 2, level: 'beginner', category: 'testing' },
        { name: 'Appium', years: 1, level: 'beginner', category: 'automation' },
        
        // Web Technologies
        { name: 'HTML', years: 2, level: 'intermediate', category: 'programming' },
        { name: 'CSS', years: 2, level: 'intermediate', category: 'programming' },
        { name: 'Web Testing', years: 3, level: 'intermediate', category: 'testing' }
    ],
    
    totalExperience: 4,
    availability: 'immediate',
    location: 'Venezuela / Latin America',
    preferredLocations: ['Remote', 'Venezuela', 'Latin America', 'Colombia', 'Argentina', 'Chile', 'Mexico'],
    
    createdAt: new Date(),
    updatedAt: new Date()
};

// Guardar en localStorage
localStorage.setItem('qa_profile', JSON.stringify(profile));

// Verificar que se guardó
const saved = localStorage.getItem('qa_profile');
if (saved) {
    alert('✅ Perfil QA completo creado exitosamente!\n\n' + 
          '• ' + profile.skills.length + ' habilidades añadidas\n' +
          '• Nivel: Avanzado\n' +
          '• Ahora recarga la página y busca trabajos!');
} else {
    alert('❌ Error al guardar el perfil');
}


















