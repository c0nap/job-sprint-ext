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

function initializeClipboardMacros() {
  const macroButtons = document.querySelectorAll('.macro-btn');

  macroButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-key');
      handleMacroClick(key);
    });
  });

  // Edit macros button
  document.getElementById('editMacros').addEventListener('click', () => {
    // TODO: Open settings page or modal for editing macros
    alert('Edit macros functionality coming soon!');
  });
}

function handleMacroClick(key) {
  // Get the macro value from service worker
  chrome.runtime.sendMessage(
    { action: 'getClipboardMacro', key },
    (response) => {
      if (response.success && response.value) {
        // Send to content script to paste
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: 'pasteText', text: response.value },
              (pasteResponse) => {
                if (chrome.runtime.lastError) {
                  console.error('Error pasting text:', chrome.runtime.lastError);
                } else {
                  console.log('Text pasted successfully');
                  window.close(); // Close popup after successful paste
                }
              }
            );
          }
        });
      } else {
        alert('No value set for this macro. Please edit macros first.');
      }
    }
  );
}

// ============ DATA EXTRACTION ============

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
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'extractJobData' },
          (response) => {
            if (chrome.runtime.lastError) {
              showStatus(statusDiv, 'error', 'Error: Could not access page');
              resetExtractButton(extractBtn);
              return;
            }

            if (response.success) {
              // Send to service worker to log
              chrome.runtime.sendMessage(
                { action: 'logJobData', data: response.data },
                (logResponse) => {
                  if (logResponse.success) {
                    showStatus(statusDiv, 'success', 'Job data logged successfully!');
                  } else {
                    showStatus(statusDiv, 'error', 'Failed to log data: ' + (logResponse.error || 'Unknown error'));
                  }
                  resetExtractButton(extractBtn);
                }
              );
            } else {
              showStatus(statusDiv, 'error', 'Failed to extract data');
              resetExtractButton(extractBtn);
            }
          }
        );
      }
    });
  });
}

function resetExtractButton(button) {
  button.disabled = false;
  button.textContent = 'Extract & Log Job Data';
}

// ============ AUTOFILL ============

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
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'startAutofill' },
          (response) => {
            if (chrome.runtime.lastError) {
              showStatus(statusDiv, 'error', 'Error: Could not access page');
            } else if (response.success) {
              showStatus(statusDiv, 'success', 'Autofill started successfully!');
            } else {
              showStatus(statusDiv, 'error', 'Failed to start autofill');
            }

            setTimeout(() => {
              autofillBtn.disabled = false;
              autofillBtn.textContent = 'Start Autofill';
            }, 2000);
          }
        );
      }
    });
  });
}

// ============ SETTINGS ============

function initializeSettings() {
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: Open settings page
    alert('Settings page coming soon!');
  });
}

// ============ UTILITY FUNCTIONS ============

function showStatus(element, type, message) {
  element.className = `status-message ${type}`;
  element.textContent = message;
}
