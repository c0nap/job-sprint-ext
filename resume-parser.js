// Resume Parser Module
// Parses different sections of a resume into structured JSON for the Clipboard feature

// Default parsing heuristics (configurable in settings)
const DEFAULT_PARSER_CONFIG = {
  demographics: {
    delimiters: ['|', '\n', '\t', ',', '/', '–', '—', '-'],
    patterns: {
      email: /[\w\.-]+@[\w\.-]+\.\w+/gi,
      phone: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/gi,
      github: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/gi,
      website: /(?:https?:\/\/)?(?:www\.)?[\w\.-]+\.\w{2,}(?:\/[\w\.-]*)?/gi
    },
    labelPatterns: {
      phone: /(?:phone|tel|mobile|cell)[\s:]+(.+)/gi,
      email: /(?:email|e-mail)[\s:]+(.+)/gi,
      address: /(?:address|location)[\s:]+(.+)/gi,
      linkedin: /(?:linkedin)[\s:]+(.+)/gi,
      github: /(?:github)[\s:]+(.+)/gi,
      portfolio: /(?:portfolio|website|site)[\s:]+(.+)/gi
    },
    keywords: {
      objective: ['objective', 'summary', 'about', 'goal'],
      available: ['available', 'availability', 'start date', 'can start']
    },
    titleSuffixes: ['phd', 'ph.d', 'ph.d.', 'md', 'm.d.', 'jr', 'jr.', 'sr', 'sr.', 'iii', 'ii', 'esq']
  },
  education: {
    delimiters: ['\n', '\t'],
    orderPatterns: ['institution', 'degree', 'year', 'gpa', 'coursework'],
    keywords: {
      gpa: ['gpa', 'grade point average', 'cumulative gpa'],
      coursework: ['coursework', 'courses', 'relevant courses'],
      honors: ['honors', 'honor', 'magna cum laude', 'summa cum laude', 'cum laude', "dean's list"],
      concentration: ['concentration', 'specialization', 'focus', 'minor', 'emphasis']
    },
    degreePatterns: /(?:B\.?[AS]\.?|M\.?[AS]\.?|Ph\.?D\.?|Bachelor|Master|Associate|Doctor|MBA|B\.Sc\.|M\.Sc\.|B\.Eng\.|M\.Eng\.)[\w\s]*/gi
  },
  employment: {
    delimiters: ['\n', '\t'],
    orderPatterns: ['title', 'company', 'location', 'dates', 'description'],
    keywords: {
      dates: ['date', 'duration', 'period']
    }
  },
  projects: {
    delimiters: ['\n', '\t'],
    orderPatterns: ['title', 'description', 'timeframe', 'technologies']
  },
  skills: {
    delimiters: [',', '|', '\n', '\t', '•', '·', '▪', '○', '-'],
    categoryKeywords: ['languages', 'frameworks', 'tools', 'databases', 'technologies', 'technical', 'soft skills', 'other'],
    proficiencyPattern: /\((?:expert|advanced|intermediate|proficient|familiar|basic|beginner)\)/gi
  },
  references: {
    delimiters: ['\n', '\t'],
    orderPatterns: ['name', 'title', 'company', 'email', 'phone']
  }
};

/**
 * Parse demographics section
 * @param {string} text - Raw text from resume
 * @param {object} config - Parser configuration
 * @returns {object} - Structured demographics data
 */
function parseDemographics(text, config = DEFAULT_PARSER_CONFIG.demographics) {
  const result = {
    name: '',
    address: '',
    phone: '',
    email: '',
    linkedin: '',
    github: '',
    website: '',
    objective: '',
    available: ''
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Try label-based extraction first (e.g., "Phone: 555-1234")
  if (config.labelPatterns) {
    for (const [field, pattern] of Object.entries(config.labelPatterns)) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(text);
      if (match && match[1]) {
        const value = match[1].trim();
        if (field === 'portfolio') {
          result.website = value;
        } else {
          result[field] = value;
        }
      }
    }
  }

  // Extract email (if not found via label)
  if (!result.email) {
    const emailPattern = new RegExp(config.patterns.email.source, 'gi');
    const emailMatch = emailPattern.exec(text);
    if (emailMatch) {
      result.email = emailMatch[0];
    }
  }

  // Extract phone (if not found via label)
  if (!result.phone) {
    const phonePattern = new RegExp(config.patterns.phone.source, 'g');
    const phoneMatch = phonePattern.exec(text);
    if (phoneMatch) {
      result.phone = phoneMatch[0];
    }
  }

  // Extract LinkedIn
  if (!result.linkedin) {
    const linkedinPattern = new RegExp(config.patterns.linkedin.source, 'gi');
    const linkedinMatch = linkedinPattern.exec(text);
    if (linkedinMatch) {
      result.linkedin = linkedinMatch[0];
    }
  }

  // Extract GitHub
  if (!result.github) {
    const githubPattern = new RegExp(config.patterns.github.source, 'gi');
    const githubMatch = githubPattern.exec(text);
    if (githubMatch) {
      result.github = githubMatch[0];
    }
  }

  // Extract website (non-LinkedIn/GitHub URLs)
  if (!result.website) {
    const websitePattern = new RegExp(config.patterns.website.source, 'gi');
    let match;
    while ((match = websitePattern.exec(text)) !== null) {
      const url = match[0];
      // Skip if it's LinkedIn or GitHub
      if (!url.includes('linkedin.com') && !url.includes('github.com') && !url.includes('@')) {
        result.website = url;
        break;
      }
    }
  }

  // Extract name (usually first line, but skip job titles and labels)
  const jobTitleKeywords = ['engineer', 'developer', 'designer', 'manager', 'analyst', 'scientist', 'architect', 'consultant'];
  const labelKeywords = ['phone', 'email', 'address', 'linkedin', 'github'];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Skip if line contains contact info
    if (result.email && line.includes(result.email)) continue;
    if (result.phone && line.includes(result.phone)) continue;
    if (result.linkedin && line.includes(result.linkedin)) continue;

    // Skip if line has a label
    if (labelKeywords.some(keyword => lowerLine.startsWith(keyword))) continue;

    // Skip if line looks like a job title
    if (jobTitleKeywords.some(keyword => lowerLine.includes(keyword))) continue;

    // Skip if line is too long (probably not a name)
    if (line.length > 50) continue;

    // This looks like a name!
    result.name = line;
    break;
  }

  // Extract address (line with city/state patterns)
  for (const line of lines) {
    if (line.match(/[A-Z][a-z]+,\s*[A-Z]{2}/) || line.match(/[A-Z][a-z]+,\s*[A-Z][a-z]+/)) {
      // Remove phone and email from this line
      let addr = line.replace(config.patterns.phone, '').replace(config.patterns.email, '');
      // Clean up delimiters
      config.delimiters.forEach(delim => {
        addr = addr.split(delim).map(s => s.trim()).filter(s => s)[0] || addr;
      });
      result.address = addr.trim();
      break;
    }
  }

  // Extract objective
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    for (const keyword of config.keywords.objective) {
      if (line.includes(keyword)) {
        const colonIndex = lines[i].indexOf(':');
        if (colonIndex > -1) {
          result.objective = lines[i].substring(colonIndex + 1).trim();
        } else if (i + 1 < lines.length) {
          result.objective = lines[i + 1];
        }
        break;
      }
    }
    if (result.objective) break;
  }

  // Extract availability
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    for (const keyword of config.keywords.available) {
      if (lowerLine.includes(keyword)) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
          result.available = line.substring(colonIndex + 1).trim();
        } else {
          result.available = line;
        }
        break;
      }
    }
    if (result.available) break;
  }

  return result;
}

/**
 * Parse education section
 * @param {string} text - Raw text from resume
 * @param {object} config - Parser configuration
 * @returns {object} - Structured education data
 */
function parseEducation(text, config = DEFAULT_PARSER_CONFIG.education) {
  const entries = [];

  // Split into potential entries (blank line separated or multiple lines)
  const blocks = text.split(/\n\s*\n/).filter(b => b.trim());

  blocks.forEach((block, index) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const entry = {
      institution: '',
      degree: '',
      year: '',
      gpa: '',
      honors: '',
      concentration: '',
      coursework: ''
    };

    // Combine all lines for pattern matching
    const fullText = lines.join(' ');

    // Extract year (4-digit number or date range)
    const yearMatch = fullText.match(/\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\b|\b(19|20)\d{2}\b/);
    if (yearMatch) {
      entry.year = yearMatch[0];
    }

    // Extract GPA - handle formats like "3.97", "3.97/4.0", "GPA: 3.97"
    const gpaMatch = fullText.match(/(?:gpa|grade point average)[:\s-]*(\d\.\d+(?:\/\d\.\d+)?)/i) ||
                     fullText.match(/\b(\d\.\d+)\s*(?:\/\s*\d\.\d+)?\s*(?:gpa|cumulative)?/i);
    if (gpaMatch) {
      entry.gpa = gpaMatch[1];
    }

    // Extract degree using pattern from config
    const degreePattern = config.degreePatterns || /(?:B\.?[AS]\.?|M\.?[AS]\.?|Ph\.?D\.?|Bachelor|Master|Associate|Doctor)[\w\s]*/gi;
    degreePattern.lastIndex = 0;
    const degreeMatch = degreePattern.exec(fullText);
    if (degreeMatch) {
      let degree = degreeMatch[0].trim();
      // Clean up common artifacts
      degree = degree.replace(/\s*[-–—,]\s*$/, '').replace(/\s+/g, ' ');
      entry.degree = degree;
    }

    // Extract honors
    if (config.keywords && config.keywords.honors) {
      for (const honorKeyword of config.keywords.honors) {
        const honorRegex = new RegExp(honorKeyword, 'gi');
        const honorMatch = honorRegex.exec(fullText);
        if (honorMatch) {
          // Extract the full honors phrase
          const startIdx = honorMatch.index;
          const endIdx = Math.min(startIdx + 50, fullText.length);
          let honorPhrase = fullText.substring(startIdx, endIdx);
          // Stop at common delimiters
          const delimMatch = honorPhrase.match(/[|•\n]/);
          if (delimMatch) {
            honorPhrase = honorPhrase.substring(0, delimMatch.index);
          }
          entry.honors = honorPhrase.trim();
          break;
        }
      }
    }

    // Extract concentration/minor
    if (config.keywords && config.keywords.concentration) {
      for (const concKeyword of config.keywords.concentration) {
        const concRegex = new RegExp(`${concKeyword}[:\\s]+([^|•\\n]+)`, 'gi');
        const concMatch = concRegex.exec(fullText);
        if (concMatch && concMatch[1]) {
          entry.concentration = concMatch[1].trim();
          break;
        }
      }
    }

    // Extract institution - first line typically
    if (lines.length > 0) {
      let firstLine = lines[0];

      // If first line is the degree, institution is second line
      if (entry.degree && firstLine.toLowerCase().includes(entry.degree.toLowerCase().substring(0, 10))) {
        if (lines.length > 1) {
          firstLine = lines[1];
        }
      }

      // Extract institution before common delimiters
      const parts = firstLine.split(/\s*[-–—|,]\s*/);
      if (parts.length > 0) {
        let inst = parts[0].trim();
        // Remove degree if it's in there
        if (entry.degree) {
          inst = inst.replace(new RegExp(entry.degree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
        }
        // Remove year if it's in there
        if (entry.year) {
          inst = inst.replace(entry.year, '').trim();
        }
        entry.institution = inst;
      }
    }

    // Look for coursework in any line
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (config.keywords && config.keywords.coursework) {
        for (const keyword of config.keywords.coursework) {
          if (lowerLine.includes(keyword)) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
              entry.coursework = line.substring(colonIndex + 1).trim();
            } else {
              // Take the rest of the line after the keyword
              const keywordIdx = lowerLine.indexOf(keyword);
              entry.coursework = line.substring(keywordIdx + keyword.length).trim();
            }
            break;
          }
        }
      }
      if (entry.coursework) break;
    }

    // Use index-based key if multiple entries
    const key = blocks.length > 1 ? `education_${index + 1}` : 'current';
    entries.push({ key, data: entry });
  });

  // Convert to object format
  const result = {};
  entries.forEach(({ key, data }) => {
    result[key] = data;
  });

  return result;
}

/**
 * Parse employment section
 * @param {string} text - Raw text from resume
 * @param {object} config - Parser configuration
 * @returns {object} - Structured employment data
 */
function parseEmployment(text, config = DEFAULT_PARSER_CONFIG.employment) {
  const entries = [];

  // Split into job entries (typically separated by blank lines)
  const blocks = text.split(/\n\s*\n/).filter(b => b.trim());

  blocks.forEach((block, index) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const entry = {
      title: '',
      company: '',
      location: '',
      dates: '',
      description: ''
    };

    if (lines.length > 0) {
      // First line usually has title, company, location, dates
      const firstLine = lines[0];

      // Try to extract dates (e.g., "Apr '20 - May '20", "2020-2021", etc.)
      const dateMatch = firstLine.match(/(?:[A-Z][a-z]{2}\s*'?\d{2}|(?:19|20)\d{2})\s*[-–—]\s*(?:[A-Z][a-z]{2}\s*'?\d{2}|(?:19|20)\d{2}|Present)/i);
      if (dateMatch) {
        entry.dates = dateMatch[0];
      }

      // Split by common delimiters to find title, company, location
      const parts = firstLine.split(/\s{2,}|[–—]/);

      if (parts.length >= 1) {
        entry.title = parts[0].trim().replace(entry.dates, '').trim();
      }

      if (parts.length >= 2) {
        // Second part likely contains company and location
        const secondPart = parts[1].trim().replace(entry.dates, '').trim();

        // Look for location pattern (City, State or City, Country)
        const locMatch = secondPart.match(/[A-Z][a-z]+,\s*[A-Z]{2}|[A-Z][a-z]+,\s*[A-Z][a-z]+/);
        if (locMatch) {
          entry.location = locMatch[0];
          entry.company = secondPart.replace(locMatch[0], '').trim().replace(/[-–—,]+$/, '').trim();
        } else {
          entry.company = secondPart;
        }
      }
    }

    // Remaining lines are description
    if (lines.length > 1) {
      entry.description = lines.slice(1).join('\n');
    }

    // Use index-based key if multiple entries
    const key = blocks.length > 1 ? `job_${index + 1}` : 'current';
    entries.push({ key, data: entry });
  });

  // Convert to object format
  const result = {};
  entries.forEach(({ key, data }) => {
    result[key] = data;
  });

  return result;
}

/**
 * Parse projects section
 * @param {string} text - Raw text from resume
 * @param {object} config - Parser configuration
 * @returns {object} - Structured projects data
 */
function parseProjects(text, config = DEFAULT_PARSER_CONFIG.projects) {
  const entries = [];

  // Split into project entries
  const blocks = text.split(/\n\s*\n/).filter(b => b.trim());

  blocks.forEach((block, index) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const entry = {
      title: '',
      description: '',
      timeframe: '',
      technologies: ''
    };

    if (lines.length > 0) {
      // First line is usually the title
      entry.title = lines[0];

      // Look for timeframe (dates, year, etc.)
      const timeMatch = lines[0].match(/(?:[A-Z][a-z]{2}\s*'?\d{2}|(?:19|20)\d{2})/);
      if (timeMatch) {
        entry.timeframe = timeMatch[0];
        entry.title = entry.title.replace(timeMatch[0], '').trim().replace(/[-–—,]+$/, '').trim();
      }
    }

    // Look for technologies/tech stack
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      if (lowerLine.includes('tech') || lowerLine.includes('stack') || lowerLine.includes('built with')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
          entry.technologies = line.substring(colonIndex + 1).trim();
        }
        lines.splice(i, 1);
        break;
      }
    }

    // Remaining lines are description
    if (lines.length > 1) {
      entry.description = lines.slice(1).join('\n');
    }

    // Use title as key (sanitized) or index-based
    let key = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
    if (!key) {
      key = `project_${index + 1}`;
    }
    entries.push({ key, data: entry });
  });

  // Convert to object format
  const result = {};
  entries.forEach(({ key, data }) => {
    result[key] = data;
  });

  return result;
}

/**
 * Parse skills section
 * @param {string} text - Raw text from resume
 * @param {object} config - Parser configuration
 * @returns {array} - Array of skill strings
 */
function parseSkills(text, config = DEFAULT_PARSER_CONFIG.skills) {
  let skills = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Check if skills are categorized (e.g., "Languages: Python, Java")
  const isCategorized = config.categoryKeywords &&
    lines.some(line => {
      const lowerLine = line.toLowerCase();
      return config.categoryKeywords.some(keyword => lowerLine.startsWith(keyword));
    });

  if (isCategorized) {
    // Parse categorized format
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      let isCategory = false;

      // Check if this line starts with a category keyword
      for (const keyword of config.categoryKeywords) {
        if (lowerLine.startsWith(keyword)) {
          isCategory = true;
          // Extract skills after the category label
          const colonIndex = line.indexOf(':');
          if (colonIndex > -1) {
            const skillsText = line.substring(colonIndex + 1).trim();
            // Split by common delimiters
            const categorySkills = skillsText.split(/[,|•·▪○-]/)
              .map(s => s.trim())
              .filter(s => s && s.length > 0);
            skills.push(...categorySkills);
          }
          break;
        }
      }

      // If not a category line, treat as regular skills
      if (!isCategory && line.length > 0) {
        // Try splitting by delimiters
        for (const delim of config.delimiters) {
          if (line.includes(delim)) {
            const parts = line.split(delim).map(s => s.trim()).filter(s => s);
            if (parts.length > 1) {
              skills.push(...parts);
              break;
            }
          }
        }
      }
    }
  } else {
    // Parse non-categorized format - try each delimiter
    for (const delim of config.delimiters) {
      const parts = text.split(delim).map(s => s.trim()).filter(s => s);
      if (parts.length > skills.length) {
        skills = parts;
      }
    }
  }

  // Clean up skills
  skills = skills.map(skill => {
    // Remove bullet points and common prefixes
    skill = skill
      .replace(/^[-•·*▪○]\s*/, '')
      .replace(/^Skills?:?\s*/i, '')
      .replace(/^Technical:?\s*/i, '')
      .trim();

    // Remove proficiency levels in parentheses
    if (config.proficiencyPattern) {
      const profPattern = new RegExp(config.proficiencyPattern.source, 'gi');
      skill = skill.replace(profPattern, '').trim();
    }

    // Remove sub-skills in parentheses (e.g., "Python (NumPy, Pandas)")
    // Keep the main skill, discard the parenthetical
    const parenMatch = skill.match(/^([^(]+)/);
    if (parenMatch) {
      skill = parenMatch[1].trim();
    }

    return skill;
  }).filter(s => s && s.length > 0);

  // Remove duplicates (case insensitive)
  const seen = new Set();
  skills = skills.filter(skill => {
    const lower = skill.toLowerCase();
    if (seen.has(lower)) {
      return false;
    }
    seen.add(lower);
    return true;
  });

  // Filter out category keywords that might have been included
  if (config.categoryKeywords) {
    skills = skills.filter(skill => {
      const lower = skill.toLowerCase();
      return !config.categoryKeywords.some(keyword => lower === keyword || lower === keyword + 's');
    });
  }

  return skills;
}

/**
 * Parse references section
 * @param {string} text - Raw text from resume
 * @param {object} config - Parser configuration
 * @returns {object} - Structured references data
 */
function parseReferences(text, config = DEFAULT_PARSER_CONFIG.references) {
  const entries = [];

  // Split into reference entries
  const blocks = text.split(/\n\s*\n/).filter(b => b.trim());

  blocks.forEach((block, index) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const entry = {
      name: '',
      title: '',
      company: '',
      email: '',
      phone: ''
    };

    // Extract email and phone using patterns
    const emailMatch = block.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    if (emailMatch) {
      entry.email = emailMatch[0];
    }

    const phoneMatch = block.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      entry.phone = phoneMatch[0];
    }

    // First line is usually the name
    if (lines.length > 0) {
      entry.name = lines[0].replace(entry.email || '', '').replace(entry.phone || '', '').trim();
    }

    // Second line might be title/company
    if (lines.length > 1) {
      const secondLine = lines[1].replace(entry.email || '', '').replace(entry.phone || '', '').trim();

      // Check if it contains company indicators
      if (secondLine.includes(',') || secondLine.includes(' at ') || secondLine.includes(' - ')) {
        const parts = secondLine.split(/,| at | - /);
        if (parts.length >= 2) {
          entry.title = parts[0].trim();
          entry.company = parts[1].trim();
        } else {
          entry.title = secondLine;
        }
      } else {
        entry.title = secondLine;
      }
    }

    // Third line might have additional info
    if (lines.length > 2) {
      const thirdLine = lines[2].replace(entry.email || '', '').replace(entry.phone || '', '').trim();
      if (thirdLine && !entry.company) {
        entry.company = thirdLine;
      }
    }

    // Use name as key (sanitized) or index-based
    let key = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
    if (!key) {
      key = `reference_${index + 1}`;
    }
    entries.push({ key, data: entry });
  });

  // Convert to object format
  const result = {};
  entries.forEach(({ key, data }) => {
    result[key] = data;
  });

  return result;
}

/**
 * Main parser function - routes to appropriate parser based on section type
 * @param {string} sectionType - Type of section (demographics, education, etc.)
 * @param {string} text - Raw text to parse
 * @param {object} parserConfig - Optional custom parser configuration
 * @returns {object|array} - Parsed data
 */
function parseResumeSection(sectionType, text, parserConfig = null) {
  const config = parserConfig || DEFAULT_PARSER_CONFIG[sectionType];

  if (!config) {
    throw new Error(`Unknown section type: ${sectionType}`);
  }

  switch (sectionType) {
    case 'demographics':
      return parseDemographics(text, config);
    case 'education':
      return parseEducation(text, config);
    case 'employment':
      return parseEmployment(text, config);
    case 'projects':
      return parseProjects(text, config);
    case 'skills':
      return parseSkills(text, config);
    case 'references':
      return parseReferences(text, config);
    default:
      throw new Error(`Unsupported section type: ${sectionType}`);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseResumeSection,
    parseDemographics,
    parseEducation,
    parseEmployment,
    parseProjects,
    parseSkills,
    parseReferences,
    DEFAULT_PARSER_CONFIG
  };
}
