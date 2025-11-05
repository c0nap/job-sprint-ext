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
