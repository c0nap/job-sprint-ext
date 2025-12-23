/**
 * Type definitions for context-aware extraction system
 * This file serves as documentation and can be imported for JSDoc type hints
 */

/**
 * Section type enumeration
 * @readonly
 * @enum {string}
 */
const SectionType = {
  HEADER: 'header',
  JOB_DESCRIPTION: 'jobDescription',
  REQUIREMENTS: 'requirements',
  COMPENSATION: 'compensation',
  TECHNICAL_SKILLS: 'technicalSkills',
  ABOUT_COMPANY: 'aboutCompany',
  LOCATION: 'location',
  APPLICATION: 'application',
  UNKNOWN: 'unknown'
};

/**
 * Parse strategy enumeration
 * @readonly
 * @enum {string}
 */
const ParseStrategy = {
  HTML: 'html',
  TEXT: 'text',
  HYBRID: 'hybrid'
};

/**
 * @typedef {Object} Section
 * @property {string} text - Plain text content of the section
 * @property {string} [html] - HTML content (if available)
 * @property {number} confidence - Confidence score 0.0-1.0 for section classification
 * @property {number} startIndex - Character position in full text where section starts
 * @property {number} endIndex - Character position in full text where section ends
 * @property {string} [headingText] - The heading that identified this section
 * @property {string[]} keywords - Key terms found in this section
 * @property {SectionType} type - The type of section this is
 */

/**
 * @typedef {Object} DocumentMetadata
 * @property {ParseStrategy} parseStrategy - Which parsing strategy was used
 * @property {number} confidence - Overall confidence in the parse quality (0.0-1.0)
 * @property {string} [detectedBoard] - Detected job board (Indeed, LinkedIn, etc.)
 * @property {string} [url] - Original page URL
 * @property {number} totalSections - Number of sections detected
 * @property {string} [title] - Page title
 */

/**
 * @typedef {Object} StructuredDocument
 * @property {string} fullText - Complete plain text content
 * @property {string} [fullHtml] - Complete HTML content (if available)
 * @property {string} url - Page URL
 * @property {Object.<SectionType, Section>} sections - Detected sections by type
 * @property {DocumentMetadata} metadata - Parsing metadata
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {*} value - The extracted value (type depends on extractor)
 * @property {number} confidence - Confidence score 0.0-1.0 for this extraction
 * @property {string} source - Which section(s) the data came from
 * @property {boolean} fallbackUsed - Whether fallback search was used
 * @property {string} [method] - Extraction method used (pattern, heuristic, etc.)
 * @property {string} [rawMatch] - The raw text that was matched
 */

/**
 * @typedef {Object} ExtractorConfig
 * @property {SectionType[]} searchSections - Sections to search (in order)
 * @property {SectionType[]} sectionPriority - Priority order for searching sections
 * @property {number} minConfidence - Minimum section confidence to search
 * @property {boolean} fallbackToFullDoc - Whether to search full doc if sections fail
 * @property {SectionType[]} [excludeSections] - Sections to explicitly exclude from search
 * @property {RegExp[]} [patterns] - Regex patterns for extraction
 * @property {Function} [customExtractor] - Custom extraction function
 * @property {boolean} [multiMatch] - Whether to return multiple matches
 * @property {Object} [options] - Additional extractor-specific options
 */

/**
 * @typedef {Object} ParseOptions
 * @property {boolean} includeHtml - Whether to include HTML in sections
 * @property {number} minSectionLength - Minimum characters for a valid section
 * @property {number} minConfidence - Minimum confidence to include a section
 * @property {string[]} customSectionPatterns - Additional section heading patterns
 * @property {boolean} detectJobBoard - Whether to detect job board type
 */

/**
 * Default extractor configurations for each extractor mode
 * Maps extractor mode keys to their search contexts
 */
const EXTRACTOR_CONTEXTS = {
  company: {
    searchSections: ['header', 'aboutCompany', 'jobDescription'],
    sectionPriority: ['header', 'aboutCompany', 'jobDescription'],
    minConfidence: 0.5,
    fallbackToFullDoc: true,
    excludeSections: [],
    description: 'Company name extraction with header priority'
  },

  jobTitle: {
    searchSections: ['header', 'jobDescription'],
    sectionPriority: ['header', 'jobDescription'],
    minConfidence: 0.6,
    fallbackToFullDoc: true,
    excludeSections: [],
    description: 'Job title from header or description'
  },

  location: {
    searchSections: ['header', 'location', 'jobDescription'],
    sectionPriority: ['header', 'location', 'jobDescription'],
    minConfidence: 0.5,
    fallbackToFullDoc: true,
    excludeSections: [],
    description: 'Job location or remote status'
  },

  compensation: {
    searchSections: ['compensation'],
    sectionPriority: ['compensation'],
    minConfidence: 0.7,
    fallbackToFullDoc: false,
    excludeSections: ['technicalSkills', 'requirements', 'aboutCompany'],
    description: 'Full compensation package (salary + benefits)'
  },

  pay: {
    searchSections: ['compensation'],
    sectionPriority: ['compensation'],
    minConfidence: 0.7,
    fallbackToFullDoc: false,
    excludeSections: ['technicalSkills', 'requirements', 'aboutCompany'],
    description: 'Specific salary or hourly rate'
  },

  role: {
    searchSections: ['header', 'jobDescription', 'requirements'],
    sectionPriority: ['header', 'jobDescription', 'requirements'],
    minConfidence: 0.5,
    fallbackToFullDoc: true,
    excludeSections: [],
    description: 'Role category (CODE, DSCI, STAT, etc.)'
  },

  tailor: {
    searchSections: ['requirements', 'technicalSkills', 'jobDescription'],
    sectionPriority: ['requirements', 'technicalSkills', 'jobDescription'],
    minConfidence: 0.5,
    fallbackToFullDoc: true,
    excludeSections: ['compensation'],
    description: 'Tailoring category based on requirements'
  },

  notes: {
    searchSections: ['jobDescription', 'requirements', 'compensation', 'aboutCompany'],
    sectionPriority: ['jobDescription', 'requirements', 'compensation', 'aboutCompany'],
    minConfidence: 0.3,
    fallbackToFullDoc: true,
    excludeSections: [],
    description: 'Aggregated notes from multiple sections'
  },

  rawDescription: {
    searchSections: [], // Always uses full document
    sectionPriority: [],
    minConfidence: 0.0,
    fallbackToFullDoc: true,
    excludeSections: [],
    description: 'Raw full page content as formatted text'
  },

  url: {
    searchSections: [], // Extracted from metadata
    sectionPriority: [],
    minConfidence: 1.0,
    fallbackToFullDoc: false,
    excludeSections: [],
    description: 'Page URL (metadata extraction)'
  },

  board: {
    searchSections: [], // Inferred from URL/domain
    sectionPriority: [],
    minConfidence: 0.8,
    fallbackToFullDoc: false,
    excludeSections: [],
    description: 'Job board name inferred from URL'
  },

  status: {
    searchSections: [], // User-provided, not extracted
    sectionPriority: [],
    minConfidence: 1.0,
    fallbackToFullDoc: false,
    excludeSections: [],
    description: 'Application status (user-provided)'
  },

  appliedDate: {
    searchSections: [], // Auto-generated timestamp
    sectionPriority: [],
    minConfidence: 1.0,
    fallbackToFullDoc: false,
    excludeSections: [],
    description: 'Date applied (auto-generated)'
  },

  decision: {
    searchSections: [], // User-provided
    sectionPriority: [],
    minConfidence: 1.0,
    fallbackToFullDoc: false,
    excludeSections: [],
    description: 'Application decision (user-provided)'
  }
};

/**
 * Section heading patterns for text-based detection
 * Maps section types to common heading patterns
 */
const SECTION_HEADING_PATTERNS = {
  jobDescription: [
    /^(?:job\s+)?description/i,
    /^about\s+(?:the\s+)?(?:role|position|job)/i,
    /^(?:the\s+)?opportunity/i,
    /^overview/i,
    /^what\s+you'?ll\s+do/i,
    /^responsibilities/i
  ],

  requirements: [
    /^requirements?/i,
    /^qualifications?/i,
    /^what\s+we'?re\s+looking\s+for/i,
    /^minimum\s+requirements?/i,
    /^must\s+have/i,
    /^prerequisites?/i,
    /^desired\s+(?:skills|qualifications)/i
  ],

  compensation: [
    /^compensation/i,
    /^salary/i,
    /^benefits?/i,
    /^what\s+we\s+offer/i,
    /^pay\s+range/i,
    /^total\s+rewards?/i,
    /^package/i,
    /^perks/i
  ],

  technicalSkills: [
    /^(?:technical\s+)?(?:skills?|requirements?)/i,
    /^tech\s+stack/i,
    /^technologies/i,
    /^tools?\s+(?:and|&)\s+technologies/i,
    /^required\s+skills?/i,
    /^programming\s+languages?/i
  ],

  aboutCompany: [
    /^about\s+(?:us|the\s+company|\[?[\w\s&.]+\]?)/i,
    /^(?:company\s+)?overview/i,
    /^who\s+we\s+are/i,
    /^our\s+(?:company|mission|story)/i,
    /^the\s+company/i
  ],

  location: [
    /^location/i,
    /^where/i,
    /^office\s+location/i,
    /^work\s+location/i,
    /^remote/i,
    /^based\s+in/i
  ],

  application: [
    /^how\s+to\s+apply/i,
    /^application\s+process/i,
    /^next\s+steps/i,
    /^apply\s+now/i,
    /^interested\??/i,
    /^to\s+apply/i
  ]
};

/**
 * HTML selectors for common job board structures
 * Maps job boards to their typical HTML structures
 */
const JOB_BOARD_SELECTORS = {
  indeed: {
    jobDescription: '#jobDescriptionText, .jobsearch-jobDescriptionText',
    company: '.jobsearch-InlineCompanyRating, .icl-u-lg-mr--sm',
    title: 'h1.jobsearch-JobInfoHeader-title',
    location: '.jobsearch-JobInfoHeader-subtitle > div:last-child'
  },

  linkedin: {
    jobDescription: '.description__text, .show-more-less-html__markup',
    company: '.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name',
    title: 'h1.topcard__title, h1.job-details-jobs-unified-top-card__job-title',
    location: '.topcard__flavor--bullet, .job-details-jobs-unified-top-card__bullet'
  },

  greenhouse: {
    jobDescription: '#content, .content',
    company: '.company-name',
    title: '.app-title',
    location: '.location'
  },

  lever: {
    jobDescription: '.section-wrapper .section',
    company: '.main-header-text-subtitle',
    title: 'h2',
    location: '.location'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SectionType,
    ParseStrategy,
    EXTRACTOR_CONTEXTS,
    SECTION_HEADING_PATTERNS,
    JOB_BOARD_SELECTORS
  };
}
