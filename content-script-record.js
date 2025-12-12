/**
 * JobSprint Record Mode - Capture User Form Interactions
 * Automatically records user's answers to form questions for building the QA database
 */

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

/**
 * Find all form inputs and attach listeners
 */
function monitorFormInputs() {
  const inputs = findFormInputs();

  logRecord('info', `Found ${inputs.length} form inputs to monitor`);

  inputs.forEach(input => {
    if (monitoredInputs.has(input)) return;

    // Add change listener
    const changeHandler = (e) => handleInputChange(e.target);
    input.addEventListener('change', changeHandler);
    input.addEventListener('blur', changeHandler);

    // Store reference for cleanup
    input._recordHandler = changeHandler;
    monitoredInputs.add(input);
  });
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

  // Try aria-label
  if (input.getAttribute('aria-label')) {
    return cleanQuestionText(input.getAttribute('aria-label'));
  }

  // Try placeholder
  if (input.placeholder) {
    return cleanQuestionText(input.placeholder);
  }

  // Try name or id attribute
  if (input.name) {
    return cleanQuestionText(input.name.replace(/[_-]/g, ' '));
  }

  if (input.id) {
    return cleanQuestionText(input.id.replace(/[_-]/g, ' '));
  }

  // Try previous sibling text
  let sibling = input.previousElementSibling;
  while (sibling) {
    const text = sibling.textContent?.trim();
    if (text && text.length > 3 && text.length < 200) {
      return cleanQuestionText(text);
    }
    sibling = sibling.previousElementSibling;
  }

  // Try parent element text
  const parent = input.parentElement;
  if (parent) {
    const parentText = parent.textContent?.trim();
    if (parentText && parentText.length > 3 && parentText.length < 200) {
      return cleanQuestionText(parentText);
    }
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
    if (input._recordHandler) {
      input.removeEventListener('change', input._recordHandler);
      input.removeEventListener('blur', input._recordHandler);
      delete input._recordHandler;
    }
  });

  monitoredInputs.clear();
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
  switch (message.action) {
    case 'startRecordMode':
      startRecordMode();
      sendResponse({ success: true });
      break;

    case 'stopRecordMode':
      stopRecordMode().then(() => {
        sendResponse({ success: true, count: recordedQAPairs.length });
      });
      return true; // Async response

    case 'pauseRecordMode':
      pauseRecordMode();
      sendResponse({ success: true });
      break;

    case 'resumeRecordMode':
      resumeRecordMode();
      sendResponse({ success: true });
      break;

    case 'getRecordStatus':
      sendResponse({
        success: true,
        active: recordModeActive,
        count: recordedQAPairs.length
      });
      break;
  }

  return false;
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
