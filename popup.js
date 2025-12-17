/**
 * JobSprint Popup Script
 * Handles user interactions in the popup UI
 * Features: Clipboard macros, job data extraction, autofill
 */

// Connection port for detecting popup closure
let contentScriptPort = null;

// Job data schema (loaded from storage)
let jobDataSchema = null;

// Initialize all popup features when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  initializeDebugConsole();
  log('JobSprint Popup loaded');

  // Load mode colors early
  await loadModeColors();

  // Apply colors to mode buttons after loading
  applyModeColorsToButtons();

  initializeClipboardMacros();
  initializeExtraction();
  initializeAutofill();
  initializeSettings();
  initializeManualEntryModal();
  initializeMouseTracking();

  // Restore UI state from last session
  restoreUIState();

  // Establish connection with content script for cleanup on popup close
  initializeContentScriptConnection();

  // Save extended UI state periodically to ensure it's captured before close
  setInterval(saveExtendedUIState, 1000);
});

// Listen for ping messages from content script (used to detect popup alive)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ alive: true });
    return false; // Synchronous response
  }
});

/**
 * Initialize connection with content script to detect popup closure
 * Sends keepalive messages to maintain connection and cleanup on disconnect
 */
async function initializeContentScriptConnection() {
  try {
    const sourceTab = await getSourceTab();
    if (!sourceTab) {
      log('[Connection] No source tab found, skipping connection init');
      return;
    }

    // Send a message to content script to establish connection
    chrome.tabs.sendMessage(
      sourceTab.id,
      { action: 'popupOpened' },
      (response) => {
        if (chrome.runtime.lastError) {
          log('[Connection] Could not connect to content script:', chrome.runtime.lastError.message);
        } else {
          log('[Connection] Connected to content script');
        }
      }
    );
  } catch (error) {
    log('[Connection] Error initializing connection:', error.message);
  }
}

/**
 * Save extended UI state including mouse tracking and modal state
 */
function saveExtendedUIState() {
  // Get the modal state
  const modal = document.getElementById('manualEntryModal');
  const isModalOpen = modal && modal.style.display === 'flex';

  // Save tracking state
  const state = {
    currentFolder,
    navigationPath,
    timestamp: Date.now(),
    // Extended state for restoration
    isModalOpen: isModalOpen,
    currentMode: currentMode  // Mode for mouse tracking
  };

  chrome.storage.local.set({ jobsprint_ui_state: state }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to save extended UI state:', chrome.runtime.lastError);
    }
  });
}

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
 * Also restores modal state and mouse tracking mode if they were active
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

    // Restore mouse tracking mode if it was saved
    if (state.currentMode) {
      currentMode = state.currentMode;
      log(`[UI] Restoring mouse tracking mode: ${currentMode}`);
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

    // Note: We don't automatically reopen the modal because the form state
    // is preserved by the browser, so the user's data is still there.
    // When they focus a field again, mouse tracking will start automatically.
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
  const manualEntryBtn = document.getElementById('manualEntryBtn');
  const statusDiv = document.getElementById('extractionStatus');

  if (!extractBtn || !statusDiv) return;

  extractBtn.addEventListener('click', () => {
    handleExtractClick(extractBtn, statusDiv);
  });

  if (manualEntryBtn) {
    manualEntryBtn.addEventListener('click', () => {
      handleManualEntryClick(manualEntryBtn, statusDiv);
    });
  }
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
 * Handle manual entry button click
 * Opens the manual entry modal directly without automatic extraction
 * @param {HTMLButtonElement} button - Manual entry button element
 * @param {HTMLElement} statusDiv - Status message display element
 */
async function handleManualEntryClick(button, statusDiv) {
  log('[ManualEntry] Manual entry button clicked');

  // Get the source tab
  const activeTab = await getSourceTab();
  if (!activeTab) {
    logError('[ManualEntry] No source tab found');
    showStatus(statusDiv, 'error', '✗ No active tab found. Please reopen the popup from the job page.');
    return;
  }

  log(`[ManualEntry] Source tab found: ${activeTab.url}`);

  // Check if tab URL is accessible
  if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
    logError(`[ManualEntry] Invalid tab URL: ${activeTab.url}`);
    showStatus(statusDiv, 'error', '✗ Cannot use this page. Chrome extension pages and settings are not supported.');
    return;
  }

  // Create minimal job data with just the URL
  const jobData = {
    url: activeTab.url,
    title: '',
    company: '',
    location: '',
    role: '',
    tailor: '',
    description: '',
    compensation: '',
    pay: '',
    source: ''
  };

  // Show manual entry modal
  showManualEntryModal(button, statusDiv, jobData);
  clearStatus(statusDiv);
}

/**
 * Log extracted job data via service worker
 * Simplified version - always submits directly (no manual entry check)
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Extracted job data
 */
function logJobData(button, statusDiv, jobData) {
  log('[Extract] Submitting simplified job data (URL + content)...');
  // Proceed with logging directly (no manual entry modal for automatic extraction)
  submitJobData(button, statusDiv, jobData);
}

/**
 * Submit job data to service worker for logging
 * @param {HTMLButtonElement} button - Extract button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Job data to submit
 * @param {boolean} fromModal - Whether this submission is from the manual entry modal
 */
function submitJobData(button, statusDiv, jobData, fromModal = false) {
  log('[Extract] Submitting job data to service worker...');
  showStatus(statusDiv, 'info', 'ℹ Logging to Google Sheets...');

  chrome.runtime.sendMessage(
    { action: 'logJobData', data: jobData },
    async (logResponse) => {
      if (logResponse?.success) {
        log('[Extract] Job data logged successfully');
        showStatus(statusDiv, 'success', '✓ Job data logged successfully!');

        // Close modal if submission was from modal
        if (fromModal) {
          hideManualEntryModal();
        }
      } else {
        const errorMsg = logResponse?.error || 'Unknown error occurred';
        logError(`[Extract] Failed to log: ${errorMsg}`);

        // If submission failed from modal, keep modal open and show error there
        if (fromModal) {
          const errorContainer = document.getElementById('manualEntryError');
          if (errorContainer) {
            errorContainer.innerHTML = await generateModalErrorMessage(errorMsg);
            errorContainer.style.display = 'block';
          }
        } else {
          showStatus(statusDiv, 'error', `✗ Failed to log data: ${errorMsg}`);
        }
      }
      resetExtractButton(button);
    }
  );
}

/**
 * Generate error message with links for modal display
 * @param {string} errorMsg - Error message from submission
 * @returns {Promise<string>} HTML error message with links
 */
async function generateModalErrorMessage(errorMsg) {
  // Get configuration to create links
  const config = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
      resolve(response?.config || {});
    });
  });

  const spreadsheetId = config.SPREADSHEET_ID || '';
  const appsScriptEditorUrl = config.APPS_SCRIPT_EDITOR_URL || '';

  let errorHtml = `<strong>✗ Submission Failed</strong>`;
  errorHtml += `<div style="margin-top: 8px;">${errorMsg}</div>`;

  // Add helpful links for debugging
  if (spreadsheetId || appsScriptEditorUrl) {
    errorHtml += `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f5c6cb;">`;
    errorHtml += `<strong>Quick Links for Debugging:</strong><br>`;

    if (spreadsheetId) {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      errorHtml += `• <a href="${sheetUrl}" target="_blank">Open Spreadsheet</a><br>`;
    }

    if (appsScriptEditorUrl) {
      errorHtml += `• <a href="${appsScriptEditorUrl}" target="_blank">Open Apps Script Editor</a><br>`;
    }

    errorHtml += `</div>`;
  }

  return errorHtml;
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
 * @param {HTMLButtonElement} button - Extract or manual entry button element
 */
function resetExtractButton(button) {
  button.disabled = false;
  // Reset to appropriate text based on button ID
  if (button.id === 'manualEntryBtn') {
    button.textContent = 'Manual Entry';
  } else {
    button.textContent = 'Quick Save (URL + Content)';
  }
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
// ============ DYNAMIC SCHEMA FUNCTIONS ============

/**
 * Load job data schema from storage
 * Falls back to default schema if not found
 */
async function loadJobDataSchema() {
  try {
    const result = await chrome.storage.sync.get(['JOB_DATA_SCHEMA']);
    if (result.JOB_DATA_SCHEMA && result.JOB_DATA_SCHEMA.columns) {
      jobDataSchema = result.JOB_DATA_SCHEMA;
      log('[Schema] Loaded custom schema with ' + jobDataSchema.columns.length + ' columns');
    } else {
      // Use default schema from settings.js DEFAULT_SCHEMA
      jobDataSchema = await getDefaultSchema();
      log('[Schema] Using default schema with ' + jobDataSchema.columns.length + ' columns');
    }

    // Generate form fields from schema
    generateDynamicFormFields();
  } catch (error) {
    logError('[Schema] Error loading schema: ' + error.message);
    // Use fallback minimal schema
    jobDataSchema = { columns: [] };
    generateDynamicFormFields();
  }
}

/**
 * Get default schema (matches DEFAULT_SCHEMA in settings.js)
 */
async function getDefaultSchema() {
  return {
    columns: [
      { id: 'company', label: 'Employer', type: 'text', placeholder: 'e.g., Google', tooltip: 'Company or organization name', required: false, readonly: false },
      { id: 'title', label: 'Job Title', type: 'text', placeholder: 'e.g., Software Engineer', tooltip: 'Position or role title', required: false, readonly: false },
      { id: 'location', label: 'Location', type: 'text', placeholder: 'e.g., San Francisco, CA', tooltip: 'Job location', required: false, readonly: false },
      { id: 'role', label: 'Role', type: 'select', placeholder: '', tooltip: 'Job role category', required: false, readonly: false, options: ['CODE', 'DSCI', 'STAT', 'R&D'] },
      { id: 'tailor', label: 'Tailor', type: 'select', placeholder: 'Same as Role', tooltip: 'Custom role tailoring', required: false, readonly: false, options: ['CODE', 'DSCI', 'STAT', 'R&D'] },
      { id: 'description', label: 'Notes', type: 'textarea', placeholder: 'Additional notes or job description', tooltip: 'Job description or notes', required: false, readonly: false },
      { id: 'compensation', label: 'Compensation', type: 'text', placeholder: 'e.g., $65.00 - $75.00 / hour', tooltip: 'Salary range', required: false, readonly: false },
      { id: 'pay', label: 'Pay', type: 'text', placeholder: 'e.g., $70.00', tooltip: 'Specific pay amount', required: false, readonly: false },
      { id: 'url', label: 'Portal Link', type: 'url', placeholder: 'https://...', tooltip: 'Job posting URL', required: false, readonly: true },
      { id: 'source', label: 'Board', type: 'select', placeholder: 'Auto-detect from URL', tooltip: 'Job board or source', required: false, readonly: false, options: ['Indeed', 'Handshake', 'Symplicity', 'Google', 'LinkedIn', 'Website', 'Other'] }
    ]
  };
}

/**
 * Generate dynamic form fields from schema
 */
function generateDynamicFormFields() {
  const container = document.getElementById('dynamicFormFields');
  if (!container) {
    logError('[Schema] Dynamic form container not found');
    return;
  }

  container.innerHTML = '';

  if (!jobDataSchema || !jobDataSchema.columns || jobDataSchema.columns.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No form fields configured. Please configure the schema in Settings.</p>';
    return;
  }

  jobDataSchema.columns.forEach(column => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-field';

    const label = document.createElement('label');
    label.setAttribute('for', `manual_${column.id}`);
    label.textContent = column.label + (column.required ? ' *' : '');
    if (column.tooltip) {
      label.title = column.tooltip;
    }

    let inputElement;

    switch (column.type) {
      case 'textarea':
        inputElement = document.createElement('textarea');
        inputElement.rows = 3;
        break;

      case 'select':
        inputElement = document.createElement('select');
        // Add empty option if placeholder exists
        if (column.placeholder) {
          const emptyOption = document.createElement('option');
          emptyOption.value = '';
          emptyOption.textContent = column.placeholder;
          inputElement.appendChild(emptyOption);
        }
        // Add options
        if (column.options && Array.isArray(column.options)) {
          column.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            inputElement.appendChild(option);
          });
        }
        break;

      default:
        inputElement = document.createElement('input');
        inputElement.type = column.type || 'text';
    }

    inputElement.id = `manual_${column.id}`;
    inputElement.setAttribute('data-field-id', column.id);
    if (column.placeholder) {
      inputElement.placeholder = column.placeholder;
    }
    if (column.required) {
      inputElement.required = true;
    }
    if (column.readonly) {
      inputElement.readOnly = true;
    }

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(inputElement);
    container.appendChild(fieldDiv);
  });

  log('[Schema] Generated ' + jobDataSchema.columns.length + ' form fields');

  // Re-setup mouse tracking for new fields
  setupFieldMouseTracking();
}

/**
 * Populate dynamic form fields with job data
 * @param {Object} jobData - Job data to populate into form
 */
function populateDynamicFormFields(jobData) {
  if (!jobData || !jobDataSchema || !jobDataSchema.columns) {
    return;
  }

  jobDataSchema.columns.forEach(column => {
    const field = document.getElementById(`manual_${column.id}`);
    if (field && jobData[column.id] !== undefined) {
      field.value = jobData[column.id] || '';
    }
  });
}

/**
 * Collect form values from dynamic fields
 * @returns {Object} Object with field values keyed by field ID
 */
function collectDynamicFormValues() {
  const values = {};

  if (!jobDataSchema || !jobDataSchema.columns) {
    return values;
  }

  jobDataSchema.columns.forEach(column => {
    const field = document.getElementById(`manual_${column.id}`);
    if (field) {
      values[column.id] = field.value.trim();
    }
  });

  return values;
}

// ============ MANUAL ENTRY MODAL ============

function initializeManualEntryModal() {
  const modal = document.getElementById('manualEntryModal');
  const closeBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelModal');
  const form = document.getElementById('manualEntryForm');
  const autoExtractBtn = document.getElementById('autoExtractBtn');

  if (!modal || !closeBtn || !cancelBtn || !form) return;

  // Load schema and generate form fields
  loadJobDataSchema();

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

  // Handle auto-extract button
  if (autoExtractBtn) {
    autoExtractBtn.addEventListener('click', () => {
      handleAutoExtractClick();
    });
  }

  // Add mode selector button handlers
  setupModeSelectorButtons();
}

/**
 * Handle auto-extract button click
 * Reconnects to the current tab and extracts detailed job data to fill the form
 */
async function handleAutoExtractClick() {
  const autoExtractBtn = document.getElementById('autoExtractBtn');
  const errorContainer = document.getElementById('manualEntryError');

  // Clear any previous error
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
  }

  // Set button to loading state
  if (autoExtractBtn) {
    autoExtractBtn.disabled = true;
    autoExtractBtn.textContent = '⏳ Extracting...';
  }

  try {
    // Step 1: Get the current active tab (reconnect)
    log('[AutoExtract] Getting current active tab...');
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found. Please make sure you have a job page open.');
    }

    const activeTab = tabs[0];
    log(`[AutoExtract] Active tab found: ${activeTab.url}`);

    // Update the stored source tab ID (reconnect)
    await chrome.storage.local.set({ popupSourceTabId: activeTab.id });
    log('[AutoExtract] Reconnected to active tab');

    // Check if tab URL is accessible
    if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot extract from this page. Chrome extension pages and settings are not supported.');
    }

    // Step 2: Request detailed extraction from content script
    log('[AutoExtract] Requesting detailed job data extraction...');

    chrome.tabs.sendMessage(
      activeTab.id,
      { action: 'extractJobDataDetailed' },
      (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          logError(`[AutoExtract] Runtime error: ${errorMsg}`);

          if (errorMsg.includes('Receiving end does not exist')) {
            showAutoExtractError('Please reload the page and try again. The extension needs to reinitialize.');
          } else {
            showAutoExtractError(`Error: ${errorMsg}`);
          }

          // Reset button
          if (autoExtractBtn) {
            autoExtractBtn.disabled = false;
            autoExtractBtn.textContent = '🔄 Auto-Extract from Page';
          }
          return;
        }

        if (!response?.success) {
          logError('[AutoExtract] Content script returned failure');
          showAutoExtractError('Failed to extract job data from page');

          // Reset button
          if (autoExtractBtn) {
            autoExtractBtn.disabled = false;
            autoExtractBtn.textContent = '🔄 Auto-Extract from Page';
          }
          return;
        }

        log(`[AutoExtract] Data extracted successfully:`, response.data);

        // Step 3: Fill the form fields with extracted data
        populateDynamicFormFields(response.data);

        // Show success feedback
        if (autoExtractBtn) {
          autoExtractBtn.textContent = '✓ Extracted!';
          autoExtractBtn.style.background = '#28a745';

          // Reset button after 2 seconds
          setTimeout(() => {
            autoExtractBtn.disabled = false;
            autoExtractBtn.textContent = '🔄 Auto-Extract from Page';
            autoExtractBtn.style.background = '#4CAF50';
          }, 2000);
        }

        log('[AutoExtract] Form fields populated successfully');
      }
    );
  } catch (error) {
    logError(`[AutoExtract] Error: ${error.message}`);
    showAutoExtractError(error.message);

    // Reset button
    if (autoExtractBtn) {
      autoExtractBtn.disabled = false;
      autoExtractBtn.textContent = '🔄 Auto-Extract from Page';
    }
  }
}

/**
 * Show error message in auto-extract error container
 * @param {string} message - Error message to display
 */
function showAutoExtractError(message) {
  const errorContainer = document.getElementById('manualEntryError');
  if (errorContainer) {
    errorContainer.innerHTML = `<strong>✗ Auto-Extract Failed</strong><div style="margin-top: 8px;">${message}</div>`;
    errorContainer.style.display = 'block';
  }
}

/**
 * Setup mode selector buttons
 * Allows user to manually select extraction mode via UI buttons
 * Now activates on mouseover for instant feedback
 */
function setupModeSelectorButtons() {
  const modeButtons = document.querySelectorAll('.mode-btn');

  modeButtons.forEach(button => {
    button.addEventListener('mouseenter', async () => {
      const mode = button.getAttribute('data-mode');
      log(`[ModeSelector] Manually selected mode: ${mode}`);

      // Update the global current mode
      currentMode = mode;

      // Update button states
      updateModeButtonStates(mode);

      // Update the active field's border color to match mode
      if (currentActiveFieldElement) {
        updateFieldBorderColor(currentActiveFieldElement, mode);
      }

      // Send mode change to content script
      const sourceTab = await getSourceTab();
      if (!sourceTab) return;

      chrome.tabs.sendMessage(
        sourceTab.id,
        { action: 'changeExtractionMode', mode: mode },
        (response) => {
          if (chrome.runtime.lastError) {
            logError(`[ModeSelector] Error: ${chrome.runtime.lastError.message}`);
          }
        }
      );
    });
  });
}

/**
 * Setup mouse tracking for manual entry form fields
 * When a field is focused, mouse tracking is activated on the source page
 * Now works dynamically with schema-defined fields
 */
function setupFieldMouseTracking() {
  // Get all dynamically generated fields
  const dynamicFields = document.querySelectorAll('#dynamicFormFields input, #dynamicFormFields textarea');

  log(`[MouseTracking] Setting up field tracking for ${dynamicFields.length} dynamic fields`);

  dynamicFields.forEach(field => {
    if (!field) {
      return;
    }

    const fieldId = field.getAttribute('data-field-id') || field.id;
    log(`[MouseTracking] Field found and listener added: ${fieldId}`);

    // Start tracking on focus
    field.addEventListener('focus', () => {
      log(`[Field] Focused: ${fieldId}`);
      currentActiveFieldElement = field; // Store the active field
      startMouseTrackingForField(fieldId);

      // Add visual indicator that tracking is active with current mode color
      // Use the persisted currentMode instead of defaulting to 'words'
      updateFieldBorderColor(field, currentMode);

      // Also update button states to match current mode
      updateModeButtonStates(currentMode);
    });

    // Stop tracking on blur
    field.addEventListener('blur', () => {
      log(`[Field] Blurred: ${fieldId}`);

      // Small delay to allow click to register
      setTimeout(() => {
        if (currentlyFocusedField === fieldId) {
          stopMouseTracking();
        }
      }, 100);

      // Remove visual indicator
      field.style.borderColor = '';
      field.style.borderWidth = '';
      field.style.boxShadow = '';
      currentActiveFieldElement = null; // Clear the stored field
    });
  });
}

/**
 * Show manual entry modal with pre-filled data
 * @param {HTMLButtonElement} button - Extract or manual entry button element
 * @param {HTMLElement} statusDiv - Status message display element
 * @param {Object} jobData - Extracted job data to pre-fill
 */
function showManualEntryModal(button, statusDiv, jobData) {
  const modal = document.getElementById('manualEntryModal');
  if (!modal) return;

  // Clear any previous error message
  const errorContainer = document.getElementById('manualEntryError');
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
  }

  // Store references for later use
  modal.dataset.button = button.id;
  modal.dataset.status = statusDiv.id;

  // Update modal title and info based on the source button
  const modalTitle = document.getElementById('modalTitle');
  const modalInfo = document.getElementById('modalInfo');

  if (button.id === 'manualEntryBtn') {
    // Manual entry was requested directly
    modalTitle.textContent = 'Add Job Details';
    modalInfo.textContent = 'Please fill in the job details below:';
  } else {
    // Auto-extraction happened but data is missing
    modalTitle.textContent = 'Review Job Data';
    modalInfo.textContent = 'Some job details couldn\'t be extracted automatically. Please review and fill in the missing information:';
  }

  // Pre-fill form fields with extracted data (dynamic based on schema)
  populateDynamicFormFields(jobData);

  // Store the full job data for later
  modal.dataset.jobData = JSON.stringify(jobData);

  // Show the modal
  modal.style.display = 'flex';

  // Apply mode colors to buttons (in case they weren't applied yet or settings changed)
  applyModeColorsToButtons();

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

  // Stop any active mouse tracking
  stopMouseTracking();

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

  // Clear any previous error message
  const errorContainer = document.getElementById('manualEntryError');
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
  }

  // Get form values (dynamic based on schema)
  const manualData = collectDynamicFormValues();

  // Get original job data to preserve other fields
  const originalData = JSON.parse(modal.dataset.jobData || '{}');

  // Merge manual data with original data (manual data overrides original)
  const finalData = {
    ...originalData,
    ...manualData
  };

  // Submit the data (modal will stay open on error, close on success)
  submitJobData(button, statusDiv, finalData, true);
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

// ============ INTERACTIVE MOUSE TRACKING ============

// Track currently focused field for mouse tracking
let currentlyFocusedField = null;
let currentActiveFieldElement = null; // Track the actual field DOM element
let currentMode = 'smart'; // Track the current mode globally (persists across fields)

// Mode colors (loaded from storage)
let popupModeColors = {
  words: '#2ecc71',
  smart: '#3498db',
  chars: '#9b59b6'
};

/**
 * Load mode colors from chrome storage
 */
async function loadModeColors() {
  try {
    const result = await chrome.storage.sync.get([
      'WORD_MODE_COLOR',
      'SENTENCE_MODE_COLOR',
      'CHAR_MODE_COLOR'
    ]);

    popupModeColors = {
      words: result.WORD_MODE_COLOR || '#2ecc71',
      smart: result.SENTENCE_MODE_COLOR || '#3498db',
      chars: result.CHAR_MODE_COLOR || '#9b59b6'
    };

    log('[Popup] Mode colors loaded:', popupModeColors);
  } catch (error) {
    logError('[Popup] Error loading mode colors:', error);
  }
}

/**
 * Get border color for a specific mode
 * @param {string} mode - Mode name: 'words', 'smart', 'chars'
 * @returns {string} Border color for the mode
 */
function getModeBorderColor(mode) {
  switch (mode) {
    case 'smart':
      return popupModeColors.smart;
    case 'chars':
      return popupModeColors.chars;
    case 'words':
      return popupModeColors.words;
    default:
      return '#FF6B6B'; // Red (default)
  }
}

/**
 * Apply loaded mode colors to mode buttons
 * Updates button border and background colors to match settings
 */
function applyModeColorsToButtons() {
  const modeButtons = document.querySelectorAll('.mode-btn');

  modeButtons.forEach(btn => {
    const mode = btn.getAttribute('data-mode');
    const color = getModeBorderColor(mode);

    // Update border color
    btn.style.borderColor = color;

    // If this is the active mode (smart is default), apply background color
    if (mode === currentMode) {
      btn.style.backgroundColor = color;
      btn.style.color = 'white';
    } else {
      btn.style.backgroundColor = '#fff';
      btn.style.color = color;
    }
  });

  log('[Popup] Mode button colors applied:', popupModeColors);
}

/**
 * Update mode button states to reflect current mode
 * @param {string} mode - Mode name
 */
function updateModeButtonStates(mode) {
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => {
    const btnMode = btn.getAttribute('data-mode');
    const color = getModeBorderColor(btnMode);

    // Always update border color to match settings
    btn.style.borderColor = color;

    if (btnMode === mode) {
      // Selected state - use loaded color
      btn.style.backgroundColor = color;
      btn.style.color = '#fff';
    } else {
      // Unselected state - white background with colored text
      btn.style.backgroundColor = '#fff';
      btn.style.color = color;
    }
  });
}

/**
 * Update field border color based on mode
 * @param {HTMLElement} field - Field element to update
 * @param {string} mode - Mode name
 */
function updateFieldBorderColor(field, mode) {
  const color = getModeBorderColor(mode);
  field.style.borderColor = color;
  field.style.borderWidth = '2px';
  field.style.boxShadow = `0 0 0 1px ${color}`;
}

/**
 * Initialize mouse tracking message listener
 * Listens for text extracted from page elements during mouse tracking
 */
function initializeMouseTracking() {
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'mouseHoverText') {
      handleMouseHoverText(message.fieldId, message.text, message.confirmed);
      sendResponse({ success: true });
      return true;
    }

    // Listen for mode changes from content script (when using Shift/Ctrl modifiers)
    if (message.action === 'modeChanged') {
      log(`[ModeSync] Mode changed to: ${message.mode}`);
      currentMode = message.mode;
      updateModeButtonStates(message.mode);

      // Also update active field border if there is one
      if (currentActiveFieldElement) {
        updateFieldBorderColor(currentActiveFieldElement, message.mode);
      }

      // Immediately save the mode change to storage
      // This ensures disabled mode (from X button) is persisted before popup closes
      saveExtendedUIState();

      sendResponse({ success: true });
      return true;
    }
  });

  log('[MouseTracking] Listener initialized');
}

/**
 * Handle text received from mouse hover on page
 * @param {string} fieldId - ID of the field to fill
 * @param {string} text - Text extracted from hovered element
 * @param {boolean} confirmed - Whether user clicked to confirm
 */
function handleMouseHoverText(fieldId, text, confirmed) {
  const field = document.getElementById(`manual_${fieldId}`);

  if (!field) {
    logError(`[MouseTracking] Field not found: ${fieldId}`);
    return;
  }

  // Update field value
  field.value = text;

  // Show visual feedback
  if (confirmed) {
    log(`[MouseTracking] Auto-filled ${fieldId}: ${text.substring(0, 50)}...`);

    // Flash field to indicate successful fill
    flashFieldSuccess(field);

    // Clear focus to allow selecting next field
    currentlyFocusedField = null;
  } else {
    // Just preview, don't log
    // Add preview styling
    field.style.backgroundColor = '#fff9e6';
  }
}

/**
 * Flash field with success color
 * @param {HTMLElement} field - Field to flash
 */
function flashFieldSuccess(field) {
  const originalBg = field.style.backgroundColor;

  field.style.backgroundColor = '#d4edda';
  field.style.transition = 'background-color 0.3s';

  setTimeout(() => {
    field.style.backgroundColor = originalBg;
  }, 1000);
}

/**
 * Start mouse tracking for a specific field
 * @param {string} fieldId - ID of the field to track for
 */
async function startMouseTrackingForField(fieldId) {
  log(`[MouseTracking] Starting tracking for field: ${fieldId}`);

  currentlyFocusedField = fieldId;

  // Get source tab
  const sourceTab = await getSourceTab();
  if (!sourceTab) {
    logError('[MouseTracking] No source tab found');
    return;
  }

  // Send message to content script to start tracking with current mode
  chrome.tabs.sendMessage(
    sourceTab.id,
    { action: 'startMouseTracking', fieldId: fieldId, mode: currentMode },
    (response) => {
      if (chrome.runtime.lastError) {
        logError(`[MouseTracking] Error: ${chrome.runtime.lastError.message}`);
      } else {
        log('[MouseTracking] Tracking started on page');
      }
    }
  );

  // Start keyboard event relay (popup captures keys and forwards to content script)
  startKeyboardRelay();
}

/**
 * Stop mouse tracking
 */
async function stopMouseTracking() {
  if (!currentlyFocusedField) return;

  log('[MouseTracking] Stopping tracking');

  // Get source tab
  const sourceTab = await getSourceTab();
  if (!sourceTab) return;

  // Send message to content script to stop tracking
  chrome.tabs.sendMessage(
    sourceTab.id,
    { action: 'stopMouseTracking' },
    (response) => {
      if (chrome.runtime.lastError) {
        logError(`[MouseTracking] Error: ${chrome.runtime.lastError.message}`);
      }
    }
  );

  // Stop keyboard event relay
  stopKeyboardRelay();

  currentlyFocusedField = null;
}

// Keyboard relay state
let keyboardRelayActive = false;
let keyboardRelayHandler = null;

/**
 * Start keyboard event relay from popup to content script
 * Captures keyboard events in popup and forwards them to content script
 */
function startKeyboardRelay() {
  if (keyboardRelayActive) return;

  log('[KeyboardRelay] Starting keyboard event relay');

  keyboardRelayHandler = async (event) => {
    // Only relay specific keys that are used for mouse tracking
    const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);
    const isEscape = event.key === 'Escape';
    const isModifierKey = ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key);
    const hasModifier = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;

    // Relay if it's an arrow key, escape, modifier key press, or if modifiers are active
    if (isArrowKey || isEscape || isModifierKey || hasModifier) {
      log(`[KeyboardRelay] Relaying key: ${event.key}, modifiers: Shift=${event.shiftKey}, Ctrl=${event.ctrlKey}, Alt=${event.altKey}`);

      // Get source tab
      const sourceTab = await getSourceTab();
      if (!sourceTab) return;

      // Create a serializable representation of the keyboard event
      const keyEventData = {
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        type: event.type // 'keydown' or 'keyup'
      };

      // Send to content script
      chrome.tabs.sendMessage(
        sourceTab.id,
        { action: 'relayKeyboardEvent', event: keyEventData },
        (response) => {
          if (chrome.runtime.lastError) {
            logError(`[KeyboardRelay] Error: ${chrome.runtime.lastError.message}`);
          }
        }
      );

      // For arrow keys WITHOUT Shift/Ctrl modifiers, prevent default to allow granularity adjustment
      // When Shift/Ctrl are held, allow default behavior (cursor movement) but still relay for text mirroring
      if (isArrowKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
      }
      // For escape, always prevent default
      if (isEscape) {
        event.preventDefault();
      }
    }
  };

  // Also relay keyup events for modifiers
  keyboardRelayHandlerUp = async (event) => {
    const isModifierKey = ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key);

    if (isModifierKey) {
      log(`[KeyboardRelay] Relaying keyup: ${event.key}`);

      const sourceTab = await getSourceTab();
      if (!sourceTab) return;

      const keyEventData = {
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        type: 'keyup'
      };

      chrome.tabs.sendMessage(
        sourceTab.id,
        { action: 'relayKeyboardEvent', event: keyEventData },
        (response) => {
          if (chrome.runtime.lastError) {
            logError(`[KeyboardRelay] Error: ${chrome.runtime.lastError.message}`);
          }
        }
      );
    }
  };

  // Add event listeners to document (both keydown and keyup)
  document.addEventListener('keydown', keyboardRelayHandler, true);
  document.addEventListener('keyup', keyboardRelayHandlerUp, true);
  keyboardRelayActive = true;

  log('[KeyboardRelay] Keyboard relay active (keydown + keyup)');
}

/**
 * Stop keyboard event relay
 */
function stopKeyboardRelay() {
  if (!keyboardRelayActive) return;

  log('[KeyboardRelay] Stopping keyboard event relay');

  if (keyboardRelayHandler) {
    document.removeEventListener('keydown', keyboardRelayHandler, true);
    keyboardRelayHandler = null;
  }

  keyboardRelayActive = false;
}
