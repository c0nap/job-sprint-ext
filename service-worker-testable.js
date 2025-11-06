/**
 * Testable exports from service-worker.js
 * This file contains core service worker logic that can be tested without Chrome extension dependencies
 */

/**
 * Log job data to Google Sheets via Apps Script endpoint
 * @param {Object} data - Job data to log (must have title, company, location, url, timestamp)
 * @param {Function} sendResponse - Callback function to send response
 */
function handleLogJobData(data, sendResponse) {
  const endpoint = process.env.APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

  // Validate data before sending
  if (!validateJobData(data)) {
    sendResponse({
      success: false,
      error: 'Invalid job data: missing required fields'
    });
    return;
  }

  // Check if endpoint is configured
  if (!endpoint || endpoint === 'YOUR_APPS_SCRIPT_URL_HERE') {
    sendResponse({
      success: false,
      error: 'Apps Script endpoint not configured'
    });
    return;
  }

  // Send data to Google Apps Script endpoint
  fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(() => {
      sendResponse({ success: true, timestamp: data.timestamp });
    })
    .catch((error) => {
      sendResponse({
        success: false,
        error: error.message || 'Network error occurred'
      });
    });
}

/**
 * Validate job data before sending to external endpoint
 * @param {Object} data - Job data to validate
 * @returns {boolean} True if all required fields are present and valid
 */
function validateJobData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check all required fields are present
  const requiredFields = ['title', 'company', 'location', 'url', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }

  // Validate URL format
  try {
    new URL(data.url);
  } catch {
    return false;
  }

  // Validate timestamp format
  if (!isValidTimestamp(data.timestamp)) {
    return false;
  }

  return true;
}

/**
 * Check if timestamp is valid ISO 8601 format
 * @param {string} timestamp - Timestamp string to validate
 * @returns {boolean} True if valid ISO 8601 timestamp
 */
function isValidTimestamp(timestamp) {
  if (typeof timestamp !== 'string') return false;
  const date = new Date(timestamp);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Calculate similarity between two strings using Jaccard index
 * Used for matching form questions to previously answered questions
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} Similarity score between 0 and 1 (higher is more similar)
 */
function calculateSimilarity(str1, str2) {
  // Normalize: lowercase, remove punctuation, split into words
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);

  const set1 = new Set(normalize(str1));
  const set2 = new Set(normalize(str2));

  // Jaccard index: size of intersection / size of union
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleLogJobData,
    validateJobData,
    isValidTimestamp,
    calculateSimilarity
  };
}
