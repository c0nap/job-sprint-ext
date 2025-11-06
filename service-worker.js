/**
 * JobSprint Service Worker - Background Logic
 * Handles data storage, message passing, and external API communication
 * Features: Clipboard macros, job data extraction/logging, Q&A autofill
 */

// Initialize storage when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('JobSprint Extension installed');
  initializeStorage();
});

/**
 * Initialize default storage values on first install
 * Sets up clipboard macros (sync) and Q&A database (local)
 */
function initializeStorage() {
  // Setup clipboard macros in sync storage (synced across devices)
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    if (!result.clipboardMacros) {
      chrome.storage.sync.set({
        clipboardMacros: {
          phone: '',
          email: '',
          address: '',
          linkedin: ''
        }
      });
    }
  });

  // Setup Q&A database in local storage (device-specific, larger capacity)
  chrome.storage.local.get(['qaDatabase'], (result) => {
    if (!result.qaDatabase) {
      chrome.storage.local.set({
        qaDatabase: []
      });
    }
  });
}

/**
 * Handle messages from popup and content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service Worker received message:', message);

  switch (message.action) {
    case 'getClipboardMacro':
      handleGetClipboardMacro(message.key, sendResponse);
      return true;

    case 'saveClipboardMacro':
      handleSaveClipboardMacro(message.key, message.value, sendResponse);
      return true;

    case 'logJobData':
      handleLogJobData(message.data, sendResponse);
      return true;

    case 'findSimilarAnswer':
      handleFindSimilarAnswer(message.question, sendResponse);
      return true;

    case 'saveQAPair':
      handleSaveQAPair(message.question, message.answer, sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// ============ CLIPBOARD FEATURE ============

/**
 * Get clipboard macro value from sync storage
 * @param {string} key - Macro key (phone, email, address, linkedin)
 * @param {Function} sendResponse - Response callback
 */
function handleGetClipboardMacro(key, sendResponse) {
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    const value = result.clipboardMacros?.[key] || '';
    sendResponse({ success: true, value });
  });
}

/**
 * Save clipboard macro value to sync storage
 * @param {string} key - Macro key (phone, email, address, linkedin)
 * @param {string} value - Macro value to save
 * @param {Function} sendResponse - Response callback
 */
function handleSaveClipboardMacro(key, value, sendResponse) {
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    const macros = result.clipboardMacros || {};
    macros[key] = value;
    chrome.storage.sync.set({ clipboardMacros: macros }, () => {
      sendResponse({ success: true });
    });
  });
}

// ============ EXTRACTION FEATURE ============

/**
 * Log job data to Google Sheets via Apps Script endpoint
 * @param {Object} data - Job data to log
 * @param {Function} sendResponse - Response callback
 */
function handleLogJobData(data, sendResponse) {
  // Configuration: Set APPS_SCRIPT_URL in extension settings or replace here
  const endpoint = getAppsScriptEndpoint();

  // Validate data before sending
  if (!validateJobData(data)) {
    console.warn('Invalid job data:', data);
    sendResponse({
      success: false,
      error: 'Invalid job data: missing required fields'
    });
    return;
  }

  // Check if endpoint is configured
  if (!endpoint || endpoint === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('Apps Script endpoint not configured');
    sendResponse({
      success: false,
      error: 'Apps Script endpoint not configured. Please set up your Google Apps Script URL.'
    });
    return;
  }

  // Send data to endpoint
  fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then(() => {
      console.log('Job data logged successfully');
      sendResponse({ success: true, timestamp: data.timestamp });
    })
    .catch((error) => {
      console.error('Failed to log job data:', error);
      sendResponse({
        success: false,
        error: error.message || 'Network error occurred'
      });
    });
}

/**
 * Get Apps Script endpoint URL from storage or environment
 * @returns {string} Endpoint URL
 */
function getAppsScriptEndpoint() {
  // TODO: In production, retrieve from chrome.storage.sync
  // For now, use placeholder (developers should replace this)
  return 'YOUR_APPS_SCRIPT_URL_HERE';
}

/**
 * Validate job data before sending
 * @param {Object} data - Job data to validate
 * @returns {boolean} True if valid
 */
function validateJobData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required fields
  const requiredFields = ['title', 'company', 'location', 'url', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      console.warn(`Missing required field: ${field}`);
      return false;
    }
  }

  // Validate URL format
  try {
    new URL(data.url);
  } catch {
    console.warn('Invalid URL format:', data.url);
    return false;
  }

  // Validate timestamp format (ISO 8601)
  if (!isValidTimestamp(data.timestamp)) {
    console.warn('Invalid timestamp format:', data.timestamp);
    return false;
  }

  return true;
}

/**
 * Check if timestamp is valid ISO 8601 format
 * @param {string} timestamp - Timestamp to validate
 * @returns {boolean} True if valid
 */
function isValidTimestamp(timestamp) {
  if (typeof timestamp !== 'string') return false;
  const date = new Date(timestamp);
  return date instanceof Date && !isNaN(date.getTime());
}

// ============ AUTOFILL FEATURE ============

/**
 * Find similar answer from Q&A database using Jaccard similarity
 * Searches for previously answered questions similar to the current one
 * @param {string} question - Question to find a match for
 * @param {Function} sendResponse - Response callback
 */
function handleFindSimilarAnswer(question, sendResponse) {
  chrome.storage.local.get(['qaDatabase'], (result) => {
    const database = result.qaDatabase || [];

    if (database.length === 0) {
      sendResponse({ success: true, answer: null, similarity: 0 });
      return;
    }

    // Find best matching question using similarity scoring
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const entry of database) {
      const similarity = calculateSimilarity(question, entry.question);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    // Only return match if similarity exceeds threshold (0.6 = 60% word overlap)
    const SIMILARITY_THRESHOLD = 0.6;
    if (bestSimilarity > SIMILARITY_THRESHOLD) {
      sendResponse({
        success: true,
        answer: bestMatch.answer,
        similarity: bestSimilarity
      });
    } else {
      sendResponse({ success: true, answer: null, similarity: bestSimilarity });
    }
  });
}

/**
 * Save question-answer pair to local database for future autofill
 * @param {string} question - Question text
 * @param {string} answer - Answer text
 * @param {Function} sendResponse - Response callback
 */
function handleSaveQAPair(question, answer, sendResponse) {
  chrome.storage.local.get(['qaDatabase'], (result) => {
    const database = result.qaDatabase || [];
    database.push({ question, answer, timestamp: Date.now() });

    chrome.storage.local.set({ qaDatabase: database }, () => {
      sendResponse({ success: true });
    });
  });
}

/**
 * Calculate similarity between two strings using Jaccard index
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  // Normalize strings
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);

  const set1 = new Set(normalize(str1));
  const set2 = new Set(normalize(str2));

  // Calculate Jaccard index: intersection / union
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}
