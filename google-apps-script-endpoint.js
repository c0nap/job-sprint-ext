/**
 * Google Apps Script Endpoint for JobSprint Extension
 *
 * This script receives job data from the JobSprint Chrome extension
 * and logs it to a Google Sheet.
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Copy this entire file
 * 2. Paste into your Google Apps Script editor
 * 3. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL
 * 5. Update the extension's config.local.js with:
 *    - APPS_SCRIPT_ENDPOINT: your deployment URL
 *    - SPREADSHEET_ID: your Google Sheet ID
 *    - PROJECT_ID: your Google Cloud Project ID (optional, for custom logging)
 *
 * LOGGING:
 * Logs are sent to Google Cloud Logging using console.log()
 * View them at: https://console.cloud.google.com/logs/query
 *
 * Filter by: resource.type="app_script_function" AND jsonPayload.message=~"JobSprint:.*"
 *
 * See GOOGLE_APPS_SCRIPT_SETUP.md and CLOUD_LOGGING.md for detailed instructions.
 */

/**
 * Main entry point for HTTP POST requests from the extension
 * @param {Object} e - Event object containing request parameters
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  var requestId = Utilities.getUuid();
  var startTime = new Date();

  try {
    // Log incoming request
    console.log({
      severity: 'INFO',
      message: 'JobSprint: Incoming request',
      requestId: requestId,
      timestamp: startTime.toISOString()
    });

    // Parse the JSON request body
    var requestData = JSON.parse(e.postData.contents);

    console.log({
      severity: 'DEBUG',
      message: 'JobSprint: Request parsed',
      requestId: requestId,
      jobTitle: requestData.title,
      company: requestData.company,
      spreadsheetId: requestData.spreadsheetId ? requestData.spreadsheetId.substring(0, 8) + '...' : 'MISSING',
      hasProjectId: !!requestData.projectId
    });

    // Validate the incoming data
    var validation = validateJobData(requestData);
    if (!validation.valid) {
      console.log({
        severity: 'WARNING',
        message: 'JobSprint: Validation failed',
        requestId: requestId,
        error: validation.error,
        receivedFields: Object.keys(requestData)
      });

      return createJsonResponse({
        success: false,
        error: validation.error
      }, 400);
    }

    // Log the job data to the spreadsheet
    var result = logJobToSheet(requestData, requestId);

    if (result.success) {
      var duration = new Date() - startTime;
      console.log({
        severity: 'INFO',
        message: 'JobSprint: Successfully logged job',
        requestId: requestId,
        jobTitle: requestData.title,
        company: requestData.company,
        durationMs: duration
      });

      return createJsonResponse({
        success: true,
        timestamp: requestData.timestamp
      }, 200);
    } else {
      console.log({
        severity: 'ERROR',
        message: 'JobSprint: Failed to log job',
        requestId: requestId,
        error: result.error,
        errorDetails: result.errorDetails
      });

      return createJsonResponse({
        success: false,
        error: result.error
      }, 500);
    }

  } catch (error) {
    console.log({
      severity: 'ERROR',
      message: 'JobSprint: Uncaught error in doPost',
      requestId: requestId,
      error: error.toString(),
      stack: error.stack,
      errorType: error.name
    });

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
  // Note: projectId is optional but recommended for advanced logging
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
 * @param {string} requestId - Request ID for logging correlation
 * @returns {Object} { success: boolean, error?: string, errorDetails?: Object }
 */
function logJobToSheet(jobData, requestId) {
  var spreadsheet = null;
  var sheet = null;

  try {
    console.log({
      severity: 'DEBUG',
      message: 'JobSprint: Attempting to open spreadsheet',
      requestId: requestId,
      spreadsheetId: jobData.spreadsheetId.substring(0, 8) + '...',
      effectiveUser: Session.getEffectiveUser().getEmail(),
      activeUser: Session.getActiveUser().getEmail()
    });

    // Open the spreadsheet by ID (required for Web App deployment with "Anyone" access)
    spreadsheet = SpreadsheetApp.openById(jobData.spreadsheetId);

    console.log({
      severity: 'DEBUG',
      message: 'JobSprint: Spreadsheet opened successfully',
      requestId: requestId,
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl()
    });

    // Get or create the "Job Applications" sheet
    sheet = spreadsheet.getSheetByName('Job Applications');
    if (!sheet) {
      console.log({
        severity: 'INFO',
        message: 'JobSprint: Creating new Job Applications sheet',
        requestId: requestId
      });

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

    console.log({
      severity: 'DEBUG',
      message: 'JobSprint: Appending row to sheet',
      requestId: requestId,
      sheetName: sheet.getName(),
      rowCount: sheet.getLastRow()
    });

    // Append the data to the sheet
    sheet.appendRow(rowData);

    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, 7);

    console.log({
      severity: 'INFO',
      message: 'JobSprint: Job logged to sheet successfully',
      requestId: requestId,
      jobTitle: jobData.title,
      company: jobData.company,
      newRowNumber: sheet.getLastRow()
    });

    return { success: true };

  } catch (error) {
    // Detailed error logging for Cloud Logging
    var errorDetails = {
      errorMessage: error.toString(),
      errorName: error.name,
      errorStack: error.stack,
      spreadsheetId: jobData.spreadsheetId,
      attemptedSpreadsheetAccess: !!spreadsheet,
      attemptedSheetAccess: !!sheet,
      effectiveUser: Session.getEffectiveUser().getEmail(),
      activeUser: Session.getActiveUser().getEmail(),
      scriptTimezone: Session.getScriptTimeZone()
    };

    console.log({
      severity: 'ERROR',
      message: 'JobSprint: Error writing to spreadsheet',
      requestId: requestId,
      error: error.toString(),
      errorType: error.name,
      errorDetails: errorDetails
    });

    // Provide user-friendly error message
    var userError = 'Failed to write to spreadsheet';
    if (error.toString().indexOf('Authorization') !== -1 || error.toString().indexOf('Permission') !== -1) {
      userError = 'Authorization error: Please ensure the spreadsheet ID is correct and the script owner has access to the spreadsheet';
    } else if (error.toString().indexOf('not found') !== -1) {
      userError = 'Spreadsheet not found: Please verify the spreadsheet ID in your config';
    }

    return {
      success: false,
      error: userError + ': ' + error.toString(),
      errorDetails: errorDetails
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
 *
 * BEFORE RUNNING: Replace 'YOUR_SPREADSHEET_ID_HERE' with your actual spreadsheet ID
 */
function testDoPost() {
  console.log({
    severity: 'INFO',
    message: 'JobSprint: Running test function',
    timestamp: new Date().toISOString()
  });

  var testData = {
    postData: {
      contents: JSON.stringify({
        title: 'Software Engineer (TEST)',
        company: 'Test Company',
        location: 'San Francisco, CA',
        url: 'https://example.com/jobs/test-123',
        timestamp: new Date().toISOString(),
        source: 'Manual Test',
        spreadsheetId: 'YOUR_SPREADSHEET_ID_HERE',  // ← REPLACE THIS
        projectId: 'YOUR_PROJECT_ID_HERE'  // ← OPTIONAL: for custom logging
      })
    }
  };

  var response = doPost(testData);
  var responseData = JSON.parse(response.getContent());

  console.log({
    severity: 'INFO',
    message: 'JobSprint: Test completed',
    success: responseData.success,
    response: responseData
  });

  if (responseData.success) {
    console.log('✅ TEST PASSED: Job logged successfully');
  } else {
    console.log('❌ TEST FAILED: ' + responseData.error);
  }

  return responseData;
}

/**
 * Diagnostic function - run this to check permissions and configuration
 * This helps troubleshoot authorization issues
 *
 * BEFORE RUNNING: Replace 'YOUR_SPREADSHEET_ID_HERE' with your actual spreadsheet ID
 */
function runDiagnostics() {
  var spreadsheetId = 'YOUR_SPREADSHEET_ID_HERE';  // ← REPLACE THIS

  console.log({
    severity: 'INFO',
    message: 'JobSprint: Running diagnostics',
    timestamp: new Date().toISOString()
  });

  // Check user context
  console.log({
    severity: 'INFO',
    message: 'JobSprint: User context',
    effectiveUser: Session.getEffectiveUser().getEmail(),
    activeUser: Session.getActiveUser().getEmail(),
    timezone: Session.getScriptTimeZone(),
    projectId: ScriptApp.getProjectId()
  });

  // Try to access the spreadsheet
  try {
    console.log({
      severity: 'INFO',
      message: 'JobSprint: Attempting to access spreadsheet',
      spreadsheetId: spreadsheetId
    });

    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    console.log({
      severity: 'INFO',
      message: '✅ Spreadsheet access successful',
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
      owner: spreadsheet.getOwner().getEmail(),
      editors: spreadsheet.getEditors().map(function(e) { return e.getEmail(); }),
      viewers: spreadsheet.getViewers().map(function(v) { return v.getEmail(); })
    });

    // Try to get or create sheet
    var sheet = spreadsheet.getSheetByName('Job Applications');
    if (sheet) {
      console.log({
        severity: 'INFO',
        message: '✅ Job Applications sheet exists',
        rowCount: sheet.getLastRow(),
        columnCount: sheet.getLastColumn()
      });
    } else {
      console.log({
        severity: 'WARNING',
        message: 'Job Applications sheet does not exist (will be created on first job log)'
      });
    }

    console.log('✅ DIAGNOSTICS PASSED: All permissions OK');
    return { success: true, message: 'All permissions OK' };

  } catch (error) {
    console.log({
      severity: 'ERROR',
      message: '❌ Spreadsheet access failed',
      error: error.toString(),
      errorName: error.name,
      errorStack: error.stack,
      spreadsheetId: spreadsheetId
    });

    console.log('❌ DIAGNOSTICS FAILED: ' + error.toString());

    if (error.toString().indexOf('Authorization') !== -1 || error.toString().indexOf('Permission') !== -1) {
      console.log('\n🔧 TROUBLESHOOTING STEPS:');
      console.log('1. Verify the spreadsheet ID is correct');
      console.log('2. Ensure the script owner (' + Session.getEffectiveUser().getEmail() + ') has edit access to the spreadsheet');
      console.log('3. Try opening the spreadsheet URL directly to confirm access');
      console.log('4. If recently deployed, wait a few minutes for permissions to propagate');
      console.log('5. Redeploy the Web App as a new version');
    }

    return { success: false, error: error.toString() };
  }
}
