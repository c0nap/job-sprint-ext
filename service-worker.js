/**
 * JobSprint Service Worker - Background Logic
 * Handles data storage, message passing, and external API communication
 */

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('JobSprint Extension installed');
  initializeStorage();
});

/**
 * Initialize default storage values
 */
function initializeStorage() {
  // Initialize clipboard macros in chrome.storage.sync
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

  // Initialize Q&A database in chrome.storage.local
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
 * Get clipboard macro from storage
 */
function handleGetClipboardMacro(key, sendResponse) {
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    const value = result.clipboardMacros?.[key] || '';
    sendResponse({ success: true, value });
  });
}

/**
 * Save clipboard macro to storage
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
 */
function handleLogJobData(data, sendResponse) {
  // TODO: Replace with actual Google Apps Script Web App URL
  const endpoint = 'YOUR_APPS_SCRIPT_URL_HERE';

  fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then(() => {
      sendResponse({ success: true });
    })
    .catch((error) => {
      console.error('Failed to log job data:', error);
      sendResponse({ success: false, error: error.message });
    });
}

// ============ AUTOFILL FEATURE ============

/**
 * Find similar answer from Q&A database using similarity heuristic
 */
function handleFindSimilarAnswer(question, sendResponse) {
  chrome.storage.local.get(['qaDatabase'], (result) => {
    const database = result.qaDatabase || [];

    if (database.length === 0) {
      sendResponse({ success: true, answer: null, similarity: 0 });
      return;
    }

    // Find best match using similarity calculation
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const entry of database) {
      const similarity = calculateSimilarity(question, entry.question);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    // Return match if similarity threshold is met (e.g., > 0.6)
    if (bestSimilarity > 0.6) {
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
 * Save Q&A pair to database
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
