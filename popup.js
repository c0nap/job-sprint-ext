/**
 * JobSprint Popup Script
 * Handles user interactions in the popup UI
 */

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
 */
function initializeClipboardMacros() {
  const macroButtons = document.querySelectorAll('.macro-btn');

  macroButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-key');
      handleMacroClick(key);
    });
  });

  // Edit macros button - TODO: Implement settings page
  document.getElementById('editMacros').addEventListener('click', () => {
    alert('Edit macros functionality coming soon!');
  });
}

/**
 * Handle macro button click - retrieve and paste macro value
 * @param {string} key - The macro key (phone, email, address, linkedin)
 */
function handleMacroClick(key) {
  // Get the macro value from service worker
  chrome.runtime.sendMessage(
    { action: 'getClipboardMacro', key },
    (response) => {
      if (!response.success || !response.value) {
        alert('No value set for this macro. Please edit macros first.');
        return;
      }

      // Send to content script to paste
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          console.error('No active tab found');
          return;
        }

        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'pasteText', text: response.value },
          (pasteResponse) => {
            if (chrome.runtime.lastError) {
              console.error('Error pasting text:', chrome.runtime.lastError);
              alert('Could not paste text. Make sure you are on a valid webpage.');
            } else {
              console.log('Text pasted successfully');
              window.close(); // Close popup after successful paste
            }
          }
        );
      });
    }
  );
}

// ============ DATA EXTRACTION ============

/**
 * Initialize job data extraction feature
 */
function initializeExtraction() {
  const extractBtn = document.getElementById('extractBtn');
  const statusDiv = document.getElementById('extractionStatus');

  extractBtn.addEventListener('click', () => {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    statusDiv.className = 'status-message';
    statusDiv.textContent = '';

    // Request extraction from content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        showStatus(statusDiv, 'error', 'No active tab found');
        resetExtractButton(extractBtn);
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'extractJobData' },
        (response) => {
          if (chrome.runtime.lastError) {
            showStatus(statusDiv, 'error', 'Could not access page');
            resetExtractButton(extractBtn);
            return;
          }

          if (!response.success) {
            showStatus(statusDiv, 'error', 'Failed to extract data');
            resetExtractButton(extractBtn);
            return;
          }

          // Send to service worker to log
          chrome.runtime.sendMessage(
            { action: 'logJobData', data: response.data },
            (logResponse) => {
              const message = logResponse.success
                ? 'Job data logged successfully!'
                : `Failed to log data: ${logResponse.error || 'Unknown error'}`;
              const type = logResponse.success ? 'success' : 'error';
              showStatus(statusDiv, type, message);
              resetExtractButton(extractBtn);
            }
          );
        }
      );
    });
  });
}

/**
 * Reset extract button to its default state
 * @param {HTMLButtonElement} button - The extract button element
 */
function resetExtractButton(button) {
  button.disabled = false;
  button.textContent = 'Extract & Log Job Data';
}

// ============ AUTOFILL ============

/**
 * Initialize autofill feature
 */
function initializeAutofill() {
  const autofillBtn = document.getElementById('autofillBtn');
  const statusDiv = document.getElementById('autofillStatus');

  autofillBtn.addEventListener('click', () => {
    autofillBtn.disabled = true;
    autofillBtn.textContent = 'Starting...';
    statusDiv.className = 'status-message info';
    statusDiv.textContent = 'Autofill process started. Check the page.';

    // Request autofill from content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        showStatus(statusDiv, 'error', 'No active tab found');
        setTimeout(() => {
          autofillBtn.disabled = false;
          autofillBtn.textContent = 'Start Autofill';
        }, 2000);
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'startAutofill' },
        (response) => {
          let message, type;

          if (chrome.runtime.lastError) {
            message = 'Could not access page';
            type = 'error';
          } else if (response.success) {
            message = 'Autofill started successfully!';
            type = 'success';
          } else {
            message = 'Failed to start autofill';
            type = 'error';
          }

          showStatus(statusDiv, type, message);

          setTimeout(() => {
            autofillBtn.disabled = false;
            autofillBtn.textContent = 'Start Autofill';
          }, 2000);
        }
      );
    });
  });
}

// ============ SETTINGS ============

/**
 * Initialize settings link
 * TODO: Implement dedicated settings page
 */
function initializeSettings() {
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Settings page coming soon!');
  });
}

// ============ UTILITY FUNCTIONS ============

/**
 * Display status message to user
 * @param {HTMLElement} element - The status message container
 * @param {string} type - Message type (success, error, info)
 * @param {string} message - Message text to display
 */
function showStatus(element, type, message) {
  element.className = `status-message ${type}`;
  element.textContent = message;
}
