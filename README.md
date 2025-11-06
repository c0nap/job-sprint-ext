# JobSprint-Extension: Application Accelerator

Welcome to the JobSprint project! This Chrome Extension is designed to automate the repetitive tasks associated with high-volume job applications, including data extraction, semi-supervised form completion, and seamless logging.

This repository is set up to work with the **Manifest V3** standard.

## 🛠️ Local Development & Testing Setup

To run and test this extension locally in your Chrome browser, you do not need any special tools, just the browser itself:

1.  **Clone or Download:** Get the latest version of the code from this repository.
    ```bash
    git clone https://github.com/c0nap/job-sprint-ext.git
    ```

2.  **Enable Developer Mode:**
    * Open a new tab in Chrome and navigate to: **`chrome://extensions`**
    * Find the **"Developer mode"** toggle in the upper right corner and switch it **ON**.

3.  **Load the Extension:**
    * Click the **"Load unpacked"** button that appears on the left.
    * Select the **root directory** of your cloned project (the folder that contains this `README.md` and `manifest.json`).

The extension will now be loaded and its icon (the "action" button) should be visible in your browser's toolbar.

### 🔄 Reloading Changes

Whenever you modify and save code in the project, you must reload the extension to see the changes:

* Go back to the **`chrome://extensions`** page.
* Find the JobSprint-Extension entry.
* Click the **"Reload"** circular arrow button.

**Note:** If you change the `manifest.json` file, you **must** reload the extension.

### 🐛 Debugging Key Components

| Component | How to Inspect |
| :--- | :--- |
| **Popup UI** | Right-click the extension icon in the toolbar and select **"Inspect Popup"** to open the developer console. |
| **Content Script** | Open the standard Chrome Developer Tools (F12) on the job application page. Console messages and errors from the Content Script will appear here. |
| **Service Worker** | On the **`chrome://extensions`** page, click on the blue link titled **"Service Worker"** (it is located on the extension's card) to open its dedicated console. |

## 🔍 Implementation Details & Clarifications

<details>
<summary>**Expand for General Development Tips**</summary>

### 💻 Core Extension Architecture

* **Manifest V3 Standard:** We are using **Manifest Version 3 (MV3)**, which requires a **Service Worker** (`service-worker.js`) instead of a traditional background script.
* **Communication:** All major components communicate via **Message Passing**:
    * **Popup ↔ Service Worker:** Used for user actions and fetching/storing data.
    * **Content Script ↔ Service Worker:** Used to send page data (questions, job title) to the worker, and to receive instructions (answers, macro text) back.

### 💾 Data Storage

| Storage Type | Purpose in this Project | Analogy | Key Characteristics |
| :--- | :--- | :--- | :--- |
| **`chrome.storage.sync`** | **Feature 3 (Clipboard Macros):** Small, critical user data (e.g., phone, address, name). | A small, synced cloud storage locker. | Max 100KB total. Automatically synced across the user's logged-in Chrome instances. |
| **`chrome.storage.local`** | **Feature 2 (Q&A Database):** The large, local database of previous questions and answers. | A local hard drive for the extension. | Max $\sim$10MB total (can be increased with `unlimitedStorage` permission). Persistent, but local to the machine. |
| **IndexedDB** | (Alternative for large data) | A lightweight, NoSQL database (like Mongo) in the browser. | Overkill for the MVP; only needed for highly structured, large-scale, or indexed relational data. |

### 🧪 Unit Testing & CI/CD

* **Test Harness:** We will use a **GitHub Actions workflow** with a JavaScript testing framework (e.g., **Jest**) to run **unit tests** on the Service Worker and other pure logic files.
* **Mocking Chrome API:** To test code that relies on `chrome.storage` or `chrome.tabs`, the test runner will use a **mock object** to simulate the behavior of the `chrome` API in an isolated runner environment. This validates logic correctness without needing a live browser instance.

</details>

---

## 🚀 Feature Implementation Plan

### Feature 1: Job Data Extraction & Logging (Output)

<details>
<summary>**Expand for Feature 1 Details**</summary>

| Component | Role |
| :--- | :--- |
| **Input** | Job Title, Location, Company, and Pay extracted from the job posting page. |
| **Moving Parts** | **Content Script** (DOM scraping) $\rightarrow$ **Service Worker** (API client) $\rightarrow$ **Google Apps Script Web App** (API endpoint). |
| **Output** | A new, formatted row added to the target Google Sheet. |

### Goals & Process

1.  **Extraction:** The **Content Script** runs on the active tab and attempts to identify key data elements (Title, Company, Location) using common DOM selectors (e.g., `h1`, specific class names).
2.  **User Classification:** The **Popup UI** will be used to allow the user to classify the job (e.g., "Software," "Research") before submitting.
3.  **API Integration:** The **Service Worker** sends the captured and classified data via a `fetch` request to a **hard-coded Google Apps Script Web App URL**.
4.  **Security Note:** Using Google Apps Script as an intermediary is the recommended secure approach, as it abstracts the sensitive Google Sheet API credentials away from the public extension code.

</details>

---

### Feature 2: Semi-Supervised Form Filling (Navigation)

<details>
<summary>**Expand for Feature 2 Details**</summary>

| Component | Role |
| :--- | :--- |
| **Input** | The text of an application question (e.g., "Are you authorized to work in the U.S.?"). |
| **Moving Parts** | **Content Script** (Read question/Inject UI) $\leftrightarrow$ **Service Worker** (Q&A Database/Similarity Logic) $\leftrightarrow$ **`chrome.storage.local`**. |
| **Output** | Form field/radio button is autofilled, and a small **User Approval UI** is injected onto the page to confirm navigation. |

### Goals & Process

1.  **Question Storage:** The **Service Worker** will manage a growing dictionary in `chrome.storage.local` where the key is the normalized question text and the value is the correct answer/form action.
2.  **Similarity Heuristic Trade-Off:** Since we cannot run complex Python/HuggingFace libraries client-side without major overhead, we will use a lightweight JavaScript heuristic:
    * **Pros of Heuristic (e.g., N-gram/Jaccard):** Extremely fast, simple to implement in JavaScript, no external libraries or backend needed, works well for highly repetitive corporate questions.
    * **Cons of Heuristic:** Cannot capture true semantic meaning (e.g., would miss that "sponsorship" and "authorization" are related concepts).
3.  **Semi-Supervision:** The **Content Script** fills the field with the suggested answer, but **pauses** execution and injects an overlay prompt. The user must click **"Approve & Next"** to allow the Content Script to click the next button/navigate the form. This prevents costly errors from incorrect autofill logic.

</details>

---

### Feature 3: Clipboard Macro UI (Autofill)

<details>
<summary>**Expand for Feature 3 Details**</summary>

| Component | Role |
| :--- | :--- |
| **Input** | User click on a macro button in the Popup UI. |
| **Moving Parts** | **Popup** (Button click) $\rightarrow$ **Service Worker** (Retrieves data from storage) $\rightarrow$ **Content Script** (Pastes text). |
| **Output** | Stored text snippet (e.g., phone number) pasted directly into the cursor position of the active form field. |

### Goals & Process

1.  **Data Persistence:** The **Service Worker** initializes and stores your basic resume snippets (e.g., `phone_number`, `last_employer_phone`) in **`chrome.storage.sync`** for cross-browser accessibility.
2.  **UI Generation:** The **Popup UI** dynamically creates buttons based on the keys available in `chrome.storage.sync`.
3.  **Text Insertion:** When a button is clicked, the **Service Worker** sends a message containing the macro text to the **Content Script** on the active tab. The Content Script will then use `document.execCommand('insertText', false, text)` to reliably insert the text into the form field currently in focus.

</details>

---

## 💡 Project Approach: JobSprint-Extension

| Phase | Tool | Role |
| :--- | :--- | :--- |
| **Planning & Design** | **Gemini** (This Conversation) | Define features, architecture (MV3, Content/Service Worker), data flow, and create incremental development tasks and documentation. |
| **Implementation** | **Claude Code** | Write all core JavaScript, HTML, and CSS for each feature based on the detailed task prompts provided. |
| **Quality Assurance** | **GitHub Actions** (with Jest/Mocha) | Automatically run **unit tests** on all logic files (using mocks for the `chrome` API) to ensure non-DOM logic is correct before merging a PR. |
| **Testing** | **Local Browser** (`chrome://extensions`) | Manual testing and debugging of the Content Script/DOM interaction in a live environment. |
