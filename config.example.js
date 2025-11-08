// config.example.js
// Copy this file to config.local.js and fill in your actual values
// See GOOGLE_APPS_SCRIPT_SETUP.md for detailed setup instructions

const CONFIG = {
  // Your Google Apps Script Web App deployment URL
  // Get this after deploying your Apps Script (step 4 in setup guide)
  APPS_SCRIPT_ENDPOINT: 'https://script.google.com/macros/s/AKfycbx.../exec',

  // Your Google Sheet ID (from the spreadsheet URL)
  // Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  // Your Google Cloud Project ID (numeric project number, not project name)
  // Find this in Google Cloud Console or Apps Script Project Settings
  PROJECT_ID: 'YOUR_PROJECT_ID_HERE',
};

// Expose globally depending on environment
if (typeof self !== 'undefined') self.APP_CONFIG = CONFIG;   // service worker or window
if (typeof global !== 'undefined') global.APP_CONFIG = CONFIG; // Node / Jest

// Only export if the environment supports modules (Node/Jest)
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
}