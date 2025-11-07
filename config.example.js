// config.example.js
const CONFIG = {
  APPS_SCRIPT_ENDPOINT: 'https://script.google.com/macros/s/AKfycbx.../exec',
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  PROJECT_ID: 'YOUR_PROJECT_ID_HERE',
};

// Expose globally depending on environment
if (typeof self !== 'undefined') self.APP_CONFIG = CONFIG;   // service worker or window
if (typeof global !== 'undefined') global.APP_CONFIG = CONFIG; // Node / Jest

// Only export if the environment supports modules (Node/Jest)
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
}