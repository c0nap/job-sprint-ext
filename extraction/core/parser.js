/**
 * Document Parser for Context-Aware Extraction
 *
 * This module provides functionality to parse job posting documents (HTML or plain text)
 * into structured sections for context-aware data extraction.
 *
 * @module document-parser
 */

// Import types (for JSDoc only)
/// <reference path="./extraction-types.js" />

/**
 * Parse a document into structured sections
 * Works with both HTML and plain text inputs
 *
 * @param {Object} input - Input document
 * @param {string} [input.html] - HTML content
 * @param {string} [input.text] - Plain text content
 * @param {string} [input.url] - Page URL
 * @param {ParseOptions} [options] - Parsing options
 * @returns {StructuredDocument} Parsed document with sections
 */
function parseDocument(input, options = {}) {
  const defaults = {
    includeHtml: true,
    minSectionLength: 50,
    minConfidence: 0.3,
    customSectionPatterns: [],
    detectJobBoard: true
  };

  const opts = { ...defaults, ...options };

  // Determine parse strategy
  const strategy = determineParseStrategy(input);

  let structuredDoc;

  if (strategy === 'html' && input.html) {
    structuredDoc = parseHtmlDocument(input.html, input.url, opts);
  } else if (strategy === 'text' && input.text) {
    structuredDoc = parseTextDocument(input.text, input.url, opts);
  } else {
    // Hybrid: try HTML first, fall back to text
    structuredDoc = input.html
      ? parseHtmlDocument(input.html, input.url, opts)
      : parseTextDocument(input.text || '', input.url, opts);
  }

  // Post-process: validate sections, compute confidence scores
  return postProcessDocument(structuredDoc, opts);
}

/**
 * Determine which parsing strategy to use
 * @param {Object} input - Input document
 * @returns {ParseStrategy} Strategy to use
 */
function determineParseStrategy(input) {
  if (input.html && input.html.length > 0) {
    // Check if HTML is meaningful (not just wrapper)
    const htmlQuality = assessHtmlQuality(input.html);
    if (htmlQuality > 0.5) {
      return 'html';
    }
  }

  if (input.text && input.text.length > 0) {
    return 'text';
  }

  return 'hybrid';
}

/**
 * Assess the quality of HTML for parsing
 * @param {string} html - HTML content
 * @returns {number} Quality score 0.0-1.0
 */
function assessHtmlQuality(html) {
  let score = 0.0;

  // Check for semantic elements
  if (/<(header|section|article|main|aside)[\s>]/i.test(html)) score += 0.3;

  // Check for heading tags
  if (/<h[1-6][^>]*>/i.test(html)) score += 0.2;

  // Check for structured content (lists, paragraphs)
  if (/<(ul|ol|p|div)[\s>]/i.test(html)) score += 0.2;

  // Check for class/id attributes (indicates structured markup)
  if (/class=["'][^"']+["']/i.test(html)) score += 0.15;
  if (/id=["'][^"']+["']/i.test(html)) score += 0.15;

  return Math.min(score, 1.0);
}

/**
 * Parse HTML document into sections
 * @param {string} html - HTML content
 * @param {string} url - Page URL
 * @param {ParseOptions} options - Parsing options
 * @returns {StructuredDocument} Structured document
 */
function parseHtmlDocument(html, url, options) {
  // Create a temporary DOM (this will need to be adapted for content script context)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Detect job board type
  const detectedBoard = options.detectJobBoard ? detectJobBoard(url, doc) : null;

  // Extract sections using HTML structure
  const sections = {};

  // Try board-specific selectors first if detected
  if (detectedBoard && JOB_BOARD_SELECTORS[detectedBoard]) {
    const boardSections = extractSectionsWithSelectors(
      doc,
      JOB_BOARD_SELECTORS[detectedBoard],
      options
    );
    Object.assign(sections, boardSections);
  }

  // Generic HTML section extraction
  const genericSections = extractSectionsFromHtml(doc, options);
  Object.assign(sections, genericSections);

  // Extract full text for fallback
  const fullText = extractTextFromHtml(doc);

  return {
    fullText: fullText,
    fullHtml: html,
    url: url || '',
    sections: sections,
    metadata: {
      parseStrategy: 'html',
      confidence: calculateOverallConfidence(sections),
      detectedBoard: detectedBoard,
      url: url,
      totalSections: Object.keys(sections).length,
      title: doc.title || ''
    }
  };
}

/**
 * Parse plain text document into sections
 * @param {string} text - Plain text content
 * @param {string} url - Page URL
 * @param {ParseOptions} options - Parsing options
 * @returns {StructuredDocument} Structured document
 */
function parseTextDocument(text, url, options) {
  // Detect job board from URL
  const detectedBoard = options.detectJobBoard ? detectJobBoardFromUrl(url) : null;

  // Extract sections using text patterns
  const sections = extractSectionsFromText(text, options);

  return {
    fullText: text,
    fullHtml: null,
    url: url || '',
    sections: sections,
    metadata: {
      parseStrategy: 'text',
      confidence: calculateOverallConfidence(sections),
      detectedBoard: detectedBoard,
      url: url,
      totalSections: Object.keys(sections).length,
      title: null
    }
  };
}

/**
 * Extract sections from HTML using generic patterns
 * @param {Document} doc - Parsed DOM document
 * @param {ParseOptions} options - Parsing options
 * @returns {Object.<string, Section>} Extracted sections
 */
function extractSectionsFromHtml(doc, options) {
  const sections = {};

  // Extract header section (top of page, h1, company/title info)
  sections.header = extractHeaderSection(doc, options);

  // Find all heading elements as potential section markers
  const headings = doc.querySelectorAll('h1, h2, h3, h4');

  headings.forEach((heading) => {
    const headingText = heading.textContent.trim();
    const sectionType = classifyHeading(headingText);

    if (sectionType && sectionType !== 'unknown') {
      const sectionContent = extractContentAfterHeading(heading, options);

      if (sectionContent && sectionContent.text.length >= options.minSectionLength) {
        // Merge if section already exists, otherwise create new
        if (sections[sectionType]) {
          sections[sectionType] = mergeSections(sections[sectionType], sectionContent);
        } else {
          sections[sectionType] = sectionContent;
        }
      }
    }
  });

  return sections;
}

/**
 * Extract sections from plain text using pattern matching
 * @param {string} text - Plain text content
 * @param {ParseOptions} options - Parsing options
 * @returns {Object.<string, Section>} Extracted sections
 */
function extractSectionsFromText(text, options) {
  const sections = {};
  const lines = text.split('\n');

  let currentSection = null;
  let currentSectionLines = [];
  let currentSectionStart = 0;
  let charPosition = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if this line is a section heading
    const sectionType = classifyHeadingText(trimmedLine);

    if (sectionType && sectionType !== 'unknown' && isLikelyHeading(line, lines[i + 1])) {
      // Save previous section if exists
      if (currentSection && currentSectionLines.length > 0) {
        const sectionText = currentSectionLines.join('\n').trim();
        if (sectionText.length >= options.minSectionLength) {
          sections[currentSection] = createSection(
            sectionText,
            null,
            0.7, // Text-based confidence is lower
            currentSectionStart,
            charPosition,
            trimmedLine,
            extractKeywords(sectionText)
          );
        }
      }

      // Start new section
      currentSection = sectionType;
      currentSectionLines = [];
      currentSectionStart = charPosition + line.length + 1;
    } else if (currentSection) {
      // Add line to current section
      currentSectionLines.push(line);
    }

    charPosition += line.length + 1; // +1 for newline
  }

  // Save last section
  if (currentSection && currentSectionLines.length > 0) {
    const sectionText = currentSectionLines.join('\n').trim();
    if (sectionText.length >= options.minSectionLength) {
      sections[currentSection] = createSection(
        sectionText,
        null,
        0.7,
        currentSectionStart,
        charPosition,
        null,
        extractKeywords(sectionText)
      );
    }
  }

  // If no sections found, create a general jobDescription section
  if (Object.keys(sections).length === 0) {
    sections.jobDescription = createSection(
      text,
      null,
      0.3, // Low confidence since we couldn't parse structure
      0,
      text.length,
      null,
      extractKeywords(text)
    );
  }

  return sections;
}

/**
 * Classify a heading text to determine section type
 * @param {string} headingText - Heading text
 * @returns {string|null} Section type or null
 */
function classifyHeadingText(headingText) {
  const normalized = headingText.toLowerCase().trim();

  // Check against each section type's patterns
  for (const [sectionType, patterns] of Object.entries(SECTION_HEADING_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return sectionType;
      }
    }
  }

  return 'unknown';
}

/**
 * Check if a line is likely a heading based on context
 * @param {string} line - Current line
 * @param {string} nextLine - Next line
 * @returns {boolean} True if likely a heading
 */
function isLikelyHeading(line, nextLine) {
  const trimmed = line.trim();

  // Empty line or very short
  if (trimmed.length < 3) return false;

  // All caps (common for headings)
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;

  // Ends with colon
  if (trimmed.endsWith(':')) return true;

  // Followed by dashes or equals (markdown-style)
  if (nextLine && /^[-=]{3,}$/.test(nextLine.trim())) return true;

  // Short line followed by longer content
  if (trimmed.length < 50 && nextLine && nextLine.trim().length > trimmed.length) return true;

  return false;
}

/**
 * Create a Section object
 * @param {string} text - Section text
 * @param {string} html - Section HTML
 * @param {number} confidence - Confidence score
 * @param {number} startIndex - Start position
 * @param {number} endIndex - End position
 * @param {string} headingText - Heading text
 * @param {string[]} keywords - Keywords
 * @returns {Section} Section object
 */
function createSection(text, html, confidence, startIndex, endIndex, headingText, keywords) {
  return {
    text: text,
    html: html || null,
    confidence: confidence,
    startIndex: startIndex,
    endIndex: endIndex,
    headingText: headingText || null,
    keywords: keywords || []
  };
}

/**
 * Extract keywords from text for section identification
 * @param {string} text - Text content
 * @returns {string[]} Array of keywords
 */
function extractKeywords(text) {
  // Simple keyword extraction (can be enhanced with NLP)
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Count word frequency
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);

  // Return top keywords
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Calculate overall confidence score for all sections
 * @param {Object.<string, Section>} sections - Sections
 * @returns {number} Overall confidence 0.0-1.0
 */
function calculateOverallConfidence(sections) {
  if (Object.keys(sections).length === 0) return 0.0;

  const confidences = Object.values(sections).map(s => s.confidence);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  // Bonus for having multiple sections
  const sectionBonus = Math.min(Object.keys(sections).length / 5, 0.2);

  return Math.min(avgConfidence + sectionBonus, 1.0);
}

/**
 * Post-process document: validate and enhance sections
 * @param {StructuredDocument} doc - Document to process
 * @param {ParseOptions} options - Options
 * @returns {StructuredDocument} Processed document
 */
function postProcessDocument(doc, options) {
  // Filter out sections below minimum confidence
  const filteredSections = {};
  for (const [type, section] of Object.entries(doc.sections)) {
    if (section.confidence >= options.minConfidence) {
      filteredSections[type] = section;
    }
  }

  doc.sections = filteredSections;
  doc.metadata.totalSections = Object.keys(filteredSections).length;
  doc.metadata.confidence = calculateOverallConfidence(filteredSections);

  return doc;
}

/**
 * Detect job board from URL and DOM
 * @param {string} url - Page URL
 * @param {Document} doc - DOM document
 * @returns {string|null} Detected job board
 */
function detectJobBoard(url, doc) {
  if (!url) return null;

  const urlLower = url.toLowerCase();

  if (urlLower.includes('indeed.com')) return 'indeed';
  if (urlLower.includes('linkedin.com')) return 'linkedin';
  if (urlLower.includes('greenhouse.io')) return 'greenhouse';
  if (urlLower.includes('lever.co')) return 'lever';
  if (urlLower.includes('myworkdayjobs.com')) return 'workday';
  if (urlLower.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (urlLower.includes('icims.com')) return 'icims';

  return null;
}

/**
 * Detect job board from URL only
 * @param {string} url - Page URL
 * @returns {string|null} Detected job board
 */
function detectJobBoardFromUrl(url) {
  return detectJobBoard(url, null);
}

/**
 * HTML extraction implementation
 */

function classifyHeading(headingText) {
  return classifyHeadingText(headingText);
}

/**
 * Extract header section from top of page
 * @param {Document} doc - DOM document
 * @param {ParseOptions} options - Options
 * @returns {Section} Header section
 */
function extractHeaderSection(doc, options) {
  try {
    // Look for h1 or main title elements
    const titleElements = doc.querySelectorAll('h1, [role="heading"][aria-level="1"], .job-title, .jobTitle');

    let headerText = '';
    let headerHtml = '';

    // Collect text from title and surrounding elements
    if (titleElements.length > 0) {
      const firstTitle = titleElements[0];
      headerText = firstTitle.textContent.trim();
      headerHtml = firstTitle.outerHTML;

      // Also include nearby company/location info
      const parent = firstTitle.closest('header, .header, .top-card, .job-header');
      if (parent) {
        headerText = parent.textContent.trim();
        headerHtml = parent.outerHTML;
      }
    }

    // If no structured header found, take first 500 chars
    if (!headerText) {
      headerText = extractTextFromHtml(doc).substring(0, 500);
      headerHtml = null;
    }

    return createSection(
      headerText,
      headerHtml,
      titleElements.length > 0 ? 0.8 : 0.5,
      0,
      headerText.length,
      'Header',
      extractKeywords(headerText)
    );
  } catch (error) {
    console.error('Error extracting header section:', error);
    return createSection('', null, 0.3, 0, 0, null, []);
  }
}

/**
 * Extract content after a heading element
 * @param {HTMLElement} heading - Heading element
 * @param {ParseOptions} options - Options
 * @returns {Section|null} Section or null
 */
function extractContentAfterHeading(heading, options) {
  try {
    const contentElements = [];
    let currentElement = heading.nextElementSibling;

    // Collect elements until next heading or section boundary
    while (currentElement) {
      // Stop at next heading
      if (/^h[1-6]$/i.test(currentElement.tagName)) {
        break;
      }

      // Stop at major section boundaries
      if (currentElement.tagName === 'SECTION' || currentElement.tagName === 'ARTICLE') {
        break;
      }

      contentElements.push(currentElement);
      currentElement = currentElement.nextElementSibling;
    }

    if (contentElements.length === 0) {
      return null;
    }

    // Extract text and HTML
    const text = contentElements.map(el => el.textContent).join('\n').trim();
    const html = contentElements.map(el => el.outerHTML).join('\n');

    if (text.length < options.minSectionLength) {
      return null;
    }

    return createSection(
      text,
      html,
      0.75,
      0,
      text.length,
      heading.textContent.trim(),
      extractKeywords(text)
    );
  } catch (error) {
    console.error('Error extracting content after heading:', error);
    return null;
  }
}

/**
 * Merge two sections by concatenating their content
 * @param {Section} section1 - First section
 * @param {Section} section2 - Second section
 * @returns {Section} Merged section
 */
function mergeSections(section1, section2) {
  return createSection(
    section1.text + '\n\n' + section2.text,
    section1.html ? (section1.html + '\n' + (section2.html || '')) : section2.html,
    Math.max(section1.confidence, section2.confidence),
    Math.min(section1.startIndex, section2.startIndex),
    Math.max(section1.endIndex, section2.endIndex),
    section1.headingText || section2.headingText,
    [...new Set([...section1.keywords, ...section2.keywords])] // Unique keywords
  );
}

/**
 * Extract sections using board-specific CSS selectors
 * @param {Document} doc - DOM document
 * @param {Object} selectors - Selector configuration
 * @param {ParseOptions} options - Options
 * @returns {Object.<string, Section>} Extracted sections
 */
function extractSectionsWithSelectors(doc, selectors, options) {
  const sections = {};

  try {
    // Map selector keys to section types
    const selectorMapping = {
      'jobDescription': 'jobDescription',
      'company': 'aboutCompany',
      'title': 'header',
      'location': 'location'
    };

    for (const [selectorKey, selectorValue] of Object.entries(selectors)) {
      const sectionType = selectorMapping[selectorKey];
      if (!sectionType) continue;

      // Try each selector (may be comma-separated)
      const element = doc.querySelector(selectorValue);
      if (element && element.textContent.trim()) {
        const text = element.textContent.trim();

        sections[sectionType] = createSection(
          text,
          element.outerHTML,
          0.9, // High confidence for board-specific selectors
          0,
          text.length,
          null,
          extractKeywords(text)
        );
      }
    }
  } catch (error) {
    console.error('Error extracting with selectors:', error);
  }

  return sections;
}

/**
 * Extract text from HTML document
 * @param {Document} doc - DOM document
 * @returns {string} Extracted text
 */
function extractTextFromHtml(doc) {
  try {
    // Remove script and style elements
    const clone = doc.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());

    // Get text content
    return clone.body ? clone.body.innerText : '';
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return doc.body ? doc.body.innerText : '';
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseDocument,
    parseHtmlDocument,
    parseTextDocument,
    detectJobBoard,
    extractKeywords,
    classifyHeadingText
  };
}
