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
  // Remove any existing approval UI
  removeApprovalUI();

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'jobsprint-approval-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // Create modal card
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 16px;
  `;

  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 40px;
    height: 40px;
    background: #4CAF50;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    font-size: 20px;
  `;
  icon.textContent = '✓';
  icon.style.color = 'white';

  const title = document.createElement('h3');
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
  `;
  title.textContent = 'Autofill Suggestion';

  header.appendChild(icon);
  header.appendChild(title);

  // Create question display
  const questionDiv = document.createElement('div');
  questionDiv.style.cssText = `
    margin-bottom: 12px;
    padding: 12px;
    background: #f5f5f5;
    border-radius: 6px;
  `;

  const questionLabel = document.createElement('div');
  questionLabel.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: #666;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;
  questionLabel.textContent = 'Question';

  const questionText = document.createElement('div');
  questionText.style.cssText = `
    font-size: 14px;
    color: #333;
    line-height: 1.4;
  `;
  questionText.textContent = question;

  questionDiv.appendChild(questionLabel);
  questionDiv.appendChild(questionText);

  // Create answer display
  const answerDiv = document.createElement('div');
  answerDiv.style.cssText = `
    margin-bottom: 20px;
    padding: 12px;
    background: #e8f5e9;
    border-radius: 6px;
    border-left: 3px solid #4CAF50;
  `;

  const answerLabel = document.createElement('div');
  answerLabel.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: #2e7d32;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;
  answerLabel.textContent = 'Suggested Answer';

  const answerText = document.createElement('div');
  answerText.style.cssText = `
    font-size: 15px;
    color: #1b5e20;
    font-weight: 500;
    line-height: 1.4;
  `;
  answerText.textContent = answer;

  answerDiv.appendChild(answerLabel);
  answerDiv.appendChild(answerText);

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  `;

  // Create reject button
  const rejectBtn = document.createElement('button');
  rejectBtn.textContent = 'Skip';
  rejectBtn.style.cssText = `
    padding: 10px 20px;
    border: 2px solid #ddd;
    background: white;
    color: #666;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  `;

  rejectBtn.onmouseover = () => {
    rejectBtn.style.background = '#f5f5f5';
    rejectBtn.style.borderColor = '#999';
  };
  rejectBtn.onmouseout = () => {
    rejectBtn.style.background = 'white';
    rejectBtn.style.borderColor = '#ddd';
  };

  rejectBtn.onclick = () => {
    removeApprovalUI();
    onReject();
  };

  // Create approve button
  const approveBtn = document.createElement('button');
  approveBtn.textContent = 'Apply Answer';
  approveBtn.style.cssText = `
    padding: 10px 20px;
    border: none;
    background: #4CAF50;
    color: white;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  `;

  approveBtn.onmouseover = () => {
    approveBtn.style.background = '#45a049';
  };
  approveBtn.onmouseout = () => {
    approveBtn.style.background = '#4CAF50';
  };

  approveBtn.onclick = () => {
    removeApprovalUI();
    onApprove();
  };

  buttonContainer.appendChild(rejectBtn);
  buttonContainer.appendChild(approveBtn);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(questionDiv);
  modal.appendChild(answerDiv);
  modal.appendChild(buttonContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus the approve button for keyboard accessibility
  approveBtn.focus();

  // Allow ESC key to reject
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      removeApprovalUI();
      onReject();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // Highlight the input field being filled
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
