// Settings page JavaScript

// Default configuration values
const DEFAULT_CONFIG = {
  APPS_SCRIPT_ENDPOINT: '',
  SPREADSHEET_ID: '',
  PROJECT_ID: '',
  ENABLE_MANUAL_ENTRY: true,
  TARGET_SHEET_NAME: 'Job Applications'
};

// Default clipboard macros (nested structure)
const DEFAULT_MACROS = {
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
};

// Default clipboard macros (nested structure)
const DEFAULT_MACROS = {
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
};

// Load settings when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  setupFolderHandlers();
  setupCloseLink();
});

// Setup close settings link
function setupCloseLink() {
  const closeLink = document.getElementById('closeSettingsLink');
  if (closeLink) {
    closeLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Close the current tab
      chrome.tabs.getCurrent((tab) => {
        if (tab) {
          chrome.tabs.remove(tab.id);
        }
      });
    });
  }
}

// Load settings from Chrome storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'APPS_SCRIPT_ENDPOINT',
      'SPREADSHEET_ID',
      'PROJECT_ID',
      'ENABLE_MANUAL_ENTRY',
      'TARGET_SHEET_NAME',
      'clipboardMacros',
      'maxSearchResults',
      'debugConsoleEnabled'
    ]);

    // Populate form fields
    document.getElementById('appsScriptEndpoint').value = result.APPS_SCRIPT_ENDPOINT || '';
    document.getElementById('spreadsheetId').value = result.SPREADSHEET_ID || '';
    document.getElementById('projectId').value = result.PROJECT_ID || '';
    document.getElementById('targetSheetName').value = result.TARGET_SHEET_NAME || 'Job Applications';
    document.getElementById('enableManualEntry').checked =
      result.ENABLE_MANUAL_ENTRY !== undefined ? result.ENABLE_MANUAL_ENTRY : true;

    // Populate search settings
    document.getElementById('maxSearchResults').value = result.maxSearchResults || 10;

    // Populate debug console setting
    document.getElementById('debugConsoleEnabled').checked = result.debugConsoleEnabled || false;

    // Populate clipboard macro folders
    const macros = result.clipboardMacros || DEFAULT_MACROS;
    const folders = ['demographics', 'references', 'education', 'skills', 'projects', 'employment'];

    folders.forEach(folder => {
      const textarea = document.querySelector(`.folder-json-editor[data-folder="${folder}"]`);
      if (textarea) {
        const folderData = macros[folder] || {};
        textarea.value = JSON.stringify(folderData, null, 2);
      }
    });

    // Update connection status
    updateConnectionStatus(result);
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Save all settings button
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // Save clipboard macros button (specific to clipboard section)
  document.getElementById('saveClipboardMacros').addEventListener('click', saveClipboardMacros);

  // Reset button
  document.getElementById('resetSettings').addEventListener('click', resetSettings);

  // Upload config button
  document.getElementById('uploadConfig').addEventListener('click', uploadConfig);

  // File input change handler
  document.getElementById('configFileInput').addEventListener('change', handleConfigFileUpload);

  // Download config button
  document.getElementById('downloadConfig').addEventListener('click', downloadConfig);

  // Clear all data button
  document.getElementById('clearAllData').addEventListener('click', clearAllData);

  // Test connection button
  document.getElementById('testConnection').addEventListener('click', testConnection);

  // Real-time connection status updates
  document.getElementById('spreadsheetId').addEventListener('input', updateConnectionStatusFromInputs);
  document.getElementById('appsScriptEndpoint').addEventListener('input', updateConnectionStatusFromInputs);
  document.getElementById('projectId').addEventListener('input', updateConnectionStatusFromInputs);

  // Export/Import all settings buttons
  document.getElementById('exportAllSettings').addEventListener('click', exportAllSettings);
  document.getElementById('importAllSettings').addEventListener('click', importAllSettings);
  document.getElementById('importFileInput').addEventListener('change', handleImportFile);
}

// Setup folder expand/collapse and JSON validation
function setupFolderHandlers() {
  // Folder header click handlers
  const folderHeaders = document.querySelectorAll('.folder-header');
  folderHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const folder = header.getAttribute('data-folder');
      toggleFolder(header, folder);
    });
  });

  // JSON editor validation on input
  const editors = document.querySelectorAll('.folder-json-editor');
  editors.forEach(editor => {
    editor.addEventListener('input', () => {
      const folder = editor.getAttribute('data-folder');
      validateFolderJSON(folder);
    });
  });
}

// Toggle folder expand/collapse
function toggleFolder(header, folder) {
  const content = document.getElementById(`folder-${folder}`);
  const isExpanded = header.classList.contains('expanded');

  if (isExpanded) {
    header.classList.remove('expanded');
    content.style.display = 'none';
  } else {
    header.classList.add('expanded');
    content.style.display = 'block';
  }
}

// Recursively validate object values (must be strings or nested objects)
function validateObjectValues(obj, path) {
  for (const [key, val] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof val === 'string') {
      // Strings are valid leaf values
      continue;
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      // Nested objects are valid - recurse
      validateObjectValues(val, currentPath);
    } else {
      // Arrays, null, numbers, booleans, etc. are not allowed
      const typeDesc = Array.isArray(val) ? 'array' : typeof val;
      throw new Error(`Value at "${currentPath}" must be a string or object, not ${typeDesc}`);
    }
  }
}

// Validate JSON for a folder
function validateFolderJSON(folder) {
  const textarea = document.querySelector(`.folder-json-editor[data-folder="${folder}"]`);
  const errorDiv = document.querySelector(`.folder-error[data-folder="${folder}"]`);

  if (!textarea || !errorDiv) return;

  try {
    const value = textarea.value.trim();
    if (value === '') {
      // Empty is valid (will use {})
      textarea.classList.remove('error');
      errorDiv.classList.remove('visible');
      errorDiv.textContent = '';
      return true;
    }

    const parsed = JSON.parse(value);

    // Must be an object, not an array
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Must be a JSON object, not an array');
    }

    // Validate values recursively (strings or nested objects)
    validateObjectValues(parsed, '');

    // Valid JSON
    textarea.classList.remove('error');
    errorDiv.classList.remove('visible');
    errorDiv.textContent = '';
    return true;
  } catch (error) {
    // Invalid JSON
    textarea.classList.add('error');
    errorDiv.classList.add('visible');
    errorDiv.textContent = `Invalid JSON: ${error.message}`;
    return false;
  }
}

// Save only clipboard macros to Chrome storage
async function saveClipboardMacros() {
  const folders = ['demographics', 'references', 'education', 'skills', 'projects', 'employment'];
  const clipboardMacros = {};
  let hasErrors = false;

  // Validate all folders
  for (const folder of folders) {
    if (!validateFolderJSON(folder)) {
      hasErrors = true;
      continue;
    }

    const textarea = document.querySelector(`.folder-json-editor[data-folder="${folder}"]`);
    if (textarea) {
      const value = textarea.value.trim();
      if (value === '') {
        clipboardMacros[folder] = {};
      } else {
        try {
          clipboardMacros[folder] = JSON.parse(value);
        } catch (error) {
          hasErrors = true;
          showClipboardStatus(`Invalid JSON in ${folder}: ${error.message}`, 'error');
        }
      }
    }
  }

  if (hasErrors) {
    showClipboardStatus('Please fix JSON errors before saving', 'error');
    return;
  }

  // Get search settings
  const maxSearchResults = parseInt(document.getElementById('maxSearchResults').value, 10);

  // Get debug console setting
  const debugConsoleEnabled = document.getElementById('debugConsoleEnabled').checked;

  // Validate search results count
  if (isNaN(maxSearchResults) || maxSearchResults < 5 || maxSearchResults > 50) {
    showClipboardStatus('Maximum search results must be between 5 and 50', 'error');
    return;
  }

  try {
    // Save clipboard macros and settings to Chrome storage
    await chrome.storage.sync.set({ clipboardMacros, maxSearchResults, debugConsoleEnabled });
    showClipboardStatus('Settings saved successfully!', 'success');
    console.log('Clipboard macros saved:', clipboardMacros);
    console.log('Max search results:', maxSearchResults);
    console.log('Debug console enabled:', debugConsoleEnabled);
  } catch (error) {
    showClipboardStatus('Error saving clipboard macros', 'error');
    console.error('Error saving clipboard macros:', error);
  }
}

// Helper to show status for clipboard macros save
function showClipboardStatus(message, type) {
  const statusDiv = document.getElementById('clipboardSaveStatus');
  if (!statusDiv) return;

  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;
  statusDiv.style.display = 'block';

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

// Save settings to Chrome storage
async function saveSettings() {
  const settings = {
    APPS_SCRIPT_ENDPOINT: document.getElementById('appsScriptEndpoint').value.trim(),
    SPREADSHEET_ID: document.getElementById('spreadsheetId').value.trim(),
    PROJECT_ID: document.getElementById('projectId').value.trim(),
    ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked,
    TARGET_SHEET_NAME: document.getElementById('targetSheetName').value.trim() || 'Job Applications'
  };

  // Get and validate clipboard macros
  const folders = ['demographics', 'references', 'education', 'skills', 'projects', 'employment'];
  const clipboardMacros = {};
  let hasErrors = false;

  for (const folder of folders) {
    if (!validateFolderJSON(folder)) {
      hasErrors = true;
      continue;
    }

    const textarea = document.querySelector(`.folder-json-editor[data-folder="${folder}"]`);
    if (textarea) {
      const value = textarea.value.trim();
      if (value === '') {
        clipboardMacros[folder] = {};
      } else {
        try {
          clipboardMacros[folder] = JSON.parse(value);
        } catch (error) {
          hasErrors = true;
          showStatus(`Invalid JSON in ${folder}: ${error.message}`, 'error');
        }
      }
    }
  }

  if (hasErrors) {
    showStatus('Please fix JSON errors before saving', 'error');
    return;
  }

  // Validate Google Sheets inputs
  if (settings.APPS_SCRIPT_ENDPOINT && !isValidUrl(settings.APPS_SCRIPT_ENDPOINT)) {
    showStatus('Invalid Apps Script Endpoint URL', 'error');
    return;
  }

  try {
    // Save to Chrome storage
    await chrome.storage.sync.set({ ...settings, clipboardMacros });

    // Update connection status
    updateConnectionStatus(settings);

    showStatus('Settings saved successfully!', 'success');

    // Notify service worker that config has changed
    chrome.runtime.sendMessage({ action: 'configUpdated' });
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

// Reset settings to defaults
async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults?')) {
    return;
  }

  try {
    await chrome.storage.sync.set({ ...DEFAULT_CONFIG, clipboardMacros: DEFAULT_MACROS });
    await loadSettings();
    showStatus('Settings reset to defaults', 'info');
  } catch (error) {
    console.error('Error resetting settings:', error);
    showStatus('Error resetting settings: ' + error.message, 'error');
  }
}

// Clear all extension data (privacy control)
async function clearAllData() {
  const confirmMessage =
    'Are you sure you want to clear ALL extension data?\n\n' +
    'This will permanently delete:\n' +
    '• Clipboard macros (phone, email, etc.)\n' +
    '• Autofill Q&A database\n' +
    '• All settings\n\n' +
    'This action CANNOT be undone!';

  if (!confirm(confirmMessage)) {
    return;
  }

  // Double confirmation for extra safety
  if (!confirm('Last confirmation: Delete all data?')) {
    return;
  }

  try {
    // Clear both sync and local storage
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();

    showStatus('All data cleared successfully', 'info');

    // Reload the page to show empty state
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    console.error('Error clearing data:', error);
    showStatus('Error clearing data: ' + error.message, 'error');
  }
}

// Upload config.local.js file
function uploadConfig() {
  // Trigger the hidden file input
  document.getElementById('configFileInput').click();
}

// Handle config file upload
async function handleConfigFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check file extension
  if (!file.name.endsWith('.js')) {
    showStatus('Please select a valid .js file', 'error');
    return;
  }

  try {
    // Read file content
    const content = await file.text();

    // Parse the config from the file
    const config = parseConfigFile(content);

    if (!config) {
      showStatus('Invalid config file format', 'error');
      return;
    }

    // Populate form fields
    document.getElementById('appsScriptEndpoint').value = config.APPS_SCRIPT_ENDPOINT || '';
    document.getElementById('spreadsheetId').value = config.SPREADSHEET_ID || '';
    document.getElementById('projectId').value = config.PROJECT_ID || '';

    // Update connection status
    updateConnectionStatusFromInputs();

    // Auto-save to chrome.storage
    const settings = {
      APPS_SCRIPT_ENDPOINT: config.APPS_SCRIPT_ENDPOINT || '',
      SPREADSHEET_ID: config.SPREADSHEET_ID || '',
      PROJECT_ID: config.PROJECT_ID || '',
      ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked,
      TARGET_SHEET_NAME: document.getElementById('targetSheetName').value.trim() || 'Job Applications'
    };

    await chrome.storage.sync.set(settings);

    showStatus('Configuration loaded from file and saved successfully!', 'success');

    // Notify service worker
    chrome.runtime.sendMessage({ action: 'configUpdated' });

  } catch (error) {
    console.error('Error reading config file:', error);
    showStatus('Error reading config file: ' + error.message, 'error');
  }

  // Clear the file input so the same file can be selected again
  event.target.value = '';
}

// Parse config.local.js file content
function parseConfigFile(content) {
  try {
    // Remove comments and whitespace
    const cleanContent = content
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');

    // Extract CONFIG object using regex
    // Look for const CONFIG = { ... }; or var CONFIG = { ... };
    const configMatch = cleanContent.match(/(?:const|var|let)\s+CONFIG\s*=\s*\{([^}]+)\}/s);

    if (!configMatch) {
      return null;
    }

    const configBody = configMatch[1];

    // Extract individual values
    const endpoint = extractConfigValue(configBody, 'APPS_SCRIPT_ENDPOINT');
    const spreadsheetId = extractConfigValue(configBody, 'SPREADSHEET_ID');
    const projectId = extractConfigValue(configBody, 'PROJECT_ID');

    return {
      APPS_SCRIPT_ENDPOINT: endpoint,
      SPREADSHEET_ID: spreadsheetId,
      PROJECT_ID: projectId
    };

  } catch (error) {
    console.error('Error parsing config file:', error);
    return null;
  }
}

// Extract a config value from the config body
function extractConfigValue(configBody, key) {
  const regex = new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`);
  const match = configBody.match(regex);
  return match ? match[1] : '';
}

// Test connection to Apps Script and Google Sheets
async function testConnection() {
  const button = document.getElementById('testConnection');
  const statusDiv = document.getElementById('saveStatus');
  const originalText = button.textContent;

  // Clear any previous status messages
  statusDiv.style.display = 'none';
  statusDiv.textContent = '';

  // Disable button and show loading state
  button.disabled = true;
  button.textContent = 'Testing...';

  try {
    // First, save current settings to ensure service worker has latest config
    const settings = {
      APPS_SCRIPT_ENDPOINT: document.getElementById('appsScriptEndpoint').value.trim(),
      SPREADSHEET_ID: document.getElementById('spreadsheetId').value.trim(),
      PROJECT_ID: document.getElementById('projectId').value.trim(),
      ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked,
      TARGET_SHEET_NAME: document.getElementById('targetSheetName').value.trim() || 'Job Applications'
    };

    await chrome.storage.sync.set(settings);
    await chrome.runtime.sendMessage({ action: 'configUpdated' });

    // Small delay to ensure config is reloaded
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now test the connection
    const response = await chrome.runtime.sendMessage({ action: 'testConnection' });

    if (response.success) {
      showStatus(response.message || 'Connection successful!', 'success');
    } else {
      showStatus(response.error || 'Connection test failed', 'error');
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    showStatus('Error testing connection: ' + error.message, 'error');
  } finally {
    // Re-enable button
    button.disabled = false;
    button.textContent = originalText;
  }
}

// Download config.local.js file
function downloadConfig() {
  const endpoint = document.getElementById('appsScriptEndpoint').value.trim();
  const spreadsheetId = document.getElementById('spreadsheetId').value.trim();
  const projectId = document.getElementById('projectId').value.trim();

  // Generate config file content
  const configContent = `// JobSprint Configuration
// This file is generated from the settings page
// Do not commit this file to version control

const CONFIG = {
  APPS_SCRIPT_ENDPOINT: '${endpoint || 'YOUR_APPS_SCRIPT_URL_HERE'}',
  SPREADSHEET_ID: '${spreadsheetId || 'YOUR_SPREADSHEET_ID_HERE'}',
  PROJECT_ID: '${projectId || 'YOUR_PROJECT_ID_HERE'}',
};

// Expose CONFIG to different environments
if (typeof self !== 'undefined') {
  self.APP_CONFIG = CONFIG;
}
if (typeof global !== 'undefined') {
  global.APP_CONFIG = CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
`;

  // Create blob and download
  const blob = new Blob([configContent], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.local.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showStatus('Config file downloaded! Place it in the extension root directory.', 'success');
}

// Update connection status based on current settings
function updateConnectionStatus(settings) {
  const statusDiv = document.getElementById('connectionStatus');
  const openSheetLink = document.getElementById('openSheetLink');
  const testConnectionBtn = document.getElementById('testConnection');

  const hasEndpoint = settings.APPS_SCRIPT_ENDPOINT &&
                      settings.APPS_SCRIPT_ENDPOINT !== 'YOUR_APPS_SCRIPT_URL_HERE' &&
                      settings.APPS_SCRIPT_ENDPOINT !== '';
  const hasSpreadsheetId = settings.SPREADSHEET_ID &&
                           settings.SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE' &&
                           settings.SPREADSHEET_ID !== '';
  const hasProjectId = settings.PROJECT_ID &&
                       settings.PROJECT_ID !== 'YOUR_PROJECT_ID_HERE' &&
                       settings.PROJECT_ID !== '';

  if (hasEndpoint && hasSpreadsheetId && hasProjectId) {
    statusDiv.textContent = '✓ Connected to Google Sheets';
    statusDiv.className = 'connection-status connected';

    // Enable the "Open Sheet" link
    openSheetLink.href = `https://docs.google.com/spreadsheets/d/${settings.SPREADSHEET_ID}/edit`;
    openSheetLink.target = '_blank';
    openSheetLink.classList.remove('disabled');
    openSheetLink.textContent = '📊 Open Google Sheet';

    // Enable the "Test Connection" button
    testConnectionBtn.disabled = false;
  } else {
    statusDiv.textContent = 'Please configure all fields to connect';
    statusDiv.className = 'connection-status disconnected';

    // Disable the "Open Sheet" link
    openSheetLink.href = '#';
    openSheetLink.removeAttribute('target');
    openSheetLink.classList.add('disabled');
    openSheetLink.textContent = 'Open Google Sheet (Configure first)';

    // Disable the "Test Connection" button
    testConnectionBtn.disabled = true;
  }
}

// Update connection status from form inputs in real-time
function updateConnectionStatusFromInputs() {
  const settings = {
    APPS_SCRIPT_ENDPOINT: document.getElementById('appsScriptEndpoint').value.trim(),
    SPREADSHEET_ID: document.getElementById('spreadsheetId').value.trim(),
    PROJECT_ID: document.getElementById('projectId').value.trim()
  };
  updateConnectionStatus(settings);
}

// Validate URL format
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Show status message
function showStatus(message, type) {
  const statusDiv = document.getElementById('saveStatus');
  statusDiv.textContent = message;
  statusDiv.className = 'status-message';

  if (type === 'success') {
    statusDiv.style.backgroundColor = '#d4edda';
    statusDiv.style.color = '#155724';
    statusDiv.textContent = '✓ ' + message;
  } else if (type === 'error') {
    statusDiv.style.backgroundColor = '#f8d7da';
    statusDiv.style.color = '#721c24';
    statusDiv.textContent = '✗ ' + message;
  } else if (type === 'info') {
    statusDiv.style.backgroundColor = '#d1ecf1';
    statusDiv.style.color = '#0c5460';
    statusDiv.textContent = 'ℹ ' + message;
  }

  statusDiv.style.display = 'block';
  statusDiv.style.padding = '10px';
  statusDiv.style.borderRadius = '4px';
  statusDiv.style.marginTop = '10px';

  // Clear after 5 seconds
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

// Export all settings to JSON file
async function exportAllSettings() {
  try {
    // Get all data from chrome.storage.sync
    const syncData = await chrome.storage.sync.get(null);

    // Get all data from chrome.storage.local (includes qaDatabase)
    const localData = await chrome.storage.local.get(null);

    // Combine all data
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      sync: syncData,
      local: localData
    };

    // Create JSON blob
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `jobsprint-backup-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('All settings exported successfully!', 'success');
    console.log('Export complete. Data exported:', exportData);
  } catch (error) {
    console.error('Error exporting settings:', error);
    showStatus('Error exporting settings: ' + error.message, 'error');
  }
}

// Trigger import file picker
function importAllSettings() {
  document.getElementById('importFileInput').click();
}

// Handle import file upload
async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check file extension
  if (!file.name.endsWith('.json')) {
    showStatus('Please select a valid .json file', 'error');
    return;
  }

  // Confirm before importing (data will be overwritten)
  const confirmMessage =
    'Importing will REPLACE all current extension data.\n\n' +
    'Current data will be overwritten including:\n' +
    '• Clipboard macros\n' +
    '• Autofill Q&A database\n' +
    '• All settings\n\n' +
    'Are you sure you want to continue?';

  if (!confirm(confirmMessage)) {
    event.target.value = ''; // Clear the file input
    return;
  }

  try {
    // Read file content
    const content = await file.text();
    const importData = JSON.parse(content);

    // Validate import data structure
    if (!importData.version || !importData.sync) {
      showStatus('Invalid backup file format', 'error');
      event.target.value = '';
      return;
    }

    // Restore sync storage
    if (importData.sync && Object.keys(importData.sync).length > 0) {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(importData.sync);
      console.log('Sync storage restored:', importData.sync);
    }

    // Restore local storage
    if (importData.local && Object.keys(importData.local).length > 0) {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(importData.local);
      console.log('Local storage restored:', importData.local);
    }

    showStatus('All settings imported successfully! Reloading...', 'success');

    // Notify service worker that config has changed
    chrome.runtime.sendMessage({ action: 'configUpdated' });

    // Reload the page after a short delay to show the imported settings
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error) {
    console.error('Error importing settings:', error);
    showStatus('Error importing settings: ' + error.message, 'error');
  }

  // Clear the file input so the same file can be selected again
  event.target.value = '';
}
