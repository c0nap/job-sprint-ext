// Settings page JavaScript

// Default configuration values
const DEFAULT_CONFIG = {
  APPS_SCRIPT_ENDPOINT: '',
  SPREADSHEET_ID: '',
  PROJECT_ID: '',
  APPS_SCRIPT_EDITOR_URL: '',
  ENABLE_MANUAL_ENTRY: true,
  TARGET_SHEET_NAME: 'Job Applications',
  // Mouse tracking settings
  CHAR_MODIFIER: 'ctrl',           // Modifier for character extraction
  WORD_MODIFIER: 'shift',          // Modifier for word extraction
  OVERLAY_MOVE_MODIFIER: 'alt',   // Modifier for moving overlay
  OVERLAY_MOVE_STEP: 20,           // Pixels to move overlay per keypress
  // Mode colors
  DISABLED_MODE_COLOR: '#6c757d'   // Grey color for disabled mode
};

// Default job data schema
const DEFAULT_SCHEMA = {
  columns: [
    {
      id: 'company',
      extractorType: 'company',
      sheetColumn: 'Employer',
      label: 'Employer',
      type: 'text',
      placeholder: 'e.g., Google',
      tooltip: 'Company or organization name',
      required: false,
      readonly: false
    },
    {
      id: 'title',
      extractorType: 'jobTitle',
      sheetColumn: 'Job Title',
      label: 'Job Title',
      type: 'text',
      placeholder: 'e.g., Software Engineer',
      tooltip: 'Position or role title',
      required: false,
      readonly: false
    },
    {
      id: 'location',
      extractorType: 'location',
      sheetColumn: 'Location',
      label: 'Location',
      type: 'text',
      placeholder: 'e.g., San Francisco, CA',
      tooltip: 'Job location (city, state, or remote)',
      required: false,
      readonly: false
    },
    {
      id: 'role',
      extractorType: 'role',
      sheetColumn: 'Role',
      label: 'Role',
      type: 'select',
      placeholder: '',
      tooltip: 'Job role category',
      required: false,
      readonly: false,
      options: ['CODE', 'DSCI', 'STAT', 'R&D']
    },
    {
      id: 'tailor',
      extractorType: 'tailor',
      sheetColumn: 'Tailor',
      label: 'Tailor',
      type: 'select',
      placeholder: 'Same as Role',
      tooltip: 'Custom role tailoring',
      required: false,
      readonly: false,
      options: ['CODE', 'DSCI', 'STAT', 'R&D']
    },
    {
      id: 'description',
      extractorType: 'notes',
      sheetColumn: 'Notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Additional notes or job description',
      tooltip: 'Job description, requirements, or notes',
      required: false,
      readonly: false
    },
    {
      id: 'compensation',
      extractorType: 'compensation',
      sheetColumn: 'Compensation',
      label: 'Compensation',
      type: 'text',
      placeholder: 'e.g., $65.00 - $75.00 / hour',
      tooltip: 'Salary or compensation range',
      required: false,
      readonly: false
    },
    {
      id: 'pay',
      extractorType: 'pay',
      sheetColumn: 'Pay',
      label: 'Pay',
      type: 'text',
      placeholder: 'e.g., $70.00',
      tooltip: 'Specific pay amount or average',
      required: false,
      readonly: false
    },
    {
      id: 'url',
      extractorType: 'url',
      sheetColumn: 'Portal Link',
      label: 'Portal Link',
      type: 'url',
      placeholder: 'https://...',
      tooltip: 'Job posting URL',
      required: false,
      readonly: true
    },
    {
      id: 'source',
      extractorType: 'board',
      sheetColumn: 'Board',
      label: 'Board',
      type: 'select',
      placeholder: 'Auto-detect from URL',
      tooltip: 'Job board or source',
      required: false,
      readonly: false,
      options: ['Indeed', 'Handshake', 'Symplicity', 'Google', 'LinkedIn', 'Website', 'Other']
    }
  ]
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
  try {
    await loadSettings();
  } catch (error) {
    console.error('Error during loadSettings:', error);
  }
  // Always set up event listeners, even if loading settings failed
  setupEventListeners();
  setupFolderHandlers();
  setupCloseLink();
  setupSchemaEditor();
});

// Setup close settings link
function setupCloseLink() {
  const closeLink = document.getElementById('closeSettingsLink');
  if (closeLink) {
    closeLink.addEventListener('click', (e) => {
      e.preventDefault();

      // Get the original tab that opened settings
      chrome.storage.local.get(['settingsOriginTabId'], (result) => {
        const originTabId = result.settingsOriginTabId;

        chrome.tabs.getCurrent((currentTab) => {
          if (!currentTab) return;

          // If we have an origin tab, switch to it first
          if (originTabId) {
            // Check if the origin tab still exists
            chrome.tabs.get(originTabId, (originTab) => {
              if (chrome.runtime.lastError) {
                // Origin tab no longer exists, just close settings
                chrome.tabs.remove(currentTab.id);
                chrome.storage.local.remove('settingsOriginTabId');
              } else {
                // Switch to origin tab, then close settings
                chrome.tabs.update(originTabId, { active: true }, () => {
                  chrome.tabs.remove(currentTab.id);
                  chrome.storage.local.remove('settingsOriginTabId');
                });
              }
            });
          } else {
            // No origin tab stored, just close settings
            chrome.tabs.remove(currentTab.id);
          }
        });
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
      'APPS_SCRIPT_EDITOR_URL',
      'ENABLE_MANUAL_ENTRY',
      'TARGET_SHEET_NAME',
      'clipboardMacros',
      'maxSearchResults',
      'debugConsoleEnabled',
      'CHAR_MODIFIER',
      'WORD_MODIFIER',
      'OVERLAY_MOVE_MODIFIER',
      'OVERLAY_MOVE_STEP',
      'WORD_MODE_COLOR',
      'CHAR_MODE_COLOR',
      'DISABLED_MODE_COLOR'
    ]);

    // Populate form fields
    document.getElementById('appsScriptEndpoint').value = result.APPS_SCRIPT_ENDPOINT || '';
    document.getElementById('spreadsheetId').value = result.SPREADSHEET_ID || '';
    document.getElementById('projectId').value = result.PROJECT_ID || '';
    document.getElementById('appsScriptEditorUrl').value = result.APPS_SCRIPT_EDITOR_URL || '';
    document.getElementById('targetSheetName').value = result.TARGET_SHEET_NAME || 'Job Applications';
    document.getElementById('enableManualEntry').checked =
      result.ENABLE_MANUAL_ENTRY !== undefined ? result.ENABLE_MANUAL_ENTRY : true;

    // Populate search settings
    document.getElementById('maxSearchResults').value = result.maxSearchResults || 10;

    // Populate debug console setting
    document.getElementById('debugConsoleEnabled').checked = result.debugConsoleEnabled || false;

    // Populate mouse tracking settings
    document.getElementById('charModifier').value = result.CHAR_MODIFIER || 'ctrl';
    document.getElementById('wordModifier').value = result.WORD_MODIFIER || 'shift';
    document.getElementById('overlayMoveModifier').value = result.OVERLAY_MOVE_MODIFIER || 'alt';
    document.getElementById('overlayMoveStep').value = result.OVERLAY_MOVE_STEP || 20;

    // Populate mode colors
    document.getElementById('wordModeColor').value = result.WORD_MODE_COLOR || '#2ecc71';
    document.getElementById('charModeColor').value = result.CHAR_MODE_COLOR || '#9b59b6';
    document.getElementById('disabledModeColor').value = result.DISABLED_MODE_COLOR || '#6c757d';

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
  const saveSettingsBtn = document.getElementById('saveSettings');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);

  // Save clipboard macros button (specific to clipboard section)
  const saveClipboardBtn = document.getElementById('saveClipboardMacros');
  if (saveClipboardBtn) saveClipboardBtn.addEventListener('click', saveClipboardMacros);

  // Reset button
  const resetBtn = document.getElementById('resetSettings');
  if (resetBtn) resetBtn.addEventListener('click', resetSettings);

  // Upload config button
  const uploadBtn = document.getElementById('uploadConfig');
  if (uploadBtn) uploadBtn.addEventListener('click', uploadConfig);

  // File input change handler
  const configFileInput = document.getElementById('configFileInput');
  if (configFileInput) configFileInput.addEventListener('change', handleConfigFileUpload);

  // Download config button
  const downloadBtn = document.getElementById('downloadConfig');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadConfig);

  // Clear all data button
  const clearBtn = document.getElementById('clearAllData');
  if (clearBtn) clearBtn.addEventListener('click', clearAllData);

  // Test connection button
  const testBtn = document.getElementById('testConnection');
  if (testBtn) testBtn.addEventListener('click', testConnection);

  // Real-time connection status updates
  const spreadsheetInput = document.getElementById('spreadsheetId');
  if (spreadsheetInput) spreadsheetInput.addEventListener('input', updateConnectionStatusFromInputs);

  const endpointInput = document.getElementById('appsScriptEndpoint');
  if (endpointInput) endpointInput.addEventListener('input', updateConnectionStatusFromInputs);

  const projectInput = document.getElementById('projectId');
  if (projectInput) projectInput.addEventListener('input', updateConnectionStatusFromInputs);

  // Export/Import all settings buttons
  const exportBtn = document.getElementById('exportAllSettings');
  if (exportBtn) exportBtn.addEventListener('click', exportAllSettings);

  const importBtn = document.getElementById('importAllSettings');
  if (importBtn) importBtn.addEventListener('click', importAllSettings);

  const importFileInput = document.getElementById('importFileInput');
  if (importFileInput) importFileInput.addEventListener('change', handleImportFile);

  // Smart mode strength slider
  const smartModeSlider = document.getElementById('smartModeStrength');
  if (smartModeSlider) {
    smartModeSlider.addEventListener('input', (e) => {
      updateSmartModeStrengthLabel(parseInt(e.target.value));
    });
  }
}

/**
 * Update smart mode strength label based on slider value
 * @param {number} value - Strength value (1-5)
 */
function updateSmartModeStrengthLabel(value) {
  const label = document.getElementById('smartModeStrengthValue');
  if (!label) return;

  const labels = ['Minimal', 'Low', 'Medium', 'High', 'Maximum'];
  const labelText = labels[value - 1] || 'Medium';
  label.textContent = `${labelText} (${value})`;
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
    APPS_SCRIPT_EDITOR_URL: document.getElementById('appsScriptEditorUrl').value.trim(),
    ENABLE_MANUAL_ENTRY: document.getElementById('enableManualEntry').checked,
    TARGET_SHEET_NAME: document.getElementById('targetSheetName').value.trim() || 'Job Applications',
    // Mouse tracking settings
    CHAR_MODIFIER: document.getElementById('charModifier').value,
    WORD_MODIFIER: document.getElementById('wordModifier').value,
    OVERLAY_MOVE_MODIFIER: document.getElementById('overlayMoveModifier').value,
    OVERLAY_MOVE_STEP: parseInt(document.getElementById('overlayMoveStep').value) || 20,
    // Mode colors
    WORD_MODE_COLOR: document.getElementById('wordModeColor').value,
    CHAR_MODE_COLOR: document.getElementById('charModeColor').value,
    DISABLED_MODE_COLOR: document.getElementById('disabledModeColor').value
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

  // Validate mouse tracking keybind settings (check for conflicts)
  const modifiers = [
    { value: settings.SENTENCE_MODIFIER, name: 'Smart' },
    { value: settings.CHAR_MODIFIER, name: 'Character' },
    { value: settings.WORD_MODIFIER, name: 'Word' }
  ];

  const modifierCounts = {};
  for (const mod of modifiers) {
    if (mod.value !== 'none') {
      modifierCounts[mod.value] = (modifierCounts[mod.value] || 0) + 1;
    }
  }

  for (const [key, count] of Object.entries(modifierCounts)) {
    if (count > 1) {
      showStatus(`Keybind conflict: Multiple extraction modes assigned to ${key}. Each modifier must be unique.`, 'error');
      return;
    }
  }

  // Validate overlay move step
  if (settings.OVERLAY_MOVE_STEP < 5 || settings.OVERLAY_MOVE_STEP > 100) {
    showStatus('Overlay move distance must be between 5 and 100 pixels', 'error');
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

// ============ SCHEMA MANAGEMENT ============

let currentSchema = null;

// Load schema from storage
async function loadSchema() {
  try {
    const result = await chrome.storage.sync.get(['JOB_DATA_SCHEMA']);
    currentSchema = result.JOB_DATA_SCHEMA || DEFAULT_SCHEMA;
    renderSchemaEditor();
  } catch (error) {
    console.error('Error loading schema:', error);
    currentSchema = DEFAULT_SCHEMA;
    renderSchemaEditor();
  }
}

// Save schema to storage
async function saveSchema() {
  try {
    // Collect schema from UI
    const columns = [];
    const columnElements = document.querySelectorAll('.schema-column');

    columnElements.forEach((el) => {
      const column = {
        id: el.querySelector('[data-field="id"]').value.trim(),
        extractorType: el.querySelector('[data-field="extractorType"]').value,
        sheetColumn: el.querySelector('[data-field="sheetColumn"]').value.trim(),
        label: el.querySelector('[data-field="label"]').value.trim(),
        type: el.querySelector('[data-field="type"]').value,
        placeholder: el.querySelector('[data-field="placeholder"]').value.trim(),
        tooltip: el.querySelector('[data-field="tooltip"]').value.trim(),
        required: el.querySelector('[data-field="required"]').checked,
        readonly: el.querySelector('[data-field="readonly"]').checked
      };

      // Add options for select type
      if (column.type === 'select') {
        const optionsText = el.querySelector('[data-field="options"]').value.trim();
        column.options = optionsText ? optionsText.split('\n').map(o => o.trim()).filter(o => o) : [];
      }

      columns.push(column);
    });

    const schema = { columns };

    // Save to storage
    await chrome.storage.sync.set({ JOB_DATA_SCHEMA: schema });
    currentSchema = schema;

    // Show success message
    const statusDiv = document.getElementById('schemaSaveStatus');
    statusDiv.className = 'status-message success';
    statusDiv.textContent = 'Schema saved successfully!';
    setTimeout(() => {
      statusDiv.className = 'status-message';
      statusDiv.textContent = '';
    }, 3000);

    // Notify other parts of the extension
    chrome.runtime.sendMessage({ action: 'schemaUpdated', schema });

  } catch (error) {
    console.error('Error saving schema:', error);
    const statusDiv = document.getElementById('schemaSaveStatus');
    statusDiv.className = 'status-message error';
    statusDiv.textContent = 'Error saving schema: ' + error.message;
  }
}

// Reset schema to default
async function resetSchema() {
  if (!confirm('Reset schema to default? This will remove all custom columns.')) {
    return;
  }

  currentSchema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
  renderSchemaEditor();

  const statusDiv = document.getElementById('schemaSaveStatus');
  statusDiv.className = 'status-message info';
  statusDiv.textContent = 'Schema reset to default. Click "Save Schema" to apply changes.';
}

// Render schema editor
function renderSchemaEditor() {
  const container = document.getElementById('schemaEditor');
  if (!container) return;

  container.innerHTML = '';

  if (!currentSchema || !currentSchema.columns || currentSchema.columns.length === 0) {
    container.innerHTML = '<div class="schema-empty">No columns defined. Click "Add Column" to create one.</div>';
    return;
  }

  currentSchema.columns.forEach((column, index) => {
    const columnEl = createSchemaColumnElement(column, index);
    container.appendChild(columnEl);
  });
}

// Create schema column element
function createSchemaColumnElement(column, index) {
  const div = document.createElement('div');
  div.className = 'schema-column';
  div.dataset.index = index;

  const showOptionsField = column.type === 'select';

  // Build extractor type options
  const extractorOptions = Object.entries({
    'company': { label: 'Company/Employer', category: 'basic' },
    'jobTitle': { label: 'Job Title', category: 'basic' },
    'location': { label: 'Location', category: 'basic' },
    'url': { label: 'Portal Link/URL', category: 'basic' },
    'rawDescription': { label: 'Raw Job Description', category: 'content' },
    'notes': { label: 'Notes', category: 'content' },
    'status': { label: 'Status', category: 'tracking' },
    'appliedDate': { label: 'Applied Date', category: 'tracking' },
    'decision': { label: 'Decision', category: 'tracking' },
    'role': { label: 'Role Category', category: 'classification' },
    'tailor': { label: 'Tailor Category', category: 'classification' },
    'compensation': { label: 'Compensation Range', category: 'compensation' },
    'pay': { label: 'Specific Pay', category: 'compensation' },
    'board': { label: 'Job Board', category: 'source' },
    'none': { label: 'None (Ignore)', category: 'special' }
  }).map(([id, info]) =>
    `<option value="${id}" ${column.extractorType === id ? 'selected' : ''}>${info.label}</option>`
  ).join('');

  div.innerHTML = `
    <div class="schema-column-header">
      <span class="schema-drag-handle" title="Drag to reorder">☰</span>
      <span class="schema-column-title">${column.sheetColumn || column.label || 'New Column'}</span>
      <div class="schema-column-controls">
        <button class="schema-btn toggle-details">
          ${index === 0 ? '▼' : '▶'} Details
        </button>
        <button class="schema-btn delete">✕ Delete</button>
      </div>
    </div>
    <div class="schema-column-details" style="display: ${index === 0 ? 'grid' : 'none'}">
      <!-- PRIMARY FIELDS (Most Critical) -->
      <div class="schema-field schema-field-full" style="grid-column: 1 / -1;">
        <label><strong>Extractor Type</strong> <span style="color: #666; font-weight: normal;">(What data to extract)</span></label>
        <select data-field="extractorType" style="font-weight: 500;">
          ${extractorOptions}
        </select>
      </div>
      <div class="schema-field schema-field-full" style="grid-column: 1 / -1;">
        <label><strong>Sheet Column Name</strong> <span style="color: #666; font-weight: normal;">(Column header in spreadsheet)</span></label>
        <input type="text" data-field="sheetColumn" value="${column.sheetColumn || ''}" placeholder="e.g., Employer" style="font-weight: 500;">
      </div>

      <!-- FIELD CONFIGURATION -->
      <div class="schema-field">
        <label>Field Type</label>
        <select data-field="type">
          <option value="text" ${column.type === 'text' ? 'selected' : ''}>Text</option>
          <option value="textarea" ${column.type === 'textarea' ? 'selected' : ''}>Textarea</option>
          <option value="select" ${column.type === 'select' ? 'selected' : ''}>Select Dropdown</option>
          <option value="url" ${column.type === 'url' ? 'selected' : ''}>URL</option>
          <option value="number" ${column.type === 'number' ? 'selected' : ''}>Number</option>
          <option value="date" ${column.type === 'date' ? 'selected' : ''}>Date</option>
        </select>
      </div>
      <div class="schema-field schema-field-full" style="display: ${showOptionsField ? 'flex' : 'none'}" data-options-field>
        <label>Options (one per line, for select type only)</label>
        <textarea data-field="options" placeholder="Option 1\nOption 2\nOption 3">${column.options ? column.options.join('\n') : ''}</textarea>
      </div>
      <div class="schema-field">
        <label class="schema-checkbox">
          <input type="checkbox" data-field="required" ${column.required ? 'checked' : ''}>
          Required field
        </label>
      </div>
      <div class="schema-field">
        <label class="schema-checkbox">
          <input type="checkbox" data-field="readonly" ${column.readonly ? 'checked' : ''}>
          Read-only (auto-filled)
        </label>
      </div>

      <!-- ADVANCED SECTION (Collapsible) -->
      <div class="schema-field schema-field-full" style="grid-column: 1 / -1; margin-top: 12px;">
        <button type="button" class="schema-btn toggle-advanced" style="width: 100%; text-align: left; background: #f0f0f0; padding: 8px 12px;">
          ▶ Advanced (Label, Placeholder, Tooltip, ID)
        </button>
      </div>
      <div class="schema-advanced-section" style="display: none; grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 4px;">
        <div class="schema-field">
          <label>Internal ID <span style="color: #999; font-size: 11px;">(read-only)</span></label>
          <input type="text" data-field="id" value="${column.id || ''}" placeholder="e.g., company" readonly style="background: #f0f0f0; cursor: not-allowed;">
        </div>
        <div class="schema-field">
          <label>Label (display name in form)</label>
          <input type="text" data-field="label" value="${column.label || ''}" placeholder="e.g., Company Name">
        </div>
        <div class="schema-field schema-field-full" style="grid-column: 1 / -1;">
          <label>Placeholder</label>
          <input type="text" data-field="placeholder" value="${column.placeholder || ''}" placeholder="e.g., Enter company name">
        </div>
        <div class="schema-field schema-field-full" style="grid-column: 1 / -1;">
          <label>Tooltip (help text)</label>
          <textarea data-field="tooltip" placeholder="Description shown on hover" rows="2">${column.tooltip || ''}</textarea>
        </div>
      </div>
    </div>
  `;

  // Setup event listeners
  const toggleBtn = div.querySelector('.toggle-details');
  const detailsDiv = div.querySelector('.schema-column-details');
  const deleteBtn = div.querySelector('.delete');
  const typeSelect = div.querySelector('[data-field="type"]');
  const sheetColumnInput = div.querySelector('[data-field="sheetColumn"]');
  const labelInput = div.querySelector('[data-field="label"]');
  const titleSpan = div.querySelector('.schema-column-title');
  const toggleAdvancedBtn = div.querySelector('.toggle-advanced');
  const advancedSection = div.querySelector('.schema-advanced-section');

  toggleBtn.addEventListener('click', () => {
    const isVisible = detailsDiv.style.display === 'grid';
    detailsDiv.style.display = isVisible ? 'none' : 'grid';
    toggleBtn.textContent = isVisible ? '▶ Details' : '▼ Details';
  });

  deleteBtn.addEventListener('click', () => {
    if (confirm(`Delete column "${column.sheetColumn || column.label}"?`)) {
      div.remove();
      // Update indices
      document.querySelectorAll('.schema-column').forEach((el, idx) => {
        el.dataset.index = idx;
      });
    }
  });

  // Toggle advanced section
  toggleAdvancedBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isVisible = advancedSection.style.display === 'grid';
    advancedSection.style.display = isVisible ? 'none' : 'grid';
    toggleAdvancedBtn.textContent = isVisible ? '▶ Advanced (Label, Placeholder, Tooltip, ID)' : '▼ Advanced (Label, Placeholder, Tooltip, ID)';
  });

  // Update title when sheet column or label changes
  sheetColumnInput.addEventListener('input', () => {
    titleSpan.textContent = sheetColumnInput.value || labelInput.value || 'New Column';
  });

  labelInput.addEventListener('input', () => {
    if (!sheetColumnInput.value) {
      titleSpan.textContent = labelInput.value || 'New Column';
    }
  });

  // Show/hide options field based on type
  typeSelect.addEventListener('change', () => {
    const optionsField = div.querySelector('[data-options-field]');
    optionsField.style.display = typeSelect.value === 'select' ? 'flex' : 'none';
  });

  // Setup drag and drop
  setupDragAndDrop(div);

  return div;
}

// Add new column
function addSchemaColumn() {
  const newColumn = {
    id: 'new_field_' + Date.now(),
    extractorType: 'none',
    sheetColumn: 'New Column',
    label: 'New Column',
    type: 'text',
    placeholder: '',
    tooltip: '',
    required: false,
    readonly: false
  };

  if (!currentSchema.columns) {
    currentSchema.columns = [];
  }

  currentSchema.columns.push(newColumn);

  const container = document.getElementById('schemaEditor');
  const columnEl = createSchemaColumnElement(newColumn, currentSchema.columns.length - 1);
  container.appendChild(columnEl);

  // Expand details for new column
  const detailsDiv = columnEl.querySelector('.schema-column-details');
  const toggleBtn = columnEl.querySelector('.toggle-details');
  detailsDiv.style.display = 'grid';
  toggleBtn.textContent = '▼ Details';

  // Focus on label field
  columnEl.querySelector('[data-field="label"]').focus();
}

// Setup drag and drop for column reordering
function setupDragAndDrop(element) {
  const handle = element.querySelector('.schema-drag-handle');
  let draggedElement = null;

  handle.addEventListener('mousedown', (e) => {
    draggedElement = element;
    element.style.opacity = '0.5';
    element.draggable = true;
  });

  element.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', element.innerHTML);
  });

  element.addEventListener('dragover', (e) => {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    if (draggedElement && draggedElement !== element) {
      const container = element.parentNode;
      const draggedIndex = Array.from(container.children).indexOf(draggedElement);
      const targetIndex = Array.from(container.children).indexOf(element);

      if (draggedIndex < targetIndex) {
        container.insertBefore(draggedElement, element.nextSibling);
      } else {
        container.insertBefore(draggedElement, element);
      }
    }

    return false;
  });

  element.addEventListener('dragend', (e) => {
    element.style.opacity = '1';
    element.draggable = false;
    draggedElement = null;

    // Update indices
    document.querySelectorAll('.schema-column').forEach((el, idx) => {
      el.dataset.index = idx;
    });
  });
}

// Setup schema editor event listeners
function setupSchemaEditor() {
  const addBtn = document.getElementById('addSchemaColumn');
  const resetBtn = document.getElementById('resetSchema');
  const saveBtn = document.getElementById('saveSchema');

  if (addBtn) addBtn.addEventListener('click', addSchemaColumn);
  if (resetBtn) resetBtn.addEventListener('click', resetSchema);
  if (saveBtn) saveBtn.addEventListener('click', saveSchema);

  // Load schema when page loads
  loadSchema();
}

