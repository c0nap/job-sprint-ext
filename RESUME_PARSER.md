# Resume Parser Feature

## Overview

The Resume Parser is a feature that allows users to parse sections from their resume into structured JSON data for use with the Clipboard Macros feature. Instead of manually typing out all your information, you can simply paste sections from your resume and let the parser extract the relevant data automatically.

## Features

### 6 Section Types Supported

1. **👤 Demographics** - Name, contact info, LinkedIn, GitHub, objective, availability
2. **📋 References** - Professional references with contact details
3. **🎓 Education** - Degrees, institutions, GPA, coursework
4. **💼 Employment** - Job titles, companies, dates, descriptions
5. **🚀 Projects** - Project titles, descriptions, technologies used
6. **💡 Skills** - List of technical and soft skills

### Intelligent Parsing

- **Pattern Recognition**: Uses regex patterns to identify emails, phone numbers, LinkedIn profiles, GitHub handles, and more
- **Configurable Heuristics**: Customize delimiters (|, newlines, tabs, commas) and keywords used for parsing
- **Multiple Formats**: Works with various resume formats and layouts
- **Order-Based Parsing**: Education and Employment sections parse based on the order information appears

### User-Friendly UI

- **Missing Field Dialogs**: When fields can't be detected, a dialog appears to fill them in manually
- **Skills Review**: For skills sections, review and remove specific skills with a click
- **Search Functionality**: Search through parsed skills to find and remove unwanted ones
- **Preview**: See parsed JSON before adding to Clipboard Macros

## Usage

### Basic Workflow

1. Open **Settings** from the extension popup
2. Navigate to the **Resume Parser** section
3. Select the **Section Type** you want to parse
4. **Paste** the text from your resume into the text area
5. Click **Parse Section**
6. Review the results and fill in any missing fields
7. Click **Add to Clipboard Macros** to save

### Example: Parsing Demographics

**Input:**
```
Patrick Conan
Rochester, New York | (845)-645-8158 | conap910@gmail.com
linkedin.com/in/patrick-conan — github.com/c0nap
Objective: Recent graduate seeking full-time software developer role building scalable, data-driven systems.
Available Winter 2025 (December 31st)
```

**Parsed Output:**
```json
{
  "name": "Patrick Conan",
  "address": "Rochester, New York",
  "phone": "(845)-645-8158",
  "email": "conap910@gmail.com",
  "linkedin": "linkedin.com/in/patrick-conan",
  "github": "github.com/c0nap",
  "objective": "Recent graduate seeking full-time software developer role building scalable, data-driven systems.",
  "available": "Available Winter 2025 (December 31st)"
}
```

### Example: Parsing Education

**Input:**
```
SUNY College at Oneonta B.S. Statistics – 2024 (summa cum laude) GPA – 3.97
Coursework: Theory of Computation, Linear Algebra, Data Analytics (R), Econometrics, Operations Research
```

**Parsed Output:**
```json
{
  "current": {
    "institution": "SUNY College at Oneonta",
    "degree": "B.S. Statistics",
    "year": "2024",
    "gpa": "3.97",
    "coursework": "Theory of Computation, Linear Algebra, Data Analytics (R), Econometrics, Operations Research"
  }
}
```

### Example: Parsing Employment

**Input:**
```
Office Assistant                   Montefiore St. Luke's Hospital – Cornwall, NY                                                     Apr '20 - May '20
Assisted in the hospital's transition to a new medical records and patient billing system.
Managed sensitive billing information to ensure appeals and insurance response forms transferred correctly.
```

**Parsed Output:**
```json
{
  "current": {
    "title": "Office Assistant",
    "company": "Montefiore St. Luke's Hospital",
    "location": "Cornwall, NY",
    "dates": "Apr '20 - May '20",
    "description": "Assisted in the hospital's transition to a new medical records and patient billing system.\nManaged sensitive billing information to ensure appeals and insurance response forms transferred correctly."
  }
}
```

### Example: Parsing Skills

**Input:**
```
Python, JavaScript, React, Node.js, SQL, PostgreSQL, Git, Docker, AWS, Linux, Machine Learning, Data Analysis
```

**Parsed Output:**
```json
[
  "Python",
  "JavaScript",
  "React",
  "Node.js",
  "SQL",
  "PostgreSQL",
  "Git",
  "Docker",
  "AWS",
  "Linux",
  "Machine Learning",
  "Data Analysis"
]
```

## Advanced Configuration

### Customizing Parser Heuristics

In the **Advanced Parser Configuration** section, you can customize how the parser works:

```json
{
  "demographics": {
    "delimiters": ["|", "\n", "\t", ","],
    "patterns": {
      "email": "regex pattern",
      "phone": "regex pattern"
    },
    "keywords": {
      "objective": ["objective", "summary", "about"],
      "available": ["available", "availability", "start date"]
    }
  }
}
```

**Configurable Options:**

- **delimiters**: Characters that separate information (pipe, newline, tab, comma, etc.)
- **patterns**: Regex patterns for matching email, phone, URLs
- **keywords**: Words to look for when identifying sections (objective, coursework, etc.)
- **orderPatterns**: Expected order of information in sections

### When to Customize

- Your resume uses unusual delimiters (e.g., semicolons instead of pipes)
- Your resume has non-standard section headers (e.g., "Career Goal" instead of "Objective")
- You want to add support for additional patterns or formats

## Tips for Best Results

1. **Paste Clean Text**: Remove excessive whitespace and formatting before pasting
2. **One Section at a Time**: Parse each section separately for better accuracy
3. **Review Before Adding**: Always review the parsed result before adding to Clipboard Macros
4. **Fill Missing Fields**: Use the missing fields dialog to complete incomplete data
5. **Use Consistent Formats**: Keep your resume formatting consistent for better parsing

## Testing

A test file is included at `test-parser.html` that allows you to test all parsers with example data:

1. Open `test-parser.html` in a web browser
2. Click the test buttons for each section type
3. View the parsed output to verify accuracy
4. Modify the input text to test different formats

## Technical Details

### Parser Architecture

- **resume-parser.js**: Core parsing module with functions for each section type
- **settings.js**: UI handlers and integration with Chrome storage
- **settings.html**: User interface for the parser

### Storage

Parsed data is saved to `chrome.storage.sync.clipboardMacros` under the appropriate section key (demographics, education, etc.).

Parser configuration is saved to `chrome.storage.sync.resumeParserConfig`.

### Validation

- Empty strings are flagged as missing fields
- Only strings and plain objects are allowed in the final structure
- JSON validation ensures data integrity before saving

## Future Enhancements

Possible improvements for future versions:

- PDF upload and parsing (currently text-only)
- Bulk import from full resume document
- AI-powered parsing for better accuracy
- Export parsed data to various formats
- Template-based parsing for different resume styles
- Multi-language support

## Troubleshooting

**Parser returns empty fields:**
- Check that your text includes the information you expect
- Try adjusting delimiters in Advanced Configuration
- Verify the section type matches your content

**Skills not detected correctly:**
- Try different delimiters (comma, pipe, newline)
- Remove bullet points before pasting
- Use the review UI to manually remove incorrect skills

**Missing fields dialog appears:**
- This is normal for incomplete data
- Fill in the fields manually or leave them empty
- You can still add to Clipboard Macros without all fields

## Support

For issues or feature requests, please open an issue on the GitHub repository.
