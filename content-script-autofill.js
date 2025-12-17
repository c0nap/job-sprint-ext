/**
 * JobSprint Autofill Module - Enhanced Semi-Supervised Form Filling
 * Handles intelligent form filling with pause/resume, multi-tab support, and extensive logging
 */

// ============ AUTOFILL STATE MANAGEMENT ============

const AutofillState = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  RUNNING: 'running',
  PAUSED: 'paused',
  WAITING_USER: 'waiting_user',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// Global autofill state
let currentState = AutofillState.IDLE;
let formInputs = [];
let currentIndex = 0;
let tabId = null;
let processedInputs = new Set();
let skippedInputs = new Set();
let autofillOptions = {
  autoPlayback: false,
  autoProceed: false
};

// ============ LOGGING UTILITIES ============

/**
 * Send log message to debug console (popup)
 * @param {string} level - Log level (info, warn, error, success)
 * @param {string} message - Log message
 * @param {Object} data - Optional data object
 */
function logToConsole(level, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = {
    timestamp,
    level,
    message,
    data,
    tabId
  };

  // Log to browser console
  console.log(`[JobSprint Autofill ${level.toUpperCase()}]`, message, data || '');

  // Send to popup's debug console
  chrome.runtime.sendMessage({
    action: 'autofillLog',
    log: logEntry
  }).catch(() => {
    // Popup might be closed, ignore error
  });
}

// ============ MAIN AUTOFILL PROCESS ============

/**
 * Start the semi-supervised autofill process
 * @param {Object} options - Autofill options
 * @param {boolean} options.autoPlayback - Auto-fill without confirmation
 * @param {boolean} options.autoProceed - Auto-click next/continue buttons
 */
async function startAutofillProcess(options = {}) {
  try {
    // Store options
    autofillOptions = {
      autoPlayback: options.autoPlayback || false,
      autoProceed: options.autoProceed || false
    };

    if (autofillOptions.autoPlayback) {
      logToConsole('warn', '⚡ AUTO-PLAYBACK MODE ENABLED - All fields will be filled automatically without confirmation!');
    }
    if (autofillOptions.autoProceed) {
      logToConsole('warn', '⚡ AUTO-PROCEED MODE ENABLED - Will automatically click Next/Continue buttons!');
    }

    logToConsole('info', 'Starting autofill process...', autofillOptions);

    // Get tab ID for multi-tab coordination
    tabId = await getTabId();
    logToConsole('info', `Autofill session initialized for tab ${tabId}`);

    // Scan page for form inputs
    setState(AutofillState.SCANNING);
    formInputs = findFormInputs();

    if (formInputs.length === 0) {
      logToConsole('warn', 'No form inputs found on this page');
      setState(AutofillState.COMPLETED);
      return;
    }

    logToConsole('success', `Found ${formInputs.length} form inputs`, {
      inputs: formInputs.map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        question: extractQuestionForInput(i)
      }))
    });

    // Check for submit/review buttons (safety check)
    const dangerousButtons = findDangerousButtons();
    if (dangerousButtons.length > 0) {
      logToConsole('warn', `Found ${dangerousButtons.length} submit/review buttons - will not auto-click these`, {
        buttons: dangerousButtons.map(b => b.textContent.trim())
      });
    }

    // Start processing
    currentIndex = 0;
    processedInputs.clear();
    skippedInputs.clear();
    setState(AutofillState.RUNNING);

    await processNextInput();

  } catch (error) {
    logToConsole('error', 'Fatal error in autofill process', { error: error.message });
    setState(AutofillState.ERROR);
  }
}

/**
 * Process the next input in the queue
 */
async function processNextInput() {
  // Check if we should pause
  if (currentState === AutofillState.PAUSED) {
    logToConsole('info', 'Autofill paused by user or system');
    return;
  }

  // Check if we're done
  if (currentIndex >= formInputs.length) {
    logToConsole('success', 'Autofill process completed!', {
      total: formInputs.length,
      processed: processedInputs.size,
      skipped: skippedInputs.size
    });
    setState(AutofillState.COMPLETED);
    removeApprovalUI();

    // Check if auto-proceed is enabled
    if (autofillOptions.autoProceed) {
      logToConsole('info', '⚡ Auto-proceed enabled - looking for Next/Continue button...');
      await handleAutoProceed();
    }

    return;
  }

  const input = formInputs[currentIndex];
  const question = extractQuestionForInput(input);

  logToConsole('info', `Processing input ${currentIndex + 1}/${formInputs.length}`, {
    type: input.type,
    question
  });

  if (!question || question.length < 3) {
    logToConsole('warn', 'Skipping input: no question found', {
      type: input.type,
      name: input.name,
      id: input.id
    });
    skippedInputs.add(currentIndex);
    currentIndex++;
    await processNextInput();
    return;
  }

  // Request suggestion from service worker
  setState(AutofillState.WAITING_USER);
  chrome.runtime.sendMessage(
    { action: 'findSimilarAnswer', question },
    async (response) => {
      if (!response || !response.success) {
        logToConsole('warn', 'No matching Q&A found for question', { question });
        skippedInputs.add(currentIndex);
        currentIndex++;
        await processNextInput();
        return;
      }

      if (!response.answer) {
        logToConsole('info', 'No answer suggestion available', {
          question,
          similarity: response.similarity
        });
        skippedInputs.add(currentIndex);
        currentIndex++;
        await processNextInput();
        return;
      }

      // Get available options for choice-type inputs
      const availableOptions = getAvailableOptions(input);

      logToConsole('success', 'Found matching Q&A pair', {
        question,
        suggestedAnswer: response.answer,
        similarity: response.similarity,
        answerType: response.answerType,
        availableOptions
      });

      // Define approval callback (used for both auto and manual)
      const approvalCallback = async () => {
        // Fill the input
        const success = await fillInputIntelligently(input, response.answer, availableOptions, response.answerType);

        if (success) {
          logToConsole('success', 'Successfully filled input', {
            question,
            answer: response.answer,
            auto: autofillOptions.autoPlayback
          });
          processedInputs.add(currentIndex);
        } else {
          logToConsole('error', 'Failed to fill input', {
            question,
            answer: response.answer
          });
          skippedInputs.add(currentIndex);
        }

        currentIndex++;
        setState(AutofillState.RUNNING);
        await processNextInput();
      };

      // Check if auto-playback is enabled
      if (autofillOptions.autoPlayback) {
        // Auto-fill without showing UI
        logToConsole('info', '⚡ Auto-filling (no confirmation)', { question, answer: response.answer });
        await approvalCallback();
      } else {
        // Show approval UI with intelligent matching
        showApprovalUI(
          input,
          question,
          response.answer,
          availableOptions,
          response.answerType,
          approvalCallback,
          async () => {
            // User rejected - skip this input
            logToConsole('info', 'User skipped input', { question });
            skippedInputs.add(currentIndex);
            currentIndex++;
            setState(AutofillState.RUNNING);
            await processNextInput();
          },
          () => {
            // User paused
            logToConsole('warn', 'User paused autofill');
            setState(AutofillState.PAUSED);
          }
        );
      }
    }
  );
}

// ============ INTELLIGENT INPUT FILLING ============

/**
 * Get available options for select/radio/checkbox inputs
 * @param {HTMLElement} input - Input element
 * @returns {Array<string>} Available options
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
    const label = input.labels?.[0] || document.querySelector(`label[for="${input.id}"]`);
    return label ? [label.textContent.trim()] : [];
  }

  return [];
}

/**
 * Intelligently fill input based on answer type and available options
 * @param {HTMLElement} input - Input element
 * @param {string} answer - Suggested answer
 * @param {Array<string>} availableOptions - Available options for choice inputs
 * @param {string} answerType - Type of answer (choice, text, exact)
 * @returns {boolean} Success status
 */
async function fillInputIntelligently(input, answer, availableOptions, answerType) {
  try {
    if (input.tagName === 'SELECT') {
      return fillSelectInput(input, answer, availableOptions, answerType);
    }

    if (input.type === 'radio') {
      return fillRadioInput(input, answer, availableOptions, answerType);
    }

    if (input.type === 'checkbox') {
      return fillCheckboxInput(input, answer, answerType);
    }

    // Text inputs
    input.value = answer;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;

  } catch (error) {
    logToConsole('error', 'Error filling input', { error: error.message });
    return false;
  }
}

/**
 * Fill select input with intelligent matching
 */
function fillSelectInput(input, answer, availableOptions, answerType) {
  if (answerType === 'exact') {
    // Exact match only
    const option = Array.from(input.options).find(opt => opt.textContent.trim() === answer);
    if (option) {
      input.value = option.value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  // Choice type - try fuzzy matching
  const normalizedAnswer = answer.toLowerCase().trim();

  // Try exact match first
  let option = Array.from(input.options).find(opt => opt.textContent.trim().toLowerCase() === normalizedAnswer);

  if (!option) {
    // Try partial match (e.g., "Yes" matches "Yes - I am authorized")
    option = Array.from(input.options).find(opt => {
      const optText = opt.textContent.trim().toLowerCase();
      return optText.includes(normalizedAnswer) || normalizedAnswer.includes(optText);
    });
  }

  if (option) {
    input.value = option.value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    logToConsole('info', 'Matched select option', {
      answer,
      matched: option.textContent.trim()
    });
    return true;
  }

  logToConsole('warn', 'No matching select option found', {
    answer,
    availableOptions
  });
  return false;
}

/**
 * Fill radio input with intelligent matching
 */
function fillRadioInput(input, answer, availableOptions, answerType) {
  const name = input.name;
  if (!name) return false;

  const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
  const normalizedAnswer = answer.toLowerCase().trim();

  for (const radio of radioGroup) {
    const label = radio.labels?.[0] || document.querySelector(`label[for="${radio.id}"]`);
    const labelText = label ? label.textContent.trim().toLowerCase() : radio.value.toLowerCase();

    if (answerType === 'exact') {
      if (labelText === normalizedAnswer) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } else {
      // Fuzzy match for choice type
      if (labelText.includes(normalizedAnswer) || normalizedAnswer.includes(labelText)) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        logToConsole('info', 'Matched radio option', {
          answer,
          matched: labelText
        });
        return true;
      }
    }
  }

  logToConsole('warn', 'No matching radio option found', {
    answer,
    availableOptions
  });
  return false;
}

/**
 * Fill checkbox input
 */
function fillCheckboxInput(input, answer, answerType) {
  const normalizedAnswer = answer.toLowerCase().trim();
  const shouldCheck = ['yes', 'true', '1', 'checked'].includes(normalizedAnswer);
  input.checked = shouldCheck;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// ============ UI COMPONENTS ============

/**
 * Enhanced approval UI with pause button and more info
 */
function showApprovalUI(input, question, answer, availableOptions, answerType, onApprove, onReject, onPause) {
  removeApprovalUI();

  const overlay = document.createElement('div');
  overlay.id = 'jobsprint-approval-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.7); display: flex;
    justify-content: center; align-items: center; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white; border-radius: 12px; padding: 24px;
    max-width: 600px; width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 12px;';
  header.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 18px; color: #333;">Autofill Suggestion</h3>
      <div style="background: #4CAF50; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
        ${currentIndex + 1} / ${formInputs.length}
      </div>
    </div>
  `;

  // Question
  const questionDiv = document.createElement('div');
  questionDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-radius: 6px;';
  questionDiv.innerHTML = `
    <div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 4px;">QUESTION</div>
    <div style="font-size: 14px; color: #333;">${escapeHtml(question)}</div>
  `;

  // Answer
  const answerDiv = document.createElement('div');
  answerDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #4CAF50;';
  answerDiv.innerHTML = `
    <div style="font-size: 12px; font-weight: 600; color: #2e7d32; margin-bottom: 4px;">SUGGESTED ANSWER</div>
    <div style="font-size: 15px; color: #1b5e20; font-weight: 500;">${escapeHtml(answer)}</div>
  `;

  // Available options (if any)
  if (availableOptions && Array.isArray(availableOptions) && availableOptions.length > 0) {
    const optionsDiv = document.createElement('div');
    optionsDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #fff3e0; border-radius: 6px;';
    optionsDiv.innerHTML = `
      <div style="font-size: 12px; font-weight: 600; color: #e65100; margin-bottom: 4px;">AVAILABLE OPTIONS</div>
      <div style="font-size: 13px; color: #bf360c;">${availableOptions.map(opt => escapeHtml(opt)).join(', ')}</div>
    `;
    modal.appendChild(optionsDiv);
  }

  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

  const pauseBtn = createButton('Pause', '#ff9800', onPause);
  const skipBtn = createButton('Skip', '#999', onReject);
  const applyBtn = createButton('Apply', '#4CAF50', onApprove);

  buttonContainer.appendChild(pauseBtn);
  buttonContainer.appendChild(skipBtn);
  buttonContainer.appendChild(applyBtn);

  modal.appendChild(header);
  modal.appendChild(questionDiv);
  modal.appendChild(answerDiv);
  modal.appendChild(buttonContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Highlight input
  highlightTargetInput(input);
  applyBtn.focus();
}

function createButton(text, color, onClick) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
    padding: 10px 20px; background: ${color}; color: white;
    border: none; border-radius: 6px; font-size: 14px;
    font-weight: 600; cursor: pointer; transition: opacity 0.2s;
  `;
  btn.onmouseover = () => { btn.style.opacity = '0.8'; };
  btn.onmouseout = () => { btn.style.opacity = '1'; };
  btn.onclick = () => {
    removeApprovalUI();
    onClick();
  };
  return btn;
}

function removeApprovalUI() {
  const overlay = document.getElementById('jobsprint-approval-overlay');
  if (overlay) overlay.remove();

  document.querySelectorAll('input, textarea, select').forEach(input => {
    input.style.outline = '';
    input.style.outlineOffset = '';
  });
}

function highlightTargetInput(input) {
  if (input) {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.style.outline = '3px solid #4CAF50';
    input.style.outlineOffset = '2px';
  }
}

// ============ UTILITY FUNCTIONS ============

function setState(newState) {
  const oldState = currentState;
  currentState = newState;
  logToConsole('info', `State changed: ${oldState} → ${newState}`);

  // Notify popup of state change
  chrome.runtime.sendMessage({
    action: 'autofillStateChange',
    state: newState,
    progress: {
      current: currentIndex,
      total: formInputs.length,
      processed: processedInputs.size,
      skipped: skippedInputs.size
    }
  }).catch(() => {});
}

async function getTabId() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getTabId' }, (response) => {
      resolve(response?.tabId || Math.random().toString(36).substr(2, 9));
    });
  });
}

function findDangerousButtons() {
  const dangerousKeywords = ['submit', 'send', 'complete', 'finish', 'review', 'next', 'continue'];
  const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');

  return Array.from(buttons).filter(btn => {
    const text = btn.textContent.toLowerCase() || btn.value.toLowerCase();
    return dangerousKeywords.some(keyword => text.includes(keyword));
  });
}

/**
 * Handle auto-proceed - click Next/Continue buttons but not Submit
 */
async function handleAutoProceed() {
  try {
    // Find all buttons
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"]');

    // Keywords to look for (proceed buttons)
    const proceedKeywords = ['next', 'continue', 'proceed', 'forward', 'go', 'advance'];

    // Keywords to avoid (dangerous buttons)
    const dangerousKeywords = ['submit', 'send', 'complete', 'finish', 'finalize', 'confirm', 'apply'];

    // Find the proceed button
    let proceedButton = null;
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase().trim();

      // Skip if button is hidden or disabled
      if (btn.offsetParent === null || btn.disabled) continue;

      // Skip if it contains dangerous keywords
      if (dangerousKeywords.some(keyword => text.includes(keyword))) {
        logToConsole('info', `Skipping dangerous button: "${text}"`);
        continue;
      }

      // Check if it contains proceed keywords
      if (proceedKeywords.some(keyword => text.includes(keyword))) {
        proceedButton = btn;
        logToConsole('success', `Found proceed button: "${text}"`);
        break;
      }
    }

    if (proceedButton) {
      logToConsole('warn', `⚡ Clicking proceed button in 2 seconds...`, {
        buttonText: proceedButton.textContent || proceedButton.value
      });

      // Wait 2 seconds before clicking (give user time to see what's happening)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click the button
      proceedButton.click();
      logToConsole('success', '✓ Clicked proceed button');
    } else {
      logToConsole('info', 'No proceed button found - staying on current page');
    }
  } catch (error) {
    logToConsole('error', 'Error in handleAutoProceed', { error: error.message });
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Export for main content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startAutofillProcess, AutofillState };
}
