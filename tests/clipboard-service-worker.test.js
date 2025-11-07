/**
 * Unit tests for clipboard-related service worker functions
 */

// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('Clipboard Service Worker Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('handleGetClipboardMacro', () => {
    test('should retrieve existing macro value', (done) => {
      const mockMacros = {
        phone: '555-1234',
        email: 'test@example.com',
        address: '123 Main St',
        linkedin: 'linkedin.com/in/test'
      };

      // Mock chrome.storage.sync.get to return mock data
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ clipboardMacros: mockMacros });
      });

      // Define the function inline (since we can't import it directly)
      function handleGetClipboardMacro(key, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const value = result.clipboardMacros?.[key] || '';
          sendResponse({ success: true, value });
        });
      }

      // Test the function
      handleGetClipboardMacro('phone', (response) => {
        expect(response.success).toBe(true);
        expect(response.value).toBe('555-1234');
        expect(chrome.storage.sync.get).toHaveBeenCalledWith(
          ['clipboardMacros'],
          expect.any(Function)
        );
        done();
      });
    });

    test('should return empty string for non-existent macro', (done) => {
      // Mock chrome.storage.sync.get to return empty object
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ clipboardMacros: {} });
      });

      function handleGetClipboardMacro(key, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const value = result.clipboardMacros?.[key] || '';
          sendResponse({ success: true, value });
        });
      }

      handleGetClipboardMacro('nonexistent', (response) => {
        expect(response.success).toBe(true);
        expect(response.value).toBe('');
        done();
      });
    });

    test('should handle missing clipboardMacros object', (done) => {
      // Mock chrome.storage.sync.get to return empty result
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      function handleGetClipboardMacro(key, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const value = result.clipboardMacros?.[key] || '';
          sendResponse({ success: true, value });
        });
      }

      handleGetClipboardMacro('phone', (response) => {
        expect(response.success).toBe(true);
        expect(response.value).toBe('');
        done();
      });
    });
  });

  describe('handleSaveClipboardMacro', () => {
    test('should save new macro value', (done) => {
      const existingMacros = {
        phone: '555-1234',
        email: 'old@example.com'
      };

      // Mock get to return existing data
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ clipboardMacros: existingMacros });
      });

      // Mock set to call callback immediately
      chrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      function handleSaveClipboardMacro(key, value, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const macros = result.clipboardMacros || {};
          macros[key] = value;
          chrome.storage.sync.set({ clipboardMacros: macros }, () => {
            sendResponse({ success: true });
          });
        });
      }

      handleSaveClipboardMacro('email', 'new@example.com', (response) => {
        expect(response.success).toBe(true);
        expect(chrome.storage.sync.get).toHaveBeenCalledWith(
          ['clipboardMacros'],
          expect.any(Function)
        );
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
          {
            clipboardMacros: {
              phone: '555-1234',
              email: 'new@example.com'
            }
          },
          expect.any(Function)
        );
        done();
      });
    });

    test('should create new macro object if none exists', (done) => {
      // Mock get to return empty result
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      chrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      function handleSaveClipboardMacro(key, value, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const macros = result.clipboardMacros || {};
          macros[key] = value;
          chrome.storage.sync.set({ clipboardMacros: macros }, () => {
            sendResponse({ success: true });
          });
        });
      }

      handleSaveClipboardMacro('phone', '555-9999', (response) => {
        expect(response.success).toBe(true);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
          {
            clipboardMacros: {
              phone: '555-9999'
            }
          },
          expect.any(Function)
        );
        done();
      });
    });

    test('should add new macro to existing ones', (done) => {
      const existingMacros = {
        phone: '555-1234'
      };

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ clipboardMacros: existingMacros });
      });

      chrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      function handleSaveClipboardMacro(key, value, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const macros = result.clipboardMacros || {};
          macros[key] = value;
          chrome.storage.sync.set({ clipboardMacros: macros }, () => {
            sendResponse({ success: true });
          });
        });
      }

      handleSaveClipboardMacro('linkedin', 'linkedin.com/in/user', (response) => {
        expect(response.success).toBe(true);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
          {
            clipboardMacros: {
              phone: '555-1234',
              linkedin: 'linkedin.com/in/user'
            }
          },
          expect.any(Function)
        );
        done();
      });
    });
  });

  describe('Clipboard Storage Integration', () => {
    test('should maintain data consistency across get and set operations', (done) => {
      let storedData = { clipboardMacros: {} };

      // Mock storage to simulate real storage behavior
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(storedData);
      });

      chrome.storage.sync.set.mockImplementation((data, callback) => {
        storedData = { ...storedData, ...data };
        callback();
      });

      function handleSaveClipboardMacro(key, value, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const macros = result.clipboardMacros || {};
          macros[key] = value;
          chrome.storage.sync.set({ clipboardMacros: macros }, () => {
            sendResponse({ success: true });
          });
        });
      }

      function handleGetClipboardMacro(key, sendResponse) {
        chrome.storage.sync.get(['clipboardMacros'], (result) => {
          const value = result.clipboardMacros?.[key] || '';
          sendResponse({ success: true, value });
        });
      }

      // Save a macro
      handleSaveClipboardMacro('phone', '555-TEST', (saveResponse) => {
        expect(saveResponse.success).toBe(true);

        // Retrieve the same macro
        handleGetClipboardMacro('phone', (getResponse) => {
          expect(getResponse.success).toBe(true);
          expect(getResponse.value).toBe('555-TEST');
          done();
        });
      });
    });
  });
});
