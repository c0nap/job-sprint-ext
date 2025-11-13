# JobSprint Extension

![CI Status](https://github.com/c0nap/job-sprint-ext/workflows/CI%20-%20Test%20&%20Validate/badge.svg)

**JobSprint Extension** automates the tedious parts of job hunting. One-click pasting of your resume details, automatic extraction and logging of job postings to your personal tracking sheet, and intelligent form filling that learns from your previous applications—all while keeping you in control with approval prompts.

Built for Chrome using **Manifest V3**, this extension speeds up high-volume job applications without sacrificing accuracy or your personal touch.

---

## Features at a Glance

1. **Clipboard Macros** - Instantly paste common resume text (phone, email, address, LinkedIn, name, website) into any form field with one click
2. **Job Data Extraction** - Capture and log job details (title, company, location) from any posting to your private Google Sheet
3. **Semi-Supervised Autofill** - Automatically fill application forms based on past answers, with approval prompts for every field
4. **Settings Page** - Easy configuration of Google Sheets credentials, manual entry preferences, and more

---

<details>
<summary><b>Installation & Setup</b></summary>

### Prerequisites

- **Google Chrome** browser
- **Node.js** and **npm** (for running tests during development)

### Step 1: Clone the Repository

```bash
git clone https://github.com/c0nap/job-sprint-ext.git
cd job-sprint-ext
```

### Step 2: Install Dependencies (for testing)

```bash
npm install
```

This installs Jest and other testing dependencies. The extension itself runs in Chrome without any build process.

### Step 3: Load Extension in Chrome

1. Open Chrome and navigate to **`chrome://extensions`**
2. Toggle **"Developer mode"** ON (top-right corner)
3. Click **"Load unpacked"**
4. Select the `job-sprint-ext` directory (the folder containing `manifest.json`)

The extension icon should now appear in your toolbar. If you don't see it, click the puzzle piece icon and pin JobSprint.

### Step 4: Configure Extension

#### Using the Settings Page (Recommended)

1. Click the JobSprint extension icon in your toolbar
2. Click **"Settings"** at the bottom of the popup
3. Configure your preferences:
   - **Google Sheets Configuration:** Enter your Apps Script URL, Spreadsheet ID, and Project ID
   - **Job Data Extraction:** Enable/disable manual entry popup for missing data
   - **Download Config:** Export your settings as a backup file

#### Setting Up Google Sheets Logging

To enable job data logging to your personal Google Sheet:

**🚀 Quick Setup (Recommended):**
Follow our complete step-by-step guide: **[GOOGLE_APPS_SCRIPT_SETUP.md](GOOGLE_APPS_SCRIPT_SETUP.md)**

This guide includes:
- ✅ Creating your Google Apps Script (copy & paste, no coding needed)
- ✅ Using the new `setupConfiguration()` function for easier testing
- ✅ Deploying it as a web app
- ✅ Configuring the extension via the Settings page (no code editing needed!)
- ✅ Manual data entry popup for incomplete extractions
- ✅ Testing your setup
- ✅ Troubleshooting common issues

**Alternatively, for local testing only:**
Run `npm run start:local-endpoint` and see [LOCAL_ENDPOINT_README.md](LOCAL_ENDPOINT_README.md) for details.

### Step 5: Verify Installation

**Visual Checks:**
- Extension icon appears in Chrome toolbar
- Clicking icon opens popup with three sections: Clipboard Macros, Extract Job Data, and Autofill
- On any webpage with an input field:
  - Click a macro button → text should paste into the focused field
  - On a job posting page, click "Extract & Log Job Data" → status message appears
  - On an application form, click "Start Autofill" → modal prompts appear for each field

### Running Tests Locally

**Run all tests:**
```bash
npm test
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**Run tests in watch mode (for development):**
```bash
npm run test:watch
```

**Check JavaScript syntax:**
```bash
node -c service-worker.js
node -c content-script.js
node -c popup.js
node -c utils.js
```

### Debugging

- **Service Worker console**: Go to `chrome://extensions`, find JobSprint, click "Service Worker" link
- **Content Script console**: Press F12 on any webpage where the extension is active
- **Popup console**: Right-click the extension icon, select "Inspect popup"

### Reloading Changes

After editing code:
1. Go to `chrome://extensions`
2. Find JobSprint Extension
3. Click the circular reload icon

</details>

---

## 🚀 Feature Breakdown

### 1. Clipboard Macros

**Goal:** Provide instant, one-click pasting of common resume text into any active form field.

<details>
<summary><b>Overview: How It Works</b></summary>

| Component | Responsibility |
| :--- | :--- |
| **Popup UI** | Generates macro buttons dynamically and initiates paste requests |
| **Service Worker** | Retrieves stored text from `chrome.storage.sync` |
| **Content Script** | Receives text and inserts it into the active input field on the webpage |

**Flow:**
User clicks macro button → Popup requests text from Service Worker → Service Worker retrieves from storage → Service Worker sends text to Content Script → Content Script pastes into focused field

</details>

<details>
<summary><b>Decisions & Justification</b></summary>

**Why `chrome.storage.sync`?**
Clipboard macros are small text snippets that should be available across all devices where you're logged into Chrome. The `sync` storage type automatically synchronizes data across your Chrome browsers (desktop, laptop, etc.), ensuring your resume details are always available.

**Why message passing through Service Worker?**
The Popup cannot directly access storage or communicate with Content Scripts. The Service Worker acts as a central message router, handling storage operations and coordinating between components.

**Insertion method selection:**
The Content Script uses two insertion strategies for maximum compatibility:
1. `document.execCommand('insertText')` - Works with most modern frameworks and respects undo/redo
2. Direct value manipulation with event dispatching - Fallback for sites where execCommand fails, ensures React/Vue/Angular forms recognize the change

</details>

<details>
<summary><b>Implementation Details</b></summary>

#### `popup.js` - User Interface Functions

| Function | Purpose |
| :--- | :--- |
| `initializeClipboardMacros()` | Sets up click handlers for all macro buttons |
| `handleMacroClick(key)` | Coordinates the three-step flow: storage retrieval → tab query → paste command |
| `showError(message)` | Displays user-facing error messages when macros aren't configured |

#### `service-worker.js` - Storage Management

| Function | Purpose |
| :--- | :--- |
| `handleGetClipboardMacro(key, sendResponse)` | Retrieves specific macro value from sync storage |
| `handleSaveClipboardMacro(key, value, sendResponse)` | Saves macro value to sync storage |
| `initializeStorage()` | Creates default macro structure on first install |

#### `content-script.js` - DOM Manipulation

| Function | Purpose |
| :--- | :--- |
| `pasteTextToActiveField(text)` | Inserts text into focused input using execCommand with direct manipulation fallback |

</details>

### 2. Job Data Extraction

**Goal:** Capture key data (Job Title, Company, Location) from any job posting and log it to your private Google Sheet.

**📖 Setup Guide:** See [GOOGLE_APPS_SCRIPT_SETUP.md](GOOGLE_APPS_SCRIPT_SETUP.md) for a complete, non-technical walkthrough of setting up your Google Sheet logging endpoint.

<details>
<summary><b>Overview: How It Works</b></summary>

| Component | Responsibility |
| :--- | :--- |
| **Content Script** | Scrapes the job posting page using CSS selectors to extract structured data |
| **Service Worker** | Validates extracted data and sends it via POST request to external API |
| **Google Apps Script** | Receives job data and appends a new row to your Google Sheet (external service) |

**Flow:**
User clicks Extract button → Content Script scrapes page → Sends data to Service Worker → Service Worker validates and posts to Apps Script endpoint → Apps Script writes to Google Sheet

</details>

<details>
<summary><b>Decisions & Justification</b></summary>

**Why Google Apps Script as intermediary?**
Direct Google Sheets API access from the extension would require exposing OAuth credentials in the extension code, creating a security risk. Apps Script provides a serverless API endpoint that handles authentication server-side, keeping credentials secure.

**Why CSS selector arrays with fallbacks?**
Job boards use different HTML structures and frequently update their layouts. Multiple selectors per field (generic → platform-specific) provide resilience. When LinkedIn changes `.topcard__title` to `.top-card-layout__title`, the extraction continues working.

**Supported platforms:**
LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Workday, plus generic selectors for smaller job boards.

**Configuration management strategy:**
The extension uses a dual-layer configuration approach for maximum flexibility:

1. **Chrome Storage (Primary)**: Settings configured via the Settings page are stored in `chrome.storage.sync`, which syncs across browsers when signed in to Chrome. This is the recommended approach for most users.

2. **config.local.js (Fallback)**: For advanced users or development environments, a local JavaScript file can be used. The service worker automatically detects and imports this file if present.

3. **Auto-migration**: When the service worker loads configuration from `config.local.js`, it automatically saves the values to `chrome.storage.sync`. This ensures the Settings page always displays the active configuration, even if users started with the file-based approach.

**Why this hybrid approach?**
- **User-friendly**: Non-technical users can configure via GUI without editing code
- **Developer-friendly**: Developers can use version-controlled config files
- **Migration path**: Existing users with `config.local.js` automatically migrate to Settings
- **Sync benefits**: Chrome storage syncs settings across devices
- **No manual copying**: Upload button parses existing config files and auto-saves to storage

**Apps Script secrets management:**
The Apps Script endpoint needs to know which spreadsheet and Google Cloud project to use. We use a three-tier approach:

1. **Script Properties (Preferred)**: The `setupConfiguration()` function stores spreadsheet ID and project ID in Apps Script's Script Properties service. This is the recommended approach because:
   - Values are stored server-side in Google's infrastructure
   - Test functions (`testDoPost()`, `runDiagnostics()`) can run without manual editing
   - One-time setup, then testing is automatic
   - No risk of accidentally committing secrets to version control

2. **Request payload (Runtime)**: For actual job logging, the extension sends spreadsheet ID and project ID in each POST request. This allows:
   - Different extensions/users to log to different sheets using the same Apps Script deployment
   - Users to change spreadsheets without redeploying Apps Script
   - Single Apps Script deployment to serve multiple configurations

3. **Hardcoded fallback (Legacy)**: For users who prefer it, values can be hardcoded in the Apps Script code. Not recommended due to version control risks.

**Why send secrets in the request instead of storing in Apps Script?**
This design choice allows a single deployed Apps Script to serve multiple users/configurations. Each user can have their own spreadsheet ID and project ID stored in their extension settings, but all share the same Apps Script deployment URL. This is particularly useful for:
- Team environments where each person tracks applications separately
- Development/staging/production configurations
- Easier sharing of the Apps Script code (no personal IDs embedded)

**Google Cloud Logging approach:**
Apps Script execution logs are only visible in Google Cloud Logging after linking to a Cloud Project. The setup requires:

1. **Create GCP Project**: Users create a free Google Cloud project (no billing required for logging)
2. **Link to Apps Script**: Connect the Apps Script to the GCP project using the numeric project ID
3. **View logs**: Access detailed execution logs, including all `console.log()`, `console.warn()`, and `console.error()` output

**Why require Google Cloud setup for logging?**
Google deprecated the built-in Apps Script Execution log viewer for deployed web apps. Cloud Logging is now the official way to view detailed logs. While this adds setup complexity, it provides:
- **Structured logging** with severity levels and filtering
- **Real-time log streaming** during development
- **Log retention** for debugging historical issues
- **Query capabilities** to search logs efficiently
- **Industry-standard tooling** (Cloud Logging is used across Google Cloud services)

The `setupConfiguration()` function and `runDiagnostics()` output confirmation messages to Cloud Logging, making it easy to verify the setup is working correctly.

**Manual data entry fallback:**
When automatic extraction fails or returns incomplete data, users can optionally review and correct the information before submitting. This feature:
- **Enabled by default** to ensure data quality
- **Pre-fills extracted data** so users only need to fill missing fields
- **Can be disabled** in Settings for users who prefer automatic-only logging
- **Prevents data loss** from custom job boards with non-standard HTML

**Validation strategy (MVP):**
For the MVP, the extension accepts partial or incomplete job data and logs whatever information is available. Missing job fields (title, company, location) trigger the manual entry popup if enabled, or are logged with placeholder values like "(No company)" to ensure data capture even from pages with incomplete extraction.

</details>

<details>
<summary><b>Implementation Details</b></summary>

#### `content-script.js` / `content-script-testable.js` - Data Extraction Logic

| Function | Purpose |
| :--- | :--- |
| `extractJobData()` | Orchestrates extraction using platform-specific selector arrays |
| `extractField(selectors)` | Tries each CSS selector in order until a match is found |
| `cleanText(text)` | Normalizes whitespace and removes newlines from extracted text |
| `extractSource(url)` | Identifies job board platform from URL hostname |

**Note on testable files**: `content-script-testable.js` contains pure extraction logic without Chrome API dependencies, allowing Jest to test the scraping logic in Node.js. The main `content-script.js` includes these functions plus Chrome message listeners.

#### `service-worker.js` / `service-worker-testable.js` - Data Validation and API Communication

| Function | Purpose |
| :--- | :--- |
| `loadConfiguration()` | Loads config from chrome.storage.sync (priority) or config.local.js (fallback), auto-saves to storage if loading from file |
| `handleLogJobData(data, sendResponse)` | Validates configuration fields, sends POST request to Apps Script endpoint with enhanced error detection for network issues, HTTP status codes, and Apps Script errors |
| `testConnection(sendResponse)` | Tests connection to Apps Script and Google Sheets, provides detailed error messages for troubleshooting |
| `validateJobData(data)` | MVP: Minimal validation - accepts any valid object (Apps Script handles missing fields) |
| `getAppsScriptEndpoint()` | Returns configured endpoint URL from cached configuration (loaded from chrome.storage or config.local.js) |
| `getSpreadsheetId()` | Returns configured spreadsheet ID from cached configuration |
| `getProjectId()` | Returns configured Google Cloud project ID from cached configuration |
| `isManualEntryEnabled()` | Returns whether the manual data entry popup is enabled (from cached configuration) |

#### `popup.js` - UI Coordination

| Function | Purpose |
| :--- | :--- |
| `handleExtractClick(button, statusDiv)` | Triggers extraction on active tab, includes enhanced error handling for content script communication issues (e.g., "Receiving end does not exist") |
| `logJobData(button, statusDiv, jobData)` | Checks if manual entry is needed, shows modal if data is incomplete, otherwise sends to Service Worker |
| `submitJobData(button, statusDiv, jobData)` | Sends validated data to Service Worker for API submission |
| `isMissingRequiredData(jobData)` | Checks if job title or company are missing/placeholder values |
| `showManualEntryModal(button, statusDiv, jobData)` | Displays modal form for reviewing and correcting extracted job data |
| `hideManualEntryModal()` | Closes the manual entry modal and resets the form |
| `handleManualEntrySubmit()` | Processes manual entry form submission, merges with original data, and submits to Service Worker |
| `showStatus(element, type, message)` | Displays success/error messages with appropriate styling |

#### `settings.js` - Settings Page Management

| Function | Purpose |
| :--- | :--- |
| `loadSettings()` | Loads current configuration from chrome.storage.sync and populates form fields |
| `saveSettings()` | Validates and saves settings to chrome.storage.sync, notifies service worker to reload config |
| `testConnection()` | Tests connection to Apps Script and Google Sheets, displays detailed error messages |
| `uploadConfig()` | Triggers file browser to select config.local.js for upload |
| `handleConfigFileUpload(event)` | Parses uploaded config.local.js file, populates form fields, auto-saves to chrome.storage.sync |
| `parseConfigFile(content)` | Extracts CONFIG object from JavaScript file using regex |
| `downloadConfig()` | Generates and downloads config.local.js file with current settings |
| `updateConnectionStatus(settings)` | Updates connection status indicator and enables/disables Test Connection button based on configuration completeness |

#### `google-apps-script-endpoint.js` - Backend API (Google Apps Script)

| Function | Purpose |
| :--- | :--- |
| `doPost(e)` | Main entry point for POST requests from extension, validates data and logs to Google Sheets |
| `setupConfiguration()` | Stores spreadsheet ID and project ID in Script Properties (one-time setup for testing) |
| `getConfiguration()` | Retrieves stored configuration from Script Properties |
| `testDoPost()` | Simulates a POST request using stored configuration, validates the setup |
| `runDiagnostics()` | Checks permissions, spreadsheet access, and configuration completeness |
| `validateJobData(data)` | Ensures required fields (spreadsheetId, projectId) are present, accepts partial job data |
| `logJobToSheet(jobData, requestId)` | Opens spreadsheet, creates/gets "Job Applications" sheet, appends row with job data |
| `createJsonResponse(data, statusCode)` | Creates properly formatted JSON response for the extension |

**Configuration hierarchy in Apps Script:**
1. Script Properties (for test functions) - Set via `setupConfiguration()`
2. Request payload (for actual logging) - Sent by extension in each POST request
3. Hardcoded values (deprecated) - Only for legacy setups

</details>

### 3. Semi-Supervised Autofill

**Goal:** Intelligently suggest and enter form answers based on past applications, with user confirmation for every field.

<details>
<summary><b>Overview: How It Works</b></summary>

| Component | Responsibility |
| :--- | :--- |
| **Content Script** | Identifies form inputs, extracts questions, displays approval modal, fills approved answers |
| **Service Worker** | Manages Q&A database in `chrome.storage.local`, performs similarity matching using Jaccard index |
| **Approval UI** | Custom overlay injected into page showing question, suggested answer, and approve/skip buttons |

**Flow:**
User clicks Start Autofill → Content Script finds all inputs → For each input: extracts question → Service Worker finds similar past question → Content Script shows approval modal → User approves/skips → If approved, fill field and continue

</details>

<details>
<summary><b>Decisions & Justification</b></summary>

**Why local storage instead of sync?**
The Q&A database can grow large (hundreds of questions). `chrome.storage.local` has higher capacity limits (10MB vs 100KB) and avoids unnecessary network sync overhead.

**Why Jaccard similarity instead of ML models?**
Machine learning approaches were considered but rejected for three reasons:
1. **External ML APIs** (OpenAI, HuggingFace) would add network latency to every single question, slowing the autofill process significantly
2. **In-browser ML** (transformers.js, TensorFlow.js) would dramatically increase extension file size and slow initial load times
3. **Application questions are highly repetitive** - simple keyword overlap is sufficient to match "Do you require visa sponsorship?" with "Will you need sponsorship?" without needing semantic understanding

Jaccard index (intersection size / union size of word sets) provides fast, lightweight matching with no dependencies.

**Why similarity threshold of 0.6?**
Testing showed that 60% word overlap reliably distinguishes similar questions from unrelated ones. Lower thresholds produce false positives; higher thresholds miss valid variations.

**Why semi-supervised instead of fully automatic?**
Job applications have legal and professional implications. Requiring approval for each answer prevents:
- Applying incorrect answers to similarly-worded questions
- Submitting outdated information
- Missing context-specific nuances

</details>

<details>
<summary><b>Implementation Details</b></summary>

#### `content-script.js` - Form Processing and UI

| Function | Purpose |
| :--- | :--- |
| `startAutofillProcess()` | Initiates autofill by finding all form inputs on the page |
| `findFormInputs()` | Queries for text inputs, textareas, selects, radios, and checkboxes |
| `processNextInput(inputs, index)` | Sequentially processes each input with user approval |
| `extractQuestionForInput(input)` | Finds associated label or parent text describing what the input is for |
| `fillInput(input, answer)` | Sets input value and dispatches change events for framework compatibility |
| `showApprovalUI(...)` | Displays modal overlay with question, suggested answer, and action buttons |
| `createOverlay()` | Creates full-screen backdrop for approval modal |
| `createModal()` | Builds styled modal container with slide-in animation |
| `createModalHeader()` | Generates header with checkmark icon and "Autofill Suggestion" title |
| `createQuestionDisplay(question)` | Formats question text in gray background container |
| `createAnswerDisplay(answer)` | Formats suggested answer in green background container |
| `createActionButtons(onApprove, onReject)` | Creates "Skip" and "Apply Answer" buttons with hover effects |
| `setupKeyboardHandling(onReject)` | Allows ESC key to dismiss modal |
| `highlightTargetInput(input)` | Scrolls to and outlines the target input field in green |
| `removeApprovalUI()` | Cleans up modal and removes input highlights |

#### `service-worker.js` / `service-worker-testable.js` - Q&A Database and Matching

| Function | Purpose |
| :--- | :--- |
| `handleFindSimilarAnswer(question, sendResponse)` | Searches database for best matching question using similarity scoring |
| `handleSaveQAPair(question, answer, sendResponse)` | Adds new Q&A pair to database with timestamp |
| `calculateSimilarity(str1, str2)` | Computes Jaccard index between two strings for similarity matching |

#### `popup.js` - Autofill Trigger

| Function | Purpose |
| :--- | :--- |
| `handleAutofillClick(button, statusDiv)` | Sends start command to Content Script and displays status |

</details>

---

## 🔒 Security & Privacy

<details>
<summary><b>Security Architecture & Privacy Controls</b></summary>

### Overview

JobSprint is designed with security-first principles. Your sensitive information stays private, your data stays under your control, and the extension follows industry-standard security practices.

### Security Implementations

**1. Content Security Policy (CSP) Hardening**
- **Explicit CSP directive** in manifest.json prevents inline scripts and `eval()`
- All code is loaded from vetted extension files only (`script-src 'self'`)
- Prevents XSS attacks even if malicious job postings contain scripts
- **Required for Chrome Web Store** submission

**2. XSS Prevention & Input Sanitization**
- No `innerHTML` usage anywhere in the codebase
- All DOM manipulation uses safe methods: `textContent`, `createElement`, `appendChild`
- User input from job postings is sanitized before display
- Protects against malicious content in job descriptions

**3. Rate Limiting**
- Extract button has 2-second cooldown to prevent accidental spam
- Protects your Apps Script quota from rapid-fire requests
- Prevents DoS of your own logging endpoint

**4. Privacy Controls**
- **Clear All Data** button in Settings for complete data removal
- Double-confirmation required to prevent accidental deletion
- Clears clipboard macros, autofill database, and all settings
- Gives users full control over their personal information

**5. Network Failure Resilience**
- Automatic retry with exponential backoff for job data logging
- Max 3 attempts (initial + 2 retries) with 1s, 2s delays
- Only retries network errors and timeouts (not HTTP 4xx/5xx errors)
- Prevents job data loss due to transient network issues
- 15-second timeout per attempt

### Data Security

**Is my data secure?**

Yes! Here's what happens:
1. Your extension runs locally in your browser
2. Job data goes directly from your browser to your personal Google Apps Script
3. Your Apps Script writes to your personal Google Sheet
4. No third-party services or databases are involved

**Who can access my data?**

Only you. The Apps Script URL is private (only you know it), and the Google Sheet is in your Google Drive with your normal Drive permissions.

**Can I revoke access?**

Yes, at any time:
1. In Apps Script, click Deploy → Manage deployments
2. Click the Archive button (🗑️) next to your deployment
3. The extension will stop being able to add jobs to your sheet

### Server-Side Secrets Storage

**Critical Design Decision:** Spreadsheet IDs and Project IDs are **never sent over HTTP**.

**How it works:**
1. **Server-Side Configuration:** Your Spreadsheet ID and Google Cloud Project ID are stored exclusively in Google Apps Script using **Script Properties** (server-side key-value storage)
2. **One-Time Setup:** Run `setupConfiguration()` once in the Apps Script editor to securely store these values on Google's servers
3. **Request Payload:** When the extension logs job data, it only sends:
   - Job details (title, company, location, URL)
   - Timestamp and source metadata
   - **Nothing else** - no IDs, no credentials, no secrets

**What this prevents:**
- Network interception of sensitive IDs
- Accidental exposure in browser DevTools or network logs
- Leaking configuration through compromised client systems

### Data Transmission

**What IS sent over the network:**
- Job posting data (title, company, location, URL) - **only when you click "Extract & Log"**
- The Apps Script endpoint URL (public web app URL)
- Test connection requests (minimal test data when you click "Test Connection")

**What is NEVER sent:**
- Your Google Spreadsheet ID
- Your Google Cloud Project ID
- Any credentials or authentication tokens
- Personal information from clipboard macros (phone, email, etc.)
- Q&A autofill database entries

### Local Storage

**Where your data lives:**

| Data Type | Storage Location | Synced? | Purpose |
|-----------|-----------------|---------|---------|
| **Clipboard Macros** (phone, email, address, LinkedIn, name, website) | `chrome.storage.sync` | Yes (across your Chrome browsers) | Quick-paste personal info |
| **Q&A Autofill Database** | `chrome.storage.local` | No (device-specific) | Store previous form answers |
| **Configuration** (endpoint URL, Spreadsheet ID, Project ID) | `chrome.storage.sync` + `config.local.js` | Sync storage: Yes / File: No | Remember your settings |
| **Job Data** | Not stored locally | N/A | Immediately sent to your Google Sheet |

**Privacy Notes:**
- All data stays **within your Chrome profile** - never sent to third-party servers (except Google Sheets, which YOU control)
- Clipboard macros sync across your devices via Chrome Sync (can be disabled in Chrome settings)
- Q&A autofill database is device-local for privacy (not synced)

### Extension Permissions

JobSprint requests the following Chrome permissions:

| Permission | Why We Need It | What We Do |
|------------|----------------|------------|
| `storage` | Save your settings and Q&A database | Store config in `chrome.storage.sync/local` |
| `activeTab` | Access the current job posting page | Extract job details from DOM when you click "Extract" |
| `scripting` | Inject content script for autofill | Insert autofill logic into application forms |

**What we DON'T request:**
- `<all_urls>` - We don't access all websites automatically
- `history` - We don't track your browsing
- `cookies` - We don't read or modify cookies
- `webRequest` - We don't intercept your network traffic

### Configuration Security Best Practices

1. **Never commit `config.local.js` to version control** - It contains your personal IDs
   - Already included in `.gitignore` for your protection
2. **Use the Settings Page** - Easiest way to configure without touching code
3. **Verify Apps Script Deployment** - Ensure deployment permissions are set to "Anyone" (required for web apps), not "Anyone with Google account" (would expose your email)
4. **Regular Backups** - Use Settings → Download Config to backup your configuration

### Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
- **Email:** Create an issue at https://github.com/c0nap/job-sprint-ext/issues with `[SECURITY]` prefix
- **Do not** disclose publicly until a fix is available
- We'll acknowledge within 48 hours and work on a fix promptly

</details>

---

## 🧠 Core Technical Glossary

<details>
<summary><b>Component Definitions</b></summary>

| Term | Broad Audience Description | Technical Role |
| :--- | :--- | :--- |
| **Service Worker** | The "Brain" of the extension | Background script running independently of web pages. Handles storage, message routing, and API communication. Lives in `service-worker.js` |
| **Content Script** | The "Eyes and Hands" on web pages | JavaScript injected into active tabs. Reads page DOM, manipulates form fields, displays overlays. Lives in `content-script.js` |
| **Popup** | The user interface you see when clicking the icon | HTML/CSS/JS UI for triggering features. Cannot directly access storage or web pages—relies on message passing. Lives in `popup.html`, `popup.css`, `popup.js` |
| **Message Passing** | How components communicate | Chrome's secure inter-component communication protocol. Uses `chrome.runtime.sendMessage()` and `chrome.tabs.sendMessage()` |
| **Sync Storage** | Small data that follows you across devices | `chrome.storage.sync` - 100KB limit, synced across logged-in Chrome browsers |
| **Local Storage** | Large data stored on this device only | `chrome.storage.local` - 10MB limit, faster access, not synced |

</details>

<details>
<summary><b>Architecture Decisions</b></summary>

**Why Manifest V3?**
Manifest V3 is the current standard for Chrome extensions (V2 is being deprecated). Key differences:
- Service Workers replace background pages (better resource usage)
- Enhanced security with stricter content security policies
- Required for new extensions in Chrome Web Store

**Why separate `-testable.js` files?**
Chrome extension APIs (`chrome.runtime`, `chrome.storage`, `chrome.tabs`) don't exist in Node.js test environments. The `-testable` files extract pure JavaScript logic (validation, similarity calculation, text extraction) that can be tested in Jest without mocking the entire Chrome API. This pattern:
- Isolates business logic from Chrome-specific code
- Makes tests faster and more reliable
- Allows testing complex logic (similarity matching, data validation) without a browser

**File structure:**
- `service-worker.js` - Full implementation with Chrome APIs
- `service-worker-testable.js` - Pure JS functions exported for testing
- Tests import from `-testable.js` and use mocked dependencies

**Why no build step?**
Modern Chrome supports ES6+ features natively. Avoiding webpack/babel keeps the development workflow simple (edit → reload) and reduces bundle size.

**Why modular message handling?**
Each feature has dedicated message handler functions (`handleGetClipboardMacro`, `handleLogJobData`, etc.) rather than monolithic switch statements. This:
- Makes testing individual features easier
- Allows features to be independently enabled/disabled
- Improves code readability and maintenance

</details>

---

## 💡 Project Approach

| Phase | Tool | Role |
| :--- | :--- | :--- |
| **Planning & Design** | **Gemini** | Define features, architecture (MV3, Content/Service Worker), data flow, and create incremental development tasks and documentation |
| **Implementation** | **Claude Code** | Write all core JavaScript, HTML, and CSS for each feature based on detailed task prompts |
| **Quality Assurance** | **GitHub Actions** (with Jest) | Automatically run unit tests on all logic files (using mocks for `chrome` API) to ensure non-DOM logic is correct before merging a PR |
| **Testing** | **Local Browser** (`chrome://extensions`) | Manual testing and debugging of Content Script/DOM interaction in a live environment |

---

## 🧪 Testing Framework

### Unit Testing with Jest

<details>
<summary><b>Justification: Easier Chrome Browser Emulation</b></summary>

We use **Jest** for unit testing Service Worker logic and pure JavaScript utility functions.

**Why Jest?**

* **Superior Mocking**: Jest provides advanced, easy-to-use mocking functionality, essential for simulating the entire `chrome` API (e.g., `chrome.storage.sync.get()`) without needing a live browser environment
* **Stability**: Industry-standard JavaScript testing framework with comprehensive documentation and reliable behavior
* **Simplicity**: All-in-one framework (assertions, test runner, mocking tools) simplifies setup and maintenance
* **Claude familiarity**: Well-documented patterns for testing Chrome extensions

**Process in GitHub Actions:**

A dedicated CI workflow runs Jest on every pull request. If unit tests pass (logic compiles and works with mock Chrome APIs), the PR is considered stable for review.

</details>

# TODO: Incorporate this into a testing page

## Testing Your Setup (Optional)

Want to test the script directly without the extension?

1. In the Apps Script editor, find the `testDoPost()` function at the bottom
2. Click the **Run** button (▶️) at the top
3. Select `testDoPost` from the function dropdown if needed
4. Click Run
5. Check the "Execution log" - you should see "Test response: {"success":true,...}"
6. Check your Google Sheet - a test job should appear

---

## Local Testing Alternative

If you want to test the extension without deploying to Google Apps Script, you can use the **local mock endpoint**:

1. In your terminal, run:
   ```bash
   npm run start:local-endpoint
   ```
2. Change the URL in `service-worker.js` to:
   ```javascript
   return 'http://localhost:3000/log-job';
   ```
3. Test the extension - data will be logged to your console instead of Google Sheets

See `LOCAL_ENDPOINT_README.md` for more details on local testing.




### CI/CD Pipeline

<details>
<summary><b>Automated Testing on Pull Requests</b></summary>

Every pull request to `main` automatically triggers our GitHub Actions CI pipeline with the following jobs:

1. **Validate Manifest & Structure** - Ensures `manifest.json` is valid JSON, confirms Manifest V3, verifies all required files exist
2. **JavaScript Syntax Check** - Validates all JS files can be parsed correctly (compilation check)
3. **Test Utility Functions** - Runs Jest tests specifically for utility functions
4. **Full Test Suite with Coverage** - Runs all tests and generates coverage reports
5. **Code Quality Check** - Checks for console.log statements, file sizes, and TODO comments
6. **CI Pipeline Success** - Summary job confirming all checks passed

**Local Testing:** Before pushing, run these commands locally:
```bash
npm install               # Install dependencies
npm test                  # Run tests
npm run test:coverage     # Run tests with coverage
node -c service-worker.js # Check syntax
```

See [`.github/workflows/README.md`](.github/workflows/README.md) for detailed CI documentation.

</details>

---

## 📚 Additional Documentation

- **[Google Apps Script Setup Guide](GOOGLE_APPS_SCRIPT_SETUP.md)** - Complete, non-technical guide to deploy your job logging endpoint
- **[Local Endpoint Testing](LOCAL_ENDPOINT_README.md)** - Run a local mock endpoint for development and testing
- **[CI/CD Workflow Details](.github/workflows/README.md)** - Deep dive into GitHub Actions jobs and troubleshooting
- **[Icon Assets](icons/README.md)** - Extension icon requirements and temporary workarounds

---

## 🔧 Developer Notes


---

### Critical TODOs or Human Verification Steps:

---

## 📝 License

This project is open-source. See repository for license details.
