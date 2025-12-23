/**
 * Extraction Engine - Integration layer for context-aware extraction
 *
 * This module provides a unified interface for job data extraction
 * that uses the context-aware extraction system with document parsing.
 *
 * @module extraction-engine
 */

// This file should be loaded after:
// - extraction-types.js
// - document-parser.js
// - context-aware-extractor.js

/**
 * Extract all job data from current page using context-aware extraction
 * @returns {Object} Extracted job data with all fields
 */
function extractJobDataContextAware() {
  try {
    console.log('[ExtractionEngine] Starting context-aware extraction');

    // Step 1: Parse the document into sections
    const structuredDoc = parseDocument({
      html: document.documentElement.outerHTML,
      text: document.body.innerText,
      url: window.location.href
    });

    console.log('[ExtractionEngine] Document parsed:', {
      sections: Object.keys(structuredDoc.sections),
      confidence: structuredDoc.metadata.confidence,
      board: structuredDoc.metadata.detectedBoard
    });

    // Step 2: Extract all standard fields
    const extractionResult = extractAllFields(structuredDoc);

    console.log('[ExtractionEngine] Extraction completed:', extractionResult.metadata);

    // Step 3: Convert to legacy format for compatibility with existing code
    const jobData = {
      // Basic fields (using legacy field names for compatibility)
      title: extractionResult.data.jobTitle || '',
      company: extractionResult.data.company || '',
      location: extractionResult.data.location || '',
      url: extractionResult.data.url || window.location.href,
      source: extractionResult.data.board || extractSourceLegacy(window.location.href),

      // Extended fields
      role: extractionResult.data.role || '',
      tailor: extractionResult.data.tailor || '',
      compensation: extractionResult.data.compensation || '',
      pay: extractionResult.data.pay || '',
      description: extractionResult.data.rawDescription || document.body.innerText,

      // Metadata
      timestamp: new Date().toISOString(),
      extractionMetadata: extractionResult.metadata
    };

    console.log('[ExtractionEngine] Job data prepared:', {
      title: jobData.title ? '✓' : '✗',
      company: jobData.company ? '✓' : '✗',
      location: jobData.location ? '✓' : '✗',
      pay: jobData.pay ? '✓' : '✗',
      role: jobData.role ? '✓' : '✗'
    });

    return jobData;
  } catch (error) {
    console.error('[ExtractionEngine] Error during extraction:', error);

    // Fallback to legacy extraction if context-aware fails
    console.warn('[ExtractionEngine] Falling back to legacy extraction');
    return extractJobDataLegacy();
  }
}

/**
 * Legacy extraction fallback (original simple extraction)
 * @returns {Object} Extracted job data
 */
function extractJobDataLegacy() {
  try {
    const data = {
      title: '',
      company: '',
      location: '',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: extractSourceLegacy(window.location.href),
      description: document.body.innerText
    };

    // CSS selectors for job boards
    const titleSelectors = [
      'h1', '[data-job-title]', '.job-title', '.jobTitle',
      '.topcard__title', '.top-card-layout__title',
      '.jobsearch-JobInfoHeader-title',
      '[data-test="job-title"]', '.app-title', '.posting-headline h2',
      '[data-automation-id="jobPostingHeader"]'
    ];

    const companySelectors = [
      '[data-company-name]', '.company-name', '.companyName', '.employer',
      '.topcard__org-name-link', '.top-card-layout__entity-info a',
      '[data-company-name="true"]', '[data-test="employer-name"]',
      '.posting-categories .posting-category'
    ];

    const locationSelectors = [
      '[data-location]', '.location', '.job-location', '.jobLocation',
      '.topcard__flavor--bullet', '.top-card-layout__second-subline',
      '[data-testid="job-location"]', '.jobsearch-JobInfoHeader-subtitle > div',
      '[data-test="location"]', '.posting-categories .location'
    ];

    data.title = extractFieldLegacy(titleSelectors);
    data.company = extractFieldLegacy(companySelectors);
    data.location = extractFieldLegacy(locationSelectors);

    if (!data.title && !data.company) {
      console.warn('[ExtractionEngine] Legacy extraction: Could not extract meaningful job data');
    }

    return data;
  } catch (error) {
    console.error('[ExtractionEngine] Error in legacy extraction:', error);
    return {
      title: '',
      company: '',
      location: '',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Extract field using legacy CSS selector approach
 * @param {Array<string>} selectors - Array of CSS selectors
 * @returns {string} Extracted text or empty string
 */
function extractFieldLegacy(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return cleanTextLegacy(element.textContent.trim());
      }
    } catch (error) {
      console.debug(`[ExtractionEngine] Failed selector "${selector}":`, error);
    }
  }
  return '';
}

/**
 * Clean extracted text (legacy version)
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanTextLegacy(text) {
  return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
}

/**
 * Extract source/board name from URL (legacy version)
 * @param {string} url - Page URL
 * @returns {string} Source name
 */
function extractSourceLegacy(url) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('linkedin.com')) return 'LinkedIn';
    if (hostname.includes('indeed.com')) return 'Indeed';
    if (hostname.includes('glassdoor.com')) return 'Glassdoor';
    if (hostname.includes('greenhouse.io')) return 'Greenhouse';
    if (hostname.includes('lever.co')) return 'Lever';
    if (hostname.includes('myworkdayjobs.com')) return 'Workday';
    if (hostname.includes('handshake.com')) return 'Handshake';
    if (hostname.includes('symplicity.com')) return 'Symplicity';
    return hostname;
  } catch {
    return 'Unknown';
  }
}

/**
 * Fast extract - returns plain text content only (for fast-extract button)
 * @returns {string} Plain text content of the page
 */
function fastExtractText() {
  try {
    // Remove scripts, styles, and other non-content elements
    const clone = document.cloneNode(true);
    const unwanted = clone.querySelectorAll('script, style, noscript, iframe, nav, header, footer, aside');
    unwanted.forEach(el => el.remove());

    // Get main content area if possible
    const mainContent = clone.querySelector('main, [role="main"], article, .job-description, .job-details');

    if (mainContent) {
      return mainContent.innerText || mainContent.textContent || '';
    }

    // Fallback to body
    return clone.body ? (clone.body.innerText || clone.body.textContent || '') : document.body.innerText;
  } catch (error) {
    console.error('[ExtractionEngine] Error in fast extract:', error);
    return document.body.innerText || document.body.textContent || '';
  }
}

// Export for use in content-script.js
if (typeof window !== 'undefined') {
  window.ExtractionEngine = {
    extractJobDataContextAware,
    extractJobDataLegacy,
    fastExtractText
  };
}
