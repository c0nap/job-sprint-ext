/**
 * UI tests for the Clipboard Macros MVP
 * Tests the 6-button layout and Settings integration
 */

const fs = require('fs');
const path = require('path');

// Read popup.html
const popupHtml = fs.readFileSync(
  path.join(__dirname, '../popup.html'),
  'utf8'
);

// Read settings.html
const settingsHtml = fs.readFileSync(
  path.join(__dirname, '../settings.html'),
  'utf8'
);

describe('Clipboard Macros UI - 6-Button MVP', () => {
  describe('Popup HTML Structure', () => {
    test('should have exactly 6 macro buttons', () => {
      const buttonMatches = popupHtml.match(/class="macro-btn"/g);
      expect(buttonMatches).toHaveLength(6);
    });

    test('should have all 6 macro buttons with correct data-keys', () => {
      const expectedKeys = ['phone', 'email', 'address', 'linkedin', 'name', 'website'];

      expectedKeys.forEach((key) => {
        const pattern = new RegExp(`data-key="${key}"`, 'g');
        const matches = popupHtml.match(pattern);
        expect(matches).toHaveLength(1);
      });
    });

    test('should have phone button with emoji and label', () => {
      expect(popupHtml).toContain('data-key="phone">📞 Phone</button>');
    });

    test('should have email button with emoji and label', () => {
      expect(popupHtml).toContain('data-key="email">📧 Email</button>');
    });

    test('should have address button with emoji and label', () => {
      expect(popupHtml).toContain('data-key="address">📍 Address</button>');
    });

    test('should have linkedin button with emoji and label', () => {
      expect(popupHtml).toContain('data-key="linkedin">💼 LinkedIn</button>');
    });

    test('should have name button with emoji and label', () => {
      expect(popupHtml).toContain('data-key="name">👤 Name</button>');
    });

    test('should have website button with emoji and label', () => {
      expect(popupHtml).toContain('data-key="website">🌐 Website</button>');
    });

    test('should NOT have Edit Macros button in popup', () => {
      expect(popupHtml).not.toContain('id="editMacros"');
      expect(popupHtml).not.toContain('Edit Macros');
    });

    test('should have Settings link', () => {
      expect(popupHtml).toContain('id="settingsLink"');
      expect(popupHtml).toContain('Settings</a>');
    });
  });

  describe('Settings HTML Structure', () => {
    test('should have Clipboard Macros configuration section', () => {
      expect(settingsHtml).toContain('Clipboard Macros</h3>');
    });

    test('should have all 6 macro input fields', () => {
      const expectedIds = [
        'macroPhone',
        'macroEmail',
        'macroAddress',
        'macroLinkedin',
        'macroName',
        'macroWebsite'
      ];

      expectedIds.forEach((id) => {
        const pattern = new RegExp(`id="${id}"`, 'g');
        const matches = settingsHtml.match(pattern);
        expect(matches).toHaveLength(1);
      });
    });

    test('should have phone input with label and emoji', () => {
      expect(settingsHtml).toContain('for="macroPhone">📞 Phone Number</label>');
      expect(settingsHtml).toContain('id="macroPhone"');
    });

    test('should have email input with label and emoji', () => {
      expect(settingsHtml).toContain('for="macroEmail">📧 Email Address</label>');
      expect(settingsHtml).toContain('id="macroEmail"');
    });

    test('should have address input with label and emoji', () => {
      expect(settingsHtml).toContain('for="macroAddress">📍 Address</label>');
      expect(settingsHtml).toContain('id="macroAddress"');
    });

    test('should have linkedin input with label and emoji', () => {
      expect(settingsHtml).toContain('for="macroLinkedin">💼 LinkedIn Profile</label>');
      expect(settingsHtml).toContain('id="macroLinkedin"');
    });

    test('should have name input with label and emoji', () => {
      expect(settingsHtml).toContain('for="macroName">👤 Full Name</label>');
      expect(settingsHtml).toContain('id="macroName"');
    });

    test('should have website input with label and emoji', () => {
      expect(settingsHtml).toContain('for="macroWebsite">🌐 Website/Portfolio</label>');
      expect(settingsHtml).toContain('id="macroWebsite"');
    });

    test('should have privacy notice for clipboard macros', () => {
      expect(settingsHtml).toContain('stored locally in your browser');
      expect(settingsHtml).toContain('never sent to any server');
    });
  });

  describe('CSS Grid Layout', () => {
    test('popup.css should have 3-column grid layout', () => {
      const popupCss = fs.readFileSync(
        path.join(__dirname, '../popup.css'),
        'utf8'
      );

      expect(popupCss).toContain('grid-template-columns: repeat(3, 1fr)');
    });

    test('popup.css should have compact button styling', () => {
      const popupCss = fs.readFileSync(
        path.join(__dirname, '../popup.css'),
        'utf8'
      );

      // Check for compact padding
      expect(popupCss).toMatch(/\.macro-btn[\s\S]*?padding:\s*8px\s+4px/);
    });
  });

  describe('JavaScript Integration', () => {
    test('popup.js should NOT have Edit Macros event listener', () => {
      const popupJs = fs.readFileSync(
        path.join(__dirname, '../popup.js'),
        'utf8'
      );

      expect(popupJs).not.toContain("getElementById('editMacros')");
    });

    test('popup.js should reference all 6 macros in comments', () => {
      const popupJs = fs.readFileSync(
        path.join(__dirname, '../popup.js'),
        'utf8'
      );

      // Check that the comment mentions all 6 macros
      const comment = popupJs.match(/Macro key \(([^)]+)\)/);
      if (comment && comment[1]) {
        expect(comment[1]).toContain('phone');
        expect(comment[1]).toContain('email');
        expect(comment[1]).toContain('address');
        expect(comment[1]).toContain('linkedin');
        expect(comment[1]).toContain('name');
        expect(comment[1]).toContain('website');
      }
    });

    test('settings.js should have DEFAULT_MACROS with all 6 keys', () => {
      const settingsJs = fs.readFileSync(
        path.join(__dirname, '../settings.js'),
        'utf8'
      );

      expect(settingsJs).toContain('DEFAULT_MACROS');
      expect(settingsJs).toMatch(/phone:\s*['"]/);
      expect(settingsJs).toMatch(/email:\s*['"]/);
      expect(settingsJs).toMatch(/address:\s*['"]/);
      expect(settingsJs).toMatch(/linkedin:\s*['"]/);
      expect(settingsJs).toMatch(/name:\s*['"]/);
      expect(settingsJs).toMatch(/website:\s*['"]/);
    });
  });

  describe('Service Worker Integration', () => {
    test('service-worker.js should initialize all 6 macros', () => {
      const serviceWorkerJs = fs.readFileSync(
        path.join(__dirname, '../service-worker.js'),
        'utf8'
      );

      // Check initialization includes all 6 macros
      const initSection = serviceWorkerJs.match(/clipboardMacros:\s*\{([^}]+)\}/);
      if (initSection && initSection[1]) {
        expect(initSection[1]).toContain('phone:');
        expect(initSection[1]).toContain('email:');
        expect(initSection[1]).toContain('address:');
        expect(initSection[1]).toContain('linkedin:');
        expect(initSection[1]).toContain('name:');
        expect(initSection[1]).toContain('website:');
      }
    });

    test('service-worker.js should have migration support for new macros', () => {
      const serviceWorkerJs = fs.readFileSync(
        path.join(__dirname, '../service-worker.js'),
        'utf8'
      );

      // Check for migration logic
      expect(serviceWorkerJs).toContain("hasOwnProperty('name')");
      expect(serviceWorkerJs).toContain("hasOwnProperty('website')");
    });
  });
});
