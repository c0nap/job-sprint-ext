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
      console.log('[ContentScript] Received startMouseTracking for field:', message.fieldId, 'with mode:', message.mode);
      startMouseTracking(message.fieldId, message.mode);
      sendResponse({ success: true });
      return false; // Synchronous response

    case 'stopMouseTracking':
      // Stop interactive mouse tracking
      console.log('[ContentScript] Received stopMouseTracking');
      stopMouseTracking();
      sendResponse({ success: true });
      return false; // Synchronous response

    case 'relayKeyboardEvent':
      // Handle keyboard event relayed from popup
      console.log('[ContentScript] Received relayed keyboard event:', message.event);
      handleRelayedKeyboardEvent(message.event);
      sendResponse({ success: true });
      return false; // Synchronous response

    case 'changeExtractionMode':
      // Manually change extraction mode from popup buttons
      console.log('[ContentScript] Received mode change request:', message.mode);
      handleManualModeChange(message.mode);
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
let currentModifierMode = 'smart'; // 'smart', 'words', 'chars'
let currentGranularity = {
  words: { left: 0, right: 0 },  // Number of words on each side (default: just target word = 1 total)
  chars: { left: 1, right: 1 }   // Number of characters on each side (default: 1 char left + 1 char right + target = 3 total)
};
let smartModeStrength = 2; // Aggressiveness level for smart mode (1-5, default: 2)
let lastHighlightedText = null; // Track the highlighted text range
let lastMouseEvent = null; // Store last mouse event for re-extraction
let overlayPosition = {
  top: 10,    // pixels from top
  right: 10,  // pixels from right
  bottom: null,  // pixels from bottom (alternative to top)
  left: null     // pixels from left (alternative to right)
};

// Mouse tracking settings (loaded from chrome.storage)
let mouseTrackingSettings = {
  smartModifier: 'none',
  charModifier: 'ctrl',
  wordModifier: 'shift',
  overlayMoveModifier: 'alt',
  overlayMoveStep: 20
};

// Mode colors (loaded from chrome.storage)
let modeColors = {
  words: { solid: '#2ecc71', transparent: 'rgba(46, 204, 113, 0.1)', bg: 'rgba(46, 204, 113, 0.95)' },
  smart: { solid: '#3498db', transparent: 'rgba(52, 152, 219, 0.1)', bg: 'rgba(52, 152, 219, 0.95)' },
  chars: { solid: '#9b59b6', transparent: 'rgba(155, 89, 182, 0.1)', bg: 'rgba(155, 89, 182, 0.95)' }
};

/**
 * Load mouse tracking settings and colors from chrome.storage
 * @returns {Promise<void>}
 */
async function loadMouseTrackingSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'SENTENCE_MODIFIER',
      'CHAR_MODIFIER',
      'WORD_MODIFIER',
      'OVERLAY_MOVE_MODIFIER',
      'OVERLAY_MOVE_STEP',
      'SMART_MODE_STRENGTH',
      'WORD_MODE_COLOR',
      'SENTENCE_MODE_COLOR',
      'CHAR_MODE_COLOR'
    ]);

    mouseTrackingSettings = {
      smartModifier: result.SENTENCE_MODIFIER || 'none',
      charModifier: result.CHAR_MODIFIER || 'ctrl',
      wordModifier: result.WORD_MODIFIER || 'shift',
      overlayMoveModifier: result.OVERLAY_MOVE_MODIFIER || 'alt',
      overlayMoveStep: result.OVERLAY_MOVE_STEP || 20
    };

    smartModeStrength = result.SMART_MODE_STRENGTH || 2;

    // Load and convert colors
    const wordColor = result.WORD_MODE_COLOR || '#2ecc71';
    const smartColor = result.SENTENCE_MODE_COLOR || '#3498db';
    const charColor = result.CHAR_MODE_COLOR || '#9b59b6';

    modeColors = {
      words: {
        solid: wordColor,
        transparent: hexToRgba(wordColor, 0.1),
        bg: hexToRgba(wordColor, 0.95)
      },
      smart: {
        solid: smartColor,
        transparent: hexToRgba(smartColor, 0.1),
        bg: hexToRgba(smartColor, 0.95)
      },
      chars: {
        solid: charColor,
        transparent: hexToRgba(charColor, 0.1),
        bg: hexToRgba(charColor, 0.95)
      }
    };

    console.log('[MouseTracking] Settings loaded:', mouseTrackingSettings, 'Smart mode strength:', smartModeStrength);
    console.log('[MouseTracking] Colors loaded:', modeColors);
  } catch (error) {
    console.error('[MouseTracking] Error loading settings:', error);
    // Use defaults on error
  }
}

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color (e.g., '#3498db')
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, alpha) {
  // Remove the hash if present
  hex = hex.replace('#', '');

  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Start interactive mouse tracking for field auto-fill
 * When user hovers over text elements, their content is extracted and sent to the extension
 * @param {string} fieldId - ID of the field being filled
 * @param {string} mode - Initial mode to use ('words', 'smart', 'chars')
 */
async function startMouseTracking(fieldId, mode = 'smart') {
  console.log('[MouseTracking] Starting mouse tracking for field:', fieldId, 'with mode:', mode);

  // Load settings before starting
  await loadMouseTrackingSettings();
  console.log('[MouseTracking] Settings loaded, starting tracking...');

  // Stop any existing tracking
  stopMouseTracking();

  mouseTrackingActive = true;
  currentTrackedFieldId = fieldId;
  console.log('[MouseTracking] Tracking state set to active');

  // Set the initial mode (persisted from popup)
  currentModifierMode = mode;
  console.log('[MouseTracking] Tracking state set to active with mode:', mode);

  // Create visual overlay to indicate tracking mode
  createTrackingOverlay();
  updateOverlayMode(mode); // Update overlay to show correct mode color
  console.log('[MouseTracking] Overlay created with mode:', mode);

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleMouseClick, true);
  document.addEventListener('keydown', handleEscapeKey, true);
  console.log('[MouseTracking] Event listeners added');

  // Change cursor to indicate tracking mode
  document.body.style.cursor = 'crosshair';
  console.log('[MouseTracking] Mouse tracking fully initialized');
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
 * Handle keyboard event relayed from popup
 * Creates a synthetic event object and processes it like a native keyboard event
 * @param {Object} eventData - Keyboard event data from popup
 */
function handleRelayedKeyboardEvent(eventData) {
  if (!mouseTrackingActive) return;

  console.log('[RelayedKeyEvent] Processing:', eventData.key, 'type:', eventData.type, 'with modifiers:', {
    shift: eventData.shiftKey,
    ctrl: eventData.ctrlKey,
    alt: eventData.altKey
  });

  // Create a synthetic event object that matches the KeyboardEvent interface
  const syntheticEvent = {
    key: eventData.key,
    code: eventData.code,
    shiftKey: eventData.shiftKey,
    ctrlKey: eventData.ctrlKey,
    altKey: eventData.altKey,
    metaKey: eventData.metaKey,
    type: eventData.type || 'keydown',
    preventDefault: () => {}, // No-op since it's already handled in popup
    stopPropagation: () => {}
  };

  // Handle modifier key press for persistent mode switching
  // Only switch modes on keydown (not keyup) to make modes sticky
  const isModifierKey = ['Shift', 'Control', 'Alt', 'Meta'].includes(eventData.key);

  if (isModifierKey && eventData.type === 'keydown') {
    // Map modifier key to mode based on configured settings
    let newMode = null;
    if (eventData.key === 'Shift') {
      // Check if Shift is configured for any mode
      if (mouseTrackingSettings.smartModifier === 'shift') newMode = 'smart';
      else if (mouseTrackingSettings.wordModifier === 'shift') newMode = 'words';
      else if (mouseTrackingSettings.charModifier === 'shift') newMode = 'chars';
    } else if (eventData.key === 'Control' || eventData.key === 'Meta') {
      // Check if Ctrl is configured for any mode
      if (mouseTrackingSettings.smartModifier === 'ctrl') newMode = 'smart';
      else if (mouseTrackingSettings.wordModifier === 'ctrl') newMode = 'words';
      else if (mouseTrackingSettings.charModifier === 'ctrl') newMode = 'chars';
    } else if (eventData.key === 'Alt') {
      // Check if Alt is configured for any mode (not overlay move)
      if (mouseTrackingSettings.smartModifier === 'alt') newMode = 'smart';
      else if (mouseTrackingSettings.wordModifier === 'alt') newMode = 'words';
      else if (mouseTrackingSettings.charModifier === 'alt') newMode = 'chars';
    }

    // Switch mode persistently (it stays until changed again)
    if (newMode && newMode !== currentModifierMode) {
      currentModifierMode = newMode;
      updateOverlayMode(newMode);
      console.log('[RelayedKeyEvent] Mode switched to:', newMode, 'due to modifier', eventData.key);

      // Notify popup about mode change so button states can update
      notifyPopupModeChange(newMode);

      // Re-extract text and update highlight with new mode if we have a last mouse position
      if (lastMouseEvent && lastHighlightedElement) {
        const element = lastHighlightedElement;

        // Re-extract text with new mode
        const text = extractTextFromElement(element, lastMouseEvent, newMode);

        // Remove and re-add highlight to update color and text
        removeHighlight();
        if (text && text.trim()) {
          highlightElement(element, text.trim(), lastMouseEvent);
          sendTextToPopup(text.trim());
        } else {
          highlightElement(element, null, lastMouseEvent);
        }
      }
    }
    return; // Don't process modifier keys further
  }

  // Ignore keyup events for modifiers - mode should persist
  if (isModifierKey && eventData.type === 'keyup') {
    return;
  }

  // For non-modifier keys, process through the existing keyboard handler
  handleEscapeKey(syntheticEvent);
}

/**
 * Handle manual mode change from popup button click
 * @param {string} mode - Mode to switch to: 'words', 'smart', 'chars'
 */
function handleManualModeChange(mode) {
  if (!mouseTrackingActive) return;

  console.log('[ManualModeChange] Switching to mode:', mode);

  // Update current mode
  currentModifierMode = mode;
  updateOverlayMode(mode);

  // Re-extract text and update highlight with new mode if we have a last mouse position
  if (lastMouseEvent && lastHighlightedElement) {
    const element = lastHighlightedElement;

    // Re-extract text with new mode
    const text = extractTextFromElement(element, lastMouseEvent, mode);

    // Remove and re-add highlight to update color and text
    removeHighlight();
    if (text && text.trim()) {
      highlightElement(element, text.trim(), lastMouseEvent);
      sendTextToPopup(text.trim());
    } else {
      highlightElement(element, null, lastMouseEvent);
    }
  }
}

/**
 * Handle mouse move events during tracking
 * @param {MouseEvent} event - Mouse event
 */
function handleMouseMove(event) {
  if (!mouseTrackingActive) return;

  // Store last mouse event for re-extraction when granularity changes
  lastMouseEvent = event;

  // Check if user is pressing modifier keys to override the current mode
  const modifierMode = getExtractionModeFromModifiers(event);
  if (modifierMode && modifierMode !== currentModifierMode) {
    currentModifierMode = modifierMode;
    updateOverlayMode(currentModifierMode);
  }

  // Use the current mode (either from button or modifier key)
  const mode = currentModifierMode;

  // Get element under cursor
  let element = document.elementFromPoint(event.clientX, event.clientY);

  if (!element || element === mouseTrackingOverlay) return;

  // If we hit a highlight mark, get the actual element
  if (element.classList && element.classList.contains('jobsprint-text-highlight')) {
    element = element.closest(':not(.jobsprint-text-highlight)') || element.parentElement;
  }

  // Extract text from element with appropriate scope
  const text = extractTextFromElement(element, event, mode);

  if (text && text.trim()) {
    // Highlight the element and the extracted text
    highlightElement(element, text.trim(), event);

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

  // Get current extraction mode (use button mode unless modifier is pressed)
  const mode = getExtractionModeFromModifiers(event) || currentModifierMode;

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
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    handleGranularityChange(event);
  }
}

/**
 * Handle arrow key presses to adjust extraction granularity or smart mode strength
 * Supports directional control for words and chars modes:
 * - ArrowUp: Extend both sides (increase left and right)
 * - ArrowDown: Reduce both sides (decrease left and right)
 * - ArrowLeft: Extend left only (increase left, keep right)
 * - ArrowRight: Extend right only (keep left, increase right)
 * For smart mode:
 * - ArrowUp/ArrowRight: Increase aggressiveness level
 * - ArrowDown/ArrowLeft: Decrease aggressiveness level
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleGranularityChange(event) {
  const mode = currentModifierMode; // Use current button mode

  // Determine what to adjust based on arrow key direction
  const isVertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
  const isHorizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
  const increment = (event.key === 'ArrowUp' || event.key === 'ArrowRight') ? 1 : -1;

  // Update granularity based on current mode and direction
  if (mode === 'smart') {
    // Smart mode: adjust aggressiveness level (1-5)
    smartModeStrength = Math.max(1, Math.min(5, smartModeStrength + increment));
  } else if (mode === 'chars') {
    // Character mode: adjust character granularity
    if (isVertical) {
      // Up/Down: adjust both sides symmetrically
      currentGranularity.chars.left = Math.max(0, currentGranularity.chars.left + increment);
      currentGranularity.chars.right = Math.max(0, currentGranularity.chars.right + increment);
    } else if (event.key === 'ArrowLeft') {
      // Left: extend left side only
      currentGranularity.chars.left = Math.max(0, currentGranularity.chars.left + 1);
    } else if (event.key === 'ArrowRight') {
      // Right: extend right side only
      currentGranularity.chars.right = Math.max(0, currentGranularity.chars.right + 1);
    }
  } else {
    // Word mode: adjust word granularity
    if (isVertical) {
      // Up/Down: adjust both sides symmetrically
      currentGranularity.words.left = Math.max(0, currentGranularity.words.left + increment);
      currentGranularity.words.right = Math.max(0, currentGranularity.words.right + increment);
    } else if (event.key === 'ArrowLeft') {
      // Left: extend left side only
      currentGranularity.words.left = Math.max(0, currentGranularity.words.left + 1);
    } else if (event.key === 'ArrowRight') {
      // Right: extend right side only
      currentGranularity.words.right = Math.max(0, currentGranularity.words.right + 1);
    }
  }

  console.log('[GranularityChange] New granularity:', mode, JSON.stringify(currentGranularity), 'Smart strength:', smartModeStrength);

  // Update overlay to show current granularity/strength
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

  console.log('[Overlay] Repositioning with', event.key, '- Current position:', {...overlayPosition});

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

  console.log('[Overlay] New position:', {...overlayPosition});

  // Update overlay position
  updateOverlayPosition();

  // Add visual feedback with pulse animation
  if (mouseTrackingOverlay) {
    mouseTrackingOverlay.style.animation = 'none';
    // Force reflow to restart animation
    void mouseTrackingOverlay.offsetHeight;
    mouseTrackingOverlay.style.animation = 'pulseGlow 0.3s ease-out';
  }
}

/**
 * Get extraction mode based on modifier keys (for temporary override)
 * Only returns a mode if an actual modifier key is pressed (not 'none')
 * @param {MouseEvent|KeyboardEvent} event - Event with modifier key info
 * @returns {string|null} Extraction mode if modifier is pressed, null otherwise
 */
function getExtractionModeFromModifiers(event) {
  // Check each configured modifier and return corresponding mode if pressed
  // Skip 'none' modifiers as they shouldn't override the button-selected mode

  // Check for smart modifier (only if it's not 'none')
  if (mouseTrackingSettings.smartModifier !== 'none' &&
      checkModifierKey(event, mouseTrackingSettings.smartModifier)) {
    return 'smart';
  }

  // Check for char modifier (only if it's not 'none')
  if (mouseTrackingSettings.charModifier !== 'none' &&
      checkModifierKey(event, mouseTrackingSettings.charModifier)) {
    return 'chars';
  }

  // Check for word modifier (only if it's not 'none')
  if (mouseTrackingSettings.wordModifier !== 'none' &&
      checkModifierKey(event, mouseTrackingSettings.wordModifier)) {
    return 'words';
  }

  // No actual modifier key pressed - return null to use current button mode
  return null;
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
 * @param {string} mode - Extraction mode: 'chars', 'words', or 'smart'
 * @returns {string} Extracted text
 */
function extractTextFromElement(element, event, mode = 'words') {
  if (!element) return '';

  // For input elements, get the value
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return element.value;
  }

  // Get the full text content, ignoring our highlight marks
  let fullText = '';

  // Clone the element to get clean text without modifying the original
  const clone = element.cloneNode(true);

  // Remove all our highlight marks from the clone
  const marks = clone.querySelectorAll('mark.jobsprint-text-highlight');
  marks.forEach(mark => {
    const text = document.createTextNode(mark.textContent);
    mark.parentNode.replaceChild(text, mark);
  });

  // Get text from the cleaned clone
  fullText = clone.textContent || '';
  fullText = cleanText(fullText);

  // Apply scope based on mode and granularity
  if (mode === 'smart') {
    // Smart mode: aggressive field-aware extraction with configurable strength
    return extractSmartMode(element, event, fullText);
  } else if (mode === 'words') {
    // Word mode: basic nearest words extraction
    return extractNearestWords(fullText, event, element, currentGranularity.words.left, currentGranularity.words.right);
  } else if (mode === 'chars') {
    return extractNearestChars(fullText, event, element, currentGranularity.chars.left, currentGranularity.chars.right);
  }

  return fullText;
}

/**
 * Smart mode extraction with configurable aggressiveness
 * Aggressively searches for patterns based on field type and strength setting
 * Reuses existing field-specific extraction functions with expanded search scope
 * @param {HTMLElement} element - Element being hovered over
 * @param {MouseEvent} event - Mouse event
 * @param {string} fullText - Full text of element
 * @returns {string} Extracted text
 */
function extractSmartMode(element, event, fullText) {
  const fieldId = currentTrackedFieldId;

  // Try extraction with increasing scope based on strength level
  let result = null;

  // Level 1: Just the hovered element (same as field-aware mode)
  if (fieldId === 'manualPay') {
    result = extractPayAmount(element, fullText);
  } else if (fieldId === 'manualCompensation') {
    result = extractCompensationRange(element, fullText);
  } else if (fieldId === 'manualLocation') {
    result = extractLocation(element, fullText);
  } else if (fieldId === 'manualJobTitle') {
    result = extractJobTitle(element);
  } else if (fieldId === 'manualCompany') {
    result = extractCompanyName(element);
  } else if (fieldId === 'manualNotes') {
    result = extractLargeTextBlock(element) || fullText;
  }

  // If found at level 1, return it
  if (result) return result;

  // Level 2+: Search parent elements based on strength
  if (smartModeStrength >= 2) {
    result = searchNearbyElements(element, fieldId);
    if (result) return result;
  }

  // Fallback to basic field-aware extraction
  return extractFieldAware(element, event, fullText, currentGranularity.words.left, currentGranularity.words.right);
}

/**
 * Search nearby elements (parent, siblings) using field-specific extractors
 * Reuses existing extraction functions for consistency
 * @param {HTMLElement} element - Starting element
 * @param {string} fieldId - Field being filled
 * @returns {string|null} Extracted value or null
 */
function searchNearbyElements(element, fieldId) {
  const elementsToSearch = [];

  // Add parent element (strength >= 2)
  if (smartModeStrength >= 2 && element.parentElement) {
    elementsToSearch.push(element.parentElement);
  }

  // Add siblings (strength >= 4)
  if (smartModeStrength >= 4 && element.parentElement) {
    const siblings = Array.from(element.parentElement.children);
    elementsToSearch.push(...siblings.filter(s => s !== element));
  }

  // Add grandparent (strength >= 5 - maximum)
  if (smartModeStrength >= 5 && element.parentElement?.parentElement) {
    elementsToSearch.push(element.parentElement.parentElement);
  }

  // Try extraction on each element in scope
  for (const el of elementsToSearch) {
    const text = cleanText(el.textContent || '');
    let result = null;

    // Apply field-specific extractor
    if (fieldId === 'manualPay') {
      result = extractPayAmount(el, text);
    } else if (fieldId === 'manualCompensation') {
      result = extractCompensationRange(el, text);
    } else if (fieldId === 'manualLocation') {
      result = extractLocation(el, text);
    } else if (fieldId === 'manualJobTitle') {
      result = extractJobTitle(el);
    } else if (fieldId === 'manualCompany') {
      result = extractCompanyName(el);
    } else if (fieldId === 'manualNotes') {
      result = extractLargeTextBlock(el);
    }

    if (result) return result;
  }

  return null;
}

/**
 * Field-aware intelligent extraction (less aggressive than smart mode)
 * Uses context from the focused field to intelligently extract relevant data
 * @param {HTMLElement} element - Element being hovered over
 * @param {MouseEvent} event - Mouse event
 * @param {string} fullText - Full text of element
 * @param {number} wordsLeft - Number of words to extract on the left side
 * @param {number} wordsRight - Number of words to extract on the right side
 * @returns {string} Extracted text
 */
function extractFieldAware(element, event, fullText, wordsLeft, wordsRight) {
  // Determine which field is being filled based on currentTrackedFieldId
  const fieldId = currentTrackedFieldId;

  // Use field-specific extraction logic
  if (fieldId === 'manualPay') {
    return extractPayAmount(element, fullText) || extractNearestWords(fullText, event, element, wordsLeft, wordsRight);
  } else if (fieldId === 'manualCompensation') {
    return extractCompensationRange(element, fullText) || extractNearestWords(fullText, event, element, wordsLeft, wordsRight);
  } else if (fieldId === 'manualLocation') {
    return extractLocation(element, fullText) || extractNearestWords(fullText, event, element, wordsLeft, wordsRight);
  } else if (fieldId === 'manualJobTitle') {
    return extractJobTitle(element) || extractNearestWords(fullText, event, element, wordsLeft, wordsRight);
  } else if (fieldId === 'manualCompany') {
    return extractCompanyName(element) || extractNearestWords(fullText, event, element, wordsLeft, wordsRight);
  } else if (fieldId === 'manualNotes') {
    return extractLargeTextBlock(element) || fullText;
  }

  // Default: use standard word extraction
  return extractNearestWords(fullText, event, element, wordsLeft, wordsRight);
}

/**
 * Extract words nearest to the cursor position
 * @param {string} text - Full text content
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {HTMLElement} element - Element containing the text
 * @param {number} wordsPerSide - Number of words on each side of cursor
 * @returns {string} Nearest words
 */
function extractNearestWords(text, event, element, wordsLeft = 1, wordsRight = 1) {
  if (!text) return '';

  // Split text into words by whitespace, slashes, and em/en-dashes
  // Note: Regular hyphens (-) are preserved to keep hyphenated words like "water-soaked" intact
  const words = text.split(/[\s\/—–]+/).filter(w => w.trim());

  if (words.length === 0) return '';
  if (words.length === 1) return words[0];

  // Try to find the word under cursor using Range API
  const range = document.caretRangeFromPoint(event.clientX, event.clientY);
  if (!range) {
    // Fallback: return first N words
    const totalWords = wordsLeft + wordsRight + 1;
    return words.slice(0, totalWords).join(' ');
  }

  // Get approximate position in text
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    const totalWords = wordsLeft + wordsRight + 1;
    return words.slice(0, totalWords).join(' ');
  }

  const offset = range.startOffset;

  // Calculate the actual position by walking through all text nodes before the cursor
  let targetPosition = 0;
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentNode;
  while (currentNode = walker.nextNode()) {
    if (currentNode === textNode) {
      targetPosition += offset;
      break;
    }
    targetPosition += currentNode.textContent.length;
  }

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

  // Extract words around the target (wordsLeft before, target, wordsRight after)
  const startIndex = Math.max(0, targetWordIndex - wordsLeft);
  const endIndex = Math.min(words.length, targetWordIndex + wordsRight + 1);
  const selectedWords = words.slice(startIndex, endIndex);

  return selectedWords.join(' ');
}

/**
 * Extract characters nearest to the cursor position
 * @param {string} text - Full text content
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {HTMLElement} element - Element containing the text
 * @param {number} charsLeft - Number of characters on the left side (0 = single char under cursor)
 * @param {number} charsRight - Number of characters on the right side (0 = single char under cursor)
 * @returns {string} Nearest characters
 */
function extractNearestChars(text, event, element, charsLeft = 1, charsRight = 1) {
  if (!text) return '';

  // Try to find the position under cursor using Range API
  const range = document.caretRangeFromPoint(event.clientX, event.clientY);
  if (!range) {
    // Fallback: return first N characters
    if (charsLeft === 0 && charsRight === 0) return text.charAt(0);
    const totalChars = charsLeft + charsRight + 1;
    return text.substring(0, totalChars);
  }

  // Get approximate position in text
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    if (charsLeft === 0 && charsRight === 0) return text.charAt(0);
    const totalChars = charsLeft + charsRight + 1;
    return text.substring(0, totalChars);
  }

  const offset = range.startOffset;

  // Calculate the actual position by walking through all text nodes before the cursor
  let targetPosition = 0;
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentNode;
  while (currentNode = walker.nextNode()) {
    if (currentNode === textNode) {
      targetPosition += offset;
      break;
    }
    targetPosition += currentNode.textContent.length;
  }

  if (targetPosition < 0 || targetPosition >= text.length) {
    if (charsLeft === 0 && charsRight === 0) return text.charAt(0);
    const totalChars = charsLeft + charsRight + 1;
    return text.substring(0, totalChars);
  }

  // Extract characters around the target position
  if (charsLeft === 0 && charsRight === 0) {
    // Just the character under cursor
    return text.charAt(targetPosition) || text.charAt(0);
  }

  const startIndex = Math.max(0, targetPosition - charsLeft);
  const endIndex = Math.min(text.length, targetPosition + charsRight + 1);

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
 * Highlight an element and the extracted text with visual feedback
 * @param {HTMLElement} element - Element to highlight
 * @param {string} extractedText - The extracted text to highlight within the element
 * @param {MouseEvent} mouseEvent - Mouse event for cursor position
 */
function highlightElement(element, extractedText = null, mouseEvent = null) {
  if (lastHighlightedElement === element && lastHighlightedText === extractedText) return;

  // Remove previous highlight
  removeHighlight();

  // Get color based on current mode
  const colors = getModeColors(currentModifierMode);

  // Add highlight to new element (element-level outline)
  element.style.outline = `3px solid ${colors.solid}`;
  element.style.outlineOffset = '2px';
  element.style.backgroundColor = colors.transparent;

  lastHighlightedElement = element;
  lastHighlightedText = extractedText;

  // Add text-level highlighting only for the extracted text
  // The check above (line 2169) prevents re-highlighting the same text, avoiding jitter
  if (extractedText && extractedText.trim()) {
    try {
      highlightTextInElement(element, extractedText.trim(), mouseEvent || lastMouseEvent);
    } catch (error) {
      console.error('[MouseTracking] Error highlighting text:', error);
    }
  }
}

/**
 * Create a text highlight overlay showing the extracted text
 * @param {HTMLElement} element - Element containing the text
 * @param {string} text - The extracted text to highlight
 */
function createTextHighlight(element, text) {
  // Try to find and highlight the exact text within the element
  const elementText = element.textContent || '';
  const trimmedText = text.trim();

  if (!elementText.includes(trimmedText)) {
    // Text not found exactly, skip text-level highlighting
    return;
  }

  // Find text position
  const textIndex = elementText.indexOf(trimmedText);
  if (textIndex === -1) return;

  // Create highlight mark element
  try {
    // Find text nodes and apply highlighting
    highlightTextInElement(element, trimmedText);
  } catch (error) {
    console.error('[MouseTracking] Error creating text highlight:', error);
  }
}

/**
 * Highlight specific text within an element by wrapping it in a mark
 * Uses "mouse buffer" approach: creates anchor from text immediately around cursor
 * @param {HTMLElement} element - Element containing the text
 * @param {string} searchText - Text to highlight
 * @param {MouseEvent} mouseEvent - Mouse event to determine which occurrence to highlight
 */
function highlightTextInElement(element, searchText, mouseEvent) {
  // Remove any existing highlights first
  const existingHighlights = element.querySelectorAll('mark.jobsprint-text-highlight');
  existingHighlights.forEach(mark => {
    const text = mark.textContent;
    const textNode = document.createTextNode(text);
    mark.parentNode.replaceChild(textNode, mark);
  });

  // Check if the text actually exists in this element (for smart mode)
  const clone = element.cloneNode(true);
  const marks = clone.querySelectorAll('mark.jobsprint-text-highlight');
  marks.forEach(mark => {
    const textContent = document.createTextNode(mark.textContent);
    mark.parentNode.replaceChild(textContent, mark);
  });
  const elementText = cleanText(clone.textContent || '');

  if (!elementText.includes(searchText)) {
    // Text not in this element (smart mode extracted from parent/sibling)
    // Don't highlight - just show the outline
    return;
  }

  // Get colors for current mode
  const colors = getModeColors(currentModifierMode);
  const highlightColor = colors.solid;
  const bgColor = hexToRgba(highlightColor, 0.5);
  const shadowColor = hexToRgba(highlightColor, 0.25);

  // Simple approach: Find ALL occurrences, pick the one with screen position closest to mouse
  if (!mouseEvent) {
    highlightFirstOccurrence(element, searchText, elementText, bgColor, shadowColor);
    return;
  }

  const mouseX = mouseEvent.clientX;
  const mouseY = mouseEvent.clientY;

  // Find all text nodes and their occurrences of searchText
  const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patternText = escapedText.replace(/\s+/g, '\\s+');
  const regex = new RegExp(patternText, 'g');

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  const candidates = [];
  let node;

  while (node = walker.nextNode()) {
    const nodeText = node.nodeValue || '';
    regex.lastIndex = 0; // Reset regex
    let match;

    while ((match = regex.exec(nodeText)) !== null) {
      // Found a match - get its screen position
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);

      const rects = range.getClientRects();
      if (rects.length > 0) {
        const rect = rects[0];
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.sqrt(
          Math.pow(mouseX - centerX, 2) +
          Math.pow(mouseY - centerY, 2)
        );

        candidates.push({
          node,
          matchIndex: match.index,
          matchText: match[0],
          distance
        });
      }
    }
  }

  if (candidates.length === 0) return;

  // Sort by distance and pick the closest
  candidates.sort((a, b) => a.distance - b.distance);
  const best = candidates[0];

  // Highlight the best match
  const before = best.node.nodeValue.substring(0, best.matchIndex);
  const after = best.node.nodeValue.substring(best.matchIndex + best.matchText.length);

  const fragment = document.createDocumentFragment();
  if (before) fragment.appendChild(document.createTextNode(before));

  const mark = document.createElement('mark');
  mark.className = 'jobsprint-text-highlight';
  mark.style.cssText = `
    background-color: ${bgColor};
    color: inherit;
    padding: 2px 0;
    border-radius: 2px;
    box-shadow: 0 0 0 2px ${shadowColor};
    font-weight: inherit;
    pointer-events: none;
  `;
  mark.textContent = best.matchText;
  fragment.appendChild(mark);

  if (after) fragment.appendChild(document.createTextNode(after));

  best.node.parentNode.replaceChild(fragment, best.node);
}

/**
 * Helper: Highlight first occurrence of text (fallback)
 */
function highlightFirstOccurrence(element, searchText, elementText, bgColor, shadowColor) {
  const position = elementText.indexOf(searchText);
  if (position === -1) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let cleanedPosition = 0;
  let node;

  while (node = walker.nextNode()) {
    const nodeText = node.nodeValue || '';
    const cleanedNodeText = cleanText(nodeText);
    const cleanedStart = cleanedPosition;
    const cleanedEnd = cleanedPosition + cleanedNodeText.length;

    if (position >= cleanedStart && position < cleanedEnd) {
      // Escape special regex characters, then replace spaces with flexible pattern
      const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patternText = escapedText.replace(/\s+/g, '\\s+');
      const regex = new RegExp(patternText);
      const match = nodeText.match(regex);

      if (match && match.index !== undefined) {
        const offsetInNode = match.index;
        const matchedText = match[0];
        const before = nodeText.substring(0, offsetInNode);
        const after = nodeText.substring(offsetInNode + matchedText.length);

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));

        const mark = document.createElement('mark');
        mark.className = 'jobsprint-text-highlight';
        mark.style.cssText = `
          background-color: ${bgColor};
          color: inherit;
          padding: 2px 0;
          border-radius: 2px;
          box-shadow: 0 0 0 2px ${shadowColor};
          font-weight: inherit;
          pointer-events: none;
        `;
        mark.textContent = matchedText;
        fragment.appendChild(mark);

        if (after) fragment.appendChild(document.createTextNode(after));

        node.parentNode.replaceChild(fragment, node);
      }
      break;
    }

    cleanedPosition += cleanedNodeText.length;
  }
}

/**
 * Get colors for a specific mode
 * @param {string} mode - Mode name: 'words', 'smart', 'chars'
 * @returns {Object} Object with solid and transparent color values
 */
function getModeColors(mode) {
  switch (mode) {
    case 'smart':
      return {
        solid: modeColors.smart.solid,
        transparent: modeColors.smart.transparent
      };
    case 'chars':
      return {
        solid: modeColors.chars.solid,
        transparent: modeColors.chars.transparent
      };
    case 'words':
      return {
        solid: modeColors.words.solid,
        transparent: modeColors.words.transparent
      };
    default:
      return {
        solid: '#FF6B6B',              // Red (default)
        transparent: 'rgba(255, 107, 107, 0.1)'
      };
  }
}

/**
 * Remove highlight from currently highlighted element
 */
function removeHighlight() {
  if (lastHighlightedElement) {
    lastHighlightedElement.style.outline = '';
    lastHighlightedElement.style.outlineOffset = '';
    lastHighlightedElement.style.backgroundColor = '';

    // Remove text highlights
    const highlights = lastHighlightedElement.querySelectorAll('mark.jobsprint-text-highlight');
    highlights.forEach(mark => {
      const text = mark.textContent;
      const textNode = document.createTextNode(text);
      mark.parentNode.replaceChild(textNode, mark);
    });

    lastHighlightedElement = null;
    lastHighlightedText = null;
  }
}

/**
 * Setup click event listeners for mode buttons
 */
function setupModeButtons() {
  if (!mouseTrackingOverlay) return;

  const smartBtn = mouseTrackingOverlay.querySelector('#mode-smart');
  const sentenceBtn = mouseTrackingOverlay.querySelector('#mode-sentence');
  const wordsBtn = mouseTrackingOverlay.querySelector('#mode-words');
  const charsBtn = mouseTrackingOverlay.querySelector('#mode-chars');

  if (smartBtn) {
    smartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchMode('smart');
    });
  }

  if (sentenceBtn) {
    sentenceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchMode('sentence');
    });
  }

  if (wordsBtn) {
    wordsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchMode('words');
    });
  }

  if (charsBtn) {
    charsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchMode('chars');
    });
  }

  // Update button states to reflect current mode
  updateModeButtonStates();
}

/**
 * Switch to a different extraction mode
 * @param {string} mode - Mode to switch to: 'smart', 'sentence', 'words', 'chars'
 */
function switchMode(mode) {
  currentModifierMode = mode;
  updateOverlayMode(mode);
  updateModeButtonStates();

  // Re-extract text with new mode if we have a last mouse position
  if (lastMouseEvent && lastHighlightedElement) {
    const text = extractTextFromElement(lastHighlightedElement, lastMouseEvent, mode);
    if (text && text.trim()) {
      sendTextToPopup(text.trim());
    }
  }
}

/**
 * Update mode button visual states to show active mode
 */
function updateModeButtonStates() {
  if (!mouseTrackingOverlay) return;

  const buttons = {
    smart: mouseTrackingOverlay.querySelector('#mode-smart'),
    sentence: mouseTrackingOverlay.querySelector('#mode-sentence'),
    words: mouseTrackingOverlay.querySelector('#mode-words'),
    chars: mouseTrackingOverlay.querySelector('#mode-chars')
  };

  // Reset all buttons to inactive state
  Object.values(buttons).forEach(btn => {
    if (btn) {
      btn.style.background = 'rgba(255,255,255,0.2)';
      btn.style.transform = 'scale(1)';
    }
  });

  // Highlight active button
  const activeButton = buttons[currentModifierMode];
  if (activeButton) {
    // Use mode-specific colors
    let activeColor = '#3498db'; // Default blue for smart
    if (currentModifierMode === 'sentence') {
      activeColor = '#3498db'; // Blue
    } else if (currentModifierMode === 'words') {
      activeColor = '#2ecc71'; // Green
    } else if (currentModifierMode === 'chars') {
      activeColor = '#9b59b6'; // Purple
    }

    activeButton.style.background = activeColor;
    activeButton.style.transform = 'scale(1.05)';
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
    padding: 8px 12px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    font-weight: 600;
    z-index: 999998;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    animation: slideInFromRight 0.3s ease-out;
  `;

  overlay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <span style="font-size: 14px;">🎯</span>
      <span id="jobsprint-tracking-title" style="font-size: 11px; font-weight: 500;">Mouse Text Mirror</span>
    </div>
    <div id="jobsprint-tracking-mode" style="font-size: 9px; opacity: 0.75; line-height: 1.3; margin-top: 3px;">
      ↑↓ adjust • Alt+Arrows move • ESC cancel
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

  // Note: Mode buttons removed from overlay - they're only in the popup now
  // This keeps the overlay minimal and non-redundant
}

/**
 * Update overlay position based on stored position state
 */
function updateOverlayPosition() {
  if (!mouseTrackingOverlay) return;

  // Clear all position properties first by removing them
  mouseTrackingOverlay.style.removeProperty('top');
  mouseTrackingOverlay.style.removeProperty('bottom');
  mouseTrackingOverlay.style.removeProperty('left');
  mouseTrackingOverlay.style.removeProperty('right');

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
 * @param {string} mode - Current mode: 'smart', 'words', 'sentence', or 'chars'
 */
function updateOverlayMode(mode) {
  if (!mouseTrackingOverlay) return;

  const modeElement = mouseTrackingOverlay.querySelector('#jobsprint-tracking-mode');
  if (!modeElement) return;

  // Simplified status text - just show keyboard shortcuts
  let modeText = '↑↓ adjust • Alt+Arrows move • ESC cancel';
  let bgColor = 'rgba(255, 107, 107, 0.95)';

  switch (mode) {
    case 'smart':
      bgColor = modeColors.smart.bg;
      break;
    case 'chars':
      bgColor = modeColors.chars.bg;
      break;
    case 'words':
      bgColor = modeColors.words.bg;
      break;
    default:
      bgColor = 'rgba(255, 107, 107, 0.95)'; // Red for default
  }

  modeElement.textContent = modeText;
  mouseTrackingOverlay.style.background = bgColor;

  // Add pulse animation when mode changes
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
  // Check if extension context is valid before attempting to send message
  if (!chrome.runtime?.id) {
    // Extension context invalidated - stop tracking silently
    stopMouseTracking();
    return;
  }

  try {
    chrome.runtime.sendMessage({
      action: 'mouseHoverText',
      fieldId: currentTrackedFieldId,
      text: text,
      confirmed: confirm
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Extension context invalidated is expected when extension reloads - stop tracking silently
        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          stopMouseTracking();
        } else {
          console.warn('[MouseTracking] Could not send message to popup:', chrome.runtime.lastError.message);
        }
      }
    });
  } catch (error) {
    // Extension context invalidated - stop tracking silently
    if (error.message && error.message.includes('Extension context invalidated')) {
      stopMouseTracking();
    }
  }
}

/**
 * Notify popup about mode change
 * This allows the popup to update button states when mode changes via keyboard modifiers
 * @param {string} mode - New mode: 'words', 'smart', 'chars'
 */
function notifyPopupModeChange(mode) {
  // Check if extension context is valid before attempting to send message
  if (!chrome.runtime?.id) {
    // Extension context invalidated - ignore silently
    return;
  }

  try {
    chrome.runtime.sendMessage({
      action: 'modeChanged',
      mode: mode
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Extension context invalidated is expected when extension reloads - ignore silently
        if (!chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          console.warn('[MouseTracking] Could not notify popup of mode change:', chrome.runtime.lastError.message);
        }
      }
    });
  } catch (error) {
    // Extension context invalidated - ignore silently
    if (!error.message || !error.message.includes('Extension context invalidated')) {
      console.warn('[MouseTracking] Extension context error during mode change notification:', error);
    }
  }
}
