/**
 * Google Apps Script Endpoint for JobSprint Extension
 *
 * This script receives job data from the JobSprint Chrome extension
 * and logs it to a Google Sheet.
 *
 * SECURITY NOTE:
 * This script uses Script Properties to store sensitive configuration (spreadsheet ID, project ID).
 * These values are stored server-side and are NOT transmitted over the network.
 * Only the Apps Script endpoint URL needs to be known by the extension.
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Copy this entire file into your Google Apps Script editor
 * 2. Run setupConfiguration() function ONCE to store your spreadsheet and project IDs
 * 3. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL and save it in the extension settings
 * 5. Run testDoPost() to verify everything works
 *
 * LOGGING:
 * Logs are sent to Google Cloud Logging using console.info(), console.warn(), console.error()
 * View them at: https://console.cloud.google.com/logs/query
 *
 * Use this query to see all log levels (INFO, WARNING, ERROR):
 * resource.type="app_script_function" AND resource.labels.function_name="doPost" AND jsonPayload.message=~"JobSprint:.*"
 *
 * If WARNING/ERROR logs don't show, check the severity filter dropdown (select "All severities")
 *
 * MVP BEHAVIOR:
 * This script accepts partial/incomplete job data. Only job details are sent in requests.
 * Configuration (spreadsheet ID, project ID) is stored server-side in Script Properties.
 * Missing job fields (title, company, location, etc.) are filled with defaults like "(No company)".
 * This allows capturing whatever data is available from each page.
 *
 * See GOOGLE_APPS_SCRIPT_SETUP.md for detailed instructions.
 */

/**
 * Setup function - run this FIRST to configure your spreadsheet and project IDs
 * This stores the configuration in Script Properties so you don't need to hardcode values
 *
 * BEFORE RUNNING: Replace the placeholder IDs below with your actual IDs
 */
function setupConfiguration() {
  var spreadsheetId = 'YOUR_SPREADSHEET_ID_HERE';  // ← REPLACE THIS
  var projectId = 'YOUR_PROJECT_ID_HERE';  // ← REPLACE THIS (your GCP project ID)

  // Validate inputs
  if (spreadsheetId === 'YOUR_SPREADSHEET_ID_HERE' || projectId === 'YOUR_PROJECT_ID_HERE') {
    console.error('❌ ERROR: Please replace the placeholder IDs with your actual IDs first!');
    console.error('Edit this function and update spreadsheetId and projectId before running.');
    return { success: false, error: 'Configuration not updated - placeholder values detected' };
  }

  try {
    // Store in Script Properties
    var scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperties({
      'SPREADSHEET_ID': spreadsheetId,
      'PROJECT_ID': projectId
    });

    console.info('✅ Configuration saved successfully!');
    console.info({
      message: 'JobSprint: Configuration saved',
      spreadsheetId: spreadsheetId,
      projectId: projectId
    });

    return {
      success: true,
      message: 'Configuration saved. You can now run testDoPost() and runDiagnostics() without editing them.',
      spreadsheetId: spreadsheetId,
      projectId: projectId
    };
  } catch (error) {
    console.error('❌ Failed to save configuration: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get configuration from Script Properties
 * Returns stored spreadsheet and project IDs
 */
function getConfiguration() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
  var projectId = scriptProperties.getProperty('PROJECT_ID');

  if (!spreadsheetId || !projectId) {
    console.warn('⚠️ Configuration not found. Please run setupConfiguration() first.');
    return null;
  }

  return {
    spreadsheetId: spreadsheetId,
    projectId: projectId
  };
}

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
    console.info({
      message: 'JobSprint: Incoming request',
      requestId: requestId,
      timestamp: startTime.toISOString()
    });

    // Parse the JSON request body
    var requestData = JSON.parse(e.postData.contents);

    console.log({
      message: 'JobSprint: Request parsed',
      requestId: requestId,
      hasTitle: !!requestData.title,
      hasCompany: !!requestData.company,
      hasLocation: !!requestData.location
    });

    // Get configuration from Script Properties
    var config = getConfiguration();
    if (!config) {
      console.error({
        message: 'JobSprint: Configuration not found',
        requestId: requestId,
        hint: 'Run setupConfiguration() to configure this script'
      });

      return createJsonResponse({
        success: false,
        error: 'Server configuration not set up. Please run setupConfiguration() in the Apps Script editor.'
      }, 500);
    }

    // Validate the incoming data (just checks it's a valid object with job fields)
    var validation = validateJobData(requestData);
    if (!validation.valid) {
      console.warn({
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

    // Log the job data to the spreadsheet using server-side configuration
    var result = logJobToSheet(requestData, config, requestId);

    if (result.success) {
      var duration = new Date() - startTime;
      console.info({
        message: 'JobSprint: Successfully logged job',
        requestId: requestId,
        jobTitle: requestData.title || '(No title)',
        company: requestData.company || '(No company)',
        durationMs: duration
      });

      return createJsonResponse({
        success: true,
        timestamp: requestData.timestamp
      }, 200);
    } else {
      console.error({
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
    console.error({
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
 * For MVP: Accept any valid object with job fields (all optional)
 * Configuration fields are NOT accepted in requests - they're stored server-side
 * @param {Object} data - Job data to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateJobData(data) {
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid job data: data must be an object' };
  }

  // For security: Reject requests that try to send configuration fields
  // Configuration should only be set server-side via setupConfiguration()
  if ('spreadsheetId' in data || 'projectId' in data) {
    return {
      valid: false,
      error: 'Invalid request: configuration fields should not be sent in requests. Use setupConfiguration() to configure the server.'
    };
  }

  // For MVP: All job data fields are optional - we'll log whatever we have
  // This allows us to capture partial data from pages with incomplete extraction

  return { valid: true };
}

/**
 * Logs job data to the Google Sheet
 * @param {Object} jobData - Validated job data (title, company, location, url, etc.)
 * @param {Object} config - Server-side configuration from Script Properties
 * @param {string} requestId - Request ID for logging correlation
 * @returns {Object} { success: boolean, error?: string, errorDetails?: Object }
 */
function logJobToSheet(jobData, config, requestId) {
  var spreadsheet = null;
  var sheet = null;

  try {
    console.log({
      message: 'JobSprint: Attempting to open spreadsheet',
      requestId: requestId,
      hasSpreadsheetId: !!config.spreadsheetId
    });

    // Open the spreadsheet by ID using server-side configuration
    spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);

    console.log({
      message: 'JobSprint: Spreadsheet opened successfully',
      requestId: requestId,
      spreadsheetName: spreadsheet.getName()
    });

    // Get or create the "Job Applications" sheet
    sheet = spreadsheet.getSheetByName('Job Applications');
    if (!sheet) {
      console.info({
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

    // Prepare the row data - use defaults for missing/empty fields (MVP: accept partial data)
    var rowData = [
      jobData.timestamp || new Date().toISOString(),
      jobData.title || '(No title)',
      jobData.company || '(No company)',
      jobData.location || '(No location)',
      jobData.url || '',
      jobData.source || '',
      new Date().toISOString()
    ];

    console.log({
      message: 'JobSprint: Appending row to sheet',
      requestId: requestId,
      sheetName: sheet.getName(),
      currentRowCount: sheet.getLastRow()
    });

    // Append the data to the sheet
    sheet.appendRow(rowData);

    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, 7);

    console.info({
      message: 'JobSprint: Job logged to sheet successfully',
      requestId: requestId,
      jobTitle: jobData.title || '(No title)',
      company: jobData.company || '(No company)',
      newRowNumber: sheet.getLastRow()
    });

    return { success: true };

  } catch (error) {
    // Detailed error logging for Cloud Logging
    var errorDetails = {
      errorMessage: error.toString(),
      errorName: error.name,
      hasSpreadsheet: !!spreadsheet,
      hasSheet: !!sheet
    };

    console.error({
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
 * SETUP: Run setupConfiguration() FIRST to set your IDs, then you can run this test anytime
 */
function testDoPost() {
  console.info({
    message: 'JobSprint: Running test function',
    timestamp: new Date().toISOString()
  });

  // Get configuration from Script Properties
  var config = getConfiguration();
  if (!config) {
    console.error('❌ TEST FAILED: No configuration found.');
    console.error('Please run setupConfiguration() first to set your spreadsheet and project IDs.');
    return { success: false, error: 'Configuration not set. Run setupConfiguration() first.' };
  }

  var testData = {
    postData: {
      contents: JSON.stringify({
        title: 'Software Engineer (TEST)',
        company: 'Test Company',
        location: 'San Francisco, CA',
        url: 'https://example.com/jobs/test-123',
        timestamp: new Date().toISOString(),
        source: 'Manual Test'
      })
    }
  };

  var response = doPost(testData);
  var responseData = JSON.parse(response.getContent());

  console.info({
    message: 'JobSprint: Test completed',
    success: responseData.success,
    config: config
  });

  if (responseData.success) {
    console.info('✅ TEST PASSED: Job logged successfully');
    console.info('You can now use the Chrome extension with confidence!');
  } else {
    console.error('❌ TEST FAILED: ' + responseData.error);
  }

  return responseData;
}

/**
 * Diagnostic function - run this to check permissions and configuration
 * This helps troubleshoot authorization issues
 *
 * SETUP: Run setupConfiguration() FIRST, then this function will automatically use your saved IDs
 */
function runDiagnostics() {
  console.info({
    message: 'JobSprint: Running diagnostics',
    timestamp: new Date().toISOString()
  });

  // Get configuration from Script Properties
  var config = getConfiguration();
  if (!config) {
    console.error('❌ DIAGNOSTICS FAILED: No configuration found.');
    console.error('Please run setupConfiguration() first to set your spreadsheet and project IDs.');
    return { success: false, error: 'Configuration not set. Run setupConfiguration() first.' };
  }

  var spreadsheetId = config.spreadsheetId;

  console.info({
    message: 'JobSprint: Using configuration',
    spreadsheetId: spreadsheetId,
    projectId: config.projectId
  });

  // Check user context
  console.info({
    message: 'JobSprint: User context',
    hasEffectiveUser: !!Session.getEffectiveUser().getEmail(),
    hasActiveUser: !!Session.getActiveUser().getEmail(),
    timezone: Session.getScriptTimeZone()
  });

  // Try to access the spreadsheet
  try {
    console.log({
      message: 'JobSprint: Attempting to access spreadsheet',
      hasSpreadsheetId: !!spreadsheetId
    });

    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    console.info({
      message: '✅ Spreadsheet access successful',
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
      hasOwner: !!spreadsheet.getOwner(),
      editorCount: spreadsheet.getEditors().length,
      viewerCount: spreadsheet.getViewers().length
    });

    // Try to get or create sheet
    var sheet = spreadsheet.getSheetByName('Job Applications');
    if (sheet) {
      console.info({
        message: '✅ Job Applications sheet exists',
        rowCount: sheet.getLastRow(),
        columnCount: sheet.getLastColumn()
      });
    } else {
      console.warn({
        message: 'Job Applications sheet does not exist (will be created on first job log)'
      });
    }

    console.info('✅ DIAGNOSTICS PASSED: All permissions OK');
    console.info('You can now deploy this script as a Web App and use it with the Chrome extension!');
    return {
      success: true,
      message: 'All permissions OK',
      spreadsheetUrl: spreadsheet.getUrl(),
      spreadsheetName: spreadsheet.getName()
    };

  } catch (error) {
    console.error({
      message: '❌ Spreadsheet access failed',
      error: error.toString(),
      errorName: error.name,
      hasSpreadsheetId: !!spreadsheetId
    });

    console.error('❌ DIAGNOSTICS FAILED: ' + error.toString());

    if (error.toString().indexOf('Authorization') !== -1 || error.toString().indexOf('Permission') !== -1) {
      console.warn('🔧 TROUBLESHOOTING STEPS:');
      console.warn('1. Verify the spreadsheet ID is correct in setupConfiguration()');
      console.warn('2. Ensure the script owner has edit access to the spreadsheet');
      console.warn('3. Try opening the spreadsheet URL directly to confirm access:');
      console.warn('   https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit');
      console.warn('4. If recently deployed, wait a few minutes for permissions to propagate');
      console.warn('5. Redeploy the Web App as a new version');
    }

    return { success: false, error: error.toString() };
  }
}
