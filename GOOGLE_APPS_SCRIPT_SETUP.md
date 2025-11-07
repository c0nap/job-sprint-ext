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

### Step 5: Configure the Extension

Now we need to tell the extension where to send the job data.

1. In your extension folder, open `service-worker.js` in a text editor (Notepad, TextEdit, VS Code, etc.)
2. Find line 174 (or search for `function getAppsScriptEndpoint()`)
3. You'll see this:

```javascript
function getAppsScriptEndpoint() {
  // TODO: In production, retrieve from chrome.storage.sync
  // For now, use placeholder (developers should replace this)
  return 'YOUR_APPS_SCRIPT_URL_HERE';
}
```

4. Replace `'YOUR_APPS_SCRIPT_URL_HERE'` with your actual URL (paste the URL you copied in Step 4)
5. It should look like this (but with your actual URL):

```javascript
function getAppsScriptEndpoint() {
  // TODO: In production, retrieve from chrome.storage.sync
  // For now, use placeholder (developers should replace this)
  return 'https://script.google.com/macros/s/AKfycbx.../exec';
}
```

6. **Save the file**
7. Reload the extension in Chrome:
   - Go to `chrome://extensions`
   - Find "JobSprint Extension"
   - Click the circular reload icon 🔄

**What this does:** This tells the extension where to send job data when you click "Extract & Log Job Data".

---

### Step 6: Test It!

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

**Cause:** The URL in `service-worker.js` is still set to `'YOUR_APPS_SCRIPT_URL_HERE'`

**How to fix:**
1. Open `service-worker.js`
2. Find the `getAppsScriptEndpoint()` function
3. Replace the placeholder with your actual deployment URL
4. Save and reload the extension

---

### "Invalid job data: missing required field"

**Cause:** The page you're on doesn't have recognizable job posting data

**How to fix:**
- Make sure you're on an actual job posting page (not search results)
- Try a different job board (LinkedIn, Indeed, Glassdoor are best supported)
- The extension works best on job detail pages, not list views

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

## Testing Your Setup (Optional)

Want to test the script directly without the extension?

1. In the Apps Script editor, find the `testDoPost()` function at the bottom
2. Click the **Run** button (▶️) at the top
3. Select `testDoPost` from the function dropdown if needed
4. Click Run
5. Check the "Execution log" - you should see "Test response: {"success":true,...}"
6. Check your Google Sheet - a test job should appear

---

## Security & Privacy

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

### Quick Fix if “Extensions → Apps Script” Shows 404

If clicking **Extensions → Apps Script** gives a 404:

1. Open an **incognito window** — the script editor should load there.
2. If not, go to [https://script.google.com/home/projects](https://script.google.com/home/projects)
   → find your spreadsheet’s bound project in the list.
3. Open it and click the **“Open spreadsheet”** button to confirm it’s truly bound.
   (If that button opens your sheet, you’re in the right project.)

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
     ```
   * You’ll see all `Logger.log()` / `console.log()` output for your deployed script.
     *(Optional filter)*

     ```
     jsonPayload.functionName="doPost"
     ```

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