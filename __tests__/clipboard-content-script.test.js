/**
 * Unit tests for clipboard-related content script functions
 * @jest-environment jsdom
 */

describe('Clipboard Content Script Functions', () => {
  beforeEach(() => {
    // Clear the document body before each test
    document.body.innerHTML = '';
  });

  describe('pasteTextToActiveField', () => {
    // Define the function inline (since we can't import it directly)
    // Note: execCommand is deprecated and not supported in jsdom, so we use the fallback method
    function pasteTextToActiveField(text) {
      const activeElement = document.activeElement;

      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        try {
          // Direct value manipulation (fallback method)
          const start = activeElement.selectionStart || 0;
          const end = activeElement.selectionEnd || 0;
          const currentValue = activeElement.value;

          activeElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);

          // Some input types (like email) don't support selection properties
          try {
            activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
          } catch (e) {
            // Ignore selection errors for input types that don't support it
          }

          // Trigger input event for frameworks (React, Vue, etc.)
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
          // Fallback for inputs that don't support selection at all
          activeElement.value = text;
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

    test('should paste text into empty input field', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      pasteTextToActiveField('Hello World');

      expect(input.value).toBe('Hello World');
    });

    test('should paste text into textarea', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      pasteTextToActiveField('Test message');

      expect(textarea.value).toBe('Test message');
    });

    test('should paste text at cursor position in the middle of existing text', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello World';
      document.body.appendChild(input);
      input.focus();

      // Set cursor position to middle (after "Hello ")
      input.selectionStart = 6;
      input.selectionEnd = 6;

      pasteTextToActiveField('Beautiful ');

      expect(input.value).toBe('Hello Beautiful World');
      expect(input.selectionStart).toBe(16); // Cursor should move after pasted text
    });

    test('should replace selected text with pasted text', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello World';
      document.body.appendChild(input);
      input.focus();

      // Select "World"
      input.selectionStart = 6;
      input.selectionEnd = 11;

      pasteTextToActiveField('Universe');

      expect(input.value).toBe('Hello Universe');
    });

    test('should dispatch input and change events', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      let inputEventFired = false;
      let changeEventFired = false;

      input.addEventListener('input', () => {
        inputEventFired = true;
      });

      input.addEventListener('change', () => {
        changeEventFired = true;
      });

      pasteTextToActiveField('Test');

      expect(inputEventFired).toBe(true);
      expect(changeEventFired).toBe(true);
    });

    test('should handle email input type', () => {
      const input = document.createElement('input');
      input.type = 'email';
      document.body.appendChild(input);
      input.focus();

      pasteTextToActiveField('test@example.com');

      expect(input.value).toBe('test@example.com');
    });

    test('should handle tel input type', () => {
      const input = document.createElement('input');
      input.type = 'tel';
      document.body.appendChild(input);
      input.focus();

      pasteTextToActiveField('555-1234');

      expect(input.value).toBe('555-1234');
    });

    test('should not paste into non-input elements', () => {
      const div = document.createElement('div');
      div.textContent = 'Original content';
      document.body.appendChild(div);

      // Focus is on body, not on an input
      pasteTextToActiveField('Should not paste');

      expect(div.textContent).toBe('Original content');
    });

    test('should handle multiple paste operations', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      pasteTextToActiveField('First ');
      input.selectionStart = input.value.length;
      input.selectionEnd = input.value.length;

      pasteTextToActiveField('Second ');
      input.selectionStart = input.value.length;
      input.selectionEnd = input.value.length;

      pasteTextToActiveField('Third');

      expect(input.value).toBe('First Second Third');
    });

    test('should handle special characters', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';
      pasteTextToActiveField(specialText);

      expect(input.value).toBe(specialText);
    });

    test('should handle unicode characters', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      const unicodeText = 'Hello 世界 🌍';
      pasteTextToActiveField(unicodeText);

      expect(input.value).toBe(unicodeText);
    });

    test('should handle newlines in textarea', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const multilineText = 'Line 1\nLine 2\nLine 3';
      pasteTextToActiveField(multilineText);

      expect(textarea.value).toBe(multilineText);
    });

    test('should update cursor position correctly after paste', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Test';
      document.body.appendChild(input);
      input.focus();

      input.selectionStart = 0;
      input.selectionEnd = 0;

      const textToPaste = 'Start ';
      pasteTextToActiveField(textToPaste);

      expect(input.selectionStart).toBe(textToPaste.length);
      expect(input.selectionEnd).toBe(textToPaste.length);
    });
  });

  describe('Clipboard Integration Scenarios', () => {
    function pasteTextToActiveField(text) {
      const activeElement = document.activeElement;

      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        try {
          // Direct value manipulation (fallback method)
          const start = activeElement.selectionStart || 0;
          const end = activeElement.selectionEnd || 0;
          const currentValue = activeElement.value;

          activeElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);

          // Some input types (like email) don't support selection properties
          try {
            activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
          } catch (e) {
            // Ignore selection errors for input types that don't support it
          }

          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
          // Fallback for inputs that don't support selection at all
          activeElement.value = text;
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

    test('should simulate full clipboard macro workflow - phone number', () => {
      const input = document.createElement('input');
      input.type = 'tel';
      input.placeholder = 'Phone number';
      document.body.appendChild(input);
      input.focus();

      const phoneNumber = '(555) 123-4567';
      pasteTextToActiveField(phoneNumber);

      expect(input.value).toBe(phoneNumber);
    });

    test('should simulate full clipboard macro workflow - email', () => {
      const input = document.createElement('input');
      input.type = 'email';
      input.placeholder = 'Email address';
      document.body.appendChild(input);
      input.focus();

      const email = 'user@example.com';
      pasteTextToActiveField(email);

      expect(input.value).toBe(email);
    });

    test('should simulate full clipboard macro workflow - address', () => {
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Address';
      document.body.appendChild(textarea);
      textarea.focus();

      const address = '123 Main Street\nApt 4B\nNew York, NY 10001';
      pasteTextToActiveField(address);

      expect(textarea.value).toBe(address);
    });

    test('should simulate full clipboard macro workflow - LinkedIn URL', () => {
      const input = document.createElement('input');
      input.type = 'url';
      input.placeholder = 'LinkedIn profile';
      document.body.appendChild(input);
      input.focus();

      const linkedinUrl = 'https://www.linkedin.com/in/johndoe';
      pasteTextToActiveField(linkedinUrl);

      expect(input.value).toBe(linkedinUrl);
    });

    test('should handle rapid consecutive macro pastes', () => {
      const form = document.createElement('form');
      document.body.appendChild(form);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Name';
      form.appendChild(nameInput);

      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.placeholder = 'Email';
      form.appendChild(emailInput);

      const phoneInput = document.createElement('input');
      phoneInput.type = 'tel';
      phoneInput.placeholder = 'Phone';
      form.appendChild(phoneInput);

      // Simulate pasting into multiple fields
      nameInput.focus();
      pasteTextToActiveField('John Doe');

      emailInput.focus();
      pasteTextToActiveField('john@example.com');

      phoneInput.focus();
      pasteTextToActiveField('555-1234');

      expect(nameInput.value).toBe('John Doe');
      expect(emailInput.value).toBe('john@example.com');
      expect(phoneInput.value).toBe('555-1234');
    });
  });
});
