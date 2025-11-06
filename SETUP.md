# Project Setup Guide

This document provides initial setup instructions for the JobSprint Chrome Extension.

## File Structure

```
job-sprint-ext/
├── manifest.json           # Chrome Extension configuration (Manifest V3)
├── service-worker.js       # Background script for core logic
├── content-script.js       # Injected script for webpage interaction
├── popup.html              # Extension popup UI
├── popup.css               # Popup styling
├── popup.js                # Popup interaction logic
├── utils.js                # Shared utility functions
├── package.json            # Node.js dependencies and scripts
├── .gitignore              # Git ignore rules
├── icons/                  # Extension icons (add PNG files)
│   └── README.md           # Instructions for icons
└── __tests__/              # Jest unit tests
    └── utils.test.js       # Utility function tests
```

## Installation & Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `job-sprint-ext` directory

### 3. Testing

Run unit tests with Jest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Next Steps

### Required Configuration

1. **Icons**: Add icon files to the `icons/` directory:
   - icon16.png (16x16)
   - icon48.png (48x48)
   - icon128.png (128x128)

2. **Google Sheets Integration**:
   - Create a Google Apps Script Web App for logging job data
   - Update the endpoint URL in `service-worker.js` (line ~98)

3. **Clipboard Macros**:
   - Open the extension popup
   - Click "Edit Macros" to set your personal information

### Feature Implementation Status

- ✅ Clipboard Macros - Basic structure complete
- ✅ Data Extraction - Basic structure complete
- ✅ Autofill - Basic structure complete
- ⏳ Approval UI - Needs custom overlay (currently uses confirm dialog)
- ⏳ Site-specific selectors - Needs refinement per job board
- ⏳ Settings page - Not yet implemented

## Development Workflow

1. Make code changes
2. Save files
3. Go to `chrome://extensions`
4. Click reload button on JobSprint card
5. Test functionality in browser

## Debugging

- **Service Worker**: Click "Service Worker" link in `chrome://extensions`
- **Content Script**: Press F12 on the webpage to open DevTools
- **Popup**: Right-click popup and select "Inspect"

## GitHub Actions CI/CD

The project includes Jest tests that will run automatically on pull requests via GitHub Actions. Ensure all tests pass before merging.
