# JobSprint-Extension: Application Accelerator

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

### 🧠 Core Technical Glossary

<details>
<summary><b>Definitions of Components</b></summary>

| Term | Broad Audience Description | Technical Role |
| :--- | :--- | :--- |
| **Service Worker** | The <b>"Brain"</b> of the extension. | A separate background process that handles central logic, data storage, and external communication (APIs). |
| **Content Script** | The <b>"Eyes and Hands"</b> of the extension. | A JavaScript file injected into the active webpage. It reads the page's structure and fills/modifies form fields. |
| **Message Passing** | How components talk to each other. | The secure communication protocol used for the Popup, Service Worker, and Content Script to exchange data and instructions. |
| **Data Storage** | Where the extension remembers things. | Internal browser databases (`chrome.storage.sync` for small settings, `chrome.storage.local` for large databases). |

</details>

## 🚀 Feature Breakdown

### 1. Clipboard

**Goal:** Provide instant, one-click pasting of common resume text (phone, address, etc.) into any active form field.

<details>
<summary><b>Clipboard Macro Implementation</b></summary>

| Component | Responsibility |
| :--- | :--- |
| <b>Service Worker</b> | Stores your resume snippets (macros) using **`chrome.storage.sync`**, ensuring the data syncs across all your logged-in Chrome browsers. |
| <b>Popup UI</b> | Generates the macro buttons dynamically and tells the Service Worker which text snippet to use. |
| <b>Content Script</b> | Receives the text from the Service Worker and uses a browser command to paste the content into the cursor's active position on the webpage. |

</details>

### 2. Extraction

**Goal:** Capture key data elements (Job Title, Location, Company) from a job posting and securely log them to your private Google Sheet.

<details>
<summary><b>Data Extraction and Logging</b></summary>

| Component | Responsibility |
| :--- | :--- |
| <b>Content Script</b> | Scrapes the job posting page to find and extract key data elements. |
| <b>Service Worker</b> | Acts as a secure client, sending the captured data via a network request to an external application (the Google Apps Script Web App). |
| <b>Crucial Decision: Security</b> | <b>We use Google Apps Script as a secure intermediary API.</b> This prevents sensitive Google Sheet credentials from being hardcoded or exposed in the public extension code. |

</details>

### 3. Autofill

**Goal:** Read form survey questions, intelligently suggest and enter answers based on past applications, and require user confirmation to navigate to the next step.

<details>
<summary><b>Semi-Supervised Autofill</b></summary>

| Component | Responsibility |
| :--- | :--- |
| <b>Content Script</b> | Reads the application questions and **injects a temporary, approval-based UI** onto the page to confirm the autofilled answer before advancing the form. |
| <b>Service Worker</b> | Manages the **Question & Answer database** (in `chrome.storage.local`). It receives new questions and uses a similarity check to return the best stored answer. |
| <b>Crucial Decision: Similarity Heuristics</b> | We avoid complex machine learning models due to size and speed concerns. The Service Worker will use a simple, fast **JavaScript similarity heuristic** (like **Jaccard index or N-gram matching**) to match new questions against the stored database. |

</details>

## 🧪 Testing Framework Justification

### Unit Testing

<details>
<summary><b>Justification for Jest</b></summary>

We will use the **Jest** testing framework for unit testing our Service Worker and any pure JavaScript utility functions.

**Why Jest?**

* <b>Stability & Documentation:</b> Jest is the industry standard for JavaScript unit testing, offering reliable stability and comprehensive documentation.

* <b>Superior Mocking:</b> Jest provides advanced, easy-to-use mocking functionality, which is essential for this project. We must be able to **mock the entire `chrome` API** (e.g., simulating a call to `chrome.storage.sync.get()`) to test our isolated application logic without needing a live browser environment.

* <b>Simplicity:</b> Jest is an all-in-one framework, including the assertion library, test runner, and mocking tools, which simplifies initial setup and maintenance.

**Process in GitHub Actions:**

A dedicated GitHub Actions workflow will run Jest on every pull request. If the unit tests pass (meaning the logic compiles and works with the mock Chrome APIs), the PR is considered stable for review.

</details>
