// Settings page JavaScript

// Default configuration values
const DEFAULT_CONFIG = {
  APPS_SCRIPT_ENDPOINT: '',
  SPREADSHEET_ID: '',
  PROJECT_ID: '',
  ENABLE_MANUAL_ENTRY: true
};

// Load settings when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// Load settings from Chrome storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'APPS_SCRIPT_ENDPOINT',
      'SPREADSHEET_ID',
      'PROJECT_ID',
      'ENABLE_MANUAL_ENTRY'
    ]);

    // Populate form fields
    document.getElementById('appsScriptEndpoint').value = result.APPS_SCRIPT_ENDPOINT || '';
    document.getElementById('spreadsheetId').value = result.SPREADSHEET_ID || '';
    document.getElementById('projectId').value = result.PROJECT_ID || '';
    document.getElementById('enableManualEntry').checked =
      result.ENABLE_MANUAL_ENTRY !== undefined ? result.ENABLE_MANUAL_ENTRY : true;

    // Update connection status
    updateConnectionStatus(result);
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Save button
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // Reset button
  document.getElementById('resetSettings').addEventListener('click', resetSettings);

  // Upload config button
  document.getElementById('uploadConfig').addEventListener('click', uploadConfig);

  // File input change handler
  document.getElementById('configFileInput').addEventListener('change', handleConfigFileUpload);

  // Download config button
  document.getElementById('downloadConfig').addEventListener('click', downloadConfig);

  // Test connection button
  document.getElementById('testConnection').addEventListener('click', testConnection);

  // Real-time connection status updates
  document.getElementById('spreadsheetId').addEventListener('input', updateConnectionStatusFromInputs);
  document.getElementById('appsScriptEndpoint').addEventListener('input', updateConnectionStatusFromInputs);
  document.getElementById('projectId').addEventListener('input', updateConnectionStatusFromInputs);
}

// Save settings to Chrome storage
async function saveSettings() {
  const settings = {
    APPS_SCRIPT_ENDPOINT: document.getElementById('appsScriptEndpoint').value.trim(),
    SPREADSHEET_ID: document.getElementById('spreadsheetId').value.trim(),
    PROJECT_ID: document.getElementById('projectId').value.trim(),
    ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked
  };

  // Validate inputs
  if (settings.APPS_SCRIPT_ENDPOINT && !isValidUrl(settings.APPS_SCRIPT_ENDPOINT)) {
    showStatus('Invalid Apps Script Endpoint URL', 'error');
    return;
  }

  try {
    // Save to Chrome storage
    await chrome.storage.sync.set(settings);

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
    await chrome.storage.sync.set(DEFAULT_CONFIG);
    await loadSettings();
    showStatus('Settings reset to defaults', 'info');
  } catch (error) {
    console.error('Error resetting settings:', error);
    showStatus('Error resetting settings: ' + error.message, 'error');
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
      ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked
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
      ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked
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
