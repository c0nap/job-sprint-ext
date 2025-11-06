/**
 * Testable exports from service-worker.js
 * This file exports functions for unit testing without Chrome extension dependencies
 */

/**
 * Log job data to Google Sheets via Apps Script endpoint
 * @param {Object} data - Job data to log
 * @param {Function} sendResponse - Callback function
 */
function handleLogJobData(data, sendResponse) {
  const endpoint = process.env.APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

  // Validate data
  if (!validateJobData(data)) {
    sendResponse({
      success: false,
      error: 'Invalid job data: missing required fields'
    });
    return;
  }

  // Check endpoint
  if (!endpoint || endpoint === 'YOUR_APPS_SCRIPT_URL_HERE') {
    sendResponse({
      success: false,
      error: 'Apps Script endpoint not configured'
    });
    return;
  }

  fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
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
 * Validate job data before sending
 */
function validateJobData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const requiredFields = ['title', 'company', 'location', 'url', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }

  try {
    new URL(data.url);
  } catch {
    return false;
  }

  if (!isValidTimestamp(data.timestamp)) {
    return false;
  }

  return true;
}

/**
 * Check if timestamp is valid ISO 8601 format
 */
function isValidTimestamp(timestamp) {
  if (typeof timestamp !== 'string') return false;
  const date = new Date(timestamp);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Calculate similarity between two strings using Jaccard index
 */
function calculateSimilarity(str1, str2) {
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const set1 = new Set(normalize(str1));
  const set2 = new Set(normalize(str2));
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
