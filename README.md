# JobSprint Extension

![CI Status](https://github.com/c0nap/job-sprint-ext/workflows/CI%20-%20Test%20&%20Validate/badge.svg)

**JobSprint Extension** automates the tedious parts of job hunting. One-click pasting of your resume details, automatic extraction and logging of job postings to your personal tracking sheet, and intelligent form filling that learns from your previous applications—all while keeping you in control with approval prompts.

Built for Chrome using **Manifest V3**, this extension speeds up high-volume job applications without sacrificing accuracy or your personal touch.

---

## Features at a Glance

1. **Clipboard Macros** - Instantly paste common resume text (phone, email, address, LinkedIn) into any form field with one click
2. **Job Data Extraction** - Capture and log job details (title, company, location) from any posting to your private Google Sheet
3. **Semi-Supervised Autofill** - Automatically fill application forms based on past answers, with approval prompts for every field

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

#### Option A: Clipboard Macros
Click the extension icon and use the "Edit Macros" button to set your personal information. *(Note: Full settings UI is in development. Current version uses browser storage directly.)*

#### Option B: Google Sheets Logging (optional)
To enable job data logging to your personal Google Sheet:

**🚀 Quick Setup (Recommended):**
Follow our complete step-by-step guide: **[GOOGLE_APPS_SCRIPT_SETUP.md](GOOGLE_APPS_SCRIPT_SETUP.md)**

This guide includes:
- ✅ Creating your Google Apps Script (copy & paste, no coding needed)
- ✅ Deploying it as a web app
- ✅ Connecting it to the extension
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

**Validation strategy (MVP):**
For the MVP, the extension accepts partial or incomplete job data and logs whatever information is available. Only configuration fields (`spreadsheetId`, `projectId`) are strictly required. Missing job fields (title, company, location) are logged with placeholder values like "(No company)" to ensure data capture even from pages with incomplete extraction.

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
| `handleLogJobData(data, sendResponse)` | Validates configuration fields and sends POST request to Apps Script endpoint |
| `validateJobData(data)` | MVP: Minimal validation - accepts any valid object (Apps Script handles missing fields) |
| `getAppsScriptEndpoint()` | Returns configured endpoint URL from config.local.js |
| `getSpreadsheetId()` | Returns configured spreadsheet ID from config.local.js |
| `getProjectId()` | Returns configured Google Cloud project ID from config.local.js |

#### `popup.js` - UI Coordination

| Function | Purpose |
| :--- | :--- |
| `handleExtractClick(button, statusDiv)` | Triggers extraction on active tab and shows status updates |
| `logJobData(button, statusDiv, jobData)` | Sends validated data to Service Worker for API submission |
| `showStatus(element, type, message)` | Displays success/error messages with appropriate styling |

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

<details>
<summary><b>Known TODOs and Future Improvements</b></summary>

**Pending Features:**
1. **Settings UI** (`popup.js:33`, `popup.js:269`) - Implement proper settings page for:
   - Editing clipboard macro values (currently requires manual storage manipulation)
   - Configuring Google Apps Script endpoint URL (currently hardcoded)
   - Managing Q&A database (view/edit/delete saved answers)

2. **Apps Script Configuration** (`service-worker.js:174`) - Move endpoint URL from hardcoded constant to `chrome.storage.sync` for user configuration

3. **Enhanced Approval UI** (`SETUP.md:76`) - Current modal is functional but could be enhanced with:
   - Keyboard shortcuts (Enter to approve, Esc to skip - currently only Esc works)
   - Confidence score display (show similarity percentage)
   - Edit-before-approve capability

4. **Site-Specific Selector Refinement** (`SETUP.md:77`) - Extraction selectors work on major job boards but may need updates as sites change their HTML structure

**Test Coverage Goals:**
- Current: Core business logic (similarity matching, validation, extraction)
- Needed: UI interaction testing (requires browser automation with Puppeteer or similar)

**Performance Optimizations:**
- Consider debouncing autofill to reduce DOM queries on complex forms
- Implement selector caching to avoid repeated querySelector calls

</details>

---

## 📝 License

This project is open-source. See repository for license details.
