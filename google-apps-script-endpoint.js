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
 * FLEXIBLE SCHEMA:
 * This script now supports flexible, user-defined schemas. The extension sends job data
 * with custom field names defined in the schema editor. This script will:
 * - Dynamically create column headers based on incoming data
 * - Handle any column names in any order
 * - Fill missing columns with empty values
 * - Preserve existing columns in the sheet
 * - Maintain backward compatibility with fixed 13-column format
 *
 * SCHEMA MAPPING:
 * The extension uses these internal field IDs (customizable via Settings > Schema Editor):
 * - company → Employer column
 * - title → Job Title column
 * - location → Location column
 * - url → Portal Link column
 * - source → Board column
 * - role → Role column
 * - tailor → Tailor column
 * - description → Notes column
 * - compensation → Compensation column
 * - pay → Pay column
 * + any custom fields you add (e.g., "remote", "team_size", "tech_stack")
 *
 * The script automatically adds these system columns:
 * - Status (always "No response")
 * - Applied (auto-filled with current date)
 * - Decision (empty for user to fill later)
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
 * Get or create headers dynamically based on job data
 * Handles flexible schema - preserves existing headers and adds new ones as needed
 * @param {Sheet} sheet - Google Sheet object
 * @param {Object} jobData - Job data being logged
 * @param {boolean} isNewSheet - Whether this is a newly created sheet
 * @returns {Array<string>} Array of header names
 */
function getOrCreateHeaders(sheet, jobData, isNewSheet) {
  // Define standard column mapping (field ID → display label)
  var fieldLabelMap = {
    'company': 'Employer',
    'title': 'Job Title',
    'location': 'Location',
    'url': 'Portal Link',
    'source': 'Board',
    'role': 'Role',
    'tailor': 'Tailor',
    'description': 'Notes',
    'compensation': 'Compensation',
    'pay': 'Pay'
  };

  // System columns that are always added
  var systemColumns = ['Status', 'Applied', 'Decision'];

  if (isNewSheet) {
    // New sheet: create default headers based on standard fields + any custom fields
    var headers = [];

    // Add standard columns that exist in jobData
    for (var fieldId in fieldLabelMap) {
      if (jobData.hasOwnProperty(fieldId) || fieldId === 'company' || fieldId === 'title') {
        // Always include company and title, even if empty
        headers.push(fieldLabelMap[fieldId]);
      }
    }

    // Add system columns
    headers = headers.concat(systemColumns);

    // Add any custom fields not in the standard mapping
    for (var key in jobData) {
      if (jobData.hasOwnProperty(key) &&
          !fieldLabelMap.hasOwnProperty(key) &&
          key !== 'timestamp' && key !== 'targetSheetName') {
        // Custom field - use field ID as label (capitalize first letter)
        var customLabel = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        if (headers.indexOf(customLabel) === -1) {
          headers.push(customLabel);
        }
      }
    }

    // Write headers to sheet
    sheet.appendRow(headers);

    // Format header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    return headers;
  } else {
    // Existing sheet: get current headers
    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      // Sheet exists but no headers - treat as new
      return getOrCreateHeaders(sheet, jobData, true);
    }

    var headerRange = sheet.getRange(1, 1, 1, lastCol);
    var headers = headerRange.getValues()[0];

    // Check if any new columns need to be added
    var newColumns = [];

    // Check standard fields
    for (var fieldId in fieldLabelMap) {
      if (jobData.hasOwnProperty(fieldId)) {
        var label = fieldLabelMap[fieldId];
        if (headers.indexOf(label) === -1) {
          newColumns.push(label);
        }
      }
    }

    // Check custom fields
    for (var key in jobData) {
      if (jobData.hasOwnProperty(key) &&
          !fieldLabelMap.hasOwnProperty(key) &&
          key !== 'timestamp' && key !== 'targetSheetName') {
        var customLabel = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        if (headers.indexOf(customLabel) === -1 && newColumns.indexOf(customLabel) === -1) {
          newColumns.push(customLabel);
        }
      }
    }

    // Add new columns if needed
    if (newColumns.length > 0) {
      var newHeaderRange = sheet.getRange(1, headers.length + 1, 1, newColumns.length);
      newHeaderRange.setValues([newColumns]);
      newHeaderRange.setFontWeight('bold');
      newHeaderRange.setBackground('#4285f4');
      newHeaderRange.setFontColor('#ffffff');
      headers = headers.concat(newColumns);
    }

    return headers;
  }
}

/**
 * Create row data array matching header order
 * @param {Array<string>} headers - Sheet headers
 * @param {Object} jobData - Job data
 * @param {Object} fieldLabelMap - Mapping of field IDs to labels
 * @returns {Array} Row data in correct column order
 */
function createRowData(headers, jobData, fieldLabelMap) {
  var rowData = [];
  var appliedDate = formatAppliedDate(jobData.timestamp);

  // Reverse lookup map (label → field ID)
  var labelFieldMap = {};
  for (var fieldId in fieldLabelMap) {
    labelFieldMap[fieldLabelMap[fieldId]] = fieldId;
  }

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];

    // Handle system columns
    if (header === 'Status') {
      rowData.push('No response');
    } else if (header === 'Applied') {
      rowData.push(appliedDate);
    } else if (header === 'Decision') {
      rowData.push('');
    }
    // Handle standard fields
    else if (labelFieldMap.hasOwnProperty(header)) {
      var fieldId = labelFieldMap[header];
      var value = jobData[fieldId] || '';

      // Special handling for inferred values
      if (fieldId === 'source' && !value) {
        value = inferBoard(jobData.url, jobData.source);
      } else if (fieldId === 'role' && !value) {
        value = inferRole(jobData.title);
      } else if (fieldId === 'tailor' && !value) {
        value = jobData.role || inferRole(jobData.title);
      }

      rowData.push(value);
    }
    // Handle custom fields
    else {
      // Convert label back to field ID (lowercase, replace spaces with underscores)
      var customFieldId = header.toLowerCase().replace(/ /g, '_');
      rowData.push(jobData[customFieldId] || jobData[header] || '');
    }
  }

  return rowData;
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

    // Get sheet name from config, default to "Job Applications"
    var sheetName = jobData.targetSheetName || 'Job Applications';

    // Get or create the target sheet
    sheet = spreadsheet.getSheetByName(sheetName);
    var isNewSheet = false;
    if (!sheet) {
      console.info({
        message: 'JobSprint: Creating new sheet',
        requestId: requestId,
        sheetName: sheetName
      });

      sheet = spreadsheet.insertSheet(sheetName);
      isNewSheet = true;
    }

    // Get or create headers dynamically based on job data
    var headers = getOrCreateHeaders(sheet, jobData, isNewSheet);

    console.log({
      message: 'JobSprint: Headers determined',
      requestId: requestId,
      headerCount: headers.length,
      headers: headers
    });

    // Create row data dynamically based on headers
    var fieldLabelMap = {
      'company': 'Employer',
      'title': 'Job Title',
      'location': 'Location',
      'url': 'Portal Link',
      'source': 'Board',
      'role': 'Role',
      'tailor': 'Tailor',
      'description': 'Notes',
      'compensation': 'Compensation',
      'pay': 'Pay'
    };

    var rowData = createRowData(headers, jobData, fieldLabelMap);

    console.log({
      message: 'JobSprint: Appending row to sheet',
      requestId: requestId,
      sheetName: sheet.getName(),
      currentRowCount: sheet.getLastRow(),
      columnCount: rowData.length
    });

    // Append the data to the sheet
    sheet.appendRow(rowData);

    // Auto-resize columns for better readability (all columns)
    if (headers.length > 0) {
      sheet.autoResizeColumns(1, headers.length);
    }

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
 * Infer the job board from URL or source
 * @param {string} url - Job posting URL
 * @param {string} source - Source field from job data
 * @returns {string} Inferred board name
 */
function inferBoard(url, source) {
  if (!url && !source) return 'Other';

  var urlLower = (url || '').toLowerCase();
  var sourceLower = (source || '').toLowerCase();

  // Check URL and source for known boards
  if (urlLower.indexOf('indeed.com') !== -1 || sourceLower.indexOf('indeed') !== -1) {
    return 'Indeed';
  } else if (urlLower.indexOf('linkedin.com') !== -1 || sourceLower.indexOf('linkedin') !== -1) {
    return 'LinkedIn';
  } else if (urlLower.indexOf('handshake') !== -1 || sourceLower.indexOf('handshake') !== -1) {
    return 'Handshake';
  } else if (urlLower.indexOf('symplicity') !== -1 || sourceLower.indexOf('symplicity') !== -1) {
    return 'Symplicity';
  } else if (urlLower.indexOf('google.com/about/careers') !== -1 || sourceLower.indexOf('google') !== -1) {
    return 'Google';
  } else if (urlLower.indexOf('greenhouse.io') !== -1) {
    return 'Website';
  } else if (urlLower.indexOf('lever.co') !== -1) {
    return 'Website';
  } else if (urlLower.indexOf('workday.com') !== -1) {
    return 'Website';
  } else if (urlLower.indexOf('myworkdayjobs.com') !== -1) {
    return 'Website';
  } else if (urlLower.indexOf('taleo') !== -1) {
    return 'Website';
  } else if (urlLower.indexOf('icims.com') !== -1) {
    return 'Website';
  } else if (urlLower.indexOf('jobs.') !== -1 || urlLower.indexOf('careers.') !== -1) {
    return 'Website';
  }

  return 'Other';
}

/**
 * Format timestamp to MM/DD/YYYY date
 * @param {string} timestamp - ISO timestamp or date string
 * @returns {string} Formatted date MM/DD/YYYY
 */
function formatAppliedDate(timestamp) {
  if (!timestamp) {
    var today = new Date();
    return Utilities.formatDate(today, Session.getScriptTimeZone(), 'M/d/yyyy');
  }

  try {
    var date = new Date(timestamp);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'M/d/yyyy');
  } catch (e) {
    // If parsing fails, return today's date
    var today = new Date();
    return Utilities.formatDate(today, Session.getScriptTimeZone(), 'M/d/yyyy');
  }
}

/**
 * Infer role category from job title
 * @param {string} title - Job title
 * @returns {string} Role category (CODE, DSCI, STAT, R&D, or empty)
 */
function inferRole(title) {
  if (!title) return '';

  var titleLower = title.toLowerCase();

  // Data Science / Data Analyst / ML Engineer
  if (titleLower.indexOf('data scien') !== -1 ||
      titleLower.indexOf('data analy') !== -1 ||
      titleLower.indexOf('machine learning') !== -1 ||
      titleLower.indexOf('ml engineer') !== -1 ||
      titleLower.indexOf('ai engineer') !== -1) {
    return 'DSCI';
  }

  // Software Engineer / Developer / Programmer
  if (titleLower.indexOf('software') !== -1 ||
      titleLower.indexOf('developer') !== -1 ||
      titleLower.indexOf('engineer') !== -1 ||
      titleLower.indexOf('programmer') !== -1 ||
      titleLower.indexOf('full stack') !== -1 ||
      titleLower.indexOf('backend') !== -1 ||
      titleLower.indexOf('frontend') !== -1) {
    return 'CODE';
  }

  // Statistician / Quantitative Analyst
  if (titleLower.indexOf('statistic') !== -1 ||
      titleLower.indexOf('quantitative') !== -1 ||
      titleLower.indexOf('quant ') !== -1) {
    return 'STAT';
  }

  // Research & Development / Research Scientist
  if (titleLower.indexOf('research') !== -1 ||
      titleLower.indexOf('scientist') !== -1 ||
      titleLower.indexOf('r&d') !== -1) {
    return 'R&D';
  }

  // Default to empty if no match
  return '';
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
