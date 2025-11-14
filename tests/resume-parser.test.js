/**
 * Unit tests for Resume Parser
 * Tests pattern matching, process of elimination, and edge cases
 */

const {
  parseDemographics,
  parseEducation,
  parseEmployment,
  parseProjects,
  parseSkills,
  parseReferences,
  parseResumeSection,
  DEFAULT_PARSER_CONFIG
} = require('../resume-parser');

describe('Resume Parser', () => {
  describe('parseDemographics', () => {
    test('should extract all fields from standard pipe-delimited format', () => {
      const input = `Patrick Conan
Rochester, New York | (845)-645-8158 | conap910@gmail.com
linkedin.com/in/patrick-conan — github.com/c0nap
Objective: Recent graduate seeking full-time software developer role building scalable, data-driven systems.
Available Winter 2025 (December 31st)`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Patrick Conan');
      expect(result.address).toBe('Rochester, New York');
      expect(result.phone).toBe('(845)-645-8158');
      expect(result.email).toBe('conap910@gmail.com');
      expect(result.linkedin).toBe('linkedin.com/in/patrick-conan');
      expect(result.github).toBe('github.com/c0nap');
      expect(result.objective).toBe('Recent graduate seeking full-time software developer role building scalable, data-driven systems.');
      expect(result.available).toBe('Available Winter 2025 (December 31st)');
    });

    test('should extract fields from unlabeled compact format (lazy user)', () => {
      const input = `John Smith
Austin, TX 512-555-9876 john.doe@gmail.com linkedin.com/in/johndoe`;

      const result = parseDemographics(input);

      expect(result.name).toBe('John Smith');
      expect(result.address).toBe('Austin, TX');
      expect(result.phone).toBe('512-555-9876');
      expect(result.email).toBe('john.doe@gmail.com');
      expect(result.linkedin).toBe('linkedin.com/in/johndoe');
    });

    test('should extract fields from messy multi-line format with no delimiters (lazy user)', () => {
      const input = `Maria Rodriguez
1234 Oak Avenue
Boston, Massachusetts 02101
617-555-4321
maria.r@company.com
www.mariarodriguez.com`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Maria Rodriguez');
      expect(result.address).toMatch(/Boston, Massachusetts/);
      expect(result.phone).toBe('617-555-4321');
      expect(result.email).toBe('maria.r@company.com');
      expect(result.website).toBe('www.mariarodriguez.com');
    });

    test('should handle name with professional suffix', () => {
      const input = `Sarah Chen, Ph.D.
(415) 555-1234
sarah.chen@email.com`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Sarah Chen, Ph.D.');
      expect(result.phone).toBe('(415) 555-1234');
      expect(result.email).toBe('sarah.chen@email.com');
    });

    test('should skip job titles and extract name correctly', () => {
      const input = `Senior Software Engineer
Alice Johnson
Seattle, WA | alice@example.com`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Alice Johnson');
      expect(result.address).toBe('Seattle, WA');
      expect(result.email).toBe('alice@example.com');
    });

    test('should extract from slash-delimited format (lazy user)', () => {
      const input = `Robert Chen / Austin, TX / 512-555-9999 / robert@email.com`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Robert Chen');
      expect(result.address).toBe('Austin, TX');
      expect(result.phone).toBe('512-555-9999');
      expect(result.email).toBe('robert@email.com');
    });

    test('should handle labeled format with colons', () => {
      const input = `Name: David Kim
Phone: (650) 555-7890
Email: david.kim@company.com
LinkedIn: linkedin.com/in/davidkim`;

      const result = parseDemographics(input);

      expect(result.name).toBe('David Kim');
      expect(result.phone).toBe('(650) 555-7890');
      expect(result.email).toBe('david.kim@company.com');
      expect(result.linkedin).toBe('linkedin.com/in/davidkim');
    });

    test('should differentiate website from social profiles', () => {
      const input = `Jane Doe
jane@example.com
linkedin.com/in/janedoe
github.com/janedoe
https://janedoe.dev`;

      const result = parseDemographics(input);

      expect(result.email).toBe('jane@example.com');
      expect(result.linkedin).toBe('linkedin.com/in/janedoe');
      expect(result.github).toBe('github.com/janedoe');
      expect(result.website).toBe('https://janedoe.dev');
    });

    test('should extract full URLs with https', () => {
      const input = `Michael Scott
https://www.linkedin.com/in/michaelscott
https://github.com/mscott
michael@dundermifflin.com`;

      const result = parseDemographics(input);

      expect(result.linkedin).toBe('https://www.linkedin.com/in/michaelscott');
      expect(result.github).toBe('https://github.com/mscott');
      expect(result.email).toBe('michael@dundermifflin.com');
    });

    test('should handle minimal information (lazy user - just name and email)', () => {
      const input = `Emily Williams
emily.williams@email.com`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Emily Williams');
      expect(result.email).toBe('emily.williams@email.com');
      expect(result.phone).toBe('');
      expect(result.address).toBe('');
    });
  });

  describe('parseEducation', () => {
    test('should parse education with GPA and coursework', () => {
      const input = `SUNY College at Oneonta B.S. Statistics – 2024 (summa cum laude) GPA – 3.97
Coursework: Theory of Computation, Linear Algebra, Data Analytics (R), Econometrics, Operations Research`;

      const result = parseEducation(input);

      expect(result.current.institution).toContain('SUNY College at Oneonta');
      expect(result.current.degree).toContain('B.S.');
      expect(result.current.year).toBe('2024');
      expect(result.current.gpa).toBe('3.97');
      expect(result.current.coursework).toContain('Theory of Computation');
      expect(result.current.honors).toMatch(/summa cum laude/i);
    });

    test('should parse multiple degrees', () => {
      const input = `Master of Science in Computer Science
Stanford University, Stanford, CA | 2022 - 2024 | GPA: 3.95/4.0

Bachelor of Science in Computer Engineering
UC Berkeley | 2018 - 2022 | GPA: 3.87`;

      const result = parseEducation(input);

      expect(result.education_1.degree).toContain('Master');
      expect(result.education_1.institution).toContain('Stanford');
      expect(result.education_1.gpa).toBe('3.95/4.0');
      expect(result.education_2.degree).toContain('Bachelor');
      expect(result.education_2.institution).toContain('Berkeley');
    });

    test('should parse compact single-line format', () => {
      const input = `B.S. Computer Science, MIT, Cambridge MA, Class of 2023, GPA 3.9`;

      const result = parseEducation(input);

      expect(result.current.degree).toMatch(/B\.S\./);
      expect(result.current.institution).toContain('MIT');
      expect(result.current.year).toBe('2023');
      expect(result.current.gpa).toBe('3.9');
    });

    test('should extract concentration/minor', () => {
      const input = `University of Washington - Seattle, WA
Bachelor of Arts in Computer Science, Minor in Mathematics
Graduation: June 2024 | GPA: 3.78/4.0
Concentration: Artificial Intelligence`;

      const result = parseEducation(input);

      expect(result.current.institution).toContain('University of Washington');
      expect(result.current.concentration).toMatch(/Mathematics|Artificial Intelligence/);
    });
  });

  describe('parseEmployment', () => {
    test('should parse employment with dates and location', () => {
      const input = `Office Assistant                   Montefiore St. Luke's Hospital – Cornwall, NY                                                     Apr '20 - May '20
Assisted in the hospital's transition to a new medical records system.
Managed sensitive billing information.`;

      const result = parseEmployment(input);

      expect(result.current.title).toBe('Office Assistant');
      expect(result.current.company).toContain('Montefiore');
      expect(result.current.location).toBe('Cornwall, NY');
      expect(result.current.dates).toContain('Apr');
      expect(result.current.description).toContain('Assisted');
    });

    test('should parse multiple positions', () => {
      const input = `Senior Engineer | Google | Mountain View, CA | Jan 2022 - Present
Led team of 5 engineers

Software Engineer II | Google | Mountain View, CA | Jun 2019 - Dec 2021
Developed microservices`;

      const result = parseEmployment(input);

      expect(result.job_1.title).toBe('Senior Engineer');
      expect(result.job_1.company).toBe('Google');
      expect(result.job_2.title).toBe('Software Engineer II');
    });

    test('should handle remote position notation', () => {
      const input = `Full Stack Developer     TechStartup Inc. (Remote)     March 2020 - Present
Built React/Node.js applications`;

      const result = parseEmployment(input);

      expect(result.current.title).toBe('Full Stack Developer');
      expect(result.current.company).toMatch(/TechStartup/);
    });
  });

  describe('parseProjects', () => {
    test('should parse projects with technologies', () => {
      const input = `E-Commerce Platform | 2023
Full-stack web application built with MERN stack
Tech Stack: React, Node.js, MongoDB, Docker`;

      const result = parseProjects(input);

      const projectKey = Object.keys(result)[0];
      expect(result[projectKey].title).toContain('E-Commerce');
      expect(result[projectKey].timeframe).toBe('2023');
      expect(result[projectKey].technologies).toContain('React');
    });

    test('should parse single-line bullet format', () => {
      const input = `• Weather App - React Native mobile app (2024)
• Portfolio Website - Built with Next.js
• Discord Bot - Python bot with 50+ commands (2023)`;

      const result = parseProjects(input);

      expect(Object.keys(result).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('parseSkills', () => {
    test('should parse comma-separated skills', () => {
      const input = `Python, JavaScript, React, Node.js, SQL, PostgreSQL, Git, Docker`;

      const result = parseSkills(input);

      expect(result).toContain('Python');
      expect(result).toContain('JavaScript');
      expect(result).toContain('Docker');
      expect(result.length).toBeGreaterThanOrEqual(8);
    });

    test('should parse categorized skills', () => {
      const input = `Languages: Python, JavaScript, Java
Frameworks: React, Node.js, Django
Tools: Git, Docker, AWS`;

      const result = parseSkills(input);

      expect(result).toContain('Python');
      expect(result).toContain('React');
      expect(result).toContain('Git');
      expect(result).not.toContain('Languages');
      expect(result).not.toContain('Frameworks');
    });

    test('should remove proficiency levels', () => {
      const input = `Python (Expert), JavaScript (Advanced), React (Intermediate)`;

      const result = parseSkills(input);

      expect(result).toContain('Python');
      expect(result).toContain('JavaScript');
      expect(result).not.toContain('Expert');
      expect(result).not.toContain('(Expert)');
    });

    test('should extract main skills from sub-skills', () => {
      const input = `Python (NumPy, Pandas, scikit-learn), JavaScript (React, Vue), SQL`;

      const result = parseSkills(input);

      expect(result).toContain('Python');
      expect(result).toContain('JavaScript');
      expect(result).toContain('SQL');
      expect(result).not.toContain('NumPy');
    });

    test('should handle bullet-pointed skills', () => {
      const input = `• Python • JavaScript • React
▪ Docker ▪ Kubernetes
- AWS - Azure`;

      const result = parseSkills(input);

      expect(result).toContain('Python');
      expect(result).toContain('Docker');
      expect(result).toContain('AWS');
    });

    test('should remove duplicates (case insensitive)', () => {
      const input = `Python, python, PYTHON, JavaScript, javascript`;

      const result = parseSkills(input);

      const pythonCount = result.filter(s => s.toLowerCase() === 'python').length;
      const jsCount = result.filter(s => s.toLowerCase() === 'javascript').length;

      expect(pythonCount).toBe(1);
      expect(jsCount).toBe(1);
    });
  });

  describe('parseReferences', () => {
    test('should parse reference with full details', () => {
      const input = `Dr. Jane Smith
Professor of Computer Science
Massachusetts Institute of Technology
jane.smith@mit.edu
(617) 555-1234`;

      const result = parseReferences(input);

      const refKey = Object.keys(result)[0];
      expect(result[refKey].name).toContain('Jane Smith');
      expect(result[refKey].email).toBe('jane.smith@mit.edu');
      expect(result[refKey].phone).toBe('(617) 555-1234');
      expect(result[refKey].title).toContain('Professor');
    });

    test('should parse compact reference format', () => {
      const input = `Robert Chen - CTO at TechCorp - robert@techcorp.com - 415-555-9999`;

      const result = parseReferences(input);

      const refKey = Object.keys(result)[0];
      expect(result[refKey].name).toContain('Robert Chen');
      expect(result[refKey].title).toContain('CTO');
      expect(result[refKey].company).toContain('TechCorp');
      expect(result[refKey].email).toBe('robert@techcorp.com');
    });

    test('should parse multiple references', () => {
      const input = `Dr. Jane Smith
Professor, MIT
jane@mit.edu

John Anderson
Manager at Google
john@google.com`;

      const result = parseReferences(input);

      expect(Object.keys(result).length).toBe(2);
    });
  });

  describe('parseResumeSection', () => {
    test('should route to correct parser based on section type', () => {
      const text = `Python, JavaScript, React`;

      const result = parseResumeSection('skills', text);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('Python');
    });

    test('should use custom config when provided', () => {
      const text = `John Doe; (555) 123-4567; john@example.com`;

      const customConfig = {
        ...DEFAULT_PARSER_CONFIG.demographics,
        delimiters: [';']
      };

      const result = parseResumeSection('demographics', text, customConfig);

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    test('should throw error for unknown section type', () => {
      expect(() => {
        parseResumeSection('invalid_section', 'test');
      }).toThrow('Unknown section type');
    });
  });

  describe('Edge Cases and Real-World Scenarios', () => {
    test('should handle extra whitespace and formatting (lazy user)', () => {
      const input = `   John    Doe


      john@example.com       (555) 123-4567


      New York, NY`;

      const result = parseDemographics(input);

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('(555) 123-4567');
    });

    test('should handle mixed delimiters (lazy user)', () => {
      const input = `Jane Smith | Austin, TX / jane@email.com – 512-555-1234`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Jane Smith');
      expect(result.address).toBe('Austin, TX');
      expect(result.email).toBe('jane@email.com');
      expect(result.phone).toBe('512-555-1234');
    });

    test('should handle minimal resume with only essentials (lazy user)', () => {
      const input = `Bob Johnson
bob@email.com
555-1234`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Bob Johnson');
      expect(result.email).toBe('bob@email.com');
      expect(result.phone).toContain('555-1234');
    });

    test('should handle education without GPA', () => {
      const input = `Harvard University
Bachelor of Arts in Economics
Graduated 2020`;

      const result = parseEducation(input);

      expect(result.current.institution).toContain('Harvard');
      expect(result.current.year).toBe('2020');
      expect(result.current.gpa).toBe('');
    });

    test('should handle empty/missing objective field', () => {
      const input = `Sarah Jones
sarah@email.com`;

      const result = parseDemographics(input);

      expect(result.objective).toBe('');
      expect(result.available).toBe('');
    });

    test('should extract data even when all fields are on one line (extreme lazy user)', () => {
      const input = `Mike Wilson mike@email.com 555-9876 Seattle, WA linkedin.com/in/mikewilson`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Mike Wilson');
      expect(result.email).toBe('mike@email.com');
      expect(result.phone).toBe('555-9876');
      expect(result.address).toBe('Seattle, WA');
      expect(result.linkedin).toBe('linkedin.com/in/mikewilson');
    });
  });

  describe('100% Accuracy on Real-World Resumes', () => {
    test('Real-World Resume 1: Tech Professional', () => {
      const input = `Alex Thompson
San Francisco, CA | (415) 555-0123 | alex.thompson@email.com
linkedin.com/in/alexthompson | github.com/alexthompson
https://alexthompson.dev

Objective: Senior Software Engineer with 8 years experience in distributed systems
Available: Immediately`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Alex Thompson');
      expect(result.address).toBe('San Francisco, CA');
      expect(result.phone).toBe('(415) 555-0123');
      expect(result.email).toBe('alex.thompson@email.com');
      expect(result.linkedin).toBe('linkedin.com/in/alexthompson');
      expect(result.github).toBe('github.com/alexthompson');
      expect(result.website).toBe('https://alexthompson.dev');
      expect(result.objective).toContain('Senior Software Engineer');
      expect(result.available).toBe('Immediately');
    });

    test('Real-World Resume 2: Recent Graduate (lazy formatting)', () => {
      const input = `Emma Rodriguez
Boston MA 02101
emma.rodriguez@university.edu
617-555-9999`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Emma Rodriguez');
      expect(result.address).toContain('Boston');
      expect(result.email).toBe('emma.rodriguez@university.edu');
      expect(result.phone).toBe('617-555-9999');
    });

    test('Real-World Resume 3: Career Switcher (messy format)', () => {
      const input = `Dr. Lisa Chen, Ph.D.
Former Research Scientist
Chicago, Illinois | lisa.chen@research.org | 312-555-7777
Portfolio: lisachen.com
Objective: Transitioning to industry software development role`;

      const result = parseDemographics(input);

      expect(result.name).toBe('Dr. Lisa Chen, Ph.D.');
      expect(result.address).toContain('Chicago');
      expect(result.email).toBe('lisa.chen@research.org');
      expect(result.phone).toBe('312-555-7777');
      expect(result.website).toBe('lisachen.com');
      expect(result.objective).toContain('Transitioning');
    });

    test('Real-World Education: Multiple Formats', () => {
      const input = `Stanford University, Stanford, CA
Master of Science in Computer Science, 2020-2022
GPA: 3.95/4.0, Dean's List
Concentration: Machine Learning and AI

University of California, Berkeley, CA
B.S. in Computer Engineering, 2016-2020
Cumulative GPA: 3.87/4.0
Magna Cum Laude, Honors in Major`;

      const result = parseEducation(input);

      expect(result.education_1.institution).toContain('Stanford');
      expect(result.education_1.gpa).toBe('3.95/4.0');
      expect(result.education_1.honors).toContain('Dean');
      expect(result.education_2.institution).toContain('Berkeley');
      expect(result.education_2.gpa).toBe('3.87/4.0');
      expect(result.education_2.honors).toContain('Magna Cum Laude');
    });
  });
});
