# JobSprint-Extension: Application Accelerator

![CI Status](https://github.com/c0nap/job-sprint-ext/workflows/CI%20-%20Test%20&%20Validate/badge.svg)

This Chrome Extension is designed to automate the repetitive and time-consuming tasks associated with high-volume job applications, providing rapid data extraction, semi-supervised form completion, and seamless logging.

The project utilizes the **Manifest V3** standard.

## 🛠️ Local Development & Testing Setup

To run and test this extension locally, you only need the Chrome browser itself:

1. **Clone or Download:** Get the latest version of the code.

```
git clone https://github.com/c0nap/job-sprint-ext.git
```

2. **Enable Developer Mode:**

* Open a new tab in Chrome and navigate to: **`chrome://extensions`**

* Find the **"Developer mode"** toggle in the upper right corner and switch it **ON**.

3. **Load the Extension:**

* Click the **"Load unpacked"** button.

* Select the **root directory** of your cloned project (the folder containing this `README.md` and `manifest.json`).


### 🔄 Reloading and Debugging

* **Reloading:** After saving code changes, return to **`chrome://extensions`** and click the **"Reload"** circular arrow button on the JobSprint-Extension card.

* **Debugging:** Click the blue **"Service Worker"** link on the extension's card to debug the core logic. Use **F12** (Developer Tools) on the active job page to debug the Content Script's actions.

## 💡 Project Approach

| Phase | Tool | Role |
| :--- | :--- | :--- |
| **Planning & Design** | **Gemini** | Define features, architecture (MV3, Content/Service Worker), data flow, and create incremental development tasks and documentation. |
| **Implementation** | **Claude Code** | Write all core JavaScript, HTML, and CSS for each feature based on the detailed task prompts provided. |
| **Quality Assurance** | **GitHub Actions** (with Jest) | Automatically run **unit tests** on all logic files (using mocks for the `chrome` API) to ensure non-DOM logic is correct before merging a PR. |
| **Testing** | **Local Browser** (`chrome://extensions`) | Manual testing and debugging of the Content Script/DOM interaction in a live environment. |


## 🧪 Testing Framework

### Unit Testing with Jest

<details>
<summary><b>Justification: easier to emulate Chrome browser</b></summary>

We will use the **Jest** testing framework for unit testing our Service Worker and any pure JavaScript utility functions.

**Why Jest?**

* <b>Superior Mocking:</b> Jest provides advanced, easy-to-use mocking functionality, which is essential for this project. We must be able to **mock the entire `chrome` API** (e.g., simulating a call to `chrome.storage.sync.get()`) to test our isolated application logic without needing a live browser environment.

* <b>Stability:</b> Jest is the industry standard for JavaScript unit testing, offering reliable stability and comprehensive documentation. **Claude is more familiar with its documentation.**

* <b>Simplicity:</b> Jest is an all-in-one framework, including the assertion library, test runner, and mocking tools, which simplifies initial setup and maintenance.

**Process in GitHub Actions:**

A dedicated GitHub Actions workflow will run Jest on every pull request. If the unit tests pass (meaning the logic compiles and works with the mock Chrome APIs), the PR is considered stable for review.

</details>

### CI/CD Pipeline

<details>
<summary><b>Automated Testing on Pull Requests</b></summary>

Every pull request to `main` automatically triggers our GitHub Actions CI pipeline with the following jobs:

1. **Validate Manifest & Structure** - Ensures manifest.json is valid JSON, confirms Manifest V3, and verifies all required files exist
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

See [`.github/workflows/README.md`](.github/workflows/README.md) for detailed documentation.

</details>


## 🧠 Core Technical Glossary

<details>
<summary><b>Definitions of Components</b></summary>

| Term | Broad Audience Description | Technical Role |
| :--- | :--- | :--- |
| **Service Worker** | The <b>"Brain"</b> of the extension. | A separate background process that handles central logic, data storage, and external communication (APIs). |
| **Content Script** | The <b>"Eyes and Hands"</b> of the extension. | A JavaScript file injected into the active webpage. It reads the page's structure and fills/modifies form fields. |
| **Message Passing** | How components talk to each other. | The secure communication protocol used for the Popup, Service Worker, and Content Script to exchange data and instructions. |
| **Data Storage** | Where the extension remembers things. | Internal browser databases (`chrome.storage.sync` for small settings, `chrome.storage.local` for large databases). |

</details>



# 🚀 Feature Breakdown

### 1. Clipboard

**Goal:** Provide instant, one-click pasting of common resume text (phone, address, etc.) into any active form field.

<details>
<summary><b>Overview: Clipboard Macro Implementation</b></summary>

| Component | Responsibility |
| :--- | :--- |
| <b>Service Worker</b> | Stores your resume snippets (macros) using **`chrome.storage.sync`**, ensuring the data syncs across all your logged-in Chrome browsers. |
| <b>Popup UI</b> | Generates the macro buttons dynamically and tells the Service Worker which text snippet to use. |
| <b>Content Script</b> | Receives the text from the Service Worker and uses a browser command to paste the content into the cursor's active position on the webpage. |

</details>

<details>
<summary><b>Decisions & Justification</b></summary>

* **Action Flow:** User clicks button in **Popup UI** $\rightarrow$ Popup sends a message to the **Service Worker** $\rightarrow$ Service Worker retrieves the stored text from **`chrome.storage.sync`** $\rightarrow$ Service Worker sends a message to the **Content Script** on the active tab $\rightarrow$ Content Script inserts text into the active field.
* **Crucial Decision: `chrome.storage.sync`:** This storage type is perfect because the clipboard data is small and must be available across multiple devices (e.g., if you switch from a desktop to a laptop).
* **Insertion Method:** The Content Script will use methods like `document.execCommand('insertText', false, text)` or direct DOM manipulation to reliably insert text into the field currently in focus.

</details>

<details>
<summary><b>Implementation Details</b></summary>

TODO - Table containing feature-specific helper functions from a single file
TODO - Another table giving details about a different code file

</details>

### 2. Extraction

**Goal:** Capture key data elements (Job Title, Location, Company) from a job posting and securely log them to your private Google Sheet.

<details>
<summary><b>Overview: Data Extraction and Logging</b></summary>

| Component | Responsibility |
| :--- | :--- |
| <b>Content Script</b> | Scrapes the job posting page to find and extract key data elements. |
| <b>Service Worker</b> | Acts as a secure client, sending the captured data via a network request to an external application (the Google Apps Script Web App). |
| <b>Crucial Decision: Security</b> | <b>We use Google Apps Script as a secure intermediary API.</b> This prevents sensitive Google Sheet credentials from being hardcoded or exposed in the public extension code. |

</details>

<details>
<summary><b>Decisions & Justification</b></summary>

* **Extraction Method:** The **Content Script** will implement selectors targeting common HTML elements (`<h1>`, specific classes/IDs) and text patterns to extract structured data. This will be the most complex and fragile part, requiring continuous refinement during testing.
* **Logging Method (API):** The **Service Worker** handles the `fetch` request. We avoid direct Google Sheets API calls from the extension for simplicity and security. Instead, we use a custom **Google Apps Script Web App** which acts as a lightweight, private, serverless function (an API endpoint). The Service Worker sends the JSON data to this secure endpoint, and the Apps Script handles the final action of writing a new row to the Sheet. 
* **Logging Implementation:** The Service Worker will need a hard-coded URL for the Apps Script endpoint. This allows us to keep credentials out of the extension source code.

</details>

<details>
<summary><b>Implementation Details</b></summary>

TODO - Table containing feature-specific helper functions from a single file
TODO - Another table giving details about a different code file

</details>

### 3. Autofill

**Goal:** Read form survey questions, intelligently suggest and enter answers based on past applications, and require user confirmation to navigate to the next step.

<details>
<summary><b>Overview: Semi-Supervised Autofill</b></summary>

| Component | Responsibility |
| :--- | :--- |
| <b>Content Script</b> | Reads the application questions and **injects a temporary, approval-based UI** onto the page to confirm the autofilled answer before advancing the form. |
| <b>Service Worker</b> | Manages the **Question & Answer database** (in `chrome.storage.local`). It receives new questions and uses a similarity check to return the best stored answer. |
| <b>Crucial Decision: Similarity Heuristics</b> | We avoid complex machine learning models due to size and speed concerns. The Service Worker will use a simple, fast **JavaScript similarity heuristic** (like **Jaccard index or N-gram matching**) to match new questions against the stored database. |

</details>

<details>
<summary><b>Decisions & Justification</b></summary>

* **Data Storage:** The Q&A database will be stored in **`chrome.storage.local`**. This is suitable for large datasets unique to the user's machine and avoids network latency.
* **Similarity Approach Justification:**
    * **External ML Services (Unsuitable):** Services like HuggingFace or your own backend API would introduce network latency for *every question*, significantly slowing down the process. They would also require complex API key management.
    * **In-Browser ML (Too Complex):** While libraries like `transformers.js` can run semantic models in the browser, the extension's file size would increase dramatically, and the initial load time would be slow.
    * **Proposed Heuristic (Necessary):** The **JavaScript similarity heuristic** (e.g., measuring the overlap of key terms using Jaccard or N-gram repetition) is fast, requires no dependencies, and is easily testable. It's sufficient because application questions are highly repetitive ("Will you require sponsorship?" vs. "Are you authorized to work?").
* **Action Flow:** The **Content Script** will be implemented with robust JavaScript logic to traverse the form fields, sending question text to the **Service Worker**. The Service Worker returns the suggested action. The Content Script performs the action and **pauses**, waiting for user input via the injected approval UI before proceeding. This is the **semi-supervised** safety measure.

</details>

<details>
<summary><b>Implementation Details</b></summary>

TODO - Table containing feature-specific helper functions from a single file
TODO - Another table giving details about a different code file

</details>

