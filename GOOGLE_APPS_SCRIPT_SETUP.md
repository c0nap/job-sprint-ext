# Setting Up Your Google Apps Script Endpoint

This guide will walk you through setting up your own Google Apps Script endpoint to automatically log job postings to a Google Sheet. **No coding experience required!**

---

## What You'll Need

- A Google Account (Gmail)
- 10-15 minutes
- The JobSprint Chrome extension installed

---

## Overview: What We're Building

When you click "Extract & Log Job Data" in the extension, it will:
1. Capture the job details from the page you're viewing
2. Send that data to your private Google Apps Script
3. The script will add a new row to your Google Sheet

**Your data stays private** - it goes directly from your browser to your personal Google Sheet. No third-party servers involved.

---

## Step-by-Step Instructions

### Step 1: Create a New Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click the **"+ Blank"** button to create a new spreadsheet
3. Give it a name at the top, like "Job Applications Tracker"
4. Keep this tab open - we'll come back to it

**What this does:** This creates the spreadsheet where all your job postings will be logged.

---

### Step 2: Open the Apps Script Editor

1. In your Google Sheet, click **Extensions** in the menu bar
2. Click **Apps Script**
3. A new tab will open with the Apps Script editor
4. You'll see some default code that says `function myFunction() {}`

**What this does:** Apps Script is Google's way to add custom functionality to Sheets. We're about to paste in code that will receive data from the extension.

---

### Step 3: Replace the Default Code

1. **Select all the existing code** in the editor (you can use Ctrl+A or Cmd+A)
2. **Delete it**
3. Open the file named `google-apps-script-endpoint.js` in the extension folder
4. **Copy all the code** from that file (Ctrl+C or Cmd+C)
5. **Paste it** into the Apps Script editor (Ctrl+V or Cmd+V)
6. At the top of the editor, change the project name from "Untitled project" to something like "JobSprint Endpoint"
7. Click the **save icon** (💾) or press Ctrl+S / Cmd+S

**What this does:** This code creates an endpoint that can receive job data from your extension and write it to your sheet.

---

### Step 4: Deploy as a Web App

This is the most important step - it makes your script accessible from the extension.

1. In the Apps Script editor, click the **blue "Deploy"** button (top right)
2. Select **"New deployment"** from the dropdown
3. Next to "Select type", click the gear icon ⚙️
4. Choose **"Web app"** from the list
5. Fill in the deployment settings:
   - **Description:** "JobSprint endpoint" (or anything you like)
   - **Execute as:** Select **"Me (your-email@gmail.com)"**
   - **Who has access:** Select **"Anyone"**
     - ⚠️ Don't worry - "Anyone" means anyone with the URL. Since the URL is long and random, only you will know it.
6. Click the **"Deploy"** button
7. Google will ask you to authorize the script:
   - Click **"Authorize access"**
   - Choose your Google account
   - Click **"Advanced"** if you see a warning
   - Click **"Go to [Project Name] (unsafe)"** - this is your own script, so it's safe
   - Click **"Allow"**
8. After authorization, you'll see a screen with your **Web app URL**
9. **IMPORTANT:** Click the **"Copy"** button next to the URL - you'll need this in the next step

**What this does:** This creates a public URL endpoint that the extension can send data to. The long random URL acts as your security - it's like a secret key that only you know.

---

### Step 5: Configure the Apps Script Test Functions (Optional but Recommended)

Before we configure the extension, let's set up the Apps Script test functions so you can verify everything works.

1. In the Apps Script editor, find the `setupConfiguration()` function (around line 304)
2. Replace the placeholder values with your actual IDs:
   - **SPREADSHEET_ID:** Go back to your Google Sheet tab, look at the URL. The ID is the long string between `/d/` and `/edit`. Example: `https://docs.google.com/spreadsheets/d/`**`1A2B3C4D5E6F7G8H9I0J`**`/edit` - copy `1A2B3C4D5E6F7G8H9I0J`
   - **PROJECT_ID:** If you set up Google Cloud Logging (see bottom of this guide), use your numeric project number. Otherwise, use any identifier like `test-project-123`
3. Click **Run** (▶️ button) and select `setupConfiguration` from the dropdown
4. Click Run again to execute
5. Check the execution log - you should see "✅ Configuration saved successfully!"
6. Now run `runDiagnostics` to test your setup
7. If diagnostics pass, run `testDoPost` to add a test job to your sheet

**What this does:** This saves your configuration in Apps Script's Script Properties, so test functions work automatically without editing them each time.

**🔒 Security Note:** Script Properties are Google's server-side key-value storage. Your Spreadsheet ID and Project ID are stored securely on Google's servers and are NEVER transmitted over the network when logging jobs. The extension only sends job data (title, company, location, URL) - never your configuration secrets.

---

### Step 6: Configure the Extension

Now we need to tell the extension where to send the job data. **There are two methods:**

#### Method A: Using the Settings Page (Recommended - Easy!)

1. Click the JobSprint extension icon in your Chrome toolbar
2. Click **"Settings"** at the bottom of the popup
3. A new tab will open with the settings page
4. Fill in the three required fields:
   - **Apps Script Endpoint URL:** Paste the URL you copied in Step 4
   - **Google Spreadsheet ID:** The ID from your sheet URL (see Step 5 above)
   - **Google Cloud Project ID:** Your project ID (same as in Step 5)
5. Click **"Save Settings"**
6. You should see "✓ Connected to Google Sheets" with a green checkmark
7. Click **"📊 Open Google Sheet"** to verify it opens your sheet

**Benefits of this method:**
- ✅ Easy to update settings later
- ✅ No need to edit code files
- ✅ Settings sync across Chrome browsers (if you're signed in)
- ✅ Can download a `config.local.js` file for backup

**🔒 Why do I need to enter Spreadsheet ID and Project ID here?**
These values are stored locally in your extension for two purposes:
1. **User convenience:** Generate the "Open Google Sheet" link in settings
2. **Initial setup:** Help you configure the Apps Script via `setupConfiguration()`

**Important:** These values are stored locally only and are NEVER sent over the network. When you click "Extract & Log Job Data", the extension only sends job details to your Apps Script endpoint. Your Apps Script retrieves the Spreadsheet ID and Project ID from its own server-side Script Properties.

#### Method B: Using config.local.js (Advanced)

1. In your extension folder, copy `config.example.js` to `config.local.js`
2. Open `config.local.js` in a text editor
3. Replace the placeholder values:
   ```javascript
   const CONFIG = {
     APPS_SCRIPT_ENDPOINT: 'https://script.google.com/macros/s/AKfycbx.../exec',
     SPREADSHEET_ID: '1A2B3C4D5E6F7G8H9I0J...',
     PROJECT_ID: '123456789012',
   };
   ```
4. Save the file
5. Reload the extension in Chrome:
   - Go to `chrome://extensions`
   - Find "JobSprint Extension"
   - Click the circular reload icon 🔄

**What this does:** This tells the extension where to send job data when you click "Extract & Log Job Data". The extension checks Settings first, then falls back to `config.local.js` if settings are empty.

---

### Step 7: Test It!

Let's make sure everything works:

1. Navigate to any job posting (LinkedIn, Indeed, Glassdoor, etc.)
2. Click the JobSprint extension icon in your toolbar
3. Click the **"Extract & Log Job Data"** button
4. You should see a success message like "Job data logged successfully!"
5. Go back to your Google Sheet (the one from Step 1)
6. You should see a new sheet called **"Job Applications"** with:
   - A blue header row with column names
   - Your first job posting in row 2!

**If it worked:** Congratulations! Your endpoint is set up and working. Every time you click "Extract & Log Job Data", a new row will be added to your sheet.

**If it didn't work:** See the Troubleshooting section below.

---

## Understanding Your Sheet

After logging your first job, you'll see a sheet with these columns:

| Column | What It Contains |
|--------|------------------|
| **Timestamp** | When you viewed the job posting (from the page) |
| **Job Title** | The position title (e.g., "Software Engineer") |
| **Company** | The company name |
| **Location** | Where the job is located |
| **URL** | Direct link back to the job posting |
| **Source** | Which job board it came from (LinkedIn, Indeed, etc.) |
| **Date Added** | When the extension logged it to your sheet |

**📝 Manual Data Entry:** If the extension can't extract certain fields from a job page (e.g., company name isn't found), it will show you a popup form where you can review and fill in the missing information before submitting. This feature is enabled by default but can be disabled in Settings if you prefer to just log whatever data is extracted automatically (which will show as placeholders like "(No company)" or "(No title)" in your sheet).

You can:
- ✅ Sort by any column
- ✅ Add your own columns (Status, Notes, Applied Date, etc.)
- ✅ Use filters to find specific jobs
- ✅ Create charts and pivot tables
- ✅ Share with career coaches or mentors

---

## Troubleshooting

### "Network error occurred"

**Possible causes:**
1. The URL in `service-worker.js` is incorrect
2. The deployment isn't set to "Anyone" access
3. Your script has an error

**How to fix:**
1. Double-check the URL in `service-worker.js` matches exactly what's in the Apps Script deployment
2. In Apps Script, click Deploy → Manage deployments → Edit (pencil icon) → Verify "Who has access" is set to "Anyone"
3. In Apps Script, click the "Execution log" button to see if there are any errors

---

### "Apps Script endpoint not configured"

**Cause:** The extension configuration is not set up yet

**How to fix:**
1. Click the extension icon → Settings
2. Fill in your Apps Script Endpoint URL, Spreadsheet ID, and Project ID
3. Click "Save Settings"
4. Try extracting job data again

**Alternative fix (if you prefer using config.local.js):**
1. Create `config.local.js` from `config.example.js`
2. Fill in your values
3. Reload the extension

---

### "Invalid job data" or "Configuration not set up"

**Cause:** Either the extension configuration (spreadsheet ID, project ID) is missing, or you haven't set up config.local.js

**How to fix:**
- Create `config.local.js` from `config.example.js` and fill in your values
- Make sure `SPREADSHEET_ID` and `PROJECT_ID` are set correctly
- Reload the extension after updating config

**Note:** For the MVP, the extension will accept and log whatever job data it can extract from the page, even if some fields are missing. Missing values will show as "(No company)" or "(No title)" in your sheet. This allows capturing data from pages with incomplete extraction.

---

### Extension extracts data but nothing appears in the sheet

**Possible causes:**
1. The script isn't writing to the correct sheet
2. There's a permissions issue

**How to fix:**
1. In Apps Script, click **Run** (play button) → Select `testDoPost` function → Click Run
2. Check the "Execution log" for error messages
3. Try re-authorizing: Deploy → Manage deployments → Edit → Change "Execute as" to "Me" again → Update

---

### Can I use this for multiple extensions/computers?

**Yes!** The same Apps Script URL works everywhere. You can:
- Install the extension on multiple computers (just use the same URL in `service-worker.js`)
- Share the URL with a friend (they'll add to your sheet)
- Have multiple extensions use the same sheet

---

## Need Help?

If you're still having trouble:

1. Check the **Execution log** in Apps Script for error messages
2. Check the **Chrome Developer Console** (F12) for extension errors
3. Try the test function (`testDoPost`) to verify the script works
4. Review the troubleshooting section above

---

## What's Next?

Now that your endpoint is set up, you can:

✅ Log jobs as you browse job boards
✅ Track your applications in Google Sheets
✅ Add your own columns (Application Status, Follow-up Dates, etc.)
✅ Create charts to visualize your job search
✅ Filter and sort to find jobs you want to apply to

Happy job hunting! 🎉




# TODO: Incorporate the following guide into this page as an expandable section, matching our writing style.

## 🧭 Viewing Logs for Your Google Apps Script Web App

### Quick Fix if “Sheets → Extensions → Apps Script” Shows 404

If clicking **Sheets → Extensions → Apps Script** gives a 404:

1. Open an **incognito window** — the script editor should load there.
2. If not, go to [https://script.google.com/home/projects](https://script.google.com/home/projects)
   → find your spreadsheet’s bound project in the list.
3. Open it and click the **“Open spreadsheet”** button to confirm it’s truly bound.
   (If that button opens your sheet, you’re in the right project.)

You can now exit the incognito window and open your Apps Script and Sheet from [https://script.google.com/home/projects](https://script.google.com/home/projects).

---

### Why Google Cloud Logging Is Needed

* The **Executions** page only shows basic status (✅ Completed / ❌ Failed).
* Full `Logger.log()` or `console.log()` output no longer appears for deployed web-apps.
* Local runs (via “Run” in the editor) still show complete logs, but web requests don’t.
* Google now requires linking to a **Google Cloud Project** to access full logs for deployed code.

---

### Enable Cloud Logging (Simple Walkthrough)

1. **Create a Cloud Project**

   * Go to [https://console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate)
   * Name it anything (e.g. `LogSprint Cloud App`)
   * Keep “No organization” as the location.
   * Click **Create**.

2. **Link It to Your Apps Script**

   * In your script editor → ⚙️ **Project Settings**
   * Under “Google Cloud Platform Project” click **Change project**
   * Copy the **numeric Project Number** from your new Cloud project and paste it here.
   * Save changes.

3. **Trigger Your Script**

   * Run your Chrome extension or web app once to generate logs.

4. **View Logs**

   * Open [https://console.cloud.google.com/logs/query](https://console.cloud.google.com/logs/query)
   * At top left, select your new project.
   * Paste this query and click **Run Query**:

     ```
     resource.type="app_script_function"
     AND resource.labels.function_name="doPost"
     AND jsonPayload.message=~"JobSprint:.*"
     ```
   * You'll see all `console.log()` / `console.info()` / `console.warn()` / `console.error()` output for your deployed script.

   **⚠️ Important:** If you don't see WARNING or ERROR logs:
   - Check the **severity filter** dropdown at the top of the logs page - make sure "All severities" is selected
   - The query searches for logs with `jsonPayload.message` starting with "JobSprint:"
   - All console methods (info, warn, error) create the same structured log format

---

### Summary

| Where                                    | What You’ll See                          |
| ---------------------------------------- | ---------------------------------------- |
| **Executions page**                      | Only success/failure and uncaught errors |
| **Apps Script editor (Run → View Logs)** | Full logs for local runs                 |
| **Google Cloud Logging**                 | Full logs for web-app executions         |

---

**In short:**
If your deployed web app says “Completed” but you see nothing in Executions, link your script to a Cloud project. Cloud Logging is now the only place Google exposes real-time logs for web-app requests.

### OAuth

(first time setup - for developers)
1. complete the Oauth consent screen
2. Navigate to **Audience** and add yourself as a test user

### Updating your code
After uploading the latest source code, you must create a new deployment -> manage deployments -> edit -> New version. This will require auth. Your URL will not change.

### When you connected your script to a custom GCP project:

The “Executions” tab in Apps Script loses direct access to the built-in Logs Viewer.

The “Cloud logs” / “Cloud errors” options are disabled because log ownership was transferred to your linked GCP project.

(Apps Script’s own lightweight viewer only works for unbound projects.)

```
logName:"/logs/custom"
```

# TODO: Incorporate this section better either here or in main README - not as a list of New Features


## New Features

### Settings Page

The extension now includes a dedicated settings page where you can:

- **Configure all credentials:** Apps Script URL, Spreadsheet ID, and Project ID
- **Test your connection:** See if your Google Sheets connection is working
- **Open your sheet directly:** Click a button to open your Google Sheet
- **Download config file:** Export your settings as `config.local.js` for backup
- **Control manual entry:** Enable/disable the manual data entry popup

**To access:** Click the JobSprint icon → Settings (at the bottom)

### Manual Data Entry Popup

When the extension can't automatically extract all job details (common on custom job boards), it will show a form where you can:

- Review the data that was extracted
- Fill in any missing fields (job title, company, location)
- Submit the corrected data to your sheet

**Benefits:**
- ✅ Ensures complete job records
- ✅ Works on any job board, even custom ones
- ✅ Can be disabled in Settings if you prefer automatic-only extraction

### Improved Apps Script Setup

The Apps Script code now includes a `setupConfiguration()` function that:

- Stores your Spreadsheet ID and Project ID in Script Properties
- Allows test functions to run without editing them each time
- Makes deployment and testing much easier

**To use:**
1. Edit `setupConfiguration()` with your IDs (one time only)
2. Run it to save your configuration
3. Run `testDoPost()` and `runDiagnostics()` anytime without editing

---

## Advanced: Using a Separate Sheet

If you want the job data in a specific sheet (not the one the script is attached to):

1. Create or open the target spreadsheet
2. Copy the spreadsheet ID from the URL:
   - URL: `https://docs.google.com/spreadsheets/d/`**`1A2B3C4D5E6F7G8H9I0J`**`/edit`
   - The ID is the long string between `/d/` and `/edit`
3. In the Apps Script code, find the line:
   ```javascript
   var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
   ```
4. Replace it with:
   ```javascript
   var spreadsheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID_HERE');
   ```
5. Replace `YOUR_SPREADSHEET_ID_HERE` with the actual ID you copied
6. Save and redeploy (Deploy → New deployment)

---
