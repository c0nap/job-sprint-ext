# Local Google Apps Script Mock Endpoint

This is a local testable version of the Google Apps Script endpoint used by the Job Detail Extraction feature. It allows developers to test the extension's job logging functionality without needing to set up a real Google Apps Script deployment.

## Purpose

The Job Detail Extraction feature sends job data to a Google Apps Script endpoint, which stores it in a Google Sheet. During development and testing, this local endpoint provides:

- ✅ **Local testing** - No need for internet connection or Google Apps Script setup
- ✅ **Faster development** - Immediate feedback without cloud deployment
- ✅ **Test automation** - Can be used in CI/CD pipelines
- ✅ **Data inspection** - Easy access to logged data via REST API

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Local Endpoint

```bash
npm run start:local-endpoint
```

The server will start on `http://localhost:3000` by default.

To use a different port:

```bash
node local-gas-endpoint.js 8080
```

### 3. Configure the Extension

Update `service-worker.js` to use the local endpoint:

```javascript
function getAppsScriptEndpoint() {
  // For local testing
  return 'http://localhost:3000/log-job';

  // For production
  // return 'YOUR_APPS_SCRIPT_URL_HERE';
}
```

### 4. Test the Extension

1. Load the extension in Chrome
2. Navigate to a job posting page
3. Click "Extract & Log Job Data"
4. Check the server console to see the logged data

## API Reference

### POST `/log-job`

Logs a job posting to the local endpoint.

**Request Body:**

```json
{
  "title": "Software Engineer",
  "company": "Tech Corp",
  "location": "San Francisco, CA",
  "url": "https://linkedin.com/jobs/123",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "source": "LinkedIn"
}
```

**Required Fields:**
- `title` (string) - Job title
- `company` (string) - Company name
- `location` (string) - Job location
- `url` (string) - Valid URL to the job posting
- `timestamp` (string) - ISO 8601 timestamp

**Optional Fields:**
- `source` (string) - Job board identifier (e.g., "LinkedIn", "Indeed")

**Success Response (200):**

```json
{
  "success": true,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Invalid job data: missing required field 'title'"
}
```

### GET `/jobs`

Retrieves all logged jobs.

**Response:**

```json
{
  "success": true,
  "count": 2,
  "jobs": [
    {
      "title": "Software Engineer",
      "company": "Tech Corp",
      "location": "San Francisco, CA",
      "url": "https://linkedin.com/jobs/123",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "source": "LinkedIn",
      "receivedAt": "2025-01-15T10:30:05.123Z"
    }
  ]
}
```

### GET `/jobs/latest`

Retrieves the most recently logged job.

**Response:**

```json
{
  "success": true,
  "job": {
    "title": "Software Engineer",
    "company": "Tech Corp",
    "location": "San Francisco, CA",
    "url": "https://linkedin.com/jobs/123",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "source": "LinkedIn",
    "receivedAt": "2025-01-15T10:30:05.123Z"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "No jobs logged yet"
}
```

### DELETE `/jobs`

Clears all logged jobs from memory.

**Response:**

```json
{
  "success": true,
  "message": "Cleared 5 job(s)",
  "count": 5
}
```

### GET `/health`

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "uptime": 123.456,
  "jobsLogged": 5
}
```

## Testing

### Run Endpoint Tests

```bash
npm run test:endpoint
```

This runs the comprehensive test suite that verifies:
- Data validation
- API contract compliance
- Error handling
- Integration with the extension

### Run All Tests

```bash
npm test
```

## Example Usage with curl

### Log a job:

```bash
curl -X POST http://localhost:3000/log-job \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Software Engineer",
    "company": "Tech Corp",
    "location": "San Francisco, CA",
    "url": "https://linkedin.com/jobs/123",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "source": "LinkedIn"
  }'
```

### Get all jobs:

```bash
curl http://localhost:3000/jobs
```

### Get latest job:

```bash
curl http://localhost:3000/jobs/latest
```

### Clear all jobs:

```bash
curl -X DELETE http://localhost:3000/jobs
```

### Health check:

```bash
curl http://localhost:3000/health
```

## Data Storage

The MVP version stores data **in-memory only**. This means:

- ✅ Fast and lightweight
- ✅ No database setup required
- ⚠️ Data is lost when the server restarts
- ⚠️ Not suitable for production use

**For production use,** set up the real Google Apps Script endpoint that stores data permanently in Google Sheets:
👉 **[See GOOGLE_APPS_SCRIPT_SETUP.md for the complete deployment guide](GOOGLE_APPS_SCRIPT_SETUP.md)**

## CORS

CORS is enabled for all origins to facilitate local testing. This allows the Chrome extension to make requests to the local endpoint without CORS issues.

## Troubleshooting

### Extension can't connect to the endpoint

1. Make sure the server is running: `npm run start:local-endpoint`
2. Check that the endpoint URL in `service-worker.js` matches the server port
3. Verify that the browser isn't blocking the request (check console)

### Tests are failing

1. Make sure all dependencies are installed: `npm install`
2. Run tests in verbose mode: `npm run test:endpoint -- --verbose`
3. Check that no other service is using port 3000

### Server won't start

1. Check if port is already in use: `lsof -i :3000` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows)
2. Try a different port: `node local-gas-endpoint.js 8080`

## Integration with CI/CD

The local endpoint tests are automatically run in GitHub Actions as part of the CI pipeline. See `.github/workflows/ci.yml` for the configuration.

## Future Enhancements

Potential improvements for future versions:

- [ ] Persistent storage (SQLite, file-based)
- [ ] Configuration via environment variables
- [ ] Authentication/API keys
- [ ] Web UI for viewing logged jobs
- [ ] Export to CSV/JSON
- [ ] Job deduplication
- [ ] Search and filtering

## License

MIT
