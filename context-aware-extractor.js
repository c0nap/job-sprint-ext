/**
 * Context-Aware Extractor Wrapper
 *
 * This module provides the framework for performing context-aware extractions
 * using structured documents. Extractors search only relevant sections.
 *
 * @module context-aware-extractor
 */

// Import types and configurations
/// <reference path="./extraction-types.js" />

/**
 * Perform context-aware extraction
 *
 * @param {StructuredDocument} structuredDoc - Parsed document with sections
 * @param {string} extractorType - Type of extractor (company, pay, etc.)
 * @param {Object} options - Additional options
 * @returns {ExtractionResult} Extraction result with confidence
 */
function extractWithContext(structuredDoc, extractorType, options = {}) {
  // Get extractor configuration
  const config = EXTRACTOR_CONTEXTS[extractorType];

  if (!config) {
    console.warn(`No context configuration found for extractor: ${extractorType}`);
    return createFailedResult(extractorType, 'No configuration');
  }

  // Special cases: metadata-based extractors
  if (extractorType === 'url') {
    return extractUrl(structuredDoc);
  }

  if (extractorType === 'board') {
    return extractBoard(structuredDoc);
  }

  if (extractorType === 'rawDescription') {
    return extractRawDescription(structuredDoc);
  }

  // Try extracting from priority sections
  for (const sectionType of config.sectionPriority) {
    const section = structuredDoc.sections[sectionType];

    // Skip if section doesn't exist
    if (!section) continue;

    // Skip if section confidence too low
    if (section.confidence < config.minConfidence) continue;

    // Skip if section is in exclude list
    if (config.excludeSections && config.excludeSections.includes(sectionType)) continue;

    // Attempt extraction from this section
    const result = extractFromSection(
      section,
      extractorType,
      config,
      sectionType,
      options
    );

    if (result && result.value !== null && result.value !== undefined) {
      return result;
    }
  }

  // Fallback: search full document if allowed
  if (config.fallbackToFullDoc && structuredDoc.fullText) {
    console.log(`[Extractor:${extractorType}] Falling back to full document search`);

    const fallbackResult = extractFromText(
      structuredDoc.fullText,
      extractorType,
      config,
      options
    );

    if (fallbackResult && fallbackResult.value) {
      fallbackResult.source = 'fullDocument';
      fallbackResult.fallbackUsed = true;
      return fallbackResult;
    }
  }

  // No extraction found
  return createFailedResult(extractorType, 'No match found in any section');
}

/**
 * Extract data from a specific section
 *
 * @param {Section} section - Section to extract from
 * @param {string} extractorType - Extractor type
 * @param {ExtractorConfig} config - Extractor configuration
 * @param {string} sectionType - Type of section being searched
 * @param {Object} options - Additional options
 * @returns {ExtractionResult|null} Extraction result or null
 */
function extractFromSection(section, extractorType, config, sectionType, options) {
  // Use custom extractor if provided
  if (config.customExtractor) {
    try {
      const value = config.customExtractor(section.text, section, options);
      if (value) {
        return createSuccessResult(
          extractorType,
          value,
          0.85, // Custom extractors get good confidence
          sectionType,
          false,
          'custom'
        );
      }
    } catch (error) {
      console.error(`Custom extractor failed for ${extractorType}:`, error);
    }
  }

  // Use pattern-based extraction
  if (config.patterns && config.patterns.length > 0) {
    for (const pattern of config.patterns) {
      const match = section.text.match(pattern);
      if (match) {
        const value = match[1] || match[0];
        const confidence = calculatePatternConfidence(match, section, pattern);

        return createSuccessResult(
          extractorType,
          value.trim(),
          confidence,
          sectionType,
          false,
          'pattern',
          match[0]
        );
      }
    }
  }

  // Use heuristic extraction (extractor-specific logic)
  const heuristicResult = extractUsingHeuristics(
    section.text,
    extractorType,
    sectionType,
    options
  );

  if (heuristicResult) {
    return createSuccessResult(
      extractorType,
      heuristicResult.value,
      heuristicResult.confidence,
      sectionType,
      false,
      'heuristic',
      heuristicResult.rawMatch
    );
  }

  return null;
}

/**
 * Extract from full text (fallback)
 *
 * @param {string} text - Full text content
 * @param {string} extractorType - Extractor type
 * @param {ExtractorConfig} config - Extractor configuration
 * @param {Object} options - Additional options
 * @returns {ExtractionResult|null} Extraction result or null
 */
function extractFromText(text, extractorType, config, options) {
  // Pattern-based extraction
  if (config.patterns && config.patterns.length > 0) {
    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = match[1] || match[0];

        return createSuccessResult(
          extractorType,
          value.trim(),
          0.5, // Lower confidence for full document search
          'fullDocument',
          true,
          'pattern',
          match[0]
        );
      }
    }
  }

  // Heuristic extraction
  const heuristicResult = extractUsingHeuristics(text, extractorType, 'fullDocument', options);

  if (heuristicResult) {
    return createSuccessResult(
      extractorType,
      heuristicResult.value,
      heuristicResult.confidence * 0.7, // Reduce confidence for fallback
      'fullDocument',
      true,
      'heuristic',
      heuristicResult.rawMatch
    );
  }

  return null;
}

/**
 * Extract using extractor-specific heuristics
 * This is where the actual extraction logic lives
 *
 * @param {string} text - Text to extract from
 * @param {string} extractorType - Extractor type
 * @param {string} sectionType - Section being searched
 * @param {Object} options - Options
 * @returns {Object|null} {value, confidence, rawMatch} or null
 */
function extractUsingHeuristics(text, extractorType, sectionType, options) {
  switch (extractorType) {
    case 'company':
      return extractCompanyName(text, sectionType);
    case 'jobTitle':
      return extractJobTitle(text, sectionType);
    case 'location':
      return extractLocation(text, sectionType);
    case 'compensation':
      return extractCompensation(text, sectionType);
    case 'pay':
      return extractPay(text, sectionType);
    case 'role':
      return extractRole(text, sectionType);
    case 'tailor':
      return extractTailor(text, sectionType);
    default:
      return null;
  }
}

/**
 * Extract company name from text
 * @param {string} text - Text to extract from
 * @param {string} sectionType - Section being searched
 * @returns {Object|null} Extraction result or null
 */
function extractCompanyName(text, sectionType) {
  // Patterns for company name
  const patterns = [
    /(?:at|join|with)\s+([A-Z][A-Za-z0-9\s&.,'-]{2,50})(?:\s+(?:is|are|–|-|,|\.))/i,
    /([A-Z][A-Za-z0-9\s&.,'-]{2,50})\s+is\s+(?:looking|seeking|hiring)/i,
    /(?:company|employer):\s*([A-Z][A-Za-z0-9\s&.,'-]{2,50})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const company = match[1].trim();
      // Filter out common false positives
      if (!isLikelyCompanyName(company)) continue;

      return {
        value: company,
        confidence: sectionType === 'header' ? 0.85 : 0.7,
        rawMatch: match[0]
      };
    }
  }

  return null;
}

/**
 * Check if text is likely a company name
 * @param {string} text - Text to check
 * @returns {boolean} True if likely a company name
 */
function isLikelyCompanyName(text) {
  // Filter out common false positives
  const falsePositives = ['the role', 'the position', 'the team', 'our company', 'this opportunity'];
  const lowerText = text.toLowerCase();

  if (falsePositives.some(fp => lowerText.includes(fp))) {
    return false;
  }

  // Company names usually start with capital letter and are reasonably short
  return text.length >= 2 && text.length <= 50 && /^[A-Z]/.test(text);
}

/**
 * Extract job title from text
 * @param {string} text - Text to extract from
 * @param {string} sectionType - Section being searched
 * @returns {Object|null} Extraction result or null
 */
function extractJobTitle(text, sectionType) {
  // Patterns for job titles
  const patterns = [
    /(?:position|role|job):\s*([A-Z][A-Za-z\s\-/()]{3,60})/i,
    /(?:hiring|seeking)\s+(?:a|an)?\s*([A-Z][A-Za-z\s\-/()]{3,60})(?:\s+to|\s+for|\s+in)/i,
    /([A-Z][A-Za-z\s\-/()]{3,60})\s+(?:opportunity|position|role)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const title = match[1].trim();
      if (!isLikelyJobTitle(title)) continue;

      return {
        value: title,
        confidence: sectionType === 'header' ? 0.9 : 0.75,
        rawMatch: match[0]
      };
    }
  }

  return null;
}

/**
 * Check if text is likely a job title
 * @param {string} text - Text to check
 * @returns {boolean} True if likely a job title
 */
function isLikelyJobTitle(text) {
  // Job title indicators
  const titleKeywords = ['engineer', 'developer', 'analyst', 'manager', 'director', 'designer',
                         'scientist', 'specialist', 'coordinator', 'associate', 'intern',
                         'consultant', 'architect', 'lead', 'senior', 'junior', 'principal'];

  const lowerText = text.toLowerCase();
  return titleKeywords.some(keyword => lowerText.includes(keyword)) && text.length >= 3 && text.length <= 60;
}

/**
 * Extract location from text
 * @param {string} text - Text to extract from
 * @param {string} sectionType - Section being searched
 * @returns {Object|null} Extraction result or null
 */
function extractLocation(text, sectionType) {
  // Patterns for location
  const patterns = [
    /location:\s*([A-Z][A-Za-z\s,.-]{2,80})/i,
    /(?:based in|located in|office in)\s+([A-Z][A-Za-z\s,.-]{2,80})(?:\.|,|\n|$)/i,
    /(Remote|Hybrid|On-site|Work from home)/i,
    /([A-Z][A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?)/,  // City, ST or City, ST ZIP
    /([A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+)/  // City, Country
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();

      return {
        value: location,
        confidence: sectionType === 'location' ? 0.9 : 0.7,
        rawMatch: match[0]
      };
    }
  }

  return null;
}

/**
 * Extract compensation (full package) from text
 * @param {string} text - Text to extract from
 * @param {string} sectionType - Section being searched
 * @returns {Object|null} Extraction result or null
 */
function extractCompensation(text, sectionType) {
  // Look for compensation package descriptions
  const patterns = [
    /compensation(?:\s+package)?:\s*([^\n]{10,200})/i,
    /total\s+(?:rewards?|compensation):\s*([^\n]{10,200})/i,
    /(?:we offer|benefits include):\s*([^\n]{10,200})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const comp = match[1].trim();

      return {
        value: comp,
        confidence: 0.8,
        rawMatch: match[0]
      };
    }
  }

  return null;
}

/**
 * Extract specific pay amount from text
 * @param {string} text - Text to extract from
 * @param {string} sectionType - Section being searched
 * @returns {Object|null} Extraction result or null
 */
function extractPay(text, sectionType) {
  // Patterns for pay (salary ranges, hourly rates)
  const patterns = [
    // Salary ranges: $100,000 - $150,000 or $100k - $150k
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:-|to|–)\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:per year|annually|\/year)?/i,
    /\$\s*(\d{1,3})k\s*(?:-|to|–)\s*\$?\s*(\d{1,3})k/i,

    // Hourly rates: $25/hour or $25 per hour
    /\$\s*(\d{1,3}(?:\.\d{2})?)\s*(?:per hour|\/hour|\/hr|hourly)/i,

    // Single salary: $100,000 per year
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:per year|annually|\/year)/i,
    /\$\s*(\d{1,3})k\s*(?:per year|annually|\/year)?/i,

    // Salary line: "Salary: $X"
    /salary:\s*\$\s*(\d{1,3}(?:,\d{3})*)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let pay = '';

      // Handle range patterns (groups 1 and 2)
      if (match[2]) {
        pay = `$${match[1]} - $${match[2]}`;
      } else {
        // Handle single value patterns
        pay = match[0].trim();
      }

      return {
        value: pay,
        confidence: 0.85,
        rawMatch: match[0]
      };
    }
  }

  return null;
}

/**
 * Extract role category from text
 * @param {string} text - Text to extract from
 * @param {string} sectionType - Section being searched
 * @returns {Object|null} Extraction result or null
 */
function extractRole(text, sectionType) {
  const lowerText = text.toLowerCase();

  // Role category keywords
  const roleCategories = {
    'CODE': ['software engineer', 'developer', 'programmer', 'full stack', 'backend', 'frontend', 'web developer'],
    'DSCI': ['data scientist', 'machine learning', 'data analyst', 'data engineer', 'ai engineer'],
    'STAT': ['statistician', 'quantitative analyst', 'statistical'],
    'R&D': ['research', 'scientist', 'researcher'],
    'PM': ['product manager', 'program manager', 'project manager'],
    'DESIGN': ['designer', 'ux', 'ui', 'graphic designer', 'product designer'],
    'QA': ['qa engineer', 'test engineer', 'quality assurance'],
    'DEVOPS': ['devops', 'site reliability', 'infrastructure engineer', 'cloud engineer'],
    'SECURITY': ['security engineer', 'cybersecurity', 'information security']
  };

  // Check which category matches
  for (const [category, keywords] of Object.entries(roleCategories)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return {
          value: category,
          confidence: 0.8,
          rawMatch: keyword
        };
      }
    }
  }

  return null;
}

/**
 * Extract tailor category from text
 * @param {string} text - Text to extract from
 * @param {string} sectionType - Section being searched
 * @returns {Object|null} Extraction result or null
 */
function extractTailor(text, sectionType) {
  const lowerText = text.toLowerCase();

  // Tailor categories based on tech stack and requirements
  const tailorCategories = {
    'PYTHON': ['python', 'django', 'flask', 'pandas', 'numpy', 'pytorch', 'tensorflow'],
    'JAVASCRIPT': ['javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'next.js'],
    'JAVA': ['java', 'spring', 'hibernate', 'kotlin'],
    'CLOUD': ['aws', 'azure', 'gcp', 'google cloud', 'cloud platform', 'kubernetes', 'docker'],
    'DATA': ['sql', 'database', 'postgres', 'mysql', 'mongodb', 'data pipeline', 'etl'],
    'ML': ['machine learning', 'deep learning', 'neural network', 'ai', 'scikit-learn'],
    'MOBILE': ['ios', 'android', 'swift', 'react native', 'flutter'],
    'FULLSTACK': ['full stack', 'fullstack', 'full-stack']
  };

  // Check which category matches (collect all matches)
  const matches = [];
  for (const [category, keywords] of Object.entries(tailorCategories)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        matches.push(category);
        break; // Only add category once
      }
    }
  }

  if (matches.length > 0) {
    // Return comma-separated list of categories
    return {
      value: matches.join(', '),
      confidence: 0.75,
      rawMatch: matches.join(', ')
    };
  }

  return null;
}

/**
 * Calculate confidence score for a pattern match
 *
 * @param {RegExpMatchArray} match - Regex match result
 * @param {Section} section - Section where match was found
 * @param {RegExp} pattern - Pattern that matched
 * @returns {number} Confidence score 0.0-1.0
 */
function calculatePatternConfidence(match, section, pattern) {
  let confidence = 0.7; // Base confidence for pattern match

  // Boost confidence for high-confidence sections
  confidence += section.confidence * 0.2;

  // Boost for longer matches (more context)
  if (match[0].length > 20) confidence += 0.05;
  if (match[0].length > 50) confidence += 0.05;

  return Math.min(confidence, 1.0);
}

/**
 * Special extractors for metadata
 */

function extractUrl(structuredDoc) {
  return createSuccessResult(
    'url',
    structuredDoc.url || '',
    1.0,
    'metadata',
    false,
    'metadata'
  );
}

function extractBoard(structuredDoc) {
  const board = structuredDoc.metadata.detectedBoard || inferBoardFromUrl(structuredDoc.url);

  return createSuccessResult(
    'board',
    board || '',
    board ? 0.9 : 0.3,
    'metadata',
    false,
    'metadata'
  );
}

function extractRawDescription(structuredDoc) {
  return createSuccessResult(
    'rawDescription',
    structuredDoc.fullText || '',
    1.0,
    'fullDocument',
    false,
    'metadata'
  );
}

function inferBoardFromUrl(url) {
  if (!url) return null;

  const urlLower = url.toLowerCase();

  if (urlLower.includes('indeed.com')) return 'Indeed';
  if (urlLower.includes('linkedin.com')) return 'LinkedIn';
  if (urlLower.includes('greenhouse.io')) return 'Greenhouse';
  if (urlLower.includes('lever.co')) return 'Lever';
  if (urlLower.includes('myworkdayjobs.com')) return 'Workday';
  if (urlLower.includes('handshake.com')) return 'Handshake';
  if (urlLower.includes('symplicity.com')) return 'Symplicity';
  if (urlLower.includes('google.com/about/careers')) return 'Google';

  return 'Website';
}

/**
 * Helper functions to create result objects
 */

function createSuccessResult(
  extractorType,
  value,
  confidence,
  source,
  fallbackUsed,
  method,
  rawMatch = null
) {
  return {
    value: value,
    confidence: confidence,
    source: source,
    fallbackUsed: fallbackUsed,
    method: method,
    rawMatch: rawMatch
  };
}

function createFailedResult(extractorType, reason) {
  return {
    value: null,
    confidence: 0.0,
    source: 'none',
    fallbackUsed: false,
    method: 'none',
    error: reason
  };
}

/**
 * Batch extraction: extract multiple fields at once
 *
 * @param {StructuredDocument} structuredDoc - Parsed document
 * @param {string[]} extractorTypes - Array of extractor types
 * @param {Object} options - Options
 * @returns {Object.<string, ExtractionResult>} Map of extractor to result
 */
function extractBatch(structuredDoc, extractorTypes, options = {}) {
  const results = {};

  for (const extractorType of extractorTypes) {
    results[extractorType] = extractWithContext(structuredDoc, extractorType, options);
  }

  return results;
}

/**
 * Extract all standard job fields
 *
 * @param {StructuredDocument} structuredDoc - Parsed document
 * @param {Object} options - Options
 * @returns {Object} Extracted job data with confidence scores
 */
function extractAllFields(structuredDoc, options = {}) {
  const standardFields = [
    'company',
    'jobTitle',
    'location',
    'compensation',
    'pay',
    'role',
    'url',
    'board'
  ];

  const results = extractBatch(structuredDoc, standardFields, options);

  // Convert to simple data object with values
  const data = {};
  const metadata = {};

  for (const [field, result] of Object.entries(results)) {
    data[field] = result.value;
    metadata[field] = {
      confidence: result.confidence,
      source: result.source,
      fallbackUsed: result.fallbackUsed
    };
  }

  return {
    data: data,
    metadata: metadata,
    documentMetadata: structuredDoc.metadata
  };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractWithContext,
    extractBatch,
    extractAllFields,
    extractFromSection,
    extractFromText
  };
}
