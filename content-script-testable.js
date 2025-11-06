/**
 * Testable exports from content-script.js
 * This file exports functions for unit testing without Chrome extension dependencies
 */

/**
 * Extract job posting data from the current page
 * @returns {Object} Extracted job data
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

    // Enhanced selectors for popular job boards
    const titleSelectors = [
      'h1',
      '[data-job-title]',
      '.job-title',
      '.jobTitle',
      '.topcard__title',
      '.top-card-layout__title',
      '.jobsearch-JobInfoHeader-title',
      '[data-test="job-title"]',
      '.app-title',
      '.posting-headline h2',
      '[data-automation-id="jobPostingHeader"]'
    ];

    const companySelectors = [
      '[data-company-name]',
      '.company-name',
      '.companyName',
      '.employer',
      '.topcard__org-name-link',
      '.top-card-layout__entity-info a',
      '[data-company-name="true"]',
      '[data-test="employer-name"]',
      '.posting-categories .posting-category'
    ];

    const locationSelectors = [
      '[data-location]',
      '.location',
      '.job-location',
      '.jobLocation',
      '.topcard__flavor--bullet',
      '.top-card-layout__second-subline',
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle > div',
      '[data-test="location"]',
      '.posting-categories .location'
    ];

    data.title = extractField(titleSelectors, 'title');
    data.company = extractField(companySelectors, 'company');
    data.location = extractField(locationSelectors, 'location');

    return data;
  } catch (error) {
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
 * Extract field using multiple selectors with fallback
 */
function extractField(selectors, fieldName) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return cleanText(element.textContent.trim());
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  return '';
}

/**
 * Clean extracted text
 */
function cleanText(text) {
  return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
}

/**
 * Extract source/job board name from URL
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
