/**
 * Testable exports from content-script.js
 * This file contains core extraction logic that can be tested without Chrome extension dependencies
 */

/**
 * Extract job posting data from the current page
 * @returns {Object} Extracted job data with title, company, location, url, timestamp, and source
 */
function extractJobData() {
  try {
    const data = {
      title: '',
      company: '',
      location: '',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: extractSource(window.location.href)
    };

    // CSS selectors for job boards (LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Workday)
    const titleSelectors = [
      // Generic selectors
      'h1',
      '[data-job-title]',
      '.job-title',
      '.jobTitle',
      // LinkedIn
      '.topcard__title',
      '.top-card-layout__title',
      // Indeed
      '.jobsearch-JobInfoHeader-title',
      // Glassdoor
      '[data-test="job-title"]',
      // Greenhouse
      '.app-title',
      // Lever
      '.posting-headline h2',
      // Workday
      '[data-automation-id="jobPostingHeader"]'
    ];

    const companySelectors = [
      // Generic selectors
      '[data-company-name]',
      '.company-name',
      '.companyName',
      '.employer',
      // LinkedIn
      '.topcard__org-name-link',
      '.top-card-layout__entity-info a',
      // Indeed
      '[data-company-name="true"]',
      // Glassdoor
      '[data-test="employer-name"]',
      // Lever
      '.posting-categories .posting-category'
    ];

    const locationSelectors = [
      // Generic selectors
      '[data-location]',
      '.location',
      '.job-location',
      '.jobLocation',
      // LinkedIn
      '.topcard__flavor--bullet',
      '.top-card-layout__second-subline',
      // Indeed
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle > div',
      // Glassdoor
      '[data-test="location"]',
      // Lever
      '.posting-categories .location'
    ];

    // Extract fields using selector arrays with fallback
    data.title = extractField(titleSelectors, 'title');
    data.company = extractField(companySelectors, 'company');
    data.location = extractField(locationSelectors, 'location');

    return data;
  } catch (error) {
    console.error('Error extracting job data:', error);
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
 * Extract field value using multiple selectors with fallback
 * @param {Array<string>} selectors - Array of CSS selectors to try in order
 * @param {string} fieldName - Name of field being extracted (for logging)
 * @returns {string} Extracted and cleaned text, or empty string if not found
 */
function extractField(selectors, fieldName) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return cleanText(element.textContent.trim());
      }
    } catch (error) {
      console.debug(`Failed to query selector "${selector}":`, error);
    }
  }
  return '';
}

/**
 * Clean extracted text by removing extra whitespace and newlines
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text with normalized whitespace
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')    // Replace multiple whitespace with single space
    .replace(/\n+/g, ' ')    // Replace newlines with space
    .trim();
}

/**
 * Extract source/job board name from URL
 * @param {string} url - Current page URL
 * @returns {string} Source name (e.g., 'LinkedIn', 'Indeed') or hostname
 */
function extractSource(url) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('linkedin.com')) return 'LinkedIn';
    if (hostname.includes('indeed.com')) return 'Indeed';
    if (hostname.includes('glassdoor.com')) return 'Glassdoor';
    if (hostname.includes('greenhouse.io')) return 'Greenhouse';
    if (hostname.includes('lever.co')) return 'Lever';
    if (hostname.includes('myworkdayjobs.com')) return 'Workday';
    return hostname;
  } catch {
    return 'Unknown';
  }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractJobData,
    extractField,
    cleanText,
    extractSource
  };
}
