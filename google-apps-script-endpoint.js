/**
 * Google Apps Script Endpoint for JobSprint Extension
 *
 * This script receives job data from the JobSprint Chrome extension
 * and logs it to a Google Sheet.
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Copy this entire file
 * 2. Paste into your Google Apps Script editor
 * 3. Deploy as Web App
 * 4. Copy the deployment URL
 * 5. Update the extension's service-worker.js with your URL
 *
 * See GOOGLE_APPS_SCRIPT_SETUP.md for detailed step-by-step instructions.
 */

/**
 * Main entry point for HTTP POST requests from the extension
 * @param {Object} e - Event object containing request parameters
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  try {
    // Print test message to Google Cloud
    log('Request received');

    // Parse the JSON request body
    var requestData = JSON.parse(e.postData.contents);

    // Validate the incoming data
    var validation = validateJobData(requestData);
    if (!validation.valid) {
      return createJsonResponse({
        success: false,
        error: validation.error
      }, 400);
    }

    // Log the job data to the spreadsheet
    var result = logJobToSheet(requestData);

    if (result.success) {
      return createJsonResponse({
        success: true,
        timestamp: requestData.timestamp
      }, 200);
    } else {
      return createJsonResponse({
        success: false,
        error: result.error
      }, 500);
    }

  } catch (error) {
    log('Error processing request: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: 'Internal server error: ' + error.toString()
    }, 500);
  }
}

/**
 * Validates job data according to the API contract
 * @param {Object} data - Job data to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateJobData(data) {
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid job data: data must be an object' };
  }

  // Check all required fields exist and are non-empty strings
  var requiredFields = ['title', 'company', 'location', 'url', 'timestamp', 'spreadsheetId'];
  for (var i = 0; i < requiredFields.length; i++) {
    var field = requiredFields[i];

    if (!(field in data)) {
      return { valid: false, error: 'Invalid job data: missing required field "' + field + '"' };
    }

    if (typeof data[field] !== 'string' || data[field].trim() === '') {
      return { valid: false, error: 'Invalid job data: "' + field + '" must be a non-empty string' };
    }
  }

  // Validate timestamp format (ISO 8601)
  var timestamp = new Date(data.timestamp);
  if (isNaN(timestamp.getTime())) {
    return { valid: false, error: 'Invalid job data: timestamp must be a valid ISO 8601 date string' };
  }

  return { valid: true };
}

/**
 * Logs job data to the Google Sheet
 * @param {Object} jobData - Validated job data
 * @returns {Object} { success: boolean, error?: string }
 */
function logJobToSheet(jobData) {
  try {
    // Open the spreadsheet by ID (required for Web App deployment with "Anyone" access)
    var spreadsheet = SpreadsheetApp.openById(jobData.spreadsheetId);

    // Get or create the "Job Applications" sheet
    var sheet = spreadsheet.getSheetByName('Job Applications');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Job Applications');

      // Add header row if this is a new sheet
      sheet.appendRow([
        'Timestamp',
        'Job Title',
        'Company',
        'Location',
        'URL',
        'Source',
        'Date Added'
      ]);

      // Format header row (bold, frozen)
      var headerRange = sheet.getRange('A1:G1');
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // Prepare the row data
    var rowData = [
      jobData.timestamp,
      jobData.title,
      jobData.company,
      jobData.location,
      jobData.url,
      jobData.source || '',
      new Date().toISOString()
    ];

    // Append the data to the sheet
    sheet.appendRow(rowData);

    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, 7);

    log('Successfully logged job: ' + jobData.title + ' at ' + jobData.company);

    return { success: true };

  } catch (error) {
    log('Error writing to sheet: ' + error.toString());
    return {
      success: false,
      error: 'Failed to write to spreadsheet: ' + error.toString()
    };
  }
}

/**
 * Creates a JSON response with proper content type
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code
 * @returns {ContentService.TextOutput} JSON response
 */
function createJsonResponse(data, statusCode) {
  var response = ContentService.createTextOutput(JSON.stringify(data));
  response.setMimeType(ContentService.MimeType.JSON);

  // Note: Apps Script Web Apps don't support custom HTTP status codes
  // The statusCode parameter is for documentation purposes

  return response;
}

/**
 * Test function - run this to verify the script works
 * This simulates a POST request from the extension
 */
function testDoPost() {
  var testData = {
    postData: {
      contents: JSON.stringify({
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        url: 'https://example.com/jobs/123',
        timestamp: new Date().toISOString(),
        source: 'Test',
        spreadsheetId: 'YOUR_SPREADSHEET_ID_HERE'
      })
    }
  };

  var response = doPost(testData);
  log('Test response: ' + response.getContent());
}


/**
 * Write log entries directly to Cloud Logging (works for Web App executions too)
 * @param {string} message - The text message to log
 * @param {string} [severity] - Optional severity: "INFO", "WARNING", or "ERROR"
 */
function log(message, severity) {
  // Get the bound Cloud Project ID automatically
  const projectId = ScriptApp.getProjectId();

  // Build the structured log payload
  const payload = {
    logName: 'projects/' + ScriptApp.getProjectId() + '/logs/custom',      // Custom log name visible in Logs Explorer
    resource: { type: 'app_script_function' },          // Resource type used for Apps Script executions
    entries: [{                                         // One or more log entries
      textPayload: String(message),                     // The actual message text
      severity: severity || 'INFO'                      // Default severity is INFO
    }]
  };

  // HTTP request options for the Cloud Logging API
  const options = {
    method: 'post',                                     // POST to /entries:write
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true                            // Prevent throw if logging fails silently
  };

  // Send log entry to Cloud Logging REST endpoint
  UrlFetchApp.fetch('https://logging.googleapis.com/v2/entries:write', options);
}
