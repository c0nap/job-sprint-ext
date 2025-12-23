/**
 * JobSprint Service Worker - Background Logic
 * Handles data storage, message passing, and external API communication
 * Features: Clipboard macros, job data extraction/logging, Q&A autofill
 */

// Cache for configuration loaded from chrome.storage or config.local.js
let configCache = {
  APPS_SCRIPT_ENDPOINT: '',
  SPREADSHEET_ID: '',
  PROJECT_ID: '',
  ENABLE_MANUAL_ENTRY: true,
  TARGET_SHEET_NAME: 'Job Applications'
};

// Extractor mode definitions
// These define what types of data can be extracted and mapped to spreadsheet columns
const EXTRACTOR_MODES = {
  'company': {
    label: 'Company/Employer',
    description: 'Company or organization name',
    category: 'basic'
  },
  'jobTitle': {
    label: 'Job Title',
    description: 'Position title or role name',
    category: 'basic'
  },
  'location': {
    label: 'Location',
    description: 'Job location (city, state, country, or remote)',
    category: 'basic'
  },
  'url': {
    label: 'Portal Link/URL',
    description: 'Job posting URL or application link',
    category: 'basic'
  },
  'rawDescription': {
    label: 'Raw Job Description',
    description: 'Full page content as formatted plain text',
    category: 'content'
  },
  'notes': {
    label: 'Notes',
    description: 'Additional notes or custom text',
    category: 'content'
  },
  'status': {
    label: 'Status',
    description: 'Application status (default: "Queued" or "No response")',
    category: 'tracking'
  },
  'appliedDate': {
    label: 'Applied Date',
    description: 'Date applied (auto-populated with current date)',
    category: 'tracking'
  },
  'decision': {
    label: 'Decision',
    description: 'Final decision or outcome',
    category: 'tracking'
  },
  'role': {
    label: 'Role Category',
    description: 'Role type (CODE, DSCI, STAT, R&D, etc.)',
    category: 'classification'
  },
  'tailor': {
    label: 'Tailor Category',
    description: 'Resume/application tailoring category',
    category: 'classification'
  },
  'compensation': {
    label: 'Compensation Range',
    description: 'Salary range or compensation package',
    category: 'compensation'
  },
  'pay': {
    label: 'Specific Pay',
    description: 'Specific pay amount or hourly rate',
    category: 'compensation'
  },
  'board': {
    label: 'Job Board',
    description: 'Source job board (Indeed, LinkedIn, Handshake, etc.)',
    category: 'source'
  },
  'none': {
    label: 'None (Ignore)',
    description: 'Do not populate this column during extraction',
    category: 'special'
  }
};

// Initialize storage when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('JobSprint Extension installed');
  initializeStorage();
  loadConfiguration();
});

// Load configuration on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('JobSprint Extension starting up');
  loadConfiguration();
});

// Track the popup window ID to avoid creating multiple windows
let popupWindowId = null;

// Handle extension icon click - open detached popup window
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked');

  // Check if popup window is already open
  if (popupWindowId !== null) {
    try {
      // Try to focus the existing window
      await chrome.windows.update(popupWindowId, { focused: true });
      console.log('Focused existing popup window');
      return;
    } catch (error) {
      // Window was closed, reset the ID
      console.log('Previous popup window was closed');
      popupWindowId = null;
    }
  }

  // Get the active tab to associate with the popup
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (activeTab) {
    // Store the source tab ID so popup can interact with it
    await chrome.storage.local.set({ popupSourceTabId: activeTab.id });
    console.log('Stored source tab ID:', activeTab.id);
  }

  // Create a new detached popup window
  const window = await chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 420,
    height: 600,
    focused: true
  });

  popupWindowId = window.id;
  console.log('Created new popup window:', popupWindowId);
});

// Listen for window close events to reset the window ID
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    console.log('Popup window closed');
    popupWindowId = null;
  }
});

/**
 * Load configuration from chrome.storage (priority) or config.local.js (fallback)
 * Caches the configuration for quick access
 * If loading from config.local.js, auto-saves to chrome.storage for future use
 */
async function loadConfiguration() {
  try {
    // Try to load from chrome.storage first
    const storageConfig = await chrome.storage.sync.get([
      'APPS_SCRIPT_ENDPOINT',
      'SPREADSHEET_ID',
      'PROJECT_ID',
      'ENABLE_MANUAL_ENTRY',
      'TARGET_SHEET_NAME',
      'SCHEMA_MAPPING'
    ]);

    // Check if we have values in storage
    const hasStorageConfig = storageConfig.APPS_SCRIPT_ENDPOINT ||
                             storageConfig.SPREADSHEET_ID ||
                             storageConfig.PROJECT_ID;

    if (hasStorageConfig) {
      // Use chrome.storage values
      configCache.APPS_SCRIPT_ENDPOINT = storageConfig.APPS_SCRIPT_ENDPOINT || '';
      configCache.SPREADSHEET_ID = storageConfig.SPREADSHEET_ID || '';
      configCache.PROJECT_ID = storageConfig.PROJECT_ID || '';
      configCache.ENABLE_MANUAL_ENTRY =
        storageConfig.ENABLE_MANUAL_ENTRY !== undefined ? storageConfig.ENABLE_MANUAL_ENTRY : true;
      configCache.TARGET_SHEET_NAME = storageConfig.TARGET_SHEET_NAME || 'Job Applications';
      configCache.SCHEMA_MAPPING = storageConfig.SCHEMA_MAPPING || {};
      console.log('Configuration loaded from chrome.storage');
    } else {
      // Fallback to config.local.js
      if (typeof self.APP_CONFIG !== 'undefined') {
        configCache.APPS_SCRIPT_ENDPOINT = self.APP_CONFIG.APPS_SCRIPT_ENDPOINT || '';
        configCache.SPREADSHEET_ID = self.APP_CONFIG.SPREADSHEET_ID || '';
        configCache.PROJECT_ID = self.APP_CONFIG.PROJECT_ID || '';
        console.log('Configuration loaded from config.local.js');

        // Auto-save to chrome.storage for future use (if we have valid config)
        const hasValidConfig = configCache.APPS_SCRIPT_ENDPOINT &&
                               configCache.APPS_SCRIPT_ENDPOINT !== 'YOUR_APPS_SCRIPT_URL_HERE';

        if (hasValidConfig) {
          try {
            await chrome.storage.sync.set({
              APPS_SCRIPT_ENDPOINT: configCache.APPS_SCRIPT_ENDPOINT,
              SPREADSHEET_ID: configCache.SPREADSHEET_ID,
              PROJECT_ID: configCache.PROJECT_ID,
              ENABLE_MANUAL_ENTRY: configCache.ENABLE_MANUAL_ENTRY,
              TARGET_SHEET_NAME: configCache.TARGET_SHEET_NAME
            });
            console.log('Configuration auto-saved to chrome.storage from config.local.js');
          } catch (saveError) {
            console.warn('Could not auto-save config to storage:', saveError);
          }
        }
      } else {
        console.warn('No configuration found in storage or config.local.js');
      }
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
    // Try fallback to config.local.js
    if (typeof self.APP_CONFIG !== 'undefined') {
      configCache.APPS_SCRIPT_ENDPOINT = self.APP_CONFIG.APPS_SCRIPT_ENDPOINT || '';
      configCache.SPREADSHEET_ID = self.APP_CONFIG.SPREADSHEET_ID || '';
      configCache.PROJECT_ID = self.APP_CONFIG.PROJECT_ID || '';
      console.log('Configuration loaded from config.local.js (fallback)');

      // Auto-save to chrome.storage (if we have valid config)
      const hasValidConfig = configCache.APPS_SCRIPT_ENDPOINT &&
                             configCache.APPS_SCRIPT_ENDPOINT !== 'YOUR_APPS_SCRIPT_URL_HERE';

      if (hasValidConfig) {
        try {
          await chrome.storage.sync.set({
            APPS_SCRIPT_ENDPOINT: configCache.APPS_SCRIPT_ENDPOINT,
            SPREADSHEET_ID: configCache.SPREADSHEET_ID,
            PROJECT_ID: configCache.PROJECT_ID,
            ENABLE_MANUAL_ENTRY: configCache.ENABLE_MANUAL_ENTRY,
            TARGET_SHEET_NAME: configCache.TARGET_SHEET_NAME
          });
          console.log('Configuration auto-saved to chrome.storage from config.local.js (fallback)');
        } catch (saveError) {
          console.warn('Could not auto-save config to storage:', saveError);
        }
      }
    }
  }
}

/**
 * Initialize default storage values on first install
 * Sets up clipboard macros (sync) and Q&A database (local)
 */
function initializeStorage() {
  // Setup clipboard macros in sync storage (synced across devices)
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    if (!result.clipboardMacros) {
      // Initialize with new nested structure
      chrome.storage.sync.set({
        clipboardMacros: {
          demographics: {
            phone: '',
            email: '',
            address: '',
            name: '',
            linkedin: '',
            website: ''
          },
          references: {},
          education: {},
          skills: {},
          projects: {},
          employment: {}
        }
      });
    } else {
      // Migration: Convert old flat structure to new nested structure
      const macros = result.clipboardMacros;

      // Check if it's the old flat structure (has 'phone', 'email' at root level)
      if (macros.phone !== undefined || macros.email !== undefined) {
        // Migrate to new structure
        const newStructure = {
          demographics: {
            phone: macros.phone || '',
            email: macros.email || '',
            address: macros.address || '',
            name: macros.name || '',
            linkedin: macros.linkedin || '',
            website: macros.website || ''
          },
          references: {},
          education: {},
          skills: {},
          projects: {},
          employment: {}
        };

        chrome.storage.sync.set({ clipboardMacros: newStructure });
        console.log('Migrated clipboard macros to new nested structure');
      } else if (!macros.demographics) {
        // Ensure all folders exist
        chrome.storage.sync.set({
          clipboardMacros: {
            demographics: macros.demographics || {},
            references: macros.references || {},
            education: macros.education || {},
            skills: macros.skills || {},
            projects: macros.projects || {},
            employment: macros.employment || {}
          }
        });
      }
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
 * Message listener for commands from popup and content script
 * Handles: clipboard macros, job data logging, autofill Q&A
 *
 * Return values:
 * - Returns true for async operations that call sendResponse later
 * - All handlers use chrome.storage (async) or fetch (async), so all return true
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service Worker received message:', message);

  switch (message.action) {
    case 'getClipboardMacro':
      // Retrieve saved clipboard macro from storage (legacy support)
      handleGetClipboardMacro(message.key, sendResponse);
      return true; // Async: chrome.storage.sync.get

    case 'getClipboardFolder':
      // Retrieve all items in a clipboard folder
      handleGetClipboardFolder(message.folder, sendResponse);
      return true; // Async: chrome.storage.sync.get

    case 'saveClipboardMacro':
      // Save clipboard macro to storage
      handleSaveClipboardMacro(message.key, message.value, sendResponse);
      return true; // Async: chrome.storage.sync.set

    case 'logJobData':
      // Log job data to Google Sheets via Apps Script
      handleLogJobData(message.data, sendResponse);
      return true; // Async: fetch to external endpoint

    case 'searchDuplicate':
      // Search for duplicate job by URL
      handleSearchDuplicate(message.url, message.targetSheetName, sendResponse);
      return true; // Async: fetch to external endpoint

    case 'getRowByNumber':
      // Get row data by row number
      handleGetRowByNumber(message.rowNumber, message.targetSheetName, sendResponse);
      return true; // Async: fetch to external endpoint

    case 'getSheetSchema':
      // Get sheet schema (column headers)
      handleGetSheetSchema(message.targetSheetName, sendResponse);
      return true; // Async: fetch to external endpoint

    case 'findSimilarAnswer':
      // Find similar Q&A pair from database for autofill
      handleFindSimilarAnswer(message.question, sendResponse);
      return true; // Async: chrome.storage.local.get

    case 'saveQAPair':
      // Save new Q&A pair to database
      handleSaveQAPair(message.question, message.answer, sendResponse);
      return true; // Async: chrome.storage.local.set

    case 'configUpdated':
      // Reload configuration when settings are updated
      loadConfiguration().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async: loadConfiguration

    case 'getConfig':
      // Get current configuration
      sendResponse({
        success: true,
        config: configCache
      });
      return false; // Synchronous

    case 'getExtractorModes':
      // Get available extractor modes for schema mapping
      sendResponse({
        success: true,
        modes: EXTRACTOR_MODES
      });
      return false; // Synchronous

    case 'testConnection':
      // Test connection to Apps Script and Google Sheets
      testConnection(sendResponse);
      return true; // Async: fetch to external endpoint

    default:
      // Unknown action - return error
      sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      return false; // Synchronous error response
  }
});

// ============ CLIPBOARD FEATURE ============

/**
 * Get clipboard folder contents from sync storage
 * @param {string} folder - Folder name (demographics, references, etc.)
 * @param {Function} sendResponse - Response callback
 */
function handleGetClipboardFolder(folder, sendResponse) {
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    const items = result.clipboardMacros?.[folder] || {};
    sendResponse({ success: true, items });
  });
}

/**
 * Get clipboard macro value from sync storage (legacy support)
 * @param {string} key - Macro key (phone, email, address, linkedin, name, website)
 * @param {Function} sendResponse - Response callback
 */
function handleGetClipboardMacro(key, sendResponse) {
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    // Try to find in demographics folder (most common)
    const value = result.clipboardMacros?.demographics?.[key] || '';
    sendResponse({ success: true, value });
  });
}

/**
 * Save clipboard macro value to sync storage
 * @param {string} key - Macro key (phone, email, address, linkedin, name, website)
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
 * Test connection to Apps Script endpoint and Google Sheets
 *
 * NOTE: This function validates configuration locally for user convenience,
 * providing immediate feedback if settings are incomplete. The actual
 * spreadsheetId and projectId are NOT sent in the request - they're
 * configured server-side in Apps Script Script Properties. We only check
 * them here to give helpful error messages in the Settings UI.
 *
 * @param {Function} sendResponse - Response callback
 */
async function testConnection(sendResponse) {
  // Ensure configuration is loaded (service worker may have restarted)
  await loadConfiguration();

  const endpoint = getAppsScriptEndpoint();
  const spreadsheetId = getSpreadsheetId();
  const projectId = getProjectId();

  // Local validation for user convenience (these are NOT sent in the request)
  // We check them here to provide immediate feedback in Settings UI
  if (!endpoint || endpoint === 'YOUR_APPS_SCRIPT_URL_HERE') {
    sendResponse({
      success: false,
      error: 'Apps Script endpoint not configured. Please enter your endpoint URL.'
    });
    return;
  }

  if (!spreadsheetId || spreadsheetId === 'YOUR_SPREADSHEET_ID_HERE') {
    sendResponse({
      success: false,
      error: 'Spreadsheet ID not configured. Please enter your Spreadsheet ID.'
    });
    return;
  }

  if (!projectId || projectId === 'YOUR_PROJECT_ID_HERE') {
    sendResponse({
      success: false,
      error: 'Project ID not configured. Please enter your Project ID.'
    });
    return;
  }

  // Send a test request to the endpoint
  // NOTE: We only send job data fields. Spreadsheet ID and Project ID
  // are configured server-side in Apps Script using Script Properties.
  // This ensures secrets never traverse the network.
  const testData = {
    title: '(Test Connection)',
    company: '(Test)',
    location: '(Test)',
    url: 'https://test.com',
    timestamp: new Date().toISOString(),
    source: 'Connection Test'
  };

  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData),
    signal: AbortSignal.timeout(15000) // 15 second timeout
  })
    .then((response) => {
      if (!response.ok) {
        // Provide specific error messages based on status code
        if (response.status === 404) {
          throw new Error('Apps Script endpoint not found. Please check your endpoint URL.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check deployment permissions (should be "Anyone").');
        } else if (response.status === 401) {
          throw new Error('Authentication required. Please redeploy your Apps Script as a Web App.');
        } else if (response.status >= 500) {
          throw new Error('Apps Script server error. Check the execution log in Apps Script.');
        } else {
          throw new Error(`HTTP ${response.status} error. Check your deployment settings.`);
        }
      }
      return response.json();
    })
    .then((responseData) => {
      if (responseData.success) {
        sendResponse({
          success: true,
          message: 'Connection successful! Your configuration is working correctly.'
        });
      } else {
        // Parse error from Apps Script
        let errorMsg = responseData.error || 'Unknown error from Apps Script';

        if (errorMsg.includes('not found') || errorMsg.includes('Spreadsheet not found')) {
          errorMsg = 'Google Sheet not found. Please verify your Spreadsheet ID.';
        } else if (errorMsg.includes('Authorization') || errorMsg.includes('Permission')) {
          errorMsg = 'Cannot access Google Sheet. Please ensure the Apps Script owner has edit access.';
        } else if (errorMsg.includes('Invalid') && errorMsg.includes('spreadsheet')) {
          errorMsg = 'Invalid Spreadsheet ID. Please check your configuration.';
        }

        sendResponse({
          success: false,
          error: errorMsg
        });
      }
    })
    .catch((error) => {
      console.error('Connection test failed:', error);

      let errorMsg = 'Connection test failed';

      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMsg = 'Cannot connect to Apps Script. Please check:\n• Apps Script URL is correct\n• Script is deployed as Web App\n• You have internet connection';
      } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMsg = 'Connection timed out. Please check your internet connection.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      sendResponse({
        success: false,
        error: errorMsg
      });
    });
}

/**
 * Fetch with retry logic for transient network failures
 * Retries only on network errors and timeouts, not HTTP errors
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts (default 2)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response; // Success - return immediately
    } catch (error) {
      lastError = error;

      // Only retry on network errors and timeouts
      const isRetriable =
        error.name === 'TypeError' || // Network failure
        error.name === 'AbortError' || // Timeout
        error.message.includes('Failed to fetch') ||
        error.message.includes('timeout');

      // Don't retry if error is not retriable or we're out of attempts
      if (!isRetriable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s
      const delayMs = 1000 * Math.pow(2, attempt);
      console.log(`Network error on attempt ${attempt + 1}/${maxRetries + 1}. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Transform job data from extractor keys to column names using schema mapping
 * @param {Object} data - Job data with extractor keys (e.g., {company: "Google", jobTitle: "Engineer"})
 * @returns {Object} Data with column names (e.g., {Employer: "Google", "Job Title": "Engineer"})
 */
function transformDataToColumns(data) {
  const schemaMapping = configCache.SCHEMA_MAPPING || {};

  // Legacy field name mappings (for backwards compatibility with existing popup code)
  const legacyFieldMap = {
    'title': 'jobTitle',
    'description': 'notes',
    'source': 'board'
    // 'company' stays as 'company'
    // 'location' stays as 'location'
    // 'url' stays as 'url'
    // 'compensation' stays as 'compensation'
    // 'pay' stays as 'pay'
    // 'role' stays as 'role'
    // 'tailor' stays as 'tailor'
  };

  // Normalize data: convert legacy field names to extractor keys
  const normalizedData = {};
  Object.entries(data).forEach(([key, value]) => {
    const normalizedKey = legacyFieldMap[key] || key;
    normalizedData[normalizedKey] = value;
  });

  // If no schema mapping exists, return normalized data (fallback for backwards compatibility)
  if (!schemaMapping || Object.keys(schemaMapping).length === 0) {
    console.warn('No schema mapping configured. Using normalized data as-is.');
    return normalizedData;
  }

  // Create reverse mapping: extractorKey -> columnName
  const reverseMapping = {};
  Object.entries(schemaMapping).forEach(([columnName, extractorKey]) => {
    if (extractorKey && extractorKey !== 'none') {
      reverseMapping[extractorKey] = columnName;
    }
  });

  // Transform data using reverse mapping
  const transformedData = {};
  Object.entries(normalizedData).forEach(([key, value]) => {
    // Check if this key is an extractor mode that has a column mapping
    if (reverseMapping[key]) {
      transformedData[reverseMapping[key]] = value;
    } else {
      // If no mapping exists, use the original key (for backwards compatibility)
      transformedData[key] = value;
    }
  });

  console.log('Data transformation:', {
    originalKeys: Object.keys(data),
    normalizedKeys: Object.keys(normalizedData),
    transformedKeys: Object.keys(transformedData),
    mappingUsed: Object.keys(reverseMapping).length > 0
  });

  return transformedData;
}

/**
 * Log job data to Google Sheets via Apps Script endpoint
 * Includes retry logic for transient network failures
 * @param {Object} data - Job data to log
 * @param {Function} sendResponse - Response callback
 */
async function handleLogJobData(data, sendResponse) {
  // Ensure configuration is loaded (service worker may have restarted)
  await loadConfiguration();

  // Configuration: Set APPS_SCRIPT_URL in extension settings or replace here
  const endpoint = getAppsScriptEndpoint();

  // Validate data before sending (MVP: just checks it's a valid object)
  if (!validateJobData(data)) {
    console.warn('Invalid job data:', data);
    sendResponse({
      success: false,
      error: 'Invalid job data: must be a valid object'
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

  // NOTE: Spreadsheet ID and Project ID are NOT sent in the request.
  // They are configured server-side in Apps Script using Script Properties.
  // This security design ensures sensitive IDs never traverse the network.
  // The extension stores these values locally only for:
  // 1. Settings UI display and "Open Sheet" link
  // 2. User convenience (remembering configuration)

  // Transform data from extractor keys to column names using schema mapping
  const transformedData = transformDataToColumns(data);

  // Add target sheet name to the data
  const dataWithSheetName = {
    ...transformedData,
    targetSheetName: configCache.TARGET_SHEET_NAME || 'Job Applications'
  };

  // Send data to endpoint with retry logic
  // Note: Apps Script Web Apps support CORS, so we don't need 'no-cors' mode
  fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataWithSheetName), // Job data fields with sheet name
    signal: AbortSignal.timeout(15000) // 15 second timeout per attempt
  })
    .then((response) => {
      // Check if the response is ok (status 200-299)
      if (!response.ok) {
        // Provide specific error messages based on status code
        if (response.status === 404) {
          throw new Error('Apps Script endpoint not found. Please check your endpoint URL in Settings.');
        } else if (response.status === 403) {
          throw new Error('Access denied to Apps Script. Please check deployment permissions (should be "Anyone").');
        } else if (response.status === 401) {
          throw new Error('Authentication required. Please redeploy your Apps Script as a Web App.');
        } else if (response.status >= 500) {
          throw new Error('Apps Script server error. Please check the Apps Script execution log.');
        } else {
          throw new Error(`Apps Script returned error (HTTP ${response.status}). Check your deployment settings.`);
        }
      }
      return response.json();
    })
    .then((responseData) => {
      if (responseData.success) {
        console.log('Job data logged successfully');
        sendResponse({ success: true, timestamp: data.timestamp });
      } else {
        console.error('Apps Script returned error:', responseData.error);

        // Parse and improve error messages from Apps Script
        let errorMsg = responseData.error || 'Unknown error from Apps Script';

        // Detect common error patterns
        if (errorMsg.includes('not found') || errorMsg.includes('Spreadsheet not found')) {
          errorMsg = 'Google Sheet not found. Please verify your Spreadsheet ID in Settings.';
        } else if (errorMsg.includes('Authorization') || errorMsg.includes('Permission')) {
          errorMsg = 'Cannot access Google Sheet. Please ensure the Apps Script owner has edit access to the sheet.';
        } else if (errorMsg.includes('Invalid') && errorMsg.includes('spreadsheet')) {
          errorMsg = 'Invalid Spreadsheet ID. Please check your configuration in Settings.';
        }

        sendResponse({
          success: false,
          error: errorMsg
        });
      }
    })
    .catch((error) => {
      console.error('Failed to log job data:', error);

      // Provide user-friendly error messages based on error type
      let errorMsg = 'Unknown error occurred';

      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMsg = 'Cannot connect to Apps Script endpoint. Please check:\n' +
                   '1. Your Apps Script URL is correct\n' +
                   '2. The script is deployed as a Web App\n' +
                   '3. You have an internet connection';
      } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMsg = 'Connection to Apps Script timed out. Please check your internet connection or try again.';
      } else if (error.message.includes('CORS')) {
        errorMsg = 'CORS error. Please ensure your Apps Script is deployed with "Anyone" access.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      sendResponse({
        success: false,
        error: errorMsg
      });
    });
}

/**
 * Search for duplicate job entry by URL
 * @param {string} url - Job URL to search for
 * @param {string} targetSheetName - Target sheet name
 * @param {Function} sendResponse - Response callback
 */
function handleSearchDuplicate(url, targetSheetName, sendResponse) {
  const endpoint = getAppsScriptEndpoint();

  // Check if endpoint is configured
  if (!endpoint || endpoint === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('Apps Script endpoint not configured');
    sendResponse({
      success: false,
      error: 'Apps Script endpoint not configured. Please set up your Google Apps Script URL.'
    });
    return;
  }

  // Validate URL
  if (!url) {
    sendResponse({
      success: false,
      error: 'URL is required for duplicate search'
    });
    return;
  }

  // Send search request to endpoint
  const requestData = {
    action: 'searchDuplicate',
    url: url,
    targetSheetName: targetSheetName || configCache.TARGET_SHEET_NAME || 'Job Applications'
  };

  fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData),
    signal: AbortSignal.timeout(15000) // 15 second timeout
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} error during duplicate search`);
      }
      return response.json();
    })
    .then((responseData) => {
      if (responseData.success) {
        console.log('Duplicate search completed:', responseData.duplicate);
        sendResponse({
          success: true,
          duplicate: responseData.duplicate
        });
      } else {
        console.error('Duplicate search error:', responseData.error);
        sendResponse({
          success: false,
          error: responseData.error || 'Unknown error during duplicate search'
        });
      }
    })
    .catch((error) => {
      console.error('Failed to search for duplicate:', error);
      sendResponse({
        success: false,
        error: 'Duplicate search failed: ' + error.message
      });
    });
}

/**
 * Handle get row by number request
 * @param {number} rowNumber - Row number to retrieve
 * @param {string} targetSheetName - Target sheet name
 * @param {function} sendResponse - Response callback
 */
function handleGetRowByNumber(rowNumber, targetSheetName, sendResponse) {
  const endpoint = getAppsScriptEndpoint();

  // Check if endpoint is configured
  if (!endpoint || endpoint === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('Apps Script endpoint not configured');
    sendResponse({
      success: false,
      error: 'Apps Script endpoint not configured. Please set up your Google Apps Script URL.'
    });
    return;
  }

  // Validate row number
  if (!rowNumber || rowNumber < 2) {
    sendResponse({
      success: false,
      error: 'Valid row number (>= 2) is required'
    });
    return;
  }

  // Send request to endpoint
  const requestData = {
    action: 'getRowByNumber',
    rowNumber: parseInt(rowNumber),
    targetSheetName: targetSheetName || configCache.TARGET_SHEET_NAME || 'Job Applications'
  };

  fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData),
    signal: AbortSignal.timeout(15000) // 15 second timeout
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} error during row retrieval`);
      }
      return response.json();
    })
    .then((responseData) => {
      if (responseData.success) {
        console.log('Row retrieval completed:', responseData.rowData);
        sendResponse({
          success: true,
          rowData: responseData.rowData
        });
      } else {
        console.error('Row retrieval error:', responseData.error);
        sendResponse({
          success: false,
          error: responseData.error || 'Unknown error during row retrieval'
        });
      }
    })
    .catch((error) => {
      console.error('Failed to get row by number:', error);
      sendResponse({
        success: false,
        error: 'Row retrieval failed: ' + error.message
      });
    });
}

/**
 * Handle get sheet schema request
 * @param {string} targetSheetName - Target sheet name
 * @param {function} sendResponse - Response callback
 */
function handleGetSheetSchema(targetSheetName, sendResponse) {
  const endpoint = getAppsScriptEndpoint();

  // Check if endpoint is configured
  if (!endpoint || endpoint === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('Apps Script endpoint not configured');
    sendResponse({
      success: false,
      error: 'Apps Script endpoint not configured. Please set up your Google Apps Script URL.'
    });
    return;
  }

  // Send request to endpoint
  const requestData = {
    action: 'getSheetSchema',
    targetSheetName: targetSheetName || configCache.TARGET_SHEET_NAME || 'Job Applications'
  };

  fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData),
    signal: AbortSignal.timeout(15000) // 15 second timeout
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} error during schema retrieval`);
      }
      return response.json();
    })
    .then((responseData) => {
      if (responseData.success) {
        console.log('Schema retrieval completed:', responseData.schema);
        sendResponse({
          success: true,
          schema: responseData.schema
        });
      } else {
        console.error('Schema retrieval error:', responseData.error);
        sendResponse({
          success: false,
          error: responseData.error || 'Unknown error during schema retrieval'
        });
      }
    })
    .catch((error) => {
      console.error('Failed to get sheet schema:', error);
      sendResponse({
        success: false,
        error: 'Schema retrieval failed: ' + error.message
      });
    });
}

// Try to import config.local.js (will fail silently if not present)
try {
  importScripts('config.local.js');
} catch (error) {
  console.log('config.local.js not found, using chrome.storage for configuration');
}

/**
 * Get Apps Script endpoint URL from cached configuration
 * @returns {string} Endpoint URL
 */
function getAppsScriptEndpoint() {
  return configCache.APPS_SCRIPT_ENDPOINT;
}

/**
 * Get Spreadsheet ID from cached configuration
 * @returns {string} Spreadsheet ID
 */
function getSpreadsheetId() {
  return configCache.SPREADSHEET_ID;
}

/**
 * Get Project ID from cached configuration
 * @returns {string} Project ID
 */
function getProjectId() {
  return configCache.PROJECT_ID;
}

/**
 * Check if manual entry is enabled
 * @returns {boolean} True if manual entry is enabled
 */
function isManualEntryEnabled() {
  return configCache.ENABLE_MANUAL_ENTRY;
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

  // MVP: Accept partial data - just check that it's a valid object
  // The Apps Script endpoint will handle missing fields with defaults
  // This allows us to capture whatever data is available from the page

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
