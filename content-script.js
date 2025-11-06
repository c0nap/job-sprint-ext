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
  try {
    const data = {
      title: '',
      company: '',
      location: '',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: extractSource(window.location.href)
    };

    // Enhanced selectors for popular job boards
    const titleSelectors = [
      // Generic
      'h1',
      '[data-job-title]',
      '.job-title',
      '.jobTitle',
      // LinkedIn
      '.topcard__title',
      '.top-card-layout__title',
      // Indeed
      '.jobsearch-JobInfoHeader-title',
      // Glassdoor
      '[data-test="job-title"]',
      // Greenhouse
      '.app-title',
      // Lever
      '.posting-headline h2',
      // Workday
      '[data-automation-id="jobPostingHeader"]'
    ];

    const companySelectors = [
      // Generic
      '[data-company-name]',
      '.company-name',
      '.companyName',
      '.employer',
      // LinkedIn
      '.topcard__org-name-link',
      '.top-card-layout__entity-info a',
      // Indeed
      '[data-company-name="true"]',
      // Glassdoor
      '[data-test="employer-name"]',
      // Greenhouse
      '.company-name',
      // Lever
      '.posting-categories .posting-category'
    ];

    const locationSelectors = [
      // Generic
      '[data-location]',
      '.location',
      '.job-location',
      '.jobLocation',
      // LinkedIn
      '.topcard__flavor--bullet',
      '.top-card-layout__second-subline',
      // Indeed
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle > div',
      // Glassdoor
      '[data-test="location"]',
      // Greenhouse
      '.location',
      // Lever
      '.posting-categories .location',
      '.sort-by-time posting-category small'
    ];

    // Extract with validation
    data.title = extractField(titleSelectors, 'title');
    data.company = extractField(companySelectors, 'company');
    data.location = extractField(locationSelectors, 'location');

    // Validate extracted data
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
 * Extract field using multiple selectors with fallback
 * @param {Array} selectors - Array of CSS selectors to try
 * @param {string} fieldName - Name of field being extracted (for logging)
 * @returns {string} Extracted text or empty string
 */
function extractField(selectors, fieldName) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        const text = element.textContent.trim();
        // Clean up extracted text
        return cleanText(text);
      }
    } catch (error) {
      console.debug(`Failed to query selector "${selector}":`, error);
    }
  }
  return '';
}

/**
 * Clean extracted text (remove extra whitespace, newlines, etc.)
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n+/g, ' ') // Replace newlines with space
    .trim();
}

/**
 * Extract source/job board name from URL
 * @param {string} url - Current page URL
 * @returns {string} Source name
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
