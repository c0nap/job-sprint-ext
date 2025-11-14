// Resume Parser Module
// Parses different sections of a resume into structured JSON for the Clipboard feature

// Default parsing heuristics (configurable in settings)
const DEFAULT_PARSER_CONFIG = {
  demographics: {
    delimiters: ['|', '\n', '\t', ','],
    patterns: {
      email: /[\w\.-]+@[\w\.-]+\.\w+/,
      phone: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      linkedin: /linkedin\.com\/in\/[\w-]+/,
      github: /github\.com\/[\w-]+/,
      website: /(?:https?:\/\/)?(?:www\.)?[\w\.-]+\.\w{2,}/
    },
    keywords: {
      objective: ['objective', 'summary', 'about'],
      available: ['available', 'availability', 'start date']
    }
  },
  education: {
    delimiters: ['\n', '\t'],
    orderPatterns: ['institution', 'degree', 'year', 'gpa', 'coursework'],
    keywords: {
      gpa: ['gpa', 'grade point average'],
      coursework: ['coursework', 'courses', 'relevant courses']
    }
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
    delimiters: [',', '|', '\n', '\t', '•', '·']
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

  // Extract email
  const emailMatch = text.match(config.patterns.email);
  if (emailMatch) {
    result.email = emailMatch[0];
  }

  // Extract phone
  const phoneMatch = text.match(config.patterns.phone);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
  }

  // Extract LinkedIn
  const linkedinMatch = text.match(config.patterns.linkedin);
  if (linkedinMatch) {
    result.linkedin = linkedinMatch[0];
  }

  // Extract GitHub
  const githubMatch = text.match(config.patterns.github);
  if (githubMatch) {
    result.github = githubMatch[0];
  }

  // Extract name (usually first line)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length > 0) {
    // First line that's not contact info is likely the name
    for (const line of lines) {
      if (!config.patterns.email.test(line) &&
          !config.patterns.phone.test(line) &&
          !config.patterns.linkedin.test(line) &&
          line.length < 50) {
        result.name = line;
        break;
      }
    }
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
      coursework: ''
    };

    // First line usually contains institution, degree, year
    if (lines.length > 0) {
      const firstLine = lines[0];

      // Try to extract year (4-digit number or date range)
      const yearMatch = firstLine.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        entry.year = yearMatch[0];
      }

      // Try to extract GPA
      const gpaMatch = firstLine.match(/gpa[:\s-]*(\d\.\d+)/i);
      if (gpaMatch) {
        entry.gpa = gpaMatch[1];
      }

      // Extract degree patterns (B.S., M.S., Ph.D., Bachelor, Master, etc.)
      const degreeMatch = firstLine.match(/(?:B\.?[AS]\.?|M\.?[AS]\.?|Ph\.?D\.?|Bachelor|Master|Associate|Doctor)[\w\s]*/i);
      if (degreeMatch) {
        entry.degree = degreeMatch[0].trim();
      }

      // Institution is typically at the start
      const parts = firstLine.split(/[–—-]/);
      if (parts.length > 0) {
        let inst = parts[0].trim();
        // Remove degree if it's at the start
        if (entry.degree) {
          inst = inst.replace(entry.degree, '').trim();
        }
        entry.institution = inst;
      }
    }

    // Look for coursework in subsequent lines
    for (const line of lines.slice(1)) {
      const lowerLine = line.toLowerCase();
      for (const keyword of config.keywords.coursework) {
        if (lowerLine.includes(keyword)) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > -1) {
            entry.coursework = line.substring(colonIndex + 1).trim();
          }
          break;
        }
      }
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

  // Try each delimiter
  for (const delim of config.delimiters) {
    const parts = text.split(delim).map(s => s.trim()).filter(s => s);
    if (parts.length > skills.length) {
      skills = parts;
    }
  }

  // Remove bullet points and common prefixes
  skills = skills.map(skill => {
    return skill
      .replace(/^[-•·*]\s*/, '')
      .replace(/^Skills?:?\s*/i, '')
      .trim();
  }).filter(s => s);

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
