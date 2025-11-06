/**
 * JobSprint Popup Script
 * Handles user interactions in the popup UI
 * Features: Clipboard macros, job data extraction, autofill
 */

// Initialize all popup features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('JobSprint Popup loaded');

  initializeClipboardMacros();
  initializeExtraction();
  initializeAutofill();
  initializeSettings();
});

// ============ CLIPBOARD MACROS ============

/**
 * Initialize clipboard macro buttons and event listeners
 * Sets up click handlers for macro buttons (phone, email, address, linkedin)
 */
function initializeClipboardMacros() {
  const macroButtons = document.querySelectorAll('.macro-btn');

  macroButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-key');
      handleMacroClick(key);
    });
  });

  // Edit macros button - TODO: Implement settings modal or page for editing macro values
  const editButton = document.getElementById('editMacros');
  if (editButton) {
    editButton.addEventListener('click', () => {
      alert('Edit macros functionality coming soon!');
    });
  }
}

/**
 * Handle macro button click - retrieve value and paste to active field
 * Flow: Get value from storage -> Query active tab -> Send to content script -> Paste
 * @param {string} key - Macro key (phone, email, address, linkedin)
 */
function handleMacroClick(key) {
  // Step 1: Get the macro value from service worker storage
  chrome.runtime.sendMessage(
    { action: 'getClipboardMacro', key },
    (response) => {
      // Early return if no value is set
      if (!response?.success || !response?.value) {
        showError('No value set for this macro. Please edit macros first.');
        return;
      }

      // Step 2: Query the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab) {
          showError('No active tab found');
          return;
        }

        // Step 3: Send paste command to content script
        chrome.tabs.sendMessage(
          activeTab.id,
          { action: 'pasteText', text: response.value },
          (pasteResponse) => {
            if (chrome.runtime.lastError) {
              showError(`Failed to paste: ${chrome.runtime.lastError.message}`);
              return;
            }

            console.log('Text pasted successfully');
            window.close(); // Close popup after successful paste
          }
        );
      });
    }
  );
}

// ============ DATA EXTRACTION ============

/**
 * Initialize job data extraction feature
 * Sets up the extract button to pull job posting data from the current page
 * Flow: Extract from page -> Send to service worker -> Log to Google Sheets
 */
function initializeExtraction() {
  const extractBtn = document.getElementById('extractBtn');
  const statusDiv = document.getElementById('extractionStatus');

  if (!extractBtn || !statusDiv) return;

  extractBtn.addEventListener('click', () => {
    handleExtractClick(extractBtn, statusDiv);
  });
}

/**
 * Handle extract button click
 * Coordinates the full extraction and logging workflow
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 */
function handleExtractClick(button, statusDiv) {
  // Set button to loading state
  setButtonLoading(button, 'Extracting...');
  clearStatus(statusDiv);

  // Step 1: Query active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab) {
      handleExtractError(button, statusDiv, 'No active tab found');
      return;
    }

    // Step 2: Request extraction from content script
    chrome.tabs.sendMessage(
      activeTab.id,
      { action: 'extractJobData' },
      (response) => {
        if (chrome.runtime.lastError) {
          handleExtractError(button, statusDiv, `Could not access page: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (!response?.success) {
          handleExtractError(button, statusDiv, 'Failed to extract job data from page');
          return;
        }

        // Step 3: Send extracted data to service worker for logging
        logJobData(button, statusDiv, response.data);
      }
    );
  });
}

/**
 * Log extracted job data via service worker
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Extracted job data
 */
function logJobData(button, statusDiv, jobData) {
  chrome.runtime.sendMessage(
    { action: 'logJobData', data: jobData },
    (logResponse) => {
      if (logResponse?.success) {
        showStatus(statusDiv, 'success', '✓ Job data logged successfully!');
      } else {
        const errorMsg = logResponse?.error || 'Unknown error occurred';
        showStatus(statusDiv, 'error', `✗ Failed to log data: ${errorMsg}`);
      }
      resetExtractButton(button);
    }
  );
}

/**
 * Handle extraction errors with consistent formatting
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {string} message - Error message to display
 */
function handleExtractError(button, statusDiv, message) {
  showStatus(statusDiv, 'error', `✗ ${message}`);
  resetExtractButton(button);
}

/**
 * Reset extract button to default state
 * @param {HTMLButtonElement} button - Extract button element
 */
function resetExtractButton(button) {
  button.disabled = false;
  button.textContent = 'Extract & Log Job Data';
}

// ============ AUTOFILL ============

/**
 * Initialize semi-supervised autofill feature
 * Sets up the autofill button to start form-filling process on the current page
 * The autofill process runs in the content script and shows modal dialogs for user approval
 */
function initializeAutofill() {
  const autofillBtn = document.getElementById('autofillBtn');
  const statusDiv = document.getElementById('autofillStatus');

  if (!autofillBtn || !statusDiv) return;

  autofillBtn.addEventListener('click', () => {
    handleAutofillClick(autofillBtn, statusDiv);
  });
}

/**
 * Handle autofill button click
 * Triggers the autofill process on the active page
 * @param {HTMLButtonElement} button - Autofill button element
 * @param {HTMLElement} statusDiv - Status message display element
 */
function handleAutofillClick(button, statusDiv) {
  // Set button to loading state
  setButtonLoading(button, 'Starting...');
  showStatus(statusDiv, 'info', 'ℹ Autofill process started. Check the page for prompts.');

  // Query active tab and send autofill command
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab) {
      handleAutofillError(button, statusDiv, 'No active tab found');
      return;
    }

    // Send autofill command to content script
    chrome.tabs.sendMessage(
      activeTab.id,
      { action: 'startAutofill' },
      (response) => {
        if (chrome.runtime.lastError) {
          handleAutofillError(button, statusDiv, `Could not access page: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (response?.success) {
          showStatus(statusDiv, 'success', '✓ Autofill started! Answer prompts on the page.');
        } else {
          handleAutofillError(button, statusDiv, 'Failed to start autofill process');
        }

        // Reset button after short delay
        setTimeout(() => resetAutofillButton(button), 2000);
      }
    );
  });
}

/**
 * Handle autofill errors with consistent formatting
 * @param {HTMLButtonElement} button - Autofill button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {string} message - Error message to display
 */
function handleAutofillError(button, statusDiv, message) {
  showStatus(statusDiv, 'error', `✗ ${message}`);
  resetAutofillButton(button);
}

/**
 * Reset autofill button to default state
 * @param {HTMLButtonElement} button - Autofill button element
 */
function resetAutofillButton(button) {
  button.disabled = false;
  button.textContent = 'Start Autofill';
}

// ============ SETTINGS ============

/**
 * Initialize settings link
 * TODO: Implement settings page with macro editing, Apps Script URL config, etc.
 */
function initializeSettings() {
  const settingsLink = document.getElementById('settingsLink');
  if (!settingsLink) return;

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Settings page coming soon!');
  });
}

// ============ UTILITY FUNCTIONS ============

/**
 * Display status message with type-based styling
 * @param {HTMLElement} element - Status display element
 * @param {string} type - Message type: 'success', 'error', or 'info'
 * @param {string} message - Message text to display
 */
function showStatus(element, type, message) {
  element.className = `status-message ${type}`;
  element.textContent = message;
}

/**
 * Clear status message
 * @param {HTMLElement} element - Status display element
 */
function clearStatus(element) {
  element.className = 'status-message';
  element.textContent = '';
}

/**
 * Set button to loading state
 * @param {HTMLButtonElement} button - Button element
 * @param {string} text - Loading text to display
 */
function setButtonLoading(button, text) {
  button.disabled = true;
  button.textContent = text;
}

/**
 * Display error message using alert (for critical errors)
 * Uses consistent error format: "✗ message"
 * @param {string} message - Error message to display
 */
function showError(message) {
  alert(`✗ ${message}`);
}
