/**
 * JobSprint Popup Script
 * Handles user interactions in the popup UI
 * Features: Clipboard macros, job data extraction, autofill
 */

// Log script loading
console.log('popup.js loaded');

// Track if initialization has run to prevent duplicates
let initialized = false;

function initialize() {
  if (initialized) {
    console.log('Already initialized, skipping duplicate initialization');
    return;
  }
  initialized = true;
  console.log('Initializing JobSprint Popup');

  initializeClipboardMacros();
  initializeExtraction();
  initializeAutofill();
  initializeSettings();
  initializeManualEntryModal();
}

// Initialize all popup features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired');
  initialize();
});

// Also try immediate initialization in case DOMContentLoaded already fired
if (document.readyState !== 'loading') {
  console.log('Document already loaded, initializing immediately');
  initialize();
}

// ============ CLIPBOARD MACROS ============

// Folder titles mapping
const FOLDER_TITLES = {
  demographics: 'Demographics',
  references: 'References',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  employment: 'Employment'
};

// Current navigation state
let currentFolder = null;

// Search cache
let searchIndex = null;
let maxSearchResults = 10; // Default, will be loaded from settings

/**
 * Initialize clipboard macro folder navigation
 * Sets up click handlers for folder buttons and navigation
 */
function initializeClipboardMacros() {
  console.log('initializeClipboardMacros called');

  // Set up folder button click handlers
  const folderButtons = document.querySelectorAll('.folder-btn');
  console.log('Found folder buttons:', folderButtons.length);

  if (folderButtons.length === 0) {
    console.error('No folder buttons found! Retrying in 100ms...');
    setTimeout(initializeClipboardMacros, 100);
    return;
  }

  folderButtons.forEach((button, index) => {
    const folder = button.getAttribute('data-folder');
    console.log(`Attaching listener to folder button ${index}:`, folder);

    // Use a simple click handler without capture phase or event manipulation
    button.onclick = function(event) {
      console.log('Folder button clicked:', folder);
      openFolder(folder);
    };
  });

  // Set up back button
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', closeFolder);
    console.log('Back button listener attached');
  } else {
    console.warn('Back button not found');
  }

  // Initialize search
  initializeSearch();
  console.log('Clipboard macros initialization complete');
}

/**
 * Open a folder and show its items
 * @param {string} folder - Folder name (demographics, references, etc.)
 */
function openFolder(folder) {
  console.log('openFolder called for:', folder);
  currentFolder = folder;

  // Get folder data from storage
  chrome.runtime.sendMessage(
    { action: 'getClipboardFolder', folder },
    (response) => {
      console.log('Got response from service worker:', response);

      if (!response?.success) {
        console.error('Failed to load folder items');
        showError('Failed to load folder items');
        return;
      }

      // Show sub-menu and hide folder view
      console.log('Showing sub-menu, hiding folder view');
      document.getElementById('folderView').style.display = 'none';
      document.getElementById('subMenuView').style.display = 'block';

      // Hide other feature sections
      hideOtherSections();

      // Update sub-menu title
      document.getElementById('subMenuTitle').textContent = FOLDER_TITLES[folder] || 'Items';

      // Render items
      console.log('Rendering items:', response.items);
      renderSubMenuItems(response.items);
    }
  );
}

/**
 * Close folder and return to main view
 */
function closeFolder() {
  currentFolder = null;

  // Show folder view and hide sub-menu
  document.getElementById('folderView').style.display = 'grid';
  document.getElementById('subMenuView').style.display = 'none';

  // Show other feature sections
  showOtherSections();
}

/**
 * Render sub-menu items
 * @param {Object} items - Object with key-value pairs of items
 */
function renderSubMenuItems(items) {
  const container = document.getElementById('subMenuItems');

  // Clear container
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Convert items object to array
  const itemsArray = Object.entries(items || {});

  if (itemsArray.length === 0) {
    // Show empty state
    showEmptyState(container);
    return;
  }

  // Render each item as a button
  itemsArray.forEach(([key, value]) => {
    // Skip empty values (but allow objects)
    if (typeof value === 'string' && value.trim() === '') return;
    if (!value) return;

    const isFolder = typeof value === 'object' && value !== null && !Array.isArray(value);

    if (isFolder) {
      // Folder item - render with main button + copy button
      const itemContainer = document.createElement('div');
      itemContainer.className = 'sub-menu-item-container';

      // Create main folder button
      const button = document.createElement('button');
      button.className = 'sub-menu-item-btn folder-item';
      button.textContent = formatItemLabel(key, value);
      button.title = 'Nested folder - use copy button to copy verbalized content';

      // Folder main button doesn't do anything (or could navigate deeper in future)
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        // For now, folders don't navigate deeper - just use copy button
      });

      // Create copy button for folder
      const copyButton = document.createElement('button');
      copyButton.className = 'sub-menu-copy-btn';
      copyButton.setAttribute('aria-label', 'Copy');
      copyButton.title = 'Copy verbalized content to clipboard';

      // Use layered document emoji for copy icon
      const copyIcon = document.createElement('span');
      copyIcon.className = 'copy-icon-layered';

      const doc1 = document.createElement('span');
      doc1.textContent = '📄';
      doc1.className = 'copy-doc-1';

      const doc2 = document.createElement('span');
      doc2.textContent = '📄';
      doc2.className = 'copy-doc-2';

      copyIcon.appendChild(doc1);
      copyIcon.appendChild(doc2);
      copyButton.appendChild(copyIcon);

      // Copy button copies verbalized content
      copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleItemClick(key, value);
      });

      itemContainer.appendChild(button);
      itemContainer.appendChild(copyButton);
      container.appendChild(itemContainer);
    } else {
      // Regular item - just one button that copies when clicked
      const button = document.createElement('button');
      button.className = 'sub-menu-item-btn basic-item';
      button.textContent = formatItemLabel(key, value);
      button.title = `Click to copy: ${value}`;

      // Click to copy
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        handleItemClick(key, value);
      });

      // Add button directly (no container, no copy button for items)
      container.appendChild(button);
    }
  });

  // If no non-empty items, show empty state
  if (container.children.length === 0) {
    showEmptyState(container);
  }
}

/**
 * Show empty state in container
 * @param {HTMLElement} container - Container element
 */
function showEmptyState(container) {
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'sub-menu-empty';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'sub-menu-empty-icon';
  iconDiv.textContent = '📭';

  const textDiv = document.createElement('div');
  textDiv.textContent = 'No items configured';

  emptyDiv.appendChild(iconDiv);
  emptyDiv.appendChild(textDiv);
  container.appendChild(emptyDiv);
}

/**
 * Format item label for display
 * @param {string} key - Item key
 * @param {string|Object} value - Item value
 * @returns {string} Formatted label
 */
function formatItemLabel(key, value) {
  // Capitalize first letter of key
  const label = key.charAt(0).toUpperCase() + key.slice(1);

  // If value is an object (nested), show folder icon
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const itemCount = Object.keys(value).length;
    return `📁 ${label} (${itemCount} items)`;
  }

  // If value is a string, show preview
  const maxLength = 30;
  const truncatedValue = value.length > maxLength
    ? value.substring(0, maxLength) + '...'
    : value;

  return `${label}: ${truncatedValue}`;
}

/**
 * Verbalize a value - convert nested objects to readable text
 * If value is a string, return as-is. If object, convert to bulleted list.
 * @param {string|Object} value - Value to verbalize
 * @param {number} indent - Indentation level (for recursion)
 * @returns {string} Verbalized text
 */
function verbalizeValue(value, indent = 0) {
  // Base case: if it's a string, return it
  if (typeof value === 'string') {
    return value;
  }

  // If it's an object, convert to list format
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '(empty)';
    }

    const lines = [];
    const indentStr = '  '.repeat(indent);

    entries.forEach(([key, val]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);

      if (typeof val === 'string') {
        // Leaf node - format as "- Key: value"
        lines.push(`${indentStr}- ${label}: ${val}`);
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        // Nested object - format with sub-items
        lines.push(`${indentStr}- ${label}:`);
        const nested = verbalizeValue(val, indent + 1);
        lines.push(nested);
      }
    });

    return lines.join('\n');
  }

  // Fallback for unexpected types
  return String(value);
}

/**
 * Handle item click - copy the value to clipboard
 * @param {string} key - Item key
 * @param {string|Object} value - Item value to copy (string or nested object)
 */
async function handleItemClick(key, value) {
  // Verbalize the value (converts objects to readable text, keeps strings as-is)
  const textToCopy = verbalizeValue(value);

  try {
    // Copy to clipboard using Clipboard API
    await navigator.clipboard.writeText(textToCopy);

    console.log('✓ Copied to clipboard:', textToCopy);

    // Show visual feedback (similar to search copy)
    // Keep popup open so user can copy multiple items
  } catch (error) {
    showError('Failed to copy to clipboard');
    console.error('Clipboard error:', error);
  }
}

/**
 * Hide other feature sections when sub-menu is open
 */
function hideOtherSections() {
  const sections = document.querySelectorAll('.feature-section:not(#clipboardSection)');
  sections.forEach(section => {
    section.classList.add('other-sections-hidden');
  });

  // Also hide footer
  const footer = document.querySelector('footer');
  if (footer) {
    footer.classList.add('other-sections-hidden');
  }
}

/**
 * Show other feature sections when returning to folder view
 */
function showOtherSections() {
  const sections = document.querySelectorAll('.feature-section:not(#clipboardSection)');
  sections.forEach(section => {
    section.classList.remove('other-sections-hidden');
  });

  // Also show footer
  const footer = document.querySelector('footer');
  if (footer) {
    footer.classList.remove('other-sections-hidden');
  }
}

// ============ CLIPBOARD SEARCH ============

/**
 * Initialize clipboard search functionality
 */
function initializeSearch() {
  // Load search settings
  chrome.storage.sync.get(['maxSearchResults'], (result) => {
    if (result.maxSearchResults) {
      maxSearchResults = result.maxSearchResults;
    }
  });

  // Set up search input handler
  const searchInput = document.getElementById('clipboardSearch');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) {
        handleSearchInput(); // Show results if there's already a value
      }
    });
  }

  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && !searchContainer.contains(e.target)) {
      hideSearchResults();
    }
  });

  // Build search index
  buildSearchIndex();
}

/**
 * Build search index from all clipboard macros
 */
function buildSearchIndex() {
  chrome.storage.sync.get(['clipboardMacros'], (result) => {
    const macros = result.clipboardMacros || {};
    searchIndex = [];

    // Recursively index all items
    Object.entries(macros).forEach(([folderKey, folderData]) => {
      indexFolder(folderKey, folderData, [folderKey]);
    });
  });
}

/**
 * Recursively index a folder and its contents
 * @param {string} key - Current key
 * @param {*} value - Current value
 * @param {Array<string>} path - Path from root to current item
 */
function indexFolder(key, value, path) {
  if (typeof value === 'string') {
    // Leaf node - add to index
    searchIndex.push({
      path: path,
      dotPath: path.join('.'),
      value: value,
      displayPath: path.map(capitalizeFirst).join(' → ')
    });
  } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Object node - recurse into children
    Object.entries(value).forEach(([childKey, childValue]) => {
      indexFolder(childKey, childValue, [...path, childKey]);
    });
  }
}

/**
 * Handle search input changes
 */
function handleSearchInput() {
  const searchInput = document.getElementById('clipboardSearch');
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    hideSearchResults();
    return;
  }

  if (!searchIndex) {
    buildSearchIndex();
    setTimeout(handleSearchInput, 100); // Retry after index is built
    return;
  }

  // Search through index
  const results = searchIndex.filter((item) => {
    // Match against dot path (e.g., "employment.walmart.start_date")
    const dotPathMatch = item.dotPath.toLowerCase().includes(query);
    // Match against display path (e.g., "Employment → Walmart → Start Date")
    const displayPathMatch = item.displayPath.toLowerCase().includes(query);
    // Match against value
    const valueMatch = item.value.toLowerCase().includes(query);

    return dotPathMatch || displayPathMatch || valueMatch;
  }).slice(0, maxSearchResults);

  displaySearchResults(results);
}

/**
 * Display search results in dropdown
 * @param {Array<Object>} results - Search results to display
 */
function displaySearchResults(results) {
  const resultsContainer = document.getElementById('searchResults');

  // Clear container
  while (resultsContainer.firstChild) {
    resultsContainer.removeChild(resultsContainer.firstChild);
  }

  if (results.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'search-no-results';
    noResults.textContent = 'No results found';
    resultsContainer.appendChild(noResults);
    resultsContainer.style.display = 'block';
    return;
  }

  results.forEach((result) => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';

    const pathDiv = document.createElement('div');
    pathDiv.className = 'search-result-path';

    const breadcrumbSpan = document.createElement('span');
    breadcrumbSpan.className = 'search-result-breadcrumb';
    breadcrumbSpan.textContent = result.displayPath;

    const valuePreview = document.createElement('div');
    valuePreview.style.fontSize = '11px';
    valuePreview.style.color = '#999';
    valuePreview.style.marginTop = '2px';
    valuePreview.textContent = result.value.length > 50
      ? result.value.substring(0, 50) + '...'
      : result.value;

    pathDiv.appendChild(breadcrumbSpan);
    pathDiv.appendChild(valuePreview);

    const copyButton = document.createElement('button');
    copyButton.className = 'search-result-copy';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', (e) => {
      e.stopPropagation();
      copySearchResult(result);
    });

    // Click on result item navigates to it
    resultItem.addEventListener('click', () => {
      navigateToSearchResult(result);
    });

    resultItem.appendChild(pathDiv);
    resultItem.appendChild(copyButton);
    resultsContainer.appendChild(resultItem);
  });

  resultsContainer.style.display = 'block';
}

/**
 * Hide search results dropdown
 */
function hideSearchResults() {
  const resultsContainer = document.getElementById('searchResults');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
}

/**
 * Copy search result value to clipboard
 * @param {Object} result - Search result to copy
 */
async function copySearchResult(result) {
  try {
    await navigator.clipboard.writeText(result.value);
    console.log('✓ Copied to clipboard:', result.value);

    // Visual feedback
    const searchInput = document.getElementById('clipboardSearch');
    const originalPlaceholder = searchInput.placeholder;
    searchInput.placeholder = '✓ Copied!';
    setTimeout(() => {
      searchInput.placeholder = originalPlaceholder;
    }, 1500);
  } catch (error) {
    showError('Failed to copy to clipboard');
    console.error('Clipboard error:', error);
  }
}

/**
 * Navigate to search result location
 * @param {Object} result - Search result to navigate to
 */
function navigateToSearchResult(result) {
  // Hide search results
  hideSearchResults();

  // Clear search input
  const searchInput = document.getElementById('clipboardSearch');
  if (searchInput) {
    searchInput.value = '';
  }

  // Navigate to the folder
  const folder = result.path[0]; // First element is the folder name
  openFolder(folder);

  // If there are more levels, we need to handle nested navigation
  // For now, opening the folder will show all items including nested ones
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============ DATA EXTRACTION ============

/**
 * Initialize job data extraction feature
 * Sets up the extract button to pull job posting data from the current page
 * Flow: Extract from page -> Send to service worker -> Log to Google Sheets
 */
function initializeExtraction() {
  const extractBtn = document.getElementById('extractBtn');
  const statusDiv = document.getElementById('extractionStatus');

  if (!extractBtn || !statusDiv) return;

  extractBtn.addEventListener('click', () => {
    handleExtractClick(extractBtn, statusDiv);
  });
}

/**
 * Handle extract button click
 * Coordinates the full extraction and logging workflow
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 */
function handleExtractClick(button, statusDiv) {
  // Set button to loading state
  setButtonLoading(button, 'Extracting...');
  clearStatus(statusDiv);

  // Step 1: Query active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab) {
      handleExtractError(button, statusDiv, 'No active tab found. Please make sure you have a tab open.');
      return;
    }

    // Check if tab URL is accessible
    if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
      handleExtractError(button, statusDiv, 'Cannot extract from this page. Chrome extension pages and settings are not supported.');
      return;
    }

    // Step 2: Request extraction from content script
    chrome.tabs.sendMessage(
      activeTab.id,
      { action: 'extractJobData' },
      (response) => {
        if (chrome.runtime.lastError) {
          // Handle the common "Receiving end does not exist" error
          const errorMsg = chrome.runtime.lastError.message;

          if (errorMsg.includes('Receiving end does not exist')) {
            handleExtractError(
              button,
              statusDiv,
              'Please reload the page and try again. The extension needs to reinitialize.'
            );
          } else if (errorMsg.includes('Cannot access')) {
            handleExtractError(
              button,
              statusDiv,
              'Cannot access this page. Please make sure you are on a job posting page.'
            );
          } else {
            handleExtractError(button, statusDiv, `Error: ${errorMsg}`);
          }
          return;
        }

        if (!response?.success) {
          handleExtractError(button, statusDiv, 'Failed to extract job data from page');
          return;
        }

        // Step 3: Send extracted data to service worker for logging
        logJobData(button, statusDiv, response.data);
      }
    );
  });
}

/**
 * Log extracted job data via service worker
 * Checks if manual entry is needed before logging
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Extracted job data
 */
function logJobData(button, statusDiv, jobData) {
  // Check if manual entry is enabled and if data is missing
  chrome.runtime.sendMessage({ action: 'getConfig' }, (configResponse) => {
    const isManualEntryEnabled = configResponse?.config?.ENABLE_MANUAL_ENTRY !== false;
    const hasMissingData = isMissingRequiredData(jobData);

    if (isManualEntryEnabled && hasMissingData) {
      // Show manual entry modal
      showManualEntryModal(button, statusDiv, jobData);
    } else {
      // Proceed with logging directly
      submitJobData(button, statusDiv, jobData);
    }
  });
}

/**
 * Submit job data to service worker for logging
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Job data to submit
 */
function submitJobData(button, statusDiv, jobData) {
  chrome.runtime.sendMessage(
    { action: 'logJobData', data: jobData },
    (logResponse) => {
      if (logResponse?.success) {
        showStatus(statusDiv, 'success', '✓ Job data logged successfully!');
      } else {
        const errorMsg = logResponse?.error || 'Unknown error occurred';
        showStatus(statusDiv, 'error', `✗ Failed to log data: ${errorMsg}`);
      }
      resetExtractButton(button);
    }
  );
}

/**
 * Check if job data is missing required fields
 * @param {Object} jobData - Job data to check
 * @returns {boolean} True if missing required data
 */
function isMissingRequiredData(jobData) {
  const title = (jobData.title || '').trim();
  const company = (jobData.company || '').trim();

  // Consider data missing if title or company is empty or placeholder
  return !title || !company ||
         title === '(No title)' ||
         company === '(No company)';
}

/**
 * Handle extraction errors with consistent formatting
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {string} message - Error message to display
 */
function handleExtractError(button, statusDiv, message) {
  showStatus(statusDiv, 'error', `✗ ${message}`);
  resetExtractButton(button);
}

/**
 * Reset extract button to default state
 * @param {HTMLButtonElement} button - Extract button element
 */
function resetExtractButton(button) {
  button.disabled = false;
  button.textContent = 'Extract & Log Job Data';
}

// ============ AUTOFILL ============

/**
 * Initialize semi-supervised autofill feature
 * Sets up the autofill button to start form-filling process on the current page
 * The autofill process runs in the content script and shows modal dialogs for user approval
 */
function initializeAutofill() {
  const autofillBtn = document.getElementById('autofillBtn');
  const statusDiv = document.getElementById('autofillStatus');

  if (!autofillBtn || !statusDiv) return;

  autofillBtn.addEventListener('click', () => {
    handleAutofillClick(autofillBtn, statusDiv);
  });
}

/**
 * Handle autofill button click
 * Triggers the autofill process on the active page
 * @param {HTMLButtonElement} button - Autofill button element
 * @param {HTMLElement} statusDiv - Status message display element
 */
function handleAutofillClick(button, statusDiv) {
  // Set button to loading state
  setButtonLoading(button, 'Starting...');
  showStatus(statusDiv, 'info', 'ℹ Autofill process started. Check the page for prompts.');

  // Query active tab and send autofill command
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab) {
      handleAutofillError(button, statusDiv, 'No active tab found');
      return;
    }

    // Send autofill command to content script
    chrome.tabs.sendMessage(
      activeTab.id,
      { action: 'startAutofill' },
      (response) => {
        if (chrome.runtime.lastError) {
          handleAutofillError(button, statusDiv, `Could not access page: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (response?.success) {
          showStatus(statusDiv, 'success', '✓ Autofill started! Answer prompts on the page.');
        } else {
          handleAutofillError(button, statusDiv, 'Failed to start autofill process');
        }

        // Reset button after short delay
        setTimeout(() => resetAutofillButton(button), 2000);
      }
    );
  });
}

/**
 * Handle autofill errors with consistent formatting
 * @param {HTMLButtonElement} button - Autofill button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {string} message - Error message to display
 */
function handleAutofillError(button, statusDiv, message) {
  showStatus(statusDiv, 'error', `✗ ${message}`);
  resetAutofillButton(button);
}

/**
 * Reset autofill button to default state
 * @param {HTMLButtonElement} button - Autofill button element
 */
function resetAutofillButton(button) {
  button.disabled = false;
  button.textContent = 'Start Autofill';
}

// ============ SETTINGS ============

/**
 * Initialize settings link
 * Opens the settings page in a new tab
 */
function initializeSettings() {
  const settingsLink = document.getElementById('settingsLink');
  if (!settingsLink) return;

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Open settings page in a new tab
    chrome.tabs.create({ url: 'settings.html' });
  });
}

// ============ MANUAL DATA ENTRY ============

/**
 * Initialize manual data entry modal event listeners
 */
function initializeManualEntryModal() {
  const modal = document.getElementById('manualEntryModal');
  const closeBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelModal');
  const form = document.getElementById('manualEntryForm');

  if (!modal || !closeBtn || !cancelBtn || !form) return;

  // Close modal on X button
  closeBtn.addEventListener('click', () => {
    hideManualEntryModal();
  });

  // Close modal on Cancel button
  cancelBtn.addEventListener('click', () => {
    hideManualEntryModal();
  });

  // Close modal on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideManualEntryModal();
    }
  });

  // Handle form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleManualEntrySubmit();
  });
}

/**
 * Show manual entry modal with pre-filled data
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Extracted job data to pre-fill
 */
function showManualEntryModal(button, statusDiv, jobData) {
  const modal = document.getElementById('manualEntryModal');
  if (!modal) return;

  // Store references for later use
  modal.dataset.button = 'extractBtn';
  modal.dataset.status = 'extractionStatus';

  // Pre-fill form fields with extracted data
  document.getElementById('manualJobTitle').value = jobData.title || '';
  document.getElementById('manualCompany').value = jobData.company || '';
  document.getElementById('manualLocation').value = jobData.location || '';
  document.getElementById('manualUrl').value = jobData.url || '';

  // Store the full job data for later
  modal.dataset.jobData = JSON.stringify(jobData);

  // Show the modal
  modal.style.display = 'flex';

  // Reset button state
  resetExtractButton(button);
}

/**
 * Hide manual entry modal
 */
function hideManualEntryModal() {
  const modal = document.getElementById('manualEntryModal');
  if (!modal) return;

  modal.style.display = 'none';

  // Clear form
  document.getElementById('manualEntryForm').reset();
}

/**
 * Handle manual entry form submission
 */
function handleManualEntrySubmit() {
  const modal = document.getElementById('manualEntryModal');
  const button = document.getElementById(modal.dataset.button);
  const statusDiv = document.getElementById(modal.dataset.status);

  // Get form values
  const manualData = {
    title: document.getElementById('manualJobTitle').value.trim(),
    company: document.getElementById('manualCompany').value.trim(),
    location: document.getElementById('manualLocation').value.trim(),
    url: document.getElementById('manualUrl').value.trim()
  };

  // Get original job data to preserve other fields
  const originalData = JSON.parse(modal.dataset.jobData || '{}');

  // Merge manual data with original data
  const finalData = {
    ...originalData,
    ...manualData
  };

  // Hide modal
  hideManualEntryModal();

  // Submit the data
  submitJobData(button, statusDiv, finalData);
}

// ============ UTILITY FUNCTIONS ============

/**
 * Display status message with type-based styling
 * @param {HTMLElement} element - Status display element
 * @param {string} type - Message type: 'success', 'error', or 'info'
 * @param {string} message - Message text to display
 */
function showStatus(element, type, message) {
  element.className = `status-message ${type}`;
  element.textContent = message;
}

/**
 * Clear status message
 * @param {HTMLElement} element - Status display element
 */
function clearStatus(element) {
  element.className = 'status-message';
  element.textContent = '';
}

/**
 * Set button to loading state
 * @param {HTMLButtonElement} button - Button element
 * @param {string} text - Loading text to display
 */
function setButtonLoading(button, text) {
  button.disabled = true;
  button.textContent = text;
}

/**
 * Display error message using alert (for critical errors)
 * Uses consistent error format: "✗ message"
 * @param {string} message - Error message to display
 */
function showError(message) {
  alert(`✗ ${message}`);
}

/**
 * Display success message using alert
 * Uses consistent success format: "✓ message"
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
  // For clipboard, we could use a less intrusive notification
  // But for now, using console.log for success (popup closes anyway)
  console.log(`✓ ${message}`);
}
