// Settings page JavaScript

// Default configuration values
const DEFAULT_CONFIG = {
  APPS_SCRIPT_ENDPOINT: '',
  SPREADSHEET_ID: '',
  PROJECT_ID: '',
  ENABLE_MANUAL_ENTRY: true
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

// Global state for resume parser
let currentParsedData = null;
let currentSectionType = null;

// Load settings when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  setupFolderHandlers();
  setupResumeParserHandlers();
});

// Load settings from Chrome storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'APPS_SCRIPT_ENDPOINT',
      'SPREADSHEET_ID',
      'PROJECT_ID',
      'ENABLE_MANUAL_ENTRY',
      'clipboardMacros',
      'maxSearchResults',
      'debugConsoleEnabled',
      'resumeParserConfig'
    ]);

    // Populate form fields
    document.getElementById('appsScriptEndpoint').value = result.APPS_SCRIPT_ENDPOINT || '';
    document.getElementById('spreadsheetId').value = result.SPREADSHEET_ID || '';
    document.getElementById('projectId').value = result.PROJECT_ID || '';
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

    // Populate parser configuration
    const parserConfig = result.resumeParserConfig || DEFAULT_PARSER_CONFIG;
    document.getElementById('parserConfigEditor').value = JSON.stringify(parserConfig, null, 2);

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
    ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked
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

// ===== Resume Parser Functions =====

// Setup resume parser event handlers
function setupResumeParserHandlers() {
  // Parse button
  document.getElementById('parseResumeBtn').addEventListener('click', handleParseResume);

  // Clear button
  document.getElementById('clearParserBtn').addEventListener('click', () => {
    document.getElementById('resumeInputText').value = '';
    document.getElementById('parserOutput').style.display = 'none';
    currentParsedData = null;
    currentSectionType = null;
  });

  // Add to clipboard button
  document.getElementById('addToClipboardBtn').addEventListener('click', handleAddToClipboard);

  // Discard button
  document.getElementById('discardResultBtn').addEventListener('click', () => {
    document.getElementById('parserOutput').style.display = 'none';
    currentParsedData = null;
    currentSectionType = null;
  });

  // Parser config save
  document.getElementById('saveParserConfig').addEventListener('click', saveParserConfig);

  // Parser config reset
  document.getElementById('resetParserConfig').addEventListener('click', () => {
    document.getElementById('parserConfigEditor').value = JSON.stringify(DEFAULT_PARSER_CONFIG, null, 2);
    saveParserConfig();
  });

  // Skills search
  document.getElementById('skillSearchInput').addEventListener('input', (e) => {
    filterSkills(e.target.value);
  });
}

// Handle parse resume button click
async function handleParseResume() {
  const sectionType = document.getElementById('resumeSectionType').value;
  const inputText = document.getElementById('resumeInputText').value.trim();

  if (!inputText) {
    showParserStatus('Please paste some text to parse', 'error');
    return;
  }

  try {
    // Get parser config
    const result = await chrome.storage.sync.get(['resumeParserConfig']);
    const parserConfig = result.resumeParserConfig || DEFAULT_PARSER_CONFIG;

    // Parse the section
    const parsedData = parseResumeSection(sectionType, inputText, parserConfig[sectionType]);

    // Store in global state
    currentParsedData = parsedData;
    currentSectionType = sectionType;

    // Display the result
    displayParsedResult(parsedData, sectionType);

    showParserStatus('Parsing successful!', 'success');
  } catch (error) {
    console.error('Error parsing resume:', error);
    showParserStatus('Error parsing: ' + error.message, 'error');
  }
}

// Display parsed result
function displayParsedResult(data, sectionType) {
  const outputDiv = document.getElementById('parserOutput');
  const resultDisplay = document.getElementById('parserResultDisplay');
  const skillsReviewUI = document.getElementById('skillsReviewUI');
  const missingFieldsDialog = document.getElementById('missingFieldsDialog');

  // Show output section
  outputDiv.style.display = 'block';

  // Display based on section type
  if (sectionType === 'skills') {
    // Skills: show as array with review UI
    resultDisplay.textContent = JSON.stringify(data, null, 2);
    skillsReviewUI.style.display = 'block';
    missingFieldsDialog.style.display = 'none';

    renderSkillsList(data);
  } else {
    // Other sections: show as JSON
    resultDisplay.textContent = JSON.stringify(data, null, 2);
    skillsReviewUI.style.display = 'none';

    // Check for missing fields
    const missingFields = findMissingFields(data, sectionType);
    if (missingFields.length > 0) {
      renderMissingFieldsDialog(missingFields, data);
      missingFieldsDialog.style.display = 'block';
    } else {
      missingFieldsDialog.style.display = 'none';
    }
  }

  // Scroll to result
  outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Render skills list with remove buttons
function renderSkillsList(skills) {
  const container = document.getElementById('skillsListContainer');
  container.innerHTML = '';

  if (!Array.isArray(skills)) {
    skills = Object.values(skills);
  }

  skills.forEach((skill, index) => {
    const skillItem = document.createElement('div');
    skillItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-bottom: 4px; background: #f8f9fa; border-radius: 4px;';
    skillItem.dataset.skill = skill;

    const skillText = document.createElement('span');
    skillText.textContent = skill;
    skillText.style.flex = '1';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'background: #e74c3c; color: white; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;';
    removeBtn.addEventListener('click', () => {
      removeSkill(skill);
    });

    skillItem.appendChild(skillText);
    skillItem.appendChild(removeBtn);
    container.appendChild(skillItem);
  });
}

// Remove skill from the list
function removeSkill(skillToRemove) {
  if (Array.isArray(currentParsedData)) {
    currentParsedData = currentParsedData.filter(s => s !== skillToRemove);
  }
  renderSkillsList(currentParsedData);
  document.getElementById('parserResultDisplay').textContent = JSON.stringify(currentParsedData, null, 2);
}

// Filter skills based on search
function filterSkills(searchTerm) {
  const container = document.getElementById('skillsListContainer');
  const skillItems = container.querySelectorAll('[data-skill]');

  const lowerSearch = searchTerm.toLowerCase();

  skillItems.forEach(item => {
    const skill = item.dataset.skill.toLowerCase();
    if (skill.includes(lowerSearch)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Find missing fields in parsed data
function findMissingFields(data, sectionType) {
  const missing = [];

  if (typeof data !== 'object') return missing;

  function checkObject(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        if (value === '') {
          missing.push({ path: fullPath, key });
        }
      } else if (typeof value === 'object' && value !== null) {
        checkObject(value, fullPath);
      }
    }
  }

  checkObject(data);
  return missing;
}

// Render missing fields dialog
function renderMissingFieldsDialog(missingFields, data) {
  const container = document.getElementById('missingFieldsContainer');
  container.innerHTML = '<p style="margin: 0 0 10px 0; font-weight: 500;">Some fields were not detected. You can fill them in below or leave them empty:</p>';

  missingFields.forEach(({ path, key }) => {
    const fieldGroup = document.createElement('div');
    fieldGroup.style.marginBottom = '10px';

    const label = document.createElement('label');
    label.textContent = key.charAt(0).toUpperCase() + key.slice(1) + ':';
    label.style.display = 'block';
    label.style.marginBottom = '4px';
    label.style.fontWeight = '500';

    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 13px;';
    input.dataset.path = path;
    input.placeholder = `Enter ${key}...`;

    // Update data on input
    input.addEventListener('input', (e) => {
      updateNestedValue(data, path, e.target.value);
      currentParsedData = data;
      document.getElementById('parserResultDisplay').textContent = JSON.stringify(data, null, 2);
    });

    fieldGroup.appendChild(label);
    fieldGroup.appendChild(input);
    container.appendChild(fieldGroup);
  });
}

// Update nested value in object by path
function updateNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
}

// Handle add to clipboard button
async function handleAddToClipboard() {
  if (!currentParsedData || !currentSectionType) {
    showParserStatus('No parsed data to add', 'error');
    return;
  }

  try {
    // Get current clipboard macros
    const result = await chrome.storage.sync.get(['clipboardMacros']);
    const macros = result.clipboardMacros || DEFAULT_MACROS;

    // For skills, convert array to object format
    let dataToAdd = currentParsedData;
    if (currentSectionType === 'skills' && Array.isArray(currentParsedData)) {
      dataToAdd = {};
      currentParsedData.forEach((skill, index) => {
        dataToAdd[`skill_${index + 1}`] = skill;
      });
    }

    // Merge with existing data
    macros[currentSectionType] = {
      ...macros[currentSectionType],
      ...dataToAdd
    };

    // Save back to storage
    await chrome.storage.sync.set({ clipboardMacros: macros });

    // Update the folder editor
    const textarea = document.querySelector(`.folder-json-editor[data-folder="${currentSectionType}"]`);
    if (textarea) {
      textarea.value = JSON.stringify(macros[currentSectionType], null, 2);
    }

    showParserStatus('Added to Clipboard Macros successfully!', 'success');

    // Clear the parser
    setTimeout(() => {
      document.getElementById('resumeInputText').value = '';
      document.getElementById('parserOutput').style.display = 'none';
      currentParsedData = null;
      currentSectionType = null;
    }, 1500);
  } catch (error) {
    console.error('Error adding to clipboard:', error);
    showParserStatus('Error adding to clipboard: ' + error.message, 'error');
  }
}

// Save parser config
async function saveParserConfig() {
  const editor = document.getElementById('parserConfigEditor');
  const errorDiv = document.getElementById('parserConfigError');

  try {
    const config = JSON.parse(editor.value);

    // Basic validation
    if (typeof config !== 'object') {
      throw new Error('Config must be a JSON object');
    }

    // Save to storage
    await chrome.storage.sync.set({ resumeParserConfig: config });

    errorDiv.style.display = 'none';
    showParserStatus('Parser configuration saved!', 'success');
  } catch (error) {
    errorDiv.textContent = 'Invalid JSON: ' + error.message;
    errorDiv.style.display = 'block';
  }
}

// Show parser status message
function showParserStatus(message, type) {
  const statusDiv = document.getElementById('parserStatus');
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
  }

  statusDiv.style.display = 'block';
  statusDiv.style.padding = '10px';
  statusDiv.style.borderRadius = '4px';

  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}
