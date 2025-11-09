/**
 * UI tests for the Clipboard Macros Folder Structure
 * Tests the 6-folder layout and Settings JSON editing
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

describe('Clipboard Macros UI - Folder Structure', () => {
  describe('Popup HTML Structure', () => {
    test('should have exactly 6 folder buttons', () => {
      const buttonMatches = popupHtml.match(/class="folder-btn"/g);
      expect(buttonMatches).toHaveLength(6);
    });

    test('should have all 6 folder buttons with correct data-folder attributes', () => {
      const expectedFolders = ['demographics', 'references', 'education', 'skills', 'projects', 'employment'];

      expectedFolders.forEach((folder) => {
        const pattern = new RegExp(`data-folder="${folder}"`, 'g');
        const matches = popupHtml.match(pattern);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });

    test('should have demographics folder button with emoji and label', () => {
      expect(popupHtml).toContain('data-folder="demographics">👤 Demographics</button>');
    });

    test('should have references folder button with emoji and label', () => {
      expect(popupHtml).toContain('data-folder="references">📋 References</button>');
    });

    test('should have education folder button with emoji and label', () => {
      expect(popupHtml).toContain('data-folder="education">🎓 Education</button>');
    });

    test('should have skills folder button with emoji and label', () => {
      expect(popupHtml).toContain('data-folder="skills">💡 Skills</button>');
    });

    test('should have projects folder button with emoji and label', () => {
      expect(popupHtml).toContain('data-folder="projects">🚀 Projects</button>');
    });

    test('should have employment folder button with emoji and label', () => {
      expect(popupHtml).toContain('data-folder="employment">💼 Employment</button>');
    });

    test('should have sub-menu view with back button', () => {
      expect(popupHtml).toContain('id="subMenuView"');
      expect(popupHtml).toContain('id="backButton"');
      expect(popupHtml).toContain('← Back');
    });

    test('should have sub-menu items container', () => {
      expect(popupHtml).toContain('id="subMenuItems"');
      expect(popupHtml).toContain('class="sub-menu-items"');
    });

    test('should have configure hint in sub-menu', () => {
      expect(popupHtml).toContain('Configure items in Settings');
    });

    test('should NOT have old macro-btn class', () => {
      expect(popupHtml).not.toContain('class="macro-btn"');
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

    test('should mention JSON editing in info alert', () => {
      expect(settingsHtml).toContain('Edit the JSON for each folder');
    });

    test('should have all 6 folder sections', () => {
      const expectedFolders = ['demographics', 'references', 'education', 'skills', 'projects', 'employment'];

      expectedFolders.forEach((folder) => {
        expect(settingsHtml).toContain(`data-folder="${folder}"`);
        expect(settingsHtml).toContain(`id="folder-${folder}"`);
      });
    });

    test('should have JSON textarea for each folder', () => {
      const expectedFolders = ['demographics', 'references', 'education', 'skills', 'projects', 'employment'];

      expectedFolders.forEach((folder) => {
        expect(settingsHtml).toContain(`class="folder-json-editor" data-folder="${folder}"`);
      });
    });

    test('should have demographics folder with standard fields', () => {
      expect(settingsHtml).toContain('👤 Demographics');
      expect(settingsHtml).toContain('folder-json-editor" data-folder="demographics"');
    });

    test('should have references folder', () => {
      expect(settingsHtml).toContain('📋 References');
      expect(settingsHtml).toContain('folder-json-editor" data-folder="references"');
    });

    test('should have education folder', () => {
      expect(settingsHtml).toContain('🎓 Education');
      expect(settingsHtml).toContain('folder-json-editor" data-folder="education"');
    });

    test('should have skills folder', () => {
      expect(settingsHtml).toContain('💡 Skills');
      expect(settingsHtml).toContain('folder-json-editor" data-folder="skills"');
    });

    test('should have projects folder', () => {
      expect(settingsHtml).toContain('🚀 Projects');
      expect(settingsHtml).toContain('folder-json-editor" data-folder="projects"');
    });

    test('should have employment folder', () => {
      expect(settingsHtml).toContain('💼 Employment');
      expect(settingsHtml).toContain('folder-json-editor" data-folder="employment"');
    });

    test('should have folder expand/collapse icons', () => {
      expect(settingsHtml).toContain('class="folder-icon">▶</span>');
    });

    test('should have error display divs for each folder', () => {
      const expectedFolders = ['demographics', 'references', 'education', 'skills', 'projects', 'employment'];

      expectedFolders.forEach((folder) => {
        expect(settingsHtml).toContain(`class="folder-error" data-folder="${folder}"`);
      });
    });

    test('should have privacy notice', () => {
      expect(settingsHtml).toContain('stored locally in your browser');
      expect(settingsHtml).toContain('never sent to any server');
    });

    test('should mention nested objects support in folder hint', () => {
      expect(settingsHtml).toContain('Values can be strings or nested objects');
      expect(settingsHtml).toContain('verbalized as lists');
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

    test('popup.css should have folder button styling', () => {
      const popupCss = fs.readFileSync(
        path.join(__dirname, '../popup.css'),
        'utf8'
      );

      expect(popupCss).toContain('.folder-btn');
    });

    test('popup.css should have sub-menu styling', () => {
      const popupCss = fs.readFileSync(
        path.join(__dirname, '../popup.css'),
        'utf8'
      );

      expect(popupCss).toContain('.sub-menu-items');
      expect(popupCss).toContain('.sub-menu-item-btn');
    });
  });

  describe('JavaScript Integration', () => {
    test('popup.js should have folder navigation functions', () => {
      const popupJs = fs.readFileSync(
        path.join(__dirname, '../popup.js'),
        'utf8'
      );

      expect(popupJs).toContain('openFolder');
      expect(popupJs).toContain('closeFolder');
      expect(popupJs).toContain('renderSubMenuItems');
    });

    test('popup.js should have FOLDER_TITLES mapping', () => {
      const popupJs = fs.readFileSync(
        path.join(__dirname, '../popup.js'),
        'utf8'
      );

      expect(popupJs).toContain('FOLDER_TITLES');
      expect(popupJs).toContain('demographics');
      expect(popupJs).toContain('references');
      expect(popupJs).toContain('education');
      expect(popupJs).toContain('skills');
      expect(popupJs).toContain('projects');
      expect(popupJs).toContain('employment');
    });

    test('popup.js should have verbalization function for nested objects', () => {
      const popupJs = fs.readFileSync(
        path.join(__dirname, '../popup.js'),
        'utf8'
      );

      expect(popupJs).toContain('verbalizeValue');
      expect(popupJs).toContain('convert nested objects to readable text');
    });

    test('settings.js should have DEFAULT_MACROS with nested structure', () => {
      const settingsJs = fs.readFileSync(
        path.join(__dirname, '../settings.js'),
        'utf8'
      );

      expect(settingsJs).toContain('DEFAULT_MACROS');
      expect(settingsJs).toContain('demographics:');
      expect(settingsJs).toContain('references:');
      expect(settingsJs).toContain('education:');
      expect(settingsJs).toContain('skills:');
      expect(settingsJs).toContain('projects:');
      expect(settingsJs).toContain('employment:');
    });

    test('settings.js should have JSON validation functions', () => {
      const settingsJs = fs.readFileSync(
        path.join(__dirname, '../settings.js'),
        'utf8'
      );

      expect(settingsJs).toContain('validateFolderJSON');
      expect(settingsJs).toContain('setupFolderHandlers');
      expect(settingsJs).toContain('toggleFolder');
    });

    test('settings.js should have recursive validation for nested objects', () => {
      const settingsJs = fs.readFileSync(
        path.join(__dirname, '../settings.js'),
        'utf8'
      );

      expect(settingsJs).toContain('validateObjectValues');
    });
  });

  describe('Service Worker Integration', () => {
    test('service-worker.js should have nested storage structure', () => {
      const serviceWorkerJs = fs.readFileSync(
        path.join(__dirname, '../service-worker.js'),
        'utf8'
      );

      // Check for nested initialization
      expect(serviceWorkerJs).toContain('demographics:');
      expect(serviceWorkerJs).toContain('references:');
      expect(serviceWorkerJs).toContain('education:');
    });

    test('service-worker.js should have getClipboardFolder handler', () => {
      const serviceWorkerJs = fs.readFileSync(
        path.join(__dirname, '../service-worker.js'),
        'utf8'
      );

      expect(serviceWorkerJs).toContain('handleGetClipboardFolder');
      expect(serviceWorkerJs).toContain('getClipboardFolder');
    });

    test('service-worker.js should have migration logic', () => {
      const serviceWorkerJs = fs.readFileSync(
        path.join(__dirname, '../service-worker.js'),
        'utf8'
      );

      expect(serviceWorkerJs).toContain('Migration');
      expect(serviceWorkerJs).toContain('macros.phone');
    });
  });
});
