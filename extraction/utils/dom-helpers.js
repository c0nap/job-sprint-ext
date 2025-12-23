/**
 * CSP-Compliant DOM Helper Utilities
 *
 * These utilities help manipulate the DOM without violating Content Security Policy (CSP).
 * - No inline styles
 * - No innerHTML with dynamic content
 * - All styling via CSS classes
 *
 * @module extraction/utils/dom-helpers
 */

/**
 * Create an element with text content and CSS classes (CSP-compliant)
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content
 * @param {string[]} classes - CSS classes to apply
 * @returns {HTMLElement} Created element
 */
function createElement(tag, text = '', classes = []) {
  const element = document.createElement(tag);
  if (text) {
    element.textContent = text;
  }
  if (classes.length > 0) {
    element.classList.add(...classes);
  }
  return element;
}

/**
 * Create a container with multiple child elements
 * @param {string} tag - Container tag name
 * @param {HTMLElement[]} children - Child elements
 * @param {string[]} classes - CSS classes for container
 * @returns {HTMLElement} Container element
 */
function createContainer(tag, children = [], classes = []) {
  const container = document.createElement(tag);
  if (classes.length > 0) {
    container.classList.add(...classes);
  }
  children.forEach(child => {
    if (child) container.appendChild(child);
  });
  return container;
}

/**
 * Clear all children from an element
 * @param {HTMLElement} element - Element to clear
 */
function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Replace element contents with new children (CSP-compliant)
 * @param {HTMLElement} element - Element to update
 * @param {HTMLElement[]} children - New child elements
 */
function replaceChildren(element, children) {
  clearElement(element);
  children.forEach(child => {
    if (child) element.appendChild(child);
  });
}

/**
 * Create a link element (CSP-compliant)
 * @param {string} href - URL
 * @param {string} text - Link text
 * @param {string[]} classes - CSS classes
 * @returns {HTMLAnchorElement} Link element
 */
function createLink(href, text, classes = []) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  if (classes.length > 0) {
    link.classList.add(...classes);
  }
  return link;
}

/**
 * Create a status message element (CSP-compliant)
 * @param {string} type - Status type: 'success', 'error', 'warning', 'info'
 * @param {string} message - Message text
 * @returns {HTMLElement} Status message element
 */
function createStatusMessage(type, message) {
  const div = document.createElement('div');
  div.classList.add('status-message', `status-${type}`);
  div.textContent = message;
  return div;
}

/**
 * Create a labeled value display (CSP-compliant)
 * @param {string} label - Label text
 * @param {string} value - Value text
 * @param {string[]} containerClasses - CSS classes for container
 * @returns {HTMLElement} Labeled value container
 */
function createLabeledValue(label, value, containerClasses = []) {
  const container = document.createElement('div');
  if (containerClasses.length > 0) {
    container.classList.add(...containerClasses);
  }

  const labelElement = document.createElement('strong');
  labelElement.textContent = label + ': ';

  const valueElement = document.createElement('span');
  valueElement.textContent = value;

  container.appendChild(labelElement);
  container.appendChild(valueElement);

  return container;
}

/**
 * Create an error message container (CSP-compliant)
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @returns {HTMLElement} Error container
 */
function createErrorMessage(title, message) {
  const container = document.createElement('div');
  container.classList.add('error-container');

  const titleElement = document.createElement('strong');
  titleElement.textContent = title;
  titleElement.classList.add('error-title');

  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  messageElement.classList.add('error-message');

  container.appendChild(titleElement);
  container.appendChild(messageElement);

  return container;
}

/**
 * Create a duplicate info display (CSP-compliant)
 * @param {Object} duplicateData - Duplicate information
 * @param {number} duplicateData.rowNumber - Row number
 * @param {string} duplicateData.status - Status
 * @param {string} duplicateData.appliedDate - Applied date
 * @param {string} duplicateData.url - URL (optional)
 * @returns {HTMLElement} Duplicate info container
 */
function createDuplicateInfo(duplicateData) {
  const container = document.createElement('div');
  container.classList.add('duplicate-info-container');

  const title = document.createElement('strong');
  title.textContent = 'ℹ️ Existing Entry Found';
  title.classList.add('duplicate-info-title');

  const details = document.createElement('div');
  details.classList.add('duplicate-info-details');

  // Row number
  details.appendChild(createLabeledValue('Row', duplicateData.rowNumber.toString()));

  // Status
  details.appendChild(createLabeledValue('Status', duplicateData.status));

  // Date
  details.appendChild(createLabeledValue('Date Recorded', duplicateData.appliedDate));

  // URL (if provided)
  if (duplicateData.url) {
    const urlContainer = document.createElement('div');
    const urlLabel = document.createElement('strong');
    urlLabel.textContent = 'URL: ';

    const urlLink = createLink(duplicateData.url,
      duplicateData.url.substring(0, 60) + (duplicateData.url.length > 60 ? '...' : ''),
      ['duplicate-url-link']);

    urlContainer.appendChild(urlLabel);
    urlContainer.appendChild(urlLink);
    details.appendChild(urlContainer);
  }

  container.appendChild(title);
  container.appendChild(details);

  return container;
}

/**
 * Show element by removing 'hidden' class or setting display
 * @param {HTMLElement} element - Element to show
 */
function showElement(element) {
  if (element.classList.contains('hidden')) {
    element.classList.remove('hidden');
  }
  if (element.style.display === 'none') {
    element.style.display = '';
  }
}

/**
 * Hide element by adding 'hidden' class or setting display
 * @param {HTMLElement} element - Element to hide
 */
function hideElement(element) {
  if (!element.classList.contains('hidden')) {
    element.classList.add('hidden');
  }
  element.style.display = 'none';
}

/**
 * Toggle element visibility
 * @param {HTMLElement} element - Element to toggle
 */
function toggleElement(element) {
  if (element.style.display === 'none' || element.classList.contains('hidden')) {
    showElement(element);
  } else {
    hideElement(element);
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createElement,
    createContainer,
    clearElement,
    replaceChildren,
    createLink,
    createStatusMessage,
    createLabeledValue,
    createErrorMessage,
    createDuplicateInfo,
    showElement,
    hideElement,
    toggleElement
  };
}

// Also expose on window for content script usage
if (typeof window !== 'undefined') {
  window.DOMHelpers = {
    createElement,
    createContainer,
    clearElement,
    replaceChildren,
    createLink,
    createStatusMessage,
    createLabeledValue,
    createErrorMessage,
    createDuplicateInfo,
    showElement,
    hideElement,
    toggleElement
  };
}
