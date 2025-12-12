/**
 * JobSprint Popup Script
 * Handles user interactions in the popup UI
 * Features: Clipboard macros, job data extraction, autofill
 */

// Listen for messages from content scripts and service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autofillLog') {
    // Add autofill log to debug console
    const { log } = message;
    addConsoleLog(log.level, `[Tab ${log.tabId}] ${log.message}`, log.data);
    sendResponse({ success: true });
  } else if (message.action === 'autofillStateChange') {
    // Update autofill status display
    updateAutofillStatus(message.state, message.progress);
    sendResponse({ success: true });
  } else if (message.action === 'recordLog') {
    // Add record mode log to debug console
    const { log } = message;
    addConsoleLog(log.level, `[Record] ${log.message}`, log.data);
    sendResponse({ success: true });
  } else if (message.action === 'recordStatusChange') {
    // Update record mode status display
    updateRecordStatus(message.status, message.count);
    sendResponse({ success: true });
  }
  return false; // Synchronous
});

// Initialize all popup features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeDebugConsole();
  log('JobSprint Popup loaded');

  initializeClipboardMacros();
  initializeExtraction();
  initializeAutofill();
  initializeSettings();
  initializeManualEntryModal();

  // Restore UI state from last session
  restoreUIState();
});

// ============ DEBUG CONSOLE ============

let debugConsoleEnabled = false;
const debugLogs = [];
const MAX_LOGS = 100;
let consoleHeight = 200; // Default height in pixels

/**
 * Initialize debug console
 * Loads settings and sets up UI
 */
function initializeDebugConsole() {
  // Load debug console settings
  chrome.storage.sync.get(['debugConsoleEnabled', 'consoleHeight'], (result) => {
    debugConsoleEnabled = result.debugConsoleEnabled || false;
    consoleHeight = result.consoleHeight || 200;

    updateDebugConsoleVisibility();
  });

  // Set up clear button
  const clearBtn = document.getElementById('clearConsoleBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearDebugConsole);
  }

  // Set up toggle button
  const toggleBtn = document.getElementById('toggleConsoleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleDebugConsole);
  }

  // Set up resize handle
  initializeConsoleResize();
}

/**
 * Initialize console resize functionality
 */
function initializeConsoleResize() {
  const resizeHandle = document.getElementById('consoleResizeHandle');
  const consolePanel = document.getElementById('debugConsole');

  if (!resizeHandle || !consolePanel) return;

  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = consolePanel.offsetHeight;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaY = startY - e.clientY; // Inverted because we're dragging top edge
    const newHeight = Math.min(Math.max(startHeight + deltaY, 50), 400); // Min 50px, max 400px

    consolePanel.style.height = newHeight + 'px';
    consoleHeight = newHeight;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      // Save the new height to storage
      chrome.storage.sync.set({ consoleHeight });
    }
  });
}

/**
 * Log a message to debug console
 * @param {string} message - Message to log
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = { timestamp, message, type: 'log' };

  debugLogs.push(logEntry);
  if (debugLogs.length > MAX_LOGS) {
    debugLogs.shift();
  }

  // Always try to append if console is enabled (don't wait for flag)
  if (debugConsoleEnabled) {
    appendToConsole(logEntry);
  }
}

/**
 * Log an error to debug console
 * @param {string} message - Error message to log
 */
function logError(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = { timestamp, message, type: 'error' };

  debugLogs.push(logEntry);
  if (debugLogs.length > MAX_LOGS) {
    debugLogs.shift();
  }

  // Always try to append if console is enabled (don't wait for flag)
  if (debugConsoleEnabled) {
    appendToConsole(logEntry);
  }
}

/**
 * Add a log entry to debug console with custom level
 * @param {string} level - Log level (info, warn, error, success)
 * @param {string} message - Log message
 * @param {any} data - Optional data to log
 */
function addConsoleLog(level, message, data) {
  const timestamp = new Date().toLocaleTimeString();

  // Map level to console type
  const typeMap = {
    'info': 'log',
    'success': 'log',
    'warn': 'warn',
    'error': 'error'
  };
  const type = typeMap[level] || 'log';

  // Format message with data if provided
  let fullMessage = message;
  if (data) {
    try {
      fullMessage += ' ' + JSON.stringify(data);
    } catch (e) {
      fullMessage += ' [data]';
    }
  }

  const logEntry = { timestamp, message: fullMessage, type };

  debugLogs.push(logEntry);
  if (debugLogs.length > MAX_LOGS) {
    debugLogs.shift();
  }

  // Always try to append if console is enabled
  if (debugConsoleEnabled) {
    appendToConsole(logEntry);
  }
}

/**
 * Append log entry to console UI
 * @param {Object} entry - Log entry
 */
function appendToConsole(entry) {
  const consoleOutput = document.getElementById('consoleOutput');
  if (!consoleOutput) return;

  const logLine = document.createElement('div');
  logLine.className = `console-line console-${entry.type}`;
  logLine.textContent = `[${entry.timestamp}] ${entry.message}`;

  consoleOutput.appendChild(logLine);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

/**
 * Clear debug console
 */
function clearDebugConsole() {
  debugLogs.length = 0;
  const consoleOutput = document.getElementById('consoleOutput');
  if (consoleOutput) {
    consoleOutput.innerHTML = '';
  }
  log('Console cleared');
}

/**
 * Toggle debug console visibility
 */
function toggleDebugConsole() {
  const consolePanel = document.getElementById('debugConsole');
  if (consolePanel) {
    const isVisible = consolePanel.style.display !== 'none';
    consolePanel.style.display = isVisible ? 'none' : 'block';
  }
}

/**
 * Update debug console visibility based on settings
 */
function updateDebugConsoleVisibility() {
  const consolePanel = document.getElementById('debugConsole');
  if (consolePanel) {
    consolePanel.style.display = debugConsoleEnabled ? 'block' : 'none';
    consolePanel.style.height = consoleHeight + 'px';

    // Render all existing logs if enabling
    if (debugConsoleEnabled) {
      const consoleOutput = document.getElementById('consoleOutput');
      if (consoleOutput) {
        consoleOutput.innerHTML = '';
        debugLogs.forEach(entry => appendToConsole(entry));
      }
    }
  }
}

// ============ CLIPBOARD MACROS ============

/**
 * Check if value is a plain object (not array, not null)
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a plain object
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
let navigationPath = []; // Track path for nested navigation
let currentData = null; // Current folder data being displayed

// Search cache
let searchIndex = null;
let maxSearchResults = 10; // Default, will be loaded from settings

/**
 * Initialize clipboard macro folder navigation
 * Sets up click handlers for folder buttons and navigation
 */
function initializeClipboardMacros() {
  // Set up folder button click handlers
  const folderButtons = document.querySelectorAll('.folder-btn');
  folderButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const folder = button.getAttribute('data-folder');
      log(`[Clipboard] Opening folder: ${folder}`);
      openFolder(folder);
    });
  });

  // Set up back button
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', closeFolder);
  }

  // Set up sub-menu settings link
  const subMenuSettingsLink = document.getElementById('subMenuSettingsLink');
  if (subMenuSettingsLink) {
    subMenuSettingsLink.addEventListener('click', async (e) => {
      e.preventDefault();
      // Open settings page in a new tab next to the source tab
      const sourceTab = await getSourceTab();
      if (sourceTab) {
        // Store the original tab ID so settings can return to it
        chrome.storage.local.set({ settingsOriginTabId: sourceTab.id }, () => {
          chrome.tabs.create({
            url: 'settings.html',
            index: sourceTab.index + 1  // Open right next to source tab
          });
        });
      } else {
        chrome.tabs.create({ url: 'settings.html' });
      }
    });
  }

  // Initialize search
  initializeSearch();
}

/**
 * Open a folder and show its items
 * @param {string} folder - Folder name (demographics, references, etc.)
 */
function openFolder(folder) {
  if (!folder) return;

  currentFolder = folder;
  navigationPath = [folder]; // Reset navigation to top level

  // Save UI state
  saveUIState();

  // Get folder data from storage
  chrome.runtime.sendMessage(
    { action: 'getClipboardFolder', folder },
    (response) => {
      if (chrome.runtime.lastError) {
        logError('[Clipboard] Runtime error: ' + chrome.runtime.lastError.message);
        showError('Failed to communicate with extension');
        return;
      }

      if (!response || !response.success) {
        logError('[Clipboard] Failed to load folder items');
        showError('Failed to load folder items');
        return;
      }

      log(`[Clipboard] Loaded ${Object.keys(response.items || {}).length} items from ${folder}`);

      currentData = response.items || {};

      // Show sub-menu and hide folder view
      const folderView = document.getElementById('folderView');
      const subMenuView = document.getElementById('subMenuView');

      if (folderView) folderView.style.display = 'none';
      if (subMenuView) subMenuView.style.display = 'block';

      // Hide other feature sections
      hideOtherSections();

      // Update sub-menu title
      updateSubMenuTitle();

      // Render items
      renderSubMenuItems(currentData);
    }
  );
}

/**
 * Open a nested folder (navigate deeper)
 * @param {string} key - Item key
 * @param {Object} value - Nested object
 */
function openNestedFolder(key, value) {
  log(`[Clipboard] Opening nested folder: ${key}`);

  navigationPath.push(key);
  currentData = value;

  // Save UI state to persist navigation
  saveUIState();

  // Update title and render new level
  updateSubMenuTitle();
  renderSubMenuItems(currentData);
}

/**
 * Update sub-menu title with navigation breadcrumbs
 */
function updateSubMenuTitle() {
  const subMenuTitle = document.getElementById('subMenuTitle');
  if (subMenuTitle) {
    // Build breadcrumb path
    const breadcrumbs = navigationPath.map((pathItem, index) => {
      if (index === 0) {
        return FOLDER_TITLES[pathItem] || pathItem;
      }
      return pathItem.charAt(0).toUpperCase() + pathItem.slice(1);
    });
    subMenuTitle.textContent = breadcrumbs.join(' → ');
  }
}

/**
 * Close folder and return to main view or go back one level
 */
function closeFolder() {
  // If we're nested, go back one level
  if (navigationPath.length > 1) {
    log(`[Clipboard] Going back one level`);
    navigationPath.pop();

    // Save UI state after going back
    saveUIState();

    // Navigate back to parent
    // We need to traverse from root to get the parent data
    chrome.runtime.sendMessage(
      { action: 'getClipboardFolder', folder: navigationPath[0] },
      (response) => {
        if (response && response.success) {
          let data = response.items || {};

          // Traverse to current level
          for (let i = 1; i < navigationPath.length; i++) {
            data = data[navigationPath[i]];
          }

          currentData = data;
          updateSubMenuTitle();
          renderSubMenuItems(currentData);
        }
      }
    );
    return;
  }

  // Otherwise, return to main folder view
  currentFolder = null;
  navigationPath = [];
  currentData = null;

  // Clear saved UI state
  saveUIState();

  // Show folder view and hide sub-menu
  const folderView = document.getElementById('folderView');
  const subMenuView = document.getElementById('subMenuView');

  if (folderView) folderView.style.display = 'grid';
  if (subMenuView) subMenuView.style.display = 'none';

  // Show other feature sections
  showOtherSections();
}

/**
 * Save current UI state to chrome.storage.local
 * Allows restoring the user's location in the UI when popup reopens
 */
function saveUIState() {
  const state = {
    currentFolder,
    navigationPath,
    timestamp: Date.now()
  };
  chrome.storage.local.set({ jobsprint_ui_state: state }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to save UI state:', chrome.runtime.lastError);
    }
  });
}

/**
 * Restore UI state from chrome.storage.local
 * Reopens the last viewed folder if user was browsing clipboard macros
 */
function restoreUIState() {
  chrome.storage.local.get(['jobsprint_ui_state'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to restore UI state:', chrome.runtime.lastError);
      return;
    }

    const state = result.jobsprint_ui_state;
    if (!state) return;

    // Only restore if state is recent (within 5 minutes)
    const age = Date.now() - (state.timestamp || 0);
    if (age > 5 * 60 * 1000) {
      chrome.storage.local.remove('jobsprint_ui_state');
      return;
    }

    // Restore folder view if user was in a folder
    if (state.currentFolder) {
      log(`[UI] Restoring state: ${state.currentFolder}, path: ${JSON.stringify(state.navigationPath)}`);

      // Delay to ensure DOM is ready
      setTimeout(() => {
        // Get folder data and restore full navigation path
        chrome.runtime.sendMessage(
          { action: 'getClipboardFolder', folder: state.currentFolder },
          (response) => {
            if (!response || !response.success) {
              log('[UI] Failed to restore folder data');
              return;
            }

            // Set the current folder and navigation state
            currentFolder = state.currentFolder;
            navigationPath = state.navigationPath || [state.currentFolder];

            // Traverse to the saved nested location
            let data = response.items || {};
            for (let i = 1; i < navigationPath.length; i++) {
              if (data[navigationPath[i]] && typeof data[navigationPath[i]] === 'object') {
                data = data[navigationPath[i]];
              } else {
                // Path no longer valid, reset to top level
                navigationPath = [state.currentFolder];
                data = response.items || {};
                break;
              }
            }

            currentData = data;

            // Update the UI
            const folderView = document.getElementById('folderView');
            const subMenuView = document.getElementById('subMenuView');

            if (folderView) folderView.style.display = 'none';
            if (subMenuView) subMenuView.style.display = 'block';

            // Hide other feature sections
            hideOtherSections();

            // Update title and render items
            updateSubMenuTitle();
            renderSubMenuItems(currentData);

            log(`[UI] State restored successfully to: ${navigationPath.join(' → ')}`);
          }
        );
      }, 100);
    }
  });
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
    // Skip empty or invalid values
    if (!value || (typeof value === 'string' && value.trim() === '')) return;

    const isFolder = isPlainObject(value);

    if (isFolder) {
      // Folder item - render with main button + copy button
      const itemContainer = document.createElement('div');
      itemContainer.className = 'sub-menu-item-container';

      // Create main folder button
      const button = document.createElement('button');
      button.className = 'sub-menu-item-btn folder-item';
      button.textContent = formatItemLabel(key, value);
      button.title = 'Click to open nested folder';

      // Clicking folder button opens nested folder
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        openNestedFolder(key, value);
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
        handleItemClick(key, value, copyButton);
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
        handleItemClick(key, value, button);
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

  // If value is an object (nested), show folder icon and count
  if (isPlainObject(value)) {
    const itemCount = Object.keys(value).length;
    return `📁 ${label} (${itemCount} items)`;
  }

  // For regular items, just show the label
  return label;
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
  if (isPlainObject(value)) {
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
      } else if (isPlainObject(val)) {
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
 * @param {HTMLElement} buttonElement - Button that was clicked (for visual feedback)
 */
async function handleItemClick(key, value, buttonElement) {
  // Verbalize the value (converts objects to readable text, keeps strings as-is)
  const textToCopy = verbalizeValue(value);

  try {
    // Copy to clipboard using Clipboard API
    await navigator.clipboard.writeText(textToCopy);
    log(`[Clipboard] Copied: ${key}`);

    // Show visual feedback on the button itself
    showButtonCopyFeedback(buttonElement);
  } catch (error) {
    logError('[Clipboard] Failed to copy: ' + error.message);
    showError('Failed to copy to clipboard');
  }
}

/**
 * Show copy success feedback on the button itself
 * Changes button color and text temporarily
 * @param {HTMLElement} button - Button element to update
 */
function showButtonCopyFeedback(button) {
  if (!button) return;

  // Save original state
  const originalText = button.innerHTML;
  const originalClass = button.className;
  const originalDisabled = button.disabled;

  // Update button appearance
  button.innerHTML = '✓ Copied!';
  button.className = originalClass + ' copied';
  button.disabled = true;
  button.style.backgroundColor = '#28a745';
  button.style.color = 'white';

  // Restore after 2 seconds
  setTimeout(() => {
    button.innerHTML = originalText;
    button.className = originalClass;
    button.disabled = originalDisabled;
    button.style.backgroundColor = '';
    button.style.color = '';
  }, 2000);
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
  } else if (isPlainObject(value)) {
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
    log(`[Clipboard] Copied search result: ${result.displayPath}`);

    // Visual feedback
    const searchInput = document.getElementById('clipboardSearch');
    const originalPlaceholder = searchInput.placeholder;
    searchInput.placeholder = '✓ Copied!';
    setTimeout(() => {
      searchInput.placeholder = originalPlaceholder;
    }, 1500);
  } catch (error) {
    logError(`[Clipboard] Failed to copy: ${error.message}`);
    showError('Failed to copy to clipboard');
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
 * Get the source tab that the popup was opened from
 * When popup is detached, we need to track the original tab explicitly
 * @returns {Promise<chrome.tabs.Tab|null>} The source tab or null
 */
async function getSourceTab() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['popupSourceTabId'], async (result) => {
      const tabId = result.popupSourceTabId;
      if (!tabId) {
        log('[Tab] No source tab ID found in storage');
        resolve(null);
        return;
      }

      try {
        const tab = await chrome.tabs.get(tabId);
        log(`[Tab] Source tab found: ${tab.url}`);
        resolve(tab);
      } catch (error) {
        logError(`[Tab] Source tab ${tabId} no longer exists: ${error.message}`);
        resolve(null);
      }
    });
  });
}

// Rate limiting for extract button (prevent accidental spam)
let lastExtractTime = 0;
const EXTRACT_COOLDOWN_MS = 2000; // 2 seconds

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
 * Includes rate limiting to prevent accidental spam to Apps Script
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 */
async function handleExtractClick(button, statusDiv) {
  // Log the action
  log('[Extract] Job data extraction initiated');

  // Rate limiting check
  const now = Date.now();
  if (now - lastExtractTime < EXTRACT_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((EXTRACT_COOLDOWN_MS - (now - lastExtractTime)) / 1000);
    showStatus(statusDiv, 'info', `ℹ Please wait ${remainingSeconds}s before extracting again`);
    log(`[Extract] Rate limited - ${remainingSeconds}s remaining`);
    return;
  }
  lastExtractTime = now;

  // Immediate button feedback - show loading state right away
  setButtonLoading(button, 'Extracting...');
  // Show immediate status feedback
  showStatus(statusDiv, 'info', 'ℹ Extracting job data from page...');
  log('[Extract] Getting source tab...');

  // Step 1: Get the source tab (the tab that was active when popup was opened)
  const activeTab = await getSourceTab();
  if (!activeTab) {
    logError('[Extract] No source tab found');
    handleExtractError(button, statusDiv, 'No active tab found. Please reopen the popup from the job page.');
    return;
  }

  log(`[Extract] Source tab found: ${activeTab.url}`);

  // Check if tab URL is accessible
  if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
    logError(`[Extract] Invalid tab URL: ${activeTab.url}`);
    handleExtractError(button, statusDiv, 'Cannot extract from this page. Chrome extension pages and settings are not supported.');
    return;
  }

  log('[Extract] Sending extraction request to content script...');

  // Step 2: Request extraction from content script
  chrome.tabs.sendMessage(
    activeTab.id,
    { action: 'extractJobData' },
    (response) => {
      if (chrome.runtime.lastError) {
        // Handle the common "Receiving end does not exist" error
        const errorMsg = chrome.runtime.lastError.message;
        logError(`[Extract] Runtime error: ${errorMsg}`);

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
        logError('[Extract] Content script returned failure');
        handleExtractError(button, statusDiv, 'Failed to extract job data from page');
        return;
      }

      log(`[Extract] Data extracted: ${JSON.stringify(response.data)}`);

      // Step 3: Send extracted data to service worker for logging
      logJobData(button, statusDiv, response.data);
    }
  );
}

/**
 * Log extracted job data via service worker
 * Checks if manual entry is needed before logging
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Extracted job data
 */
function logJobData(button, statusDiv, jobData) {
  log('[Extract] Checking if manual entry needed...');

  // Check if manual entry is enabled and if data is missing
  chrome.runtime.sendMessage({ action: 'getConfig' }, (configResponse) => {
    const isManualEntryEnabled = configResponse?.config?.ENABLE_MANUAL_ENTRY !== false;
    const hasMissingData = isMissingRequiredData(jobData);

    log(`[Extract] Manual entry enabled: ${isManualEntryEnabled}, Missing data: ${hasMissingData}`);

    if (isManualEntryEnabled && hasMissingData) {
      log('[Extract] Showing manual entry modal');
      // Show manual entry modal
      showManualEntryModal(button, statusDiv, jobData);
    } else {
      log('[Extract] Proceeding with automatic submission');
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
  log('[Extract] Submitting job data to service worker...');
  showStatus(statusDiv, 'info', 'ℹ Logging to Google Sheets...');

  chrome.runtime.sendMessage(
    { action: 'logJobData', data: jobData },
    (logResponse) => {
      if (logResponse?.success) {
        log('[Extract] Job data logged successfully');
        showStatus(statusDiv, 'success', '✓ Job data logged successfully!');
      } else {
        const errorMsg = logResponse?.error || 'Unknown error occurred';
        logError(`[Extract] Failed to log: ${errorMsg}`);
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
  const recordBtn = document.getElementById('recordBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  const statusDiv = document.getElementById('autofillStatus');
  const playbackModeBtn = document.getElementById('playbackModeBtn');
  const recordModeBtn = document.getElementById('recordModeBtn');

  if (!autofillBtn || !statusDiv) return;

  // Mode toggle handlers
  playbackModeBtn?.addEventListener('click', () => {
    switchToPlaybackMode();
  });

  recordModeBtn?.addEventListener('click', () => {
    switchToRecordMode();
  });

  // Playback mode button
  autofillBtn.addEventListener('click', () => {
    handleAutofillClick(autofillBtn, statusDiv);
  });

  // Record mode buttons
  recordBtn?.addEventListener('click', () => {
    handleRecordClick(recordBtn, stopRecordBtn, statusDiv);
  });

  stopRecordBtn?.addEventListener('click', () => {
    handleStopRecordClick(recordBtn, stopRecordBtn, statusDiv);
  });
}

/**
 * Switch to Playback Mode
 */
function switchToPlaybackMode() {
  // Update button states
  document.getElementById('playbackModeBtn')?.classList.add('active');
  document.getElementById('recordModeBtn')?.classList.remove('active');

  // Show/hide descriptions
  document.getElementById('playbackModeDesc').style.display = 'block';
  document.getElementById('recordModeDesc').style.display = 'none';

  // Show/hide action buttons
  document.getElementById('playbackActions').style.display = 'block';
  document.getElementById('recordActions').style.display = 'none';

  // Clear status
  const statusDiv = document.getElementById('autofillStatus');
  if (statusDiv) statusDiv.textContent = '';
}

/**
 * Switch to Record Mode
 */
function switchToRecordMode() {
  // Update button states
  document.getElementById('recordModeBtn')?.classList.add('active');
  document.getElementById('playbackModeBtn')?.classList.remove('active');

  // Show/hide descriptions
  document.getElementById('recordModeDesc').style.display = 'block';
  document.getElementById('playbackModeDesc').style.display = 'none';

  // Show/hide action buttons
  document.getElementById('recordActions').style.display = 'block';
  document.getElementById('playbackActions').style.display = 'none';

  // Clear status
  const statusDiv = document.getElementById('autofillStatus');
  if (statusDiv) statusDiv.textContent = '';
}

/**
 * Handle Record button click
 */
async function handleRecordClick(recordBtn, stopBtn, statusDiv) {
  setButtonLoading(recordBtn, 'Starting...');
  showStatus(statusDiv, 'info', 'ℹ Starting record mode...');

  const activeTab = await getSourceTab();
  if (!activeTab) {
    showStatus(statusDiv, 'error', '✗ No active tab found');
    resetButton(recordBtn, 'Start Recording');
    return;
  }

  chrome.tabs.sendMessage(
    activeTab.id,
    { action: 'startRecordMode' },
    (response) => {
      if (chrome.runtime.lastError) {
        showStatus(statusDiv, 'error', `✗ ${chrome.runtime.lastError.message}`);
        resetButton(recordBtn, 'Start Recording');
        return;
      }

      if (response?.success) {
        showStatus(statusDiv, 'success', '⏺ Recording... Fill out the form normally.');
        recordBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        addConsoleLog('success', 'Record mode started');
      } else {
        showStatus(statusDiv, 'error', '✗ Failed to start recording');
        resetButton(recordBtn, 'Start Recording');
      }
    }
  );
}

/**
 * Handle Stop Record button click
 */
async function handleStopRecordClick(recordBtn, stopBtn, statusDiv) {
  setButtonLoading(stopBtn, 'Saving...');
  showStatus(statusDiv, 'info', 'ℹ Stopping and saving...');

  const activeTab = await getSourceTab();
  if (!activeTab) {
    showStatus(statusDiv, 'error', '✗ No active tab found');
    return;
  }

  chrome.tabs.sendMessage(
    activeTab.id,
    { action: 'stopRecordMode' },
    (response) => {
      if (chrome.runtime.lastError) {
        showStatus(statusDiv, 'error', `✗ ${chrome.runtime.lastError.message}`);
        return;
      }

      if (response?.success) {
        const count = response.count || 0;
        showStatus(statusDiv, 'success', `✓ Saved ${count} Q&A pair${count !== 1 ? 's' : ''}!`);
        addConsoleLog('success', `Record mode stopped - saved ${count} Q&A pairs`);
        stopBtn.style.display = 'none';
        resetButton(recordBtn, 'Start Recording');
        recordBtn.style.display = 'block';
      } else {
        showStatus(statusDiv, 'error', '✗ Failed to stop recording');
      }
    }
  );
}

/**
 * Update recording status from content script
 */
function updateRecordStatus(status, count) {
  const statusDiv = document.getElementById('autofillStatus');
  if (!statusDiv) return;

  switch (status) {
    case 'recording':
      showStatus(statusDiv, 'info', `⏺ Recording: ${count} Q&A pair${count !== 1 ? 's' : ''} captured`);
      break;
    case 'paused':
      showStatus(statusDiv, 'warn', `⏸ Recording paused: ${count} Q&A pair${count !== 1 ? 's' : ''}`);
      break;
    case 'stopped':
      break; // Handled by handleStopRecordClick
  }
}

/**
 * Update autofill status based on state changes
 * Called when autofill state changes are received from content script
 * @param {string} state - Autofill state (running, paused, completed, etc.)
 * @param {Object} progress - Progress information (current, total, processed, skipped)
 */
function updateAutofillStatus(state, progress) {
  const statusDiv = document.getElementById('autofillStatus');
  if (!statusDiv) return;

  const { current, total, processed, skipped } = progress || {};

  switch (state) {
    case 'scanning':
      showStatus(statusDiv, 'info', '🔍 Scanning page for form inputs...');
      addConsoleLog('info', 'Autofill: Scanning page');
      break;

    case 'running':
      const progressText = total ? ` (${current}/${total})` : '';
      showStatus(statusDiv, 'info', `🤖 Processing inputs${progressText}...`);
      addConsoleLog('info', `Autofill running: ${current}/${total} inputs`);
      break;

    case 'waiting_user':
      showStatus(statusDiv, 'warn', '⏸ Waiting for user approval...');
      break;

    case 'paused':
      const pausedText = total ? ` (Paused at ${current}/${total})` : '';
      showStatus(statusDiv, 'warn', `⏸ Autofill paused${pausedText}`);
      addConsoleLog('warn', `Autofill paused at input ${current}/${total}`);
      break;

    case 'completed':
      const summary = processed !== undefined && skipped !== undefined
        ? ` (Filled: ${processed}, Skipped: ${skipped})`
        : '';
      showStatus(statusDiv, 'success', `✅ Autofill completed!${summary}`);
      addConsoleLog('success', `Autofill completed: ${processed} filled, ${skipped} skipped out of ${total} total`);
      break;

    case 'error':
      showStatus(statusDiv, 'error', '❌ Autofill error occurred');
      addConsoleLog('error', 'Autofill encountered an error');
      break;

    default:
      break;
  }
}

/**
 * Handle autofill button click
 * Triggers the autofill process on the active page
 * @param {HTMLButtonElement} button - Autofill button element
 * @param {HTMLElement} statusDiv - Status message display element
 */
async function handleAutofillClick(button, statusDiv) {
  // Set button to loading state
  setButtonLoading(button, 'Starting...');
  showStatus(statusDiv, 'info', 'ℹ Autofill process started. Check the page for prompts.');

  // Get the source tab (the tab that was active when popup was opened)
  const activeTab = await getSourceTab();
  if (!activeTab) {
    handleAutofillError(button, statusDiv, 'No active tab found. Please reopen the popup from the job page.');
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

  settingsLink.addEventListener('click', async (e) => {
    e.preventDefault();
    // Open settings page in a new tab next to the source tab
    const sourceTab = await getSourceTab();
    if (sourceTab) {
      // Store the original tab ID so settings can return to it
      chrome.storage.local.set({ settingsOriginTabId: sourceTab.id }, () => {
        chrome.tabs.create({
          url: 'settings.html',
          index: sourceTab.index + 1  // Open right next to source tab
        });
      });
    } else {
      chrome.tabs.create({ url: 'settings.html' });
    }
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
  document.getElementById('manualRole').value = jobData.role || '';
  document.getElementById('manualTailor').value = jobData.tailor || '';
  document.getElementById('manualNotes').value = jobData.description || '';
  document.getElementById('manualCompensation').value = jobData.compensation || '';
  document.getElementById('manualPay').value = jobData.pay || '';
  document.getElementById('manualBoard').value = jobData.source || '';

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
    url: document.getElementById('manualUrl').value.trim(),
    role: document.getElementById('manualRole').value.trim(),
    tailor: document.getElementById('manualTailor').value.trim(),
    description: document.getElementById('manualNotes').value.trim(),
    compensation: document.getElementById('manualCompensation').value.trim(),
    pay: document.getElementById('manualPay').value.trim(),
    source: document.getElementById('manualBoard').value.trim()
  };

  // Get original job data to preserve other fields
  const originalData = JSON.parse(modal.dataset.jobData || '{}');

  // Merge manual data with original data (manual data overrides original)
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
 * Display success message
 * Uses consistent success format: "✓ message"
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
  log(`✓ ${message}`);
}
