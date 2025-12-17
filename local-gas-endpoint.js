/**
 * Local Mock Google Apps Script Endpoint
 *
 * This is a local testable version of the Google Apps Script endpoint
 * used by the Job Detail Extraction feature. It mimics the behavior of
 * the real GAS endpoint for development and testing purposes.
 *
 * Features:
 * - POST endpoint that accepts job data
 * - Validates required fields
 * - Stores data in memory (MVP - no database)
 * - Returns success/error responses matching GAS contract
 * - CORS enabled for local testing
 *
 * Usage:
 *   node local-gas-endpoint.js [port]
 *   Default port: 3000
 */

const express = require('express');
const cors = require('cors');

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
  const requiredFields = ['title', 'company', 'location', 'url', 'timestamp', 'spreadsheetId'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return { valid: false, error: `Invalid job data: missing required field '${field}'` };
    }
    if (typeof data[field] !== 'string' || data[field].trim() === '') {
      return { valid: false, error: `Invalid job data: '${field}' must be a non-empty string` };
    }
  }

  // Validate URL format
  try {
    new URL(data.url);
  } catch (error) {
    return { valid: false, error: 'Invalid job data: url must be a valid URL' };
  }

  // Validate timestamp format (ISO 8601)
  const date = new Date(data.timestamp);
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid job data: timestamp must be a valid ISO 8601 date string' };
  }

  return { valid: true };
}

/**
 * Creates and configures the Express app
 * @returns {Object} Express app
 */
function createApp() {
  const app = express();

  // In-memory storage for logged jobs (MVP - no database needed)
  // Create a new storage array for each app instance to ensure test isolation
  const jobLogs = [];

  // Middleware
  app.use(cors()); // Enable CORS for all origins (local testing)
  app.use(express.json()); // Parse JSON bodies

  // Request logging middleware
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {  // Prevent CI logs from interrupting valid output
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.path}`);
    }
    next();
  });

  // POST /log-job - Main endpoint for logging job data
  app.post('/log-job', (req, res) => {
    const data = req.body;

    // Validate the job data
    const validation = validateJobData(data);
    if (!validation.valid) {
      if (process.env.NODE_ENV !== 'test') {  // Prevent CI logs from interrupting valid output
        console.error(`Validation error: ${validation.error}`);
      }
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Store the job data (MVP - in-memory storage)
    const jobEntry = {
      ...data,
      receivedAt: new Date().toISOString()
    };
    jobLogs.push(jobEntry);

    if (process.env.NODE_ENV !== 'test') {  // Prevent CI logs from interrupting valid output
      console.log(`✅ Job logged successfully: ${data.title} at ${data.company}`);
      console.log(`   Total jobs logged: ${jobLogs.length}`);
    }

    // Return success response matching GAS contract
    res.json({
      success: true,
      timestamp: data.timestamp
    });
  });

  // GET /jobs - Retrieve all logged jobs (for testing/debugging)
  app.get('/jobs', (req, res) => {
    res.json({
      success: true,
      count: jobLogs.length,
      jobs: jobLogs
    });
  });

  // GET /jobs/latest - Get the most recently logged job
  app.get('/jobs/latest', (req, res) => {
    if (jobLogs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No jobs logged yet'
      });
    }

    res.json({
      success: true,
      job: jobLogs[jobLogs.length - 1]
    });
  });

  // DELETE /jobs - Clear all logged jobs (for testing)
  app.delete('/jobs', (req, res) => {
    const count = jobLogs.length;
    jobLogs.length = 0; // Clear array
    if (process.env.NODE_ENV !== 'test') {  // Prevent CI logs from interrupting valid output
      console.log(`🗑️  Cleared ${count} job(s) from storage`);
    }

    res.json({
      success: true,
      message: `Cleared ${count} job(s)`,
      count: count
    });
  });

  // GET /health - Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      jobsLogged: jobLogs.length
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  return app;
}

/**
 * Starts the server
 * @param {number} port - Port to listen on
 * @returns {Object} Server instance
 */
function startServer(port = 3000) {
  const app = createApp();

  const server = app.listen(port, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📦 Local Google Apps Script Mock Endpoint');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  ✅ Server running on http://localhost:${port}`);
    console.log('');
    console.log('  Available endpoints:');
    console.log(`    POST   http://localhost:${port}/log-job     - Log job data`);
    console.log(`    GET    http://localhost:${port}/jobs        - Get all logged jobs`);
    console.log(`    GET    http://localhost:${port}/jobs/latest - Get latest job`);
    console.log(`    DELETE http://localhost:${port}/jobs        - Clear all jobs`);
    console.log(`    GET    http://localhost:${port}/health      - Health check`);
    console.log('');
    console.log('  Press Ctrl+C to stop the server');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  });

  return server;
}

// Export for testing
module.exports = {
  createApp,
  startServer,
  validateJobData
};

// Start server if running directly (not imported as module)
if (require.main === module) {
  const port = parseInt(process.argv[2]) || 3000;
  startServer(port);
}
