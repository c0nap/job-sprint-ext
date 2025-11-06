/**
 * JobSprint Content Script - Webpage Interaction
 * Handles DOM manipulation, data extraction, and form filling
 */

console.log('JobSprint Content Script loaded');

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content Script received message:', message);

  switch (message.action) {
    case 'pasteText':
      pasteTextToActiveField(message.text);
      sendResponse({ success: true });
      break;

    case 'extractJobData':
      const jobData = extractJobData();
      sendResponse({ success: true, data: jobData });
      break;

    case 'startAutofill':
      startAutofillProcess();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// ============ CLIPBOARD FEATURE ============

/**
 * Paste text into the currently focused input field
 * @param {string} text - Text to paste
 */
function pasteTextToActiveField(text) {
  const activeElement = document.activeElement;

  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    // Try using execCommand first (legacy but reliable)
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      // Fallback: direct value manipulation
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const currentValue = activeElement.value;

      activeElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + text.length;

      // Trigger input event for frameworks (React, Vue, etc.)
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      activeElement.dispatchEvent(new Event('change', { bubbles: true }));
    }

    console.log('Text pasted successfully');
  } else {
    console.warn('No active input field found');
  }
}

// ============ EXTRACTION FEATURE ============

/**
 * Extract job posting data from the current page
 * @returns {Object} Extracted job data
 */
function extractJobData() {
  const data = {
    title: '',
    company: '',
    location: '',
    url: window.location.href,
    timestamp: new Date().toISOString()
  };

  // TODO: Implement site-specific selectors
  // Example selectors (will need refinement per job site)
  const titleSelectors = ['h1', '[data-job-title]', '.job-title', '.jobTitle'];
  const companySelectors = ['[data-company-name]', '.company-name', '.companyName', '.employer'];
  const locationSelectors = ['[data-location]', '.location', '.job-location', '.jobLocation'];

  // Try to find title
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      data.title = element.textContent.trim();
      break;
    }
  }

  // Try to find company
  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      data.company = element.textContent.trim();
      break;
    }
  }

  // Try to find location
  for (const selector of locationSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      data.location = element.textContent.trim();
      break;
    }
  }

  console.log('Extracted job data:', data);
  return data;
}

// ============ AUTOFILL FEATURE ============

/**
 * Start the semi-supervised autofill process
 */
function startAutofillProcess() {
  console.log('Starting autofill process...');

  // Find all form inputs on the page
  const formInputs = findFormInputs();

  if (formInputs.length === 0) {
    console.log('No form inputs found');
    return;
  }

  console.log(`Found ${formInputs.length} form inputs`);

  // Process each input sequentially
  processNextInput(formInputs, 0);
}

/**
 * Find all relevant form inputs on the page
 * @returns {Array} Array of input elements
 */
function findFormInputs() {
  const inputs = [];

  // Text inputs, textareas, selects
  const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea, select');
  inputs.push(...textInputs);

  // Radio buttons and checkboxes (group by name)
  const radioCheckboxes = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  inputs.push(...radioCheckboxes);

  return inputs;
}

/**
 * Process form inputs sequentially with user confirmation
 * @param {Array} inputs - Array of input elements
 * @param {number} index - Current index
 */
function processNextInput(inputs, index) {
  if (index >= inputs.length) {
    console.log('Autofill process completed');
    removeApprovalUI();
    return;
  }

  const input = inputs[index];
  const question = extractQuestionForInput(input);

  if (!question) {
    // Skip this input and move to next
    processNextInput(inputs, index + 1);
    return;
  }

  // Request suggestion from service worker
  chrome.runtime.sendMessage(
    { action: 'findSimilarAnswer', question },
    (response) => {
      if (response.success && response.answer) {
        // Show approval UI
        showApprovalUI(input, question, response.answer, () => {
          // User approved - fill the input
          fillInput(input, response.answer);
          processNextInput(inputs, index + 1);
        }, () => {
          // User rejected - skip this input
          processNextInput(inputs, index + 1);
        });
      } else {
        // No suggestion found - skip this input
        processNextInput(inputs, index + 1);
      }
    }
  );
}

/**
 * Extract question text associated with an input field
 * @param {HTMLElement} input - Input element
 * @returns {string} Question text
 */
function extractQuestionForInput(input) {
  // Try to find associated label
  const label = input.labels?.[0] || document.querySelector(`label[for="${input.id}"]`);

  if (label) {
    return label.textContent.trim();
  }

  // Try to find nearby text
  const parent = input.parentElement;
  if (parent) {
    return parent.textContent.trim();
  }

  return '';
}

/**
 * Fill input field with suggested answer
 * @param {HTMLElement} input - Input element
 * @param {string} answer - Answer to fill
 */
function fillInput(input, answer) {
  if (input.tagName === 'SELECT') {
    // Find matching option
    const options = Array.from(input.options);
    const matchingOption = options.find(opt => opt.textContent.trim() === answer);
    if (matchingOption) {
      input.value = matchingOption.value;
    }
  } else if (input.type === 'radio' || input.type === 'checkbox') {
    input.checked = answer === 'true' || answer === 'yes';
  } else {
    input.value = answer;
  }

  // Trigger events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Show approval UI overlay for user confirmation
 */
function showApprovalUI(input, question, answer, onApprove, onReject) {
  // TODO: Implement approval UI overlay
  // For now, use simple confirm dialog as placeholder
  const approved = confirm(`Fill "${question}" with "${answer}"?`);

  if (approved) {
    onApprove();
  } else {
    onReject();
  }
}

/**
 * Remove approval UI overlay
 */
function removeApprovalUI() {
  // TODO: Implement UI removal
  console.log('Approval UI removed');
}
