/**
 * JobSprint Content Script - Webpage Interaction
 * Handles DOM manipulation, data extraction, and form filling
 */

console.log('JobSprint Content Script loaded');

/**
 * Message listener for commands from popup and service worker
 * Handles: pasteText, extractJobData, startAutofill
 *
 * Return values:
 * - Returns true for synchronous responses (all current handlers are sync)
 * - Would return true for async if using setTimeout/fetch/etc
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content Script received message:', message);

  switch (message.action) {
    case 'pasteText':
      // Paste clipboard macro to active input field
      pasteTextToActiveField(message.text);
      sendResponse({ success: true });
      return false; // Synchronous response

    case 'extractJobData':
      // Extract job posting data from current page
      const jobData = extractJobData();
      sendResponse({ success: true, data: jobData });
      return false; // Synchronous response

    case 'startAutofill':
      // Start semi-supervised form autofill process
      startAutofillProcess();
      sendResponse({ success: true });
      return false; // Synchronous response

    default:
      // Unknown action - return error
      sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      return false; // Synchronous response
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
// Note: Core extraction logic is in content-script-testable.js for better testability
// These functions are duplicated here since browser extensions can't use ES6 imports in content scripts

/**
 * Extract job posting data from the current page
 * @returns {Object} Extracted job data with title, company, location, url, timestamp, and source
 */
function extractJobData() {
  try {
    const data = {
      title: '',
      company: '',
      location: '',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: extractSource(window.location.href)
    };

    // CSS selectors for job boards (LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Workday)
    const titleSelectors = [
      'h1', '[data-job-title]', '.job-title', '.jobTitle',
      '.topcard__title', '.top-card-layout__title',
      '.jobsearch-JobInfoHeader-title',
      '[data-test="job-title"]', '.app-title', '.posting-headline h2',
      '[data-automation-id="jobPostingHeader"]'
    ];

    const companySelectors = [
      '[data-company-name]', '.company-name', '.companyName', '.employer',
      '.topcard__org-name-link', '.top-card-layout__entity-info a',
      '[data-company-name="true"]', '[data-test="employer-name"]',
      '.posting-categories .posting-category'
    ];

    const locationSelectors = [
      '[data-location]', '.location', '.job-location', '.jobLocation',
      '.topcard__flavor--bullet', '.top-card-layout__second-subline',
      '[data-testid="job-location"]', '.jobsearch-JobInfoHeader-subtitle > div',
      '[data-test="location"]', '.posting-categories .location'
    ];

    data.title = extractField(titleSelectors);
    data.company = extractField(companySelectors);
    data.location = extractField(locationSelectors);

    if (!data.title && !data.company) {
      console.warn('JobSprint: Could not extract meaningful job data from this page');
    }

    console.log('Extracted job data:', data);
    return data;
  } catch (error) {
    console.error('Error extracting job data:', error);
    return {
      title: '',
      company: '',
      location: '',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Extract field value using multiple selectors with fallback
 * @param {Array<string>} selectors - Array of CSS selectors to try in order
 * @returns {string} Extracted and cleaned text, or empty string if not found
 */
function extractField(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return cleanText(element.textContent.trim());
      }
    } catch (error) {
      console.debug(`Failed to query selector "${selector}":`, error);
    }
  }
  return '';
}

/**
 * Clean extracted text by removing extra whitespace and newlines
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text with normalized whitespace
 */
function cleanText(text) {
  return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
}

/**
 * Extract source/job board name from URL
 * @param {string} url - Current page URL
 * @returns {string} Source name (e.g., 'LinkedIn', 'Indeed') or hostname
 */
function extractSource(url) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('linkedin.com')) return 'LinkedIn';
    if (hostname.includes('indeed.com')) return 'Indeed';
    if (hostname.includes('glassdoor.com')) return 'Glassdoor';
    if (hostname.includes('greenhouse.io')) return 'Greenhouse';
    if (hostname.includes('lever.co')) return 'Lever';
    if (hostname.includes('myworkdayjobs.com')) return 'Workday';
    return hostname;
  } catch {
    return 'Unknown';
  }
}

// ============ AUTOFILL FEATURE ============

/**
 * Start the semi-supervised autofill process
 * Finds all form inputs and processes them sequentially with user confirmation
 */
function startAutofillProcess() {
  console.log('Starting autofill process...');

  const formInputs = findFormInputs();

  if (formInputs.length === 0) {
    console.log('No form inputs found');
    return;
  }

  console.log(`Found ${formInputs.length} form inputs`);
  processNextInput(formInputs, 0);
}

/**
 * Find all relevant form inputs on the page
 * @returns {Array<HTMLElement>} Array of input elements (text, email, tel, textarea, select, radio, checkbox)
 */
function findFormInputs() {
  const inputs = [];

  // Gather text-based inputs
  const textInputs = document.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="tel"], textarea, select'
  );
  inputs.push(...textInputs);

  // Gather choice-based inputs
  const choiceInputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  inputs.push(...choiceInputs);

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
 * Tries to find the label or nearby text that describes what the input is for
 * @param {HTMLElement} input - Input element
 * @returns {string} Question text or empty string if not found
 */
function extractQuestionForInput(input) {
  // First try: find associated label element
  const label = input.labels?.[0] || document.querySelector(`label[for="${input.id}"]`);
  if (label) {
    return label.textContent.trim();
  }

  // Second try: use nearby text from parent element
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
 * Displays a modal with the question and suggested answer, allowing user to approve or skip
 * @param {HTMLElement} input - The input field being autofilled
 * @param {string} question - The question text
 * @param {string} answer - The suggested answer
 * @param {Function} onApprove - Callback when user approves
 * @param {Function} onReject - Callback when user rejects
 */
function showApprovalUI(input, question, answer, onApprove, onReject) {
  removeApprovalUI();

  const overlay = createOverlay();
  const modal = createModal();

  // Build modal content
  modal.appendChild(createModalHeader());
  modal.appendChild(createQuestionDisplay(question));
  modal.appendChild(createAnswerDisplay(answer));

  const { approveBtn, rejectBtn } = createActionButtons(onApprove, onReject);
  const buttonContainer = createButtonContainer(rejectBtn, approveBtn);
  modal.appendChild(buttonContainer);

  // Assemble and display
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Setup interactions
  setupKeyboardHandling(onReject);
  highlightTargetInput(input);
  approveBtn.focus();
}

/**
 * Create the overlay backdrop
 * @returns {HTMLElement} Overlay element
 */
function createOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'jobsprint-approval-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.7); display: flex;
    justify-content: center; align-items: center; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  return overlay;
}

/**
 * Create the modal container
 * @returns {HTMLElement} Modal element
 */
function createModal() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white; border-radius: 12px; padding: 24px;
    max-width: 500px; width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation
  if (!document.getElementById('jobsprint-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'jobsprint-modal-styles';
    style.textContent = `@keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
    document.head.appendChild(style);
  }

  return modal;
}

/**
 * Create modal header with icon and title
 * @returns {HTMLElement} Header element
 */
function createModalHeader() {
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; margin-bottom: 16px;';

  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 40px; height: 40px; background: #4CAF50; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin-right: 12px; font-size: 20px; color: white;
  `;
  icon.textContent = '✓';

  const title = document.createElement('h3');
  title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #333;';
  title.textContent = 'Autofill Suggestion';

  header.appendChild(icon);
  header.appendChild(title);
  return header;
}

/**
 * Create question display section
 * @param {string} question - Question text
 * @returns {HTMLElement} Question display element
 */
function createQuestionDisplay(question) {
  const container = document.createElement('div');
  container.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-radius: 6px;';

  const label = document.createElement('div');
  label.style.cssText = 'font-size: 12px; font-weight: 600; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;';
  label.textContent = 'Question';

  const text = document.createElement('div');
  text.style.cssText = 'font-size: 14px; color: #333; line-height: 1.4;';
  text.textContent = question;

  container.appendChild(label);
  container.appendChild(text);
  return container;
}

/**
 * Create answer display section
 * @param {string} answer - Answer text
 * @returns {HTMLElement} Answer display element
 */
function createAnswerDisplay(answer) {
  const container = document.createElement('div');
  container.style.cssText = 'margin-bottom: 20px; padding: 12px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #4CAF50;';

  const label = document.createElement('div');
  label.style.cssText = 'font-size: 12px; font-weight: 600; color: #2e7d32; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;';
  label.textContent = 'Suggested Answer';

  const text = document.createElement('div');
  text.style.cssText = 'font-size: 15px; color: #1b5e20; font-weight: 500; line-height: 1.4;';
  text.textContent = answer;

  container.appendChild(label);
  container.appendChild(text);
  return container;
}

/**
 * Create action buttons (approve and reject)
 * @param {Function} onApprove - Approve callback
 * @param {Function} onReject - Reject callback
 * @returns {Object} Object with approveBtn and rejectBtn elements
 */
function createActionButtons(onApprove, onReject) {
  const rejectBtn = document.createElement('button');
  rejectBtn.textContent = 'Skip';
  rejectBtn.style.cssText = 'padding: 10px 20px; border: 2px solid #ddd; background: white; color: #666; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
  rejectBtn.addEventListener('mouseover', () => { rejectBtn.style.background = '#f5f5f5'; rejectBtn.style.borderColor = '#999'; });
  rejectBtn.addEventListener('mouseout', () => { rejectBtn.style.background = 'white'; rejectBtn.style.borderColor = '#ddd'; });
  rejectBtn.addEventListener('click', () => { removeApprovalUI(); onReject(); });

  const approveBtn = document.createElement('button');
  approveBtn.textContent = 'Apply Answer';
  approveBtn.style.cssText = 'padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
  approveBtn.addEventListener('mouseover', () => { approveBtn.style.background = '#45a049'; });
  approveBtn.addEventListener('mouseout', () => { approveBtn.style.background = '#4CAF50'; });
  approveBtn.addEventListener('click', () => { removeApprovalUI(); onApprove(); });

  return { approveBtn, rejectBtn };
}

/**
 * Create button container
 * @param {...HTMLElement} buttons - Button elements to add
 * @returns {HTMLElement} Button container element
 */
function createButtonContainer(...buttons) {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';
  buttons.forEach(btn => container.appendChild(btn));
  return container;
}

/**
 * Setup keyboard event handling (ESC to reject)
 * @param {Function} onReject - Reject callback
 */
function setupKeyboardHandling(onReject) {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      removeApprovalUI();
      onReject();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Highlight the target input field
 * @param {HTMLElement} input - Input element to highlight
 */
function highlightTargetInput(input) {
  if (input) {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.style.outline = '3px solid #4CAF50';
    input.style.outlineOffset = '2px';
  }
}

/**
 * Remove approval UI overlay
 */
function removeApprovalUI() {
  const overlay = document.getElementById('jobsprint-approval-overlay');
  if (overlay) {
    overlay.remove();
  }

  // Remove highlight from all inputs
  const allInputs = document.querySelectorAll('input, textarea, select');
  allInputs.forEach(input => {
    input.style.outline = '';
    input.style.outlineOffset = '';
  });
}
