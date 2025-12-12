/**
 * JobSprint Record Mode - Capture User Form Interactions
 * Automatically records user's answers to form questions for building the QA database
 */

console.log('JobSprint Record Mode script loaded');

// ============ RECORD MODE STATE ============

let recordModeActive = false;
let recordedQAPairs = [];
let monitoredInputs = new Set();
let questionExtractor = null; // Reference to extractQuestionForInput from autofill script

// ============ LOGGING ============

function logRecord(level, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[JobSprint Record ${level.toUpperCase()}]`, message, data || '');

  chrome.runtime.sendMessage({
    action: 'recordLog',
    log: { timestamp, level, message, data }
  }).catch(() => {});
}

// ============ RECORD MODE CONTROL ============

/**
 * Start recording mode - monitor all form interactions
 */
function startRecordMode() {
  if (recordModeActive) {
    logRecord('warn', 'Record mode already active');
    return;
  }

  recordModeActive = true;
  recordedQAPairs = [];
  monitoredInputs.clear();

  logRecord('info', 'Record mode started - monitoring form interactions');

  // Find and monitor all form inputs
  monitorFormInputs();

  // Show recording indicator
  showRecordingIndicator();

  // Send status update
  notifyRecordStatus('recording', recordedQAPairs.length);
}

/**
 * Stop recording mode and save collected QA pairs
 */
async function stopRecordMode() {
  if (!recordModeActive) {
    logRecord('warn', 'Record mode not active');
    return;
  }

  recordModeActive = false;

  logRecord('success', `Record mode stopped - captured ${recordedQAPairs.length} Q&A pairs`, {
    pairs: recordedQAPairs
  });

  // Save to database
  if (recordedQAPairs.length > 0) {
    await saveRecordedQAPairs();
  }

  // Remove indicator
  removeRecordingIndicator();

  // Clean up listeners
  cleanupMonitoring();

  // Send status update
  notifyRecordStatus('stopped', recordedQAPairs.length);
}

/**
 * Pause recording mode without saving
 */
function pauseRecordMode() {
  if (!recordModeActive) return;

  recordModeActive = false;
  logRecord('info', 'Record mode paused');
  updateRecordingIndicator('paused');
  notifyRecordStatus('paused', recordedQAPairs.length);
}

/**
 * Resume recording mode
 */
function resumeRecordMode() {
  recordModeActive = true;
  logRecord('info', 'Record mode resumed');
  updateRecordingIndicator('recording');
  notifyRecordStatus('recording', recordedQAPairs.length);
}

// ============ FORM MONITORING ============

let mutationObserver = null;
let debounceTimers = new Map();

/**
 * Find all form inputs and attach listeners
 */
function monitorFormInputs() {
  const inputs = findFormInputs();

  logRecord('info', `Found ${inputs.length} form inputs to monitor`);

  inputs.forEach(input => {
    if (monitoredInputs.has(input)) return;

    attachInputListeners(input);
  });

  // Set up MutationObserver to detect dynamically added inputs
  setupMutationObserver();
}

/**
 * Attach event listeners to an input element
 */
function attachInputListeners(input) {
  if (monitoredInputs.has(input)) return;

  const handlers = [];

  // For checkboxes and radio buttons, use click event (more reliable)
  if (input.type === 'checkbox' || input.type === 'radio') {
    const clickHandler = (e) => handleInputChangeDebounced(e.target);
    input.addEventListener('click', clickHandler);
    handlers.push({ event: 'click', handler: clickHandler });
  }

  // For file inputs, use change event
  if (input.type === 'file') {
    const fileHandler = (e) => handleFileInput(e.target);
    input.addEventListener('change', fileHandler);
    handlers.push({ event: 'change', handler: fileHandler });
  }

  // For all other inputs, use change and blur
  const changeHandler = (e) => handleInputChangeDebounced(e.target);
  input.addEventListener('change', changeHandler);
  input.addEventListener('blur', changeHandler);
  handlers.push({ event: 'change', handler: changeHandler });
  handlers.push({ event: 'blur', handler: changeHandler });

  // Store handlers for cleanup
  input._recordHandlers = handlers;
  monitoredInputs.add(input);
}

/**
 * Setup MutationObserver to detect dynamically added form inputs
 */
function setupMutationObserver() {
  if (mutationObserver) return;

  mutationObserver = new MutationObserver((mutations) => {
    if (!recordModeActive) return;

    let newInputsFound = false;
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // Element node
          // Check if the node itself is an input
          if (isFormInput(node)) {
            attachInputListeners(node);
            newInputsFound = true;
          }
          // Check for inputs within the added node
          if (node.querySelectorAll) {
            const inputs = node.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
              if (isFormInput(input) && !monitoredInputs.has(input)) {
                attachInputListeners(input);
                newInputsFound = true;
              }
            });
          }
        }
      });
    });

    if (newInputsFound) {
      logRecord('info', 'Detected new form inputs, now monitoring them');
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Check if an element is a valid form input
 */
function isFormInput(element) {
  const tagName = element.tagName;
  if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return false;

  // Skip hidden inputs
  if (element.type === 'hidden' || element.style.display === 'none') return false;

  // Skip buttons and submit inputs
  if (element.type === 'submit' || element.type === 'button' || element.type === 'image') return false;

  // Skip password inputs for security
  if (element.type === 'password') return false;

  return true;
}

/**
 * Handle input change with debouncing to prevent duplicate captures
 */
function handleInputChangeDebounced(input) {
  // Clear existing timer for this input
  const existingTimer = debounceTimers.get(input);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer (300ms debounce)
  const timer = setTimeout(() => {
    handleInputChange(input);
    debounceTimers.delete(input);
  }, 300);

  debounceTimers.set(input, timer);
}

/**
 * Handle file input change
 */
function handleFileInput(input) {
  if (!recordModeActive) return;

  const files = input.files;
  if (!files || files.length === 0) return;

  // Extract question
  const question = extractQuestionForInput(input);
  if (!question || question.length < 3) {
    logRecord('warn', 'Could not extract question for file input', {
      name: input.name,
      id: input.id
    });
    return;
  }

  // Create answer indicating file was uploaded
  const fileNames = Array.from(files).map(f => f.name).join(', ');
  const answer = files.length === 1
    ? `File uploaded: ${fileNames}`
    : `${files.length} files uploaded: ${fileNames}`;

  // Create Q&A pair
  const qaPair = {
    question: question.trim(),
    answer: answer,
    type: 'text', // File uploads are text type
    timestamp: Date.now(),
    inputType: 'file'
  };

  // Check for duplicate
  const existingIndex = recordedQAPairs.findIndex(
    pair => pair.question === qaPair.question
  );

  if (existingIndex >= 0) {
    recordedQAPairs[existingIndex] = qaPair;
    logRecord('info', 'Updated file upload Q&A pair', qaPair);
  } else {
    recordedQAPairs.push(qaPair);
    logRecord('success', 'Captured file upload Q&A pair', qaPair);
  }

  updateRecordingIndicator('recording', recordedQAPairs.length);
  notifyRecordStatus('recording', recordedQAPairs.length);
}

/**
 * Handle input value change - capture Q&A pair
 */
function handleInputChange(input) {
  if (!recordModeActive) return;

  // Skip if input is empty
  const value = getInputValue(input);
  if (!value || value.trim().length === 0) {
    return;
  }

  // Extract question
  const question = extractQuestionForInput(input);
  if (!question || question.length < 3) {
    logRecord('warn', 'Could not extract question for input', {
      type: input.type,
      name: input.name,
      id: input.id
    });
    return;
  }

  // Determine answer type
  const answerType = determineAnswerType(input);

  // Get available options for choice types
  const availableOptions = getAvailableOptions(input);

  // Create Q&A pair
  const qaPair = {
    question: question.trim(),
    answer: value.trim(),
    type: answerType,
    timestamp: Date.now(),
    inputType: input.type || input.tagName.toLowerCase(),
    availableOptions: availableOptions.length > 0 ? availableOptions : undefined
  };

  // Check for duplicate
  const existingIndex = recordedQAPairs.findIndex(
    pair => pair.question === qaPair.question
  );

  if (existingIndex >= 0) {
    // Update existing
    recordedQAPairs[existingIndex] = qaPair;
    logRecord('info', 'Updated Q&A pair', qaPair);
  } else {
    // Add new
    recordedQAPairs.push(qaPair);
    logRecord('success', 'Captured Q&A pair', qaPair);
  }

  // Update indicator
  updateRecordingIndicator('recording', recordedQAPairs.length);
  notifyRecordStatus('recording', recordedQAPairs.length);
}

// ============ VALUE EXTRACTION ============

/**
 * Get the value from an input element
 */
function getInputValue(input) {
  if (input.tagName === 'SELECT') {
    const option = input.options[input.selectedIndex];
    return option ? option.textContent.trim() : '';
  }

  if (input.type === 'radio') {
    if (!input.checked) return null;
    const label = input.labels?.[0] || document.querySelector(`label[for="${input.id}"]`);
    return label ? label.textContent.trim() : input.value;
  }

  if (input.type === 'checkbox') {
    return input.checked ? 'Yes' : 'No';
  }

  return input.value;
}

/**
 * Determine the type of answer (choice, text, exact)
 */
function determineAnswerType(input) {
  // Select, radio, checkbox are always choice type
  if (input.tagName === 'SELECT' || input.type === 'radio' || input.type === 'checkbox') {
    return 'choice';
  }

  // For text inputs, check if there are limited expected values
  // (e.g., email, phone) - use exact type
  if (input.type === 'email' || input.type === 'tel' || input.type === 'url') {
    return 'exact';
  }

  // Numbers could be exact or text depending on context
  if (input.type === 'number') {
    return 'exact';
  }

  // Default to text for text areas and text inputs
  return 'text';
}

/**
 * Get available options for select/radio inputs
 */
function getAvailableOptions(input) {
  if (input.tagName === 'SELECT') {
    return Array.from(input.options).map(opt => opt.textContent.trim());
  }

  if (input.type === 'radio') {
    const name = input.name;
    if (!name) return [];

    const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    return Array.from(radioGroup).map(radio => {
      const label = radio.labels?.[0] || document.querySelector(`label[for="${radio.id}"]`);
      return label ? label.textContent.trim() : radio.value;
    });
  }

  if (input.type === 'checkbox') {
    return ['Yes', 'No'];
  }

  return [];
}

// ============ QUESTION EXTRACTION (imported from autofill) ============

/**
 * Extract question text for a given input element
 * Looks for labels, placeholders, aria-labels, and nearby headings
 */
function extractQuestionForInput(input) {
  // Try label element
  const label = input.labels?.[0] || document.querySelector(`label[for="${input.id}"]`);
  if (label) {
    return cleanQuestionText(label.textContent);
  }

  // Try aria-labelledby
  const ariaLabelledBy = input.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement) {
      return cleanQuestionText(labelElement.textContent);
    }
  }

  // Try aria-label
  if (input.getAttribute('aria-label')) {
    return cleanQuestionText(input.getAttribute('aria-label'));
  }

  // For radio buttons, check if they're in a fieldset with a legend
  if (input.type === 'radio') {
    const fieldset = input.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        return cleanQuestionText(legend.textContent);
      }
    }
  }

  // Try data-label attribute (some custom forms use this)
  if (input.getAttribute('data-label')) {
    return cleanQuestionText(input.getAttribute('data-label'));
  }

  // Try placeholder
  if (input.placeholder) {
    return cleanQuestionText(input.placeholder);
  }

  // Try title attribute
  if (input.title && input.title.length > 5) {
    return cleanQuestionText(input.title);
  }

  // Try previous sibling text (up to 3 siblings back)
  let sibling = input.previousElementSibling;
  let siblingCount = 0;
  while (sibling && siblingCount < 3) {
    const text = sibling.textContent?.trim();
    if (text && text.length > 3 && text.length < 200) {
      // Skip if it's just a single character or number
      if (text.length > 2 && !/^\d+$/.test(text)) {
        return cleanQuestionText(text);
      }
    }
    sibling = sibling.previousElementSibling;
    siblingCount++;
  }

  // Try parent element text (but exclude the input's own value)
  const parent = input.parentElement;
  if (parent) {
    // Clone parent to remove the input and get just the label text
    const parentClone = parent.cloneNode(true);
    const inputsInClone = parentClone.querySelectorAll('input, textarea, select');
    inputsInClone.forEach(inp => inp.remove());

    const parentText = parentClone.textContent?.trim();
    if (parentText && parentText.length > 3 && parentText.length < 200) {
      return cleanQuestionText(parentText);
    }
  }

  // Try closest heading (h1-h6) within reasonable distance
  const closestHeading = input.closest('section, div')?.querySelector('h1, h2, h3, h4, h5, h6');
  if (closestHeading) {
    const headingText = closestHeading.textContent?.trim();
    if (headingText && headingText.length > 3 && headingText.length < 200) {
      return cleanQuestionText(headingText);
    }
  }

  // Last resort: use name or id attribute
  if (input.name) {
    return cleanQuestionText(input.name.replace(/[_-]/g, ' '));
  }

  if (input.id) {
    return cleanQuestionText(input.id.replace(/[_-]/g, ' '));
  }

  return '';
}

/**
 * Clean and normalize question text
 */
function cleanQuestionText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\*+/g, '')  // Remove asterisks
    .replace(/^\s*-\s*/, '')  // Remove leading dash
    .substring(0, 300);  // Limit length
}

/**
 * Find all form inputs on the page
 */
function findFormInputs() {
  const inputs = document.querySelectorAll('input, textarea, select');

  return Array.from(inputs).filter(input => {
    // Skip hidden inputs
    if (input.type === 'hidden' || input.style.display === 'none') {
      return false;
    }

    // Skip buttons and submit inputs
    if (input.type === 'submit' || input.type === 'button' || input.type === 'image') {
      return false;
    }

    // Skip password inputs for security
    if (input.type === 'password') {
      return false;
    }

    return true;
  });
}

// ============ DATABASE OPERATIONS ============

/**
 * Save all recorded Q&A pairs to the database
 */
async function saveRecordedQAPairs() {
  if (recordedQAPairs.length === 0) {
    logRecord('info', 'No Q&A pairs to save');
    return;
  }

  try {
    // Get existing database
    const result = await chrome.storage.local.get(['qaDatabase']);
    const database = result.qaDatabase || [];

    let newCount = 0;
    let updatedCount = 0;

    // Add or update each pair
    recordedQAPairs.forEach(newPair => {
      const existingIndex = database.findIndex(
        pair => pair.question.toLowerCase().trim() === newPair.question.toLowerCase().trim()
      );

      if (existingIndex >= 0) {
        // Update existing entry
        database[existingIndex] = newPair;
        updatedCount++;
      } else {
        // Add new entry
        database.push(newPair);
        newCount++;
      }
    });

    // Save to storage
    await chrome.storage.local.set({ qaDatabase: database });

    logRecord('success', `Saved to database: ${newCount} new, ${updatedCount} updated`, {
      total: database.length
    });

    // Notify user
    showSaveNotification(newCount, updatedCount);

  } catch (error) {
    logRecord('error', 'Failed to save Q&A pairs', { error: error.message });
  }
}

// ============ UI INDICATORS ============

/**
 * Show recording indicator
 */
function showRecordingIndicator() {
  removeRecordingIndicator(); // Remove if exists

  const indicator = document.createElement('div');
  indicator.id = 'jobsprint-record-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999998;
    background: #f44336;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  indicator.innerHTML = `
    <div style="width: 10px; height: 10px; background: white; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
    <div>Recording: <span id="record-count">0</span> Q&A pairs</div>
    <button id="record-pause-btn" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Pause</button>
    <button id="record-stop-btn" style="background: white; border: none; color: #f44336; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">Stop & Save</button>
  `;

  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(indicator);

  // Attach button listeners
  document.getElementById('record-pause-btn').onclick = () => {
    if (recordModeActive) {
      pauseRecordMode();
    } else {
      resumeRecordMode();
    }
  };

  document.getElementById('record-stop-btn').onclick = () => {
    stopRecordMode();
  };
}

/**
 * Update recording indicator
 */
function updateRecordingIndicator(state, count) {
  const indicator = document.getElementById('jobsprint-record-indicator');
  if (!indicator) return;

  const countDisplay = document.getElementById('record-count');
  const pauseBtn = document.getElementById('record-pause-btn');

  if (countDisplay && count !== undefined) {
    countDisplay.textContent = count;
  }

  if (pauseBtn && state) {
    if (state === 'paused') {
      indicator.style.background = '#ff9800';
      pauseBtn.textContent = 'Resume';
    } else if (state === 'recording') {
      indicator.style.background = '#f44336';
      pauseBtn.textContent = 'Pause';
    }
  }
}

/**
 * Remove recording indicator
 */
function removeRecordingIndicator() {
  const indicator = document.getElementById('jobsprint-record-indicator');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Show save notification
 */
function showSaveNotification(newCount, updatedCount) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: #4CAF50;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  notification.innerHTML = `
    ✓ Saved ${newCount + updatedCount} Q&A pairs<br>
    <small style="opacity: 0.9; font-size: 12px;">
      ${newCount} new, ${updatedCount} updated
    </small>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 4000);
}

// ============ CLEANUP ============

/**
 * Remove all event listeners from monitored inputs
 */
function cleanupMonitoring() {
  monitoredInputs.forEach(input => {
    // Handle new handler structure
    if (input._recordHandlers) {
      input._recordHandlers.forEach(({ event, handler }) => {
        input.removeEventListener(event, handler);
      });
      delete input._recordHandlers;
    }
    // Handle old handler structure (backwards compatibility)
    else if (input._recordHandler) {
      input.removeEventListener('change', input._recordHandler);
      input.removeEventListener('blur', input._recordHandler);
      delete input._recordHandler;
    }
  });

  monitoredInputs.clear();

  // Clear debounce timers
  debounceTimers.forEach(timer => clearTimeout(timer));
  debounceTimers.clear();

  // Disconnect MutationObserver
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
}

// ============ STATUS UPDATES ============

/**
 * Notify popup of recording status changes
 */
function notifyRecordStatus(status, count) {
  chrome.runtime.sendMessage({
    action: 'recordStatusChange',
    status,
    count
  }).catch(() => {});
}

// ============ MESSAGE LISTENER ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Record mode received message:', message.action);

  try {
    switch (message.action) {
      case 'startRecordMode':
        startRecordMode();
        sendResponse({ success: true });
        return false; // Synchronous response

      case 'stopRecordMode':
        stopRecordMode().then(() => {
          sendResponse({ success: true, count: recordedQAPairs.length });
        }).catch((error) => {
          console.error('Error stopping record mode:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Async response

      case 'pauseRecordMode':
        pauseRecordMode();
        sendResponse({ success: true });
        return false; // Synchronous response

      case 'resumeRecordMode':
        resumeRecordMode();
        sendResponse({ success: true });
        return false; // Synchronous response

      case 'getRecordStatus':
        sendResponse({
          success: true,
          active: recordModeActive,
          count: recordedQAPairs.length
        });
        return false; // Synchronous response

      default:
        // Not a record mode message, ignore
        return false;
    }
  } catch (error) {
    console.error('Error in record mode message handler:', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startRecordMode,
    stopRecordMode,
    extractQuestionForInput,
    determineAnswerType,
    getInputValue
  };
}
