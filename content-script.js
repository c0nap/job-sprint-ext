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

    case 'startMouseTracking':
      // Start interactive mouse tracking for field auto-fill
      startMouseTracking(message.fieldId);
      sendResponse({ success: true });
      return false; // Synchronous response

    case 'stopMouseTracking':
      // Stop interactive mouse tracking
      stopMouseTracking();
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
 * Uses intelligent field-aware extractors (same logic as interactive mouse tracking)
 * @returns {Object} Extracted job data with title, company, location, compensation, pay, description, url, timestamp, and source
 */
function extractJobData() {
  try {
    const data = {
      title: '',
      company: '',
      location: '',
      compensation: '',
      pay: '',
      description: '',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: extractSource(window.location.href)
    };

    // Use intelligent extractors (same as mouse tracking feature)
    data.title = searchPageForJobTitle() || '';
    data.company = searchPageForCompany() || '';
    data.location = searchPageForLocation() || '';
    data.compensation = searchPageForCompensation() || '';
    data.pay = searchPageForPay() || '';
    data.description = searchPageForDescription() || '';

    // Fallback to CSS selector-based extraction if intelligent extractors fail
    if (!data.title) {
      const titleSelectors = [
        'h1', '[data-job-title]', '.job-title', '.jobTitle',
        '.topcard__title', '.top-card-layout__title',
        '.jobsearch-JobInfoHeader-title',
        '[data-test="job-title"]', '.app-title', '.posting-headline h2',
        '[data-automation-id="jobPostingHeader"]'
      ];
      data.title = extractField(titleSelectors);
    }

    if (!data.company) {
      const companySelectors = [
        '[data-company-name]', '.company-name', '.companyName', '.employer',
        '.topcard__org-name-link', '.top-card-layout__entity-info a',
        '[data-company-name="true"]', '[data-test="employer-name"]',
        '.posting-categories .posting-category'
      ];
      data.company = extractField(companySelectors);
    }

    if (!data.location) {
      const locationSelectors = [
        '[data-location]', '.location', '.job-location', '.jobLocation',
        '.topcard__flavor--bullet', '.top-card-layout__second-subline',
        '[data-testid="job-location"]', '.jobsearch-JobInfoHeader-subtitle > div',
        '[data-test="location"]', '.posting-categories .location'
      ];
      data.location = extractField(locationSelectors);
    }

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
      compensation: '',
      pay: '',
      description: '',
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

// ============ PAGE-WIDE INTELLIGENT EXTRACTORS ============
// These wrappers use the same intelligent extraction logic as mouse tracking,
// but search the entire page instead of a specific element

/**
 * Search entire page for job title using intelligent extraction
 * @returns {string|null} Extracted job title or null
 */
function searchPageForJobTitle() {
  // Priority 1: Check for data attributes on any element
  const dataAttrElements = document.querySelectorAll('[data-job-title], [data-title], [data-position]');
  for (const element of dataAttrElements) {
    const result = extractJobTitle(element);
    if (result) return result;
  }

  // Priority 2: Check headers in semantic containers
  const semanticContainers = document.querySelectorAll('article, main, [role="main"]');
  for (const container of semanticContainers) {
    const headers = container.querySelectorAll('h1, h2, h3');
    for (const header of headers) {
      const result = extractJobTitle(header);
      if (result) return result;
    }
  }

  // Priority 3: Check all h1-h3 headers on page (most likely to be job title)
  const headers = document.querySelectorAll('h1, h2, h3');
  for (const header of headers) {
    const result = extractJobTitle(header);
    if (result) return result;
  }

  // Priority 4: Check common job title class names
  const titleClassElements = document.querySelectorAll('.job-title, .jobTitle, .title, .position, .job-header');
  for (const element of titleClassElements) {
    const result = extractJobTitle(element);
    if (result) return result;
  }

  return null;
}

/**
 * Search entire page for company name using intelligent extraction
 * @returns {string|null} Extracted company name or null
 */
function searchPageForCompany() {
  // Priority 1: Check common company class names first
  const companyClassElements = document.querySelectorAll(
    '[data-company-name], .company, .companyName, .employer, .organization, .org-name, .org, .business'
  );
  for (const element of companyClassElements) {
    const result = extractCompanyName(element);
    if (result) return result;
  }

  // Priority 2: Check links (companies often link to their pages)
  const links = document.querySelectorAll('a');
  for (const link of links) {
    const result = extractCompanyName(link);
    if (result) return result;
  }

  // Priority 3: Check all bold text elements in top 30% of page
  const viewportHeight = window.innerHeight;
  const allElements = document.querySelectorAll('*');
  for (const element of allElements) {
    const rect = element.getBoundingClientRect();
    if (rect.top < viewportHeight * 0.3) {
      const style = window.getComputedStyle(element);
      const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
      if (isBold) {
        const result = extractCompanyName(element);
        if (result) return result;
      }
    }
  }

  return null;
}

/**
 * Search entire page for location using intelligent extraction
 * @returns {string|null} Extracted location or null
 */
function searchPageForLocation() {
  const pageText = document.body.textContent || '';

  // Priority 1: Check common location class names
  const locationClassElements = document.querySelectorAll(
    '[data-location], .location, .job-location, .jobLocation'
  );
  for (const element of locationClassElements) {
    const text = cleanText(element.textContent);
    const result = extractLocation(element, text);
    if (result) return result;
  }

  // Priority 2: Search semantic containers (main, article)
  const semanticContainers = document.querySelectorAll('article, main, [role="main"]');
  for (const container of semanticContainers) {
    const text = cleanText(container.textContent);
    const result = extractLocation(container, text);
    if (result) return result;
  }

  // Priority 3: Search entire page text as last resort
  const result = extractLocation(document.body, pageText);
  if (result) return result;

  return null;
}

/**
 * Search entire page for compensation range using intelligent extraction
 * @returns {string|null} Extracted compensation or null
 */
function searchPageForCompensation() {
  const pageText = document.body.textContent || '';

  // Priority 1: Check common salary/compensation class names
  const salaryClassElements = document.querySelectorAll(
    '[data-salary], [data-compensation], .salary, .compensation, .pay-range, .wage'
  );
  for (const element of salaryClassElements) {
    const text = cleanText(element.textContent);
    const result = extractCompensationRange(element, text);
    if (result) return result;
  }

  // Priority 2: Search semantic containers
  const semanticContainers = document.querySelectorAll('article, main, [role="main"]');
  for (const container of semanticContainers) {
    const text = cleanText(container.textContent);
    const result = extractCompensationRange(container, text);
    if (result) return result;
  }

  // Priority 3: Search entire page text
  const result = extractCompensationRange(document.body, pageText);
  if (result) return result;

  return null;
}

/**
 * Search entire page for single pay amount using intelligent extraction
 * @returns {string|null} Extracted pay amount or null
 */
function searchPageForPay() {
  const pageText = document.body.textContent || '';

  // Priority 1: Check common pay class names
  const payClassElements = document.querySelectorAll(
    '[data-salary], [data-pay], .salary, .pay, .wage, .hourly-rate'
  );
  for (const element of payClassElements) {
    const text = cleanText(element.textContent);
    const result = extractPayAmount(element, text);
    if (result) return result;
  }

  // Priority 2: Search semantic containers
  const semanticContainers = document.querySelectorAll('article, main, [role="main"]');
  for (const container of semanticContainers) {
    const text = cleanText(container.textContent);
    const result = extractPayAmount(container, text);
    if (result) return result;
  }

  return null;
}

/**
 * Search entire page for job description using intelligent extraction
 * @returns {string|null} Extracted job description or null
 */
function searchPageForDescription() {
  // Priority 1: Check common description class names
  const descriptionClassElements = document.querySelectorAll(
    '.job-description, .description, .job-details, .posting-description, [data-description]'
  );
  for (const element of descriptionClassElements) {
    const result = extractLargeTextBlock(element);
    if (result) return result;
  }

  // Priority 2: Check semantic containers
  const semanticContainers = document.querySelectorAll('article, main, [role="main"]');
  for (const container of semanticContainers) {
    const result = extractLargeTextBlock(container);
    if (result) return result;
  }

  return null;
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
  rejectBtn.onmouseover = () => { rejectBtn.style.background = '#f5f5f5'; rejectBtn.style.borderColor = '#999'; };
  rejectBtn.onmouseout = () => { rejectBtn.style.background = 'white'; rejectBtn.style.borderColor = '#ddd'; };
  rejectBtn.onclick = () => { removeApprovalUI(); onReject(); };

  const approveBtn = document.createElement('button');
  approveBtn.textContent = 'Apply Answer';
  approveBtn.style.cssText = 'padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
  approveBtn.onmouseover = () => { approveBtn.style.background = '#45a049'; };
  approveBtn.onmouseout = () => { approveBtn.style.background = '#4CAF50'; };
  approveBtn.onclick = () => { removeApprovalUI(); onApprove(); };

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

// ============ INTERACTIVE MOUSE TRACKING ============

// Mouse tracking state
let mouseTrackingActive = false;
let currentTrackedFieldId = null;
let lastHighlightedElement = null;
let mouseTrackingOverlay = null;
let currentModifierMode = 'full'; // 'full', 'sentence', 'words', 'chars'
let currentGranularity = {
  words: 1,      // Number of words on each side (default: 1 word = 3 total)
  sentences: 1,  // Number of sentences (default: 1 sentence)
  chars: 1       // Number of characters on each side (default: 1 char)
};
let lastMouseEvent = null; // Store last mouse event for re-extraction
let overlayPosition = {
  top: 10,    // pixels from top
  right: 10,  // pixels from right
  bottom: null,  // pixels from bottom (alternative to top)
  left: null     // pixels from left (alternative to right)
};

// Mouse tracking settings (loaded from chrome.storage)
let mouseTrackingSettings = {
  sentenceModifier: 'shift',
  charModifier: 'ctrl',
  wordModifier: 'none',
  overlayMoveModifier: 'alt',
  overlayMoveStep: 20
};

/**
 * Load mouse tracking settings from chrome.storage
 * @returns {Promise<void>}
 */
async function loadMouseTrackingSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'SENTENCE_MODIFIER',
      'CHAR_MODIFIER',
      'WORD_MODIFIER',
      'OVERLAY_MOVE_MODIFIER',
      'OVERLAY_MOVE_STEP'
    ]);

    mouseTrackingSettings = {
      sentenceModifier: result.SENTENCE_MODIFIER || 'shift',
      charModifier: result.CHAR_MODIFIER || 'ctrl',
      wordModifier: result.WORD_MODIFIER || 'none',
      overlayMoveModifier: result.OVERLAY_MOVE_MODIFIER || 'alt',
      overlayMoveStep: result.OVERLAY_MOVE_STEP || 20
    };

    console.log('[MouseTracking] Settings loaded:', mouseTrackingSettings);
  } catch (error) {
    console.error('[MouseTracking] Error loading settings:', error);
    // Use defaults on error
  }
}

/**
 * Start interactive mouse tracking for field auto-fill
 * When user hovers over text elements, their content is extracted and sent to the extension
 * @param {string} fieldId - ID of the field being filled
 */
async function startMouseTracking(fieldId) {
  console.log('Starting mouse tracking for field:', fieldId);

  // Load settings before starting
  await loadMouseTrackingSettings();

  // Stop any existing tracking
  stopMouseTracking();

  mouseTrackingActive = true;
  currentTrackedFieldId = fieldId;

  // Create visual overlay to indicate tracking mode
  createTrackingOverlay();

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleMouseClick, true);
  document.addEventListener('keydown', handleEscapeKey, true);

  // Change cursor to indicate tracking mode
  document.body.style.cursor = 'crosshair';
}

/**
 * Stop interactive mouse tracking
 */
function stopMouseTracking() {
  if (!mouseTrackingActive) return;

  console.log('Stopping mouse tracking');

  mouseTrackingActive = false;
  currentTrackedFieldId = null;

  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleMouseClick, true);
  document.removeEventListener('keydown', handleEscapeKey, true);

  // Remove visual feedback
  removeHighlight();
  removeTrackingOverlay();

  // Restore cursor
  document.body.style.cursor = '';
}

/**
 * Handle mouse move events during tracking
 * @param {MouseEvent} event - Mouse event
 */
function handleMouseMove(event) {
  if (!mouseTrackingActive) return;

  // Store last mouse event for re-extraction when granularity changes
  lastMouseEvent = event;

  // Detect modifier keys to control extraction scope
  const mode = getExtractionMode(event);
  if (mode !== currentModifierMode) {
    currentModifierMode = mode;
    updateOverlayMode(mode);
  }

  // Get element under cursor
  const element = document.elementFromPoint(event.clientX, event.clientY);

  if (!element || element === mouseTrackingOverlay) return;

  // Extract text from element with appropriate scope
  const text = extractTextFromElement(element, event, mode);

  if (text && text.trim()) {
    // Highlight the element
    highlightElement(element);

    // Send text to extension popup
    sendTextToPopup(text.trim());
  } else {
    removeHighlight();
  }
}

/**
 * Handle mouse click during tracking - confirm selection and stop tracking
 * @param {MouseEvent} event - Mouse event
 */
function handleMouseClick(event) {
  if (!mouseTrackingActive) return;

  event.preventDefault();
  event.stopPropagation();

  // Get current extraction mode
  const mode = getExtractionMode(event);

  // Get element under cursor
  const element = document.elementFromPoint(event.clientX, event.clientY);

  if (element && element !== mouseTrackingOverlay) {
    const text = extractTextFromElement(element, event, mode);

    if (text && text.trim()) {
      // Send final text to popup and stop tracking
      sendTextToPopup(text.trim(), true);
    }
  }

  stopMouseTracking();
}

/**
 * Handle escape key to cancel tracking, arrow keys for granularity, and Alt+Arrow to move overlay
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleEscapeKey(event) {
  if (!mouseTrackingActive) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    stopMouseTracking();
    return;
  }

  // Handle overlay repositioning with configured modifier + Arrow keys
  if (checkModifierKey(event, mouseTrackingSettings.overlayMoveModifier) &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    handleOverlayReposition(event);
    return;
  }

  // Handle arrow keys for granularity control (without overlay move modifier)
  if (!checkModifierKey(event, mouseTrackingSettings.overlayMoveModifier) &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
    handleGranularityChange(event);
  }
}

/**
 * Handle arrow key presses to adjust extraction granularity
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleGranularityChange(event) {
  const increment = event.key === 'ArrowUp' ? 1 : -1;
  const mode = getExtractionMode(event);

  // Update granularity based on current mode
  if (mode === 'chars') {
    // Ctrl mode: adjust character granularity
    currentGranularity.chars = Math.max(0, currentGranularity.chars + increment);
  } else if (mode === 'sentence') {
    // Shift mode: adjust sentence granularity
    currentGranularity.sentences = Math.max(1, currentGranularity.sentences + increment);
  } else {
    // No modifier: adjust word granularity
    currentGranularity.words = Math.max(1, currentGranularity.words + increment);
  }

  // Update overlay to show current granularity
  updateOverlayMode(mode);

  // Re-extract text with new granularity if we have a last mouse position
  if (lastMouseEvent && lastHighlightedElement) {
    const text = extractTextFromElement(lastHighlightedElement, lastMouseEvent, mode);
    if (text && text.trim()) {
      sendTextToPopup(text.trim());
    }
  }
}

/**
 * Handle Alt+Arrow key presses to reposition the tracking overlay
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleOverlayReposition(event) {
  const MOVE_STEP = mouseTrackingSettings.overlayMoveStep; // pixels to move per keypress (from settings)

  // Get current viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate overlay dimensions (approximate)
  const overlayWidth = 300; // approximate width
  const overlayHeight = 100; // approximate height

  switch (event.key) {
    case 'ArrowUp':
      // Move up (decrease top if using top, increase bottom if using bottom)
      if (overlayPosition.top !== null) {
        overlayPosition.top = Math.max(0, overlayPosition.top - MOVE_STEP);
      } else if (overlayPosition.bottom !== null) {
        overlayPosition.bottom = Math.min(viewportHeight - overlayHeight, overlayPosition.bottom + MOVE_STEP);
      }
      break;

    case 'ArrowDown':
      // Move down (increase top if using top, decrease bottom if using bottom)
      if (overlayPosition.top !== null) {
        overlayPosition.top = Math.min(viewportHeight - overlayHeight, overlayPosition.top + MOVE_STEP);
      } else if (overlayPosition.bottom !== null) {
        overlayPosition.bottom = Math.max(0, overlayPosition.bottom - MOVE_STEP);
      }
      break;

    case 'ArrowLeft':
      // Move left (switch to left positioning, or decrease left value)
      if (overlayPosition.right !== null) {
        // Convert from right to left positioning
        overlayPosition.left = viewportWidth - overlayPosition.right - overlayWidth;
        overlayPosition.right = null;
      }
      if (overlayPosition.left !== null) {
        overlayPosition.left = Math.max(0, overlayPosition.left - MOVE_STEP);
      }
      break;

    case 'ArrowRight':
      // Move right (switch to right positioning, or decrease right value)
      if (overlayPosition.left !== null) {
        // Convert from left to right positioning
        overlayPosition.right = viewportWidth - overlayPosition.left - overlayWidth;
        overlayPosition.left = null;
      }
      if (overlayPosition.right !== null) {
        overlayPosition.right = Math.max(0, overlayPosition.right - MOVE_STEP);
      }
      break;
  }

  // Update overlay position
  updateOverlayPosition();
}

/**
 * Get extraction mode based on modifier keys and user settings
 * @param {MouseEvent|KeyboardEvent} event - Event with modifier key info
 * @returns {string} Extraction mode: 'words', 'sentence', or 'chars'
 */
function getExtractionMode(event) {
  // Check each configured modifier and return corresponding mode
  // Priority: Check if any specific modifier is pressed

  // Check for sentence modifier
  if (checkModifierKey(event, mouseTrackingSettings.sentenceModifier)) {
    return 'sentence';
  }

  // Check for char modifier
  if (checkModifierKey(event, mouseTrackingSettings.charModifier)) {
    return 'chars';
  }

  // Check for word modifier (or default if 'none')
  if (checkModifierKey(event, mouseTrackingSettings.wordModifier)) {
    return 'words';
  }

  // Default: use word mode with field-aware extraction
  return 'words';
}

/**
 * Check if a specific modifier key is pressed
 * @param {MouseEvent|KeyboardEvent} event - Event to check
 * @param {string} modifier - Modifier name: 'shift', 'ctrl', 'alt', or 'none'
 * @returns {boolean} True if the modifier is active
 */
function checkModifierKey(event, modifier) {
  switch (modifier) {
    case 'shift':
      return event.shiftKey;
    case 'ctrl':
      return event.ctrlKey || event.metaKey; // Support both Ctrl and Cmd
    case 'alt':
      return event.altKey;
    case 'none':
      // 'none' means this mode is active when NO modifiers are pressed
      return !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
    default:
      return false;
  }
}

/**
 * Extract text content from an element with scope control
 * Handles various element types and nested structures
 * @param {HTMLElement} element - Element to extract text from
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {string} mode - Extraction mode: 'chars', 'words', or 'sentence'
 * @returns {string} Extracted text
 */
function extractTextFromElement(element, event, mode = 'words') {
  if (!element) return '';

  // For input elements, get the value
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return element.value;
  }

  // Get the full text content
  let fullText = '';

  // Try to get text from the element itself (not children)
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      fullText += node.textContent;
    }
  }

  // If no direct text, get all text content
  if (!fullText.trim() && element.textContent) {
    fullText = element.textContent;
  }

  fullText = cleanText(fullText);

  // Apply scope based on mode and granularity
  if (mode === 'sentence') {
    return extractNearestSentences(fullText, event, element, currentGranularity.sentences);
  } else if (mode === 'words') {
    // In word mode, use field-aware intelligent extraction
    return extractFieldAware(element, event, fullText, currentGranularity.words);
  } else if (mode === 'chars') {
    return extractNearestChars(fullText, event, element, currentGranularity.chars);
  }

  return fullText;
}

/**
 * Field-aware intelligent extraction
 * Uses context from the focused field to intelligently extract relevant data
 * @param {HTMLElement} element - Element being hovered over
 * @param {MouseEvent} event - Mouse event
 * @param {string} fullText - Full text of element
 * @param {number} wordsPerSide - Granularity for word extraction
 * @returns {string} Extracted text
 */
function extractFieldAware(element, event, fullText, wordsPerSide) {
  // Determine which field is being filled based on currentTrackedFieldId
  const fieldId = currentTrackedFieldId;

  // Use field-specific extraction logic
  if (fieldId === 'manualPay') {
    return extractPayAmount(element, fullText) || extractNearestWords(fullText, event, element, wordsPerSide);
  } else if (fieldId === 'manualCompensation') {
    return extractCompensationRange(element, fullText) || extractNearestWords(fullText, event, element, wordsPerSide);
  } else if (fieldId === 'manualLocation') {
    return extractLocation(element, fullText) || extractNearestWords(fullText, event, element, wordsPerSide);
  } else if (fieldId === 'manualJobTitle') {
    return extractJobTitle(element) || extractNearestWords(fullText, event, element, wordsPerSide);
  } else if (fieldId === 'manualCompany') {
    return extractCompanyName(element) || extractNearestWords(fullText, event, element, wordsPerSide);
  } else if (fieldId === 'manualNotes') {
    return extractLargeTextBlock(element) || fullText;
  }

  // Default: use standard word extraction
  return extractNearestWords(fullText, event, element, wordsPerSide);
}

/**
 * Extract sentences nearest to the cursor position
 * @param {string} text - Full text content
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {HTMLElement} element - Element containing the text
 * @param {number} count - Number of sentences to extract
 * @returns {string} Nearest sentences
 */
function extractNearestSentences(text, event, element, count = 1) {
  if (!text) return '';

  // Split by sentence endings (.!?) followed by space or end
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];

  if (sentences.length === 1) {
    return sentences[0].trim();
  }

  // Try to find the position under cursor using Range API
  const range = document.caretRangeFromPoint(event.clientX, event.clientY);
  if (!range) {
    // Fallback: return first N sentences
    return sentences.slice(0, count).map(s => s.trim()).join(' ');
  }

  // Get approximate position in text
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    return sentences.slice(0, count).map(s => s.trim()).join(' ');
  }

  const offset = range.startOffset;
  const nodeText = textNode.textContent || '';

  // Find cumulative position in the full text
  let cumulativeLength = 0;
  const fullTextContent = element.textContent || '';
  const targetPosition = fullTextContent.indexOf(nodeText) + offset;

  // Find which sentence contains the target position
  let targetSentenceIndex = 0;
  for (let i = 0; i < sentences.length; i++) {
    cumulativeLength += sentences[i].length;
    if (cumulativeLength >= targetPosition) {
      targetSentenceIndex = i;
      break;
    }
  }

  // Extract sentences around the target (center on target sentence)
  const halfCount = Math.floor(count / 2);
  const startIndex = Math.max(0, targetSentenceIndex - halfCount);
  const endIndex = Math.min(sentences.length, startIndex + count);
  const selectedSentences = sentences.slice(startIndex, endIndex);

  return selectedSentences.map(s => s.trim()).join(' ');
}

/**
 * Extract words nearest to the cursor position
 * @param {string} text - Full text content
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {HTMLElement} element - Element containing the text
 * @param {number} wordsPerSide - Number of words on each side of cursor
 * @returns {string} Nearest words
 */
function extractNearestWords(text, event, element, wordsPerSide = 1) {
  if (!text) return '';

  // Split text into words
  const words = text.split(/\s+/).filter(w => w.trim());

  if (words.length === 0) return '';
  if (words.length === 1) return words[0];

  // Try to find the word under cursor using Range API
  const range = document.caretRangeFromPoint(event.clientX, event.clientY);
  if (!range) {
    // Fallback: return first N words
    const totalWords = wordsPerSide * 2 + 1;
    return words.slice(0, totalWords).join(' ');
  }

  // Get approximate position in text
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    const totalWords = wordsPerSide * 2 + 1;
    return words.slice(0, totalWords).join(' ');
  }

  const offset = range.startOffset;
  const nodeText = textNode.textContent || '';

  // Find cumulative position in the full text
  const fullTextContent = element.textContent || '';
  const targetPosition = fullTextContent.indexOf(nodeText) + offset;

  // Find which word the cursor is near
  let cumulativeLength = 0;
  let targetWordIndex = 0;

  for (let i = 0; i < words.length; i++) {
    cumulativeLength += words[i].length + 1; // +1 for space
    if (cumulativeLength >= targetPosition) {
      targetWordIndex = i;
      break;
    }
  }

  // Extract words around the target (N before, target, N after)
  const startIndex = Math.max(0, targetWordIndex - wordsPerSide);
  const endIndex = Math.min(words.length, targetWordIndex + wordsPerSide + 1);
  const selectedWords = words.slice(startIndex, endIndex);

  return selectedWords.join(' ');
}

/**
 * Extract characters nearest to the cursor position
 * @param {string} text - Full text content
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {HTMLElement} element - Element containing the text
 * @param {number} charsPerSide - Number of characters on each side of cursor (0 = single char under cursor)
 * @returns {string} Nearest characters
 */
function extractNearestChars(text, event, element, charsPerSide = 1) {
  if (!text) return '';

  // Try to find the position under cursor using Range API
  const range = document.caretRangeFromPoint(event.clientX, event.clientY);
  if (!range) {
    // Fallback: return first N characters
    if (charsPerSide === 0) return text.charAt(0);
    const totalChars = charsPerSide * 2 + 1;
    return text.substring(0, totalChars);
  }

  // Get approximate position in text
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    if (charsPerSide === 0) return text.charAt(0);
    const totalChars = charsPerSide * 2 + 1;
    return text.substring(0, totalChars);
  }

  const offset = range.startOffset;
  const nodeText = textNode.textContent || '';

  // Find cumulative position in the full text
  const fullTextContent = element.textContent || '';
  const targetPosition = fullTextContent.indexOf(nodeText) + offset;

  if (targetPosition < 0 || targetPosition >= text.length) {
    if (charsPerSide === 0) return text.charAt(0);
    const totalChars = charsPerSide * 2 + 1;
    return text.substring(0, totalChars);
  }

  // Extract characters around the target position
  if (charsPerSide === 0) {
    // Just the character under cursor
    return text.charAt(targetPosition) || text.charAt(0);
  }

  const startIndex = Math.max(0, targetPosition - charsPerSide);
  const endIndex = Math.min(text.length, targetPosition + charsPerSide + 1);

  return text.substring(startIndex, endIndex);
}

// ============ FIELD-SPECIFIC INTELLIGENT EXTRACTORS ============

/**
 * Extract pay amount (single number with optional currency)
 * Looks for patterns like: $75, $75.00, 75/hour, etc.
 * @param {HTMLElement} element - Element being hovered
 * @param {string} text - Text content
 * @returns {string|null} Extracted pay amount or null
 */
function extractPayAmount(element, text) {
  // Look for currency amounts: $XX, $XX.XX, XXk, XX/hour, etc.
  // Order matters: more specific patterns first
  const patterns = [
    /\$\s*\d+\s*k\b/i, // $70k (must come before dollar amounts to catch k notation)
    /\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*\/\s*(?:hour|hr|h)\b/i, // $75.00/hour
    /\$\s*\d+(?:,\d{3})*(?:\.\d+)?/i, // $75.00 or $75,000
    /\d+(?:,\d{3})*(?:\.\d+)?\s*(?:USD|dollars?)/i, // 75 USD
    /\d+\s*k\b/i, // 75k
    /\d+(?:\.\d+)?\s*\/\s*(?:hour|hr|h)\b/i // 75/hour
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Return the full matched text with context
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Extract compensation range (salary range with optional benefits)
 * Looks for patterns like: $65-$75/hour, $100k-$120k, etc.
 * @param {HTMLElement} element - Element being hovered
 * @param {string} text - Text content
 * @returns {string|null} Extracted compensation or null
 */
function extractCompensationRange(element, text) {
  // Look for salary ranges (must contain a dash/range indicator)
  // Order matters: more specific patterns first
  const rangePatterns = [
    /\$\s*\d+\s*k\s*[-–—]\s*\$?\s*\d+\s*k\s*(?:(?:\/|per)\s*(?:hour|hr|year|yr|annually))?/i, // $50k-$60k per year
    /\d+k\s*[-–—]\s*\d+k/i, // 100k-120k
    /\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*[-–—]\s*\$?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:(?:\/|per)\s*(?:hour|hr|year|yr|annually))?/i // $65-$75/hour
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // Fallback: try single pay amount
  return extractPayAmount(element, text);
}

/**
 * Extract location (city, state, or remote)
 * Looks for US state abbreviations, city names, or "Remote"
 * @param {HTMLElement} element - Element being hovered
 * @param {string} text - Text content
 * @returns {string|null} Extracted location or null
 */
function extractLocation(element, text) {
  // Check for special location keywords first (hard-coded as valid locations)
  // These take priority over other patterns to avoid misinterpretation
  // Priority order matters: more specific patterns first

  // Check for "Multiple Locations" and variations FIRST
  // (before Remote, as "Multiple Locations (Remote available)" should return "Multiple Locations")
  if (/\bmultiple\s+locations?\b/i.test(text)) {
    return 'Multiple Locations';
  }

  // Check for "Various Locations"
  if (/\bvarious\s+locations?\b/i.test(text)) {
    return 'Multiple Locations';
  }

  // Check for "Remote" (very common and distinctive)
  if (/\bremote\b/i.test(text)) {
    return 'Remote';
  }

  // Check for "Hybrid"
  if (/\bhybrid\b/i.test(text)) {
    return 'Hybrid';
  }

  // Check for "Nationwide"
  if (/\bnationwide\b/i.test(text)) {
    return 'Nationwide';
  }

  // Check for "On-site" or "Onsite"
  if (/\bon-?site\b/i.test(text)) {
    return 'On-site';
  }

  // Common state abbreviations (defensive - validates actual states)
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];

  // Try to match "City, STATE" format first (most complete)
  const cityStatePattern = /([A-Za-z][A-Za-z\s\.'-]+),\s*([A-Z]{2})\b/;
  const cityStateMatch = text.match(cityStatePattern);
  if (cityStateMatch && validStates.includes(cityStateMatch[2])) {
    return cityStateMatch[0].trim(); // Return "City, STATE"
  }

  // Try to match just state abbreviation
  const statePattern = /\b([A-Z]{2})\b/;
  const stateMatch = text.match(statePattern);
  if (stateMatch && validStates.includes(stateMatch[1])) {
    return stateMatch[1]; // Return just "STATE"
  }

  // Try to match "City, State Name" (full state name)
  const fullStateNames = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  for (const [stateName, abbrev] of Object.entries(fullStateNames)) {
    if (text.includes(stateName)) {
      // Try to extract city if present
      const cityFullStatePattern = new RegExp(`([A-Za-z][A-Za-z\\s\\.'-]+),\\s*${stateName}`, 'i');
      const cityFullStateMatch = text.match(cityFullStatePattern);
      if (cityFullStateMatch) {
        return `${cityFullStateMatch[1].trim()}, ${abbrev}`;
      }
      return abbrev; // Just return state abbreviation
    }
  }

  // Defensive fallback: if nothing matched, return null
  // The system will fall back to word extraction around mouse cursor
  return null;
}

/**
 * Extract job title (typically header text, bold, or prominently displayed)
 * Looks for h1-h3 headers or bold text near top of page
 * @param {HTMLElement} element - Element being hovered
 * @returns {string|null} Extracted job title or null
 */
function extractJobTitle(element) {
  // Guard against null/undefined element
  if (!element) return null;

  // Check for data attributes first (most reliable)
  const dataAttrs = ['data-job-title', 'data-title', 'data-position'];
  for (const attr of dataAttrs) {
    const value = element.getAttribute(attr);
    if (value && value.trim()) {
      return cleanText(value);
    }
  }

  // Check if element itself is a header
  if (['H1', 'H2', 'H3'].includes(element.tagName)) {
    const text = cleanText(element.textContent);
    const wordCount = text.split(/\s+/).length;
    // Headers should be reasonable length for a title
    if (wordCount >= 2 && wordCount <= 10) {
      return text;
    }
  }

  // Check semantic HTML structure (e.g., article > h1, main > h1)
  const semanticParent = element.closest('article, main, [role="main"]');
  if (semanticParent) {
    const headerInParent = semanticParent.querySelector('h1, h2, .job-title, [data-job-title]');
    if (headerInParent && headerInParent.textContent) {
      const text = cleanText(headerInParent.textContent);
      const wordCount = text.split(/\s+/).length;
      if (wordCount >= 2 && wordCount <= 10) {
        return text;
      }
    }
  }

  // Check if element is in top 25% of page (titles usually at top)
  const viewportHeight = window.innerHeight;
  const rect = element.getBoundingClientRect();
  const isNearTop = rect.top < viewportHeight * 0.25;

  // Check if element has bold/strong styling
  const style = window.getComputedStyle(element);
  const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
  const isLarge = parseInt(style.fontSize) >= 18;

  if (isBold && isLarge && isNearTop) {
    const text = cleanText(element.textContent);
    const wordCount = text.split(/\s+/).length;
    // Job titles are usually 2-8 words
    if (wordCount >= 2 && wordCount <= 8) {
      return text;
    }
  }

  // Look for nearby header with common class names
  const nearbyHeader = element.closest('header, [role="heading"], .job-title, .title, .position, .job-header');
  if (nearbyHeader) {
    const headerText = cleanText(nearbyHeader.textContent);
    const wordCount = headerText.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 8) {
      return headerText;
    }
  }

  return null;
}

/**
 * Extract company name (typically bold organization name)
 * Looks for bold text, links, or elements with company-related classes
 * @param {HTMLElement} element - Element being hovered
 * @returns {string|null} Extracted company name or null
 */
function extractCompanyName(element) {
  // Guard against null/undefined element
  if (!element) return null;

  const text = cleanText(element.textContent || '');

  // Return null if text is empty after cleaning
  if (!text) return null;

  // Filter out department names to prevent misinterpretation
  // Department names are not company names
  // Be careful: "Department Store Inc" is a valid company, but "Department of Engineering" is not
  const departmentPatterns = [
    /^department\s+(of|for|:|at)\b/i,    // "Department of/for/:/at..." but NOT "Department Store"
    /^(engineering|sales|marketing|hr|finance|it|operations|legal)\s+department/i,  // "Engineering Department"
    /\bdepartment\s*:\s*(?!store)/i,     // "Department:" label (not "Department: Store")
    /^dept\.?\s+(?!store)/i,             // "Dept." or "Dept" (not "Dept. Store")
    /\b(team|division|group|unit)\s*:/i  // "Team:", "Division:", etc.
  ];

  for (const pattern of departmentPatterns) {
    if (pattern.test(text)) {
      return null; // This is a department, not a company
    }
  }

  // Check for corporate suffixes (strong indicator of company name)
  // Must be at the end of the text to avoid false positives
  // Also filter out generic words like "a Company" or "the Corporation"
  const corporateSuffixes = /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|Co\.?|Company|LP|LLP|PC|PLC|GmbH|SA|AG)\.?$/i;
  if (corporateSuffixes.test(text)) {
    const wordCount = text.split(/\s+/).length;
    // Company names with suffixes are usually 2-6 words
    // Reject if it starts with articles or common sentence starters
    const startsWithArticle = /^(this|that|these|those|the|a|an)\s+/i.test(text);
    if (wordCount >= 1 && wordCount <= 6 && !startsWithArticle) {
      return text;
    }
  }

  // Check for all-caps company names (common in headers)
  const words = text.split(/\s+/);
  const allCapsWords = words.filter(w => w === w.toUpperCase() && w.length > 1 && /[A-Z]/.test(w));
  if (allCapsWords.length >= 1 && allCapsWords.length <= 4) {
    // If most/all words are caps, likely a company name
    if (allCapsWords.length / words.length > 0.5) {
      return allCapsWords.join(' ');
    }
  }

  // Check if element has company-related class or id
  const companyClasses = ['company', 'employer', 'organization', 'org-name', 'org', 'business'];
  const elementClasses = (element.className || '').toLowerCase();
  const elementId = (element.id || '').toLowerCase();

  for (const cls of companyClasses) {
    if ((elementClasses && elementClasses.includes(cls)) || (elementId && elementId.includes(cls))) {
      const wordCount = text.split(/\s+/).length;
      if (wordCount >= 1 && wordCount <= 5) {
        return text;
      }
    }
  }

  // Check if element is a link (companies often link to their pages)
  if (element.tagName === 'A') {
    const wordCount = text.split(/\s+/).length;
    // Company names are usually 1-5 words
    if (wordCount >= 1 && wordCount <= 5) {
      return text;
    }
  }

  // Check for bold styling
  const style = window.getComputedStyle(element);
  const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;

  if (isBold) {
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 1 && wordCount <= 5) {
      return text;
    }
  }

  return null;
}

/**
 * Extract large text block (for job description/notes)
 * Prefers the largest continuous text block near the cursor
 * @param {HTMLElement} element - Element being hovered
 * @returns {string|null} Extracted text block or null
 */
function extractLargeTextBlock(element) {
  // Guard against null/undefined element
  if (!element) return null;

  // Check if element is in a navigation, footer, or sidebar (skip these)
  const excludedTags = ['NAV', 'FOOTER', 'ASIDE', 'HEADER'];
  const excludedRoles = ['navigation', 'banner', 'contentinfo', 'complementary'];
  const excludedClasses = [
    'nav', 'navigation', 'footer', 'sidebar', 'side-bar', 'menu', 'header-',
    'related-jobs', 'similar-jobs', 'job-list', 'job-card',
    'company-info', 'company-about', 'about-company',
    'apply-button', 'apply-now', 'application-form',
    'breadcrumb', 'pagination',
    'advertisement', 'ad-', 'promo'
  ];

  // Check for sidebar-specific content patterns in text
  const text = cleanText(element.textContent || '');
  const sidebarContentPatterns = [
    /^about\s+(this\s+)?company/i,       // "About this company" / "About the company"
    /^how\s+to\s+apply/i,                 // "How to apply"
    /^apply\s+now/i,                      // "Apply now"
    /^related\s+jobs?/i,                  // "Related jobs"
    /^similar\s+(jobs?|positions?)/i,    // "Similar jobs" / "Similar positions"
    /^recommended\s+jobs?/i,              // "Recommended jobs"
    /^you\s+might\s+also\s+like/i,       // "You might also like"
    /^other\s+jobs?\s+(at|from)/i,       // "Other jobs at..." / "Other jobs from..."
    /^share\s+this\s+job/i,              // "Share this job"
    /^save\s+this\s+job/i,               // "Save this job"
    /^report\s+this\s+job/i,             // "Report this job"
    /^company\s+overview/i,               // "Company overview"
    /^company\s+culture/i,                // "Company culture"
    /^company\s+benefits/i,               // "Company benefits"
    /^why\s+work\s+(here|at)/i           // "Why work here" / "Why work at..."
  ];

  for (const pattern of sidebarContentPatterns) {
    if (pattern.test(text)) {
      return null; // This is sidebar content, not job description
    }
  }

  let current = element;
  while (current) {
    // Check tag name
    if (excludedTags.includes(current.tagName)) {
      return null; // Don't extract from these areas
    }

    // Check ARIA role
    const role = current.getAttribute('role');
    if (role && excludedRoles.includes(role)) {
      return null;
    }

    // Check class names
    const className = (current.className || '').toLowerCase();
    if (excludedClasses.some(cls => className.includes(cls))) {
      return null;
    }

    // Check for data attributes that indicate sidebar/auxiliary content
    const dataType = current.getAttribute('data-type');
    const dataSection = current.getAttribute('data-section');
    if (dataType === 'sidebar' || dataType === 'related' ||
        dataSection === 'sidebar' || dataSection === 'recommended') {
      return null;
    }

    current = current.parentElement;
  }

  // Look for semantic main content areas first
  const mainContent = element.closest('main, article, [role="main"], .job-description, .description, .content, .main-content');
  if (mainContent) {
    const text = cleanText(mainContent.textContent);
    // Prefer main content if it's a reasonable size
    if (text.length >= 100 && text.length <= 5000) {
      return text;
    }
  }

  // Look for paragraph containers
  const paragraphParent = element.closest('div.description, div.job-description, section, .text-content');
  if (paragraphParent) {
    const text = cleanText(paragraphParent.textContent);
    if (text.length >= 50 && text.length <= 5000) {
      return text;
    }
  }

  // Walk up the DOM tree to find the largest reasonable text block
  let targetElement = element;
  let maxLength = cleanText(element.textContent).length;
  current = element.parentElement;
  let depth = 0;
  const MAX_DEPTH = 5;

  while (current && depth < MAX_DEPTH) {
    const text = cleanText(current.textContent);

    // Don't select the entire page
    if (text.length > 5000) {
      break;
    }

    // Skip elements that are likely containers
    if (current.tagName === 'BODY' || current.tagName === 'HTML') {
      break;
    }

    // Prefer larger blocks - use 1.05x threshold to catch sibling paragraphs
    // This allows extraction of multi-element descriptions where paragraphs
    // might be very different sizes (e.g., long intro + short addendum)
    if (text.length > maxLength * 1.05) {
      targetElement = current;
      maxLength = text.length;
    }

    current = current.parentElement;
    depth++;
  }

  const finalText = cleanText(targetElement.textContent);

  // Only return if it's a substantial block
  if (finalText.length >= 50 && finalText.length <= 5000) {
    return finalText;
  }

  return null;
}

/**
 * Highlight an element with visual feedback
 * @param {HTMLElement} element - Element to highlight
 */
function highlightElement(element) {
  if (lastHighlightedElement === element) return;

  // Remove previous highlight
  removeHighlight();

  // Add highlight to new element
  element.style.outline = '3px solid #FF6B6B';
  element.style.outlineOffset = '2px';
  element.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';

  lastHighlightedElement = element;
}

/**
 * Remove highlight from currently highlighted element
 */
function removeHighlight() {
  if (lastHighlightedElement) {
    lastHighlightedElement.style.outline = '';
    lastHighlightedElement.style.outlineOffset = '';
    lastHighlightedElement.style.backgroundColor = '';
    lastHighlightedElement = null;
  }
}

/**
 * Create visual overlay to indicate tracking mode is active
 */
function createTrackingOverlay() {
  removeTrackingOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'jobsprint-tracking-overlay';

  // Build position CSS based on stored position
  let positionCSS = '';
  if (overlayPosition.top !== null) {
    positionCSS += `top: ${overlayPosition.top}px;`;
  }
  if (overlayPosition.bottom !== null) {
    positionCSS += `bottom: ${overlayPosition.bottom}px;`;
  }
  if (overlayPosition.right !== null) {
    positionCSS += `right: ${overlayPosition.right}px;`;
  }
  if (overlayPosition.left !== null) {
    positionCSS += `left: ${overlayPosition.left}px;`;
  }

  overlay.style.cssText = `
    position: fixed;
    ${positionCSS}
    background: rgba(255, 107, 107, 0.95);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 999998;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    animation: slideInFromRight 0.3s ease-out;
  `;

  overlay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 18px;">🎯</span>
      <span id="jobsprint-tracking-title">Hover over text to auto-fill</span>
    </div>
    <div id="jobsprint-tracking-mode" style="font-size: 11px; margin-top: 4px; opacity: 0.9;">
      ✂️ Word mode (3 words) • ↑↓ to adjust
    </div>
    <div style="font-size: 11px; margin-top: 4px; opacity: 0.9;">
      Shift=Sentences • Ctrl=Chars • Alt+Arrows=Move • ESC=Cancel
    </div>
  `;

  // Add animation
  if (!document.getElementById('jobsprint-tracking-styles')) {
    const style = document.createElement('style');
    style.id = 'jobsprint-tracking-styles';
    style.textContent = `
      @keyframes slideInFromRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes pulseGlow {
        0%, 100% {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        50% {
          box-shadow: 0 4px 20px rgba(255, 107, 107, 0.6);
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
  mouseTrackingOverlay = overlay;
}

/**
 * Update overlay position based on stored position state
 */
function updateOverlayPosition() {
  if (!mouseTrackingOverlay) return;

  // Clear all position properties first
  mouseTrackingOverlay.style.top = '';
  mouseTrackingOverlay.style.bottom = '';
  mouseTrackingOverlay.style.left = '';
  mouseTrackingOverlay.style.right = '';

  // Apply stored position
  if (overlayPosition.top !== null) {
    mouseTrackingOverlay.style.top = `${overlayPosition.top}px`;
  }
  if (overlayPosition.bottom !== null) {
    mouseTrackingOverlay.style.bottom = `${overlayPosition.bottom}px`;
  }
  if (overlayPosition.left !== null) {
    mouseTrackingOverlay.style.left = `${overlayPosition.left}px`;
  }
  if (overlayPosition.right !== null) {
    mouseTrackingOverlay.style.right = `${overlayPosition.right}px`;
  }
}

/**
 * Update overlay to show current extraction mode and granularity
 * @param {string} mode - Current mode: 'words', 'sentence', or 'chars'
 */
function updateOverlayMode(mode) {
  if (!mouseTrackingOverlay) return;

  const modeElement = mouseTrackingOverlay.querySelector('#jobsprint-tracking-mode');
  if (!modeElement) return;

  let modeText = '';
  let bgColor = 'rgba(255, 107, 107, 0.95)';

  switch (mode) {
    case 'sentence':
      const sentCount = currentGranularity.sentences;
      modeText = `📝 Sentence mode (${sentCount} sentence${sentCount > 1 ? 's' : ''}) • Shift+↑↓ to adjust`;
      bgColor = 'rgba(52, 152, 219, 0.95)'; // Blue for sentence
      break;
    case 'chars':
      const charCount = currentGranularity.chars;
      if (charCount === 0) {
        modeText = '🔍 Character mode (single char) • Ctrl+↑ to expand';
      } else {
        const totalChars = charCount * 2 + 1;
        modeText = `🔍 Character mode (${totalChars} chars) • Ctrl+↑↓ to adjust`;
      }
      bgColor = 'rgba(155, 89, 182, 0.95)'; // Purple for chars
      break;
    case 'words':
      const wordCount = currentGranularity.words;
      const totalWords = wordCount * 2 + 1;
      modeText = `✂️ Word mode (${totalWords} words) • ↑↓ to adjust`;
      bgColor = 'rgba(46, 204, 113, 0.95)'; // Green for words
      break;
    default:
      modeText = 'Hover over text • Shift=Sentences, Ctrl=Chars';
      bgColor = 'rgba(255, 107, 107, 0.95)'; // Red for default
  }

  modeElement.textContent = modeText;
  mouseTrackingOverlay.style.background = bgColor;

  // Add pulse animation when mode or granularity changes
  mouseTrackingOverlay.style.animation = 'slideInFromRight 0.3s ease-out, pulseGlow 0.5s ease-in-out';
}

/**
 * Remove tracking overlay
 */
function removeTrackingOverlay() {
  if (mouseTrackingOverlay) {
    mouseTrackingOverlay.remove();
    mouseTrackingOverlay = null;
  }
}

/**
 * Send extracted text to popup window
 * @param {string} text - Text to send
 * @param {boolean} confirm - Whether this is a confirmed selection (clicked)
 */
function sendTextToPopup(text, confirm = false) {
  chrome.runtime.sendMessage({
    action: 'mouseHoverText',
    fieldId: currentTrackedFieldId,
    text: text,
    confirmed: confirm
  });
}
