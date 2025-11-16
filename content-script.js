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
let currentModifierMode = 'full'; // 'full', 'sentence', 'words'

/**
 * Start interactive mouse tracking for field auto-fill
 * When user hovers over text elements, their content is extracted and sent to the extension
 * @param {string} fieldId - ID of the field being filled
 */
function startMouseTracking(fieldId) {
  console.log('Starting mouse tracking for field:', fieldId);

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
 * Handle escape key to cancel tracking
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleEscapeKey(event) {
  if (event.key === 'Escape' && mouseTrackingActive) {
    event.preventDefault();
    stopMouseTracking();
  }
}

/**
 * Get extraction mode based on modifier keys
 * @param {MouseEvent|KeyboardEvent} event - Event with modifier key info
 * @returns {string} Extraction mode: 'full', 'sentence', or 'words'
 */
function getExtractionMode(event) {
  if (event.ctrlKey || event.metaKey) {
    return 'words'; // Ctrl/Cmd: extract just a few words
  } else if (event.shiftKey) {
    return 'sentence'; // Shift: extract current sentence
  }
  return 'full'; // No modifier: extract full element text
}

/**
 * Extract text content from an element with scope control
 * Handles various element types and nested structures
 * @param {HTMLElement} element - Element to extract text from
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {string} mode - Extraction mode: 'full', 'sentence', or 'words'
 * @returns {string} Extracted text
 */
function extractTextFromElement(element, event, mode = 'full') {
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

  // Apply scope based on mode
  if (mode === 'sentence') {
    return extractNearestSentence(fullText, event, element);
  } else if (mode === 'words') {
    return extractNearestWords(fullText, event, element);
  }

  return fullText;
}

/**
 * Extract the sentence nearest to the cursor position
 * @param {string} text - Full text content
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {HTMLElement} element - Element containing the text
 * @returns {string} Nearest sentence
 */
function extractNearestSentence(text, event, element) {
  if (!text) return '';

  // Try to find the word under cursor using Range API
  const range = document.caretRangeFromPoint(event.clientX, event.clientY);
  if (!range) {
    // Fallback: return first sentence
    return getFirstSentence(text);
  }

  // Get approximate position in text
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    return getFirstSentence(text);
  }

  const offset = range.startOffset;
  const nodeText = textNode.textContent || '';

  // Find which sentence contains this offset
  // Split by sentence endings (.!?) followed by space or end
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];

  // Find cumulative position in the full text
  let cumulativeLength = 0;
  const fullTextContent = element.textContent || '';
  const targetPosition = fullTextContent.indexOf(nodeText) + offset;

  // Find which sentence contains the target position
  for (const sentence of sentences) {
    cumulativeLength += sentence.length;
    if (cumulativeLength >= targetPosition) {
      return sentence.trim();
    }
  }

  // Fallback: return first sentence
  return sentences[0]?.trim() || text;
}

/**
 * Extract a few words nearest to the cursor position
 * @param {string} text - Full text content
 * @param {MouseEvent} event - Mouse event for cursor position
 * @param {HTMLElement} element - Element containing the text
 * @returns {string} Nearest words (3-5 words)
 */
function extractNearestWords(text, event, element) {
  if (!text) return '';

  const WORD_COUNT = 5; // Extract 5 words around cursor

  // Try to find the word under cursor using Range API
  const range = document.caretRangeFromPoint(event.clientX, event.clientY);
  if (!range) {
    // Fallback: return first few words
    return getFirstWords(text, WORD_COUNT);
  }

  // Get approximate position in text
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    return getFirstWords(text, WORD_COUNT);
  }

  const offset = range.startOffset;
  const nodeText = textNode.textContent || '';

  // Split text into words
  const words = text.split(/\s+/);

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

  // Extract words around the target (2 before, target, 2 after)
  const startIndex = Math.max(0, targetWordIndex - 2);
  const endIndex = Math.min(words.length, targetWordIndex + 3);
  const selectedWords = words.slice(startIndex, endIndex);

  return selectedWords.join(' ');
}

/**
 * Get first sentence from text
 * @param {string} text - Text to extract from
 * @returns {string} First sentence
 */
function getFirstSentence(text) {
  const match = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+/);
  return match ? match[0].trim() : text.trim();
}

/**
 * Get first N words from text
 * @param {string} text - Text to extract from
 * @param {number} count - Number of words
 * @returns {string} First N words
 */
function getFirstWords(text, count) {
  const words = text.split(/\s+/);
  return words.slice(0, count).join(' ');
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
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
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
      Full text • Hold Shift for sentence • Ctrl for words
    </div>
    <div style="font-size: 11px; margin-top: 4px; opacity: 0.9;">
      Click to select • Press ESC to cancel
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
 * Update overlay to show current extraction mode
 * @param {string} mode - Current mode: 'full', 'sentence', or 'words'
 */
function updateOverlayMode(mode) {
  if (!mouseTrackingOverlay) return;

  const modeElement = mouseTrackingOverlay.querySelector('#jobsprint-tracking-mode');
  if (!modeElement) return;

  let modeText = '';
  let bgColor = 'rgba(255, 107, 107, 0.95)';

  switch (mode) {
    case 'sentence':
      modeText = '📝 Sentence mode (Shift) • Release to extract full text';
      bgColor = 'rgba(52, 152, 219, 0.95)'; // Blue for sentence
      break;
    case 'words':
      modeText = '✂️ Word mode (Ctrl) • Release to extract full text';
      bgColor = 'rgba(46, 204, 113, 0.95)'; // Green for words
      break;
    default:
      modeText = 'Full text • Hold Shift for sentence • Ctrl for words';
      bgColor = 'rgba(255, 107, 107, 0.95)'; // Red for full
  }

  modeElement.textContent = modeText;
  mouseTrackingOverlay.style.background = bgColor;

  // Add pulse animation when mode changes
  if (mode !== 'full') {
    mouseTrackingOverlay.style.animation = 'slideInFromRight 0.3s ease-out, pulseGlow 1s ease-in-out';
  } else {
    mouseTrackingOverlay.style.animation = 'slideInFromRight 0.3s ease-out';
  }
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
