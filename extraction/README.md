# JobSprint Extraction Module

This directory contains all job data extraction functionality, organized for clarity and maintainability.

## Directory Structure

```
extraction/
├── core/                  # Core extraction engine components
│   ├── engine.js         # Main extraction engine & orchestration
│   ├── parser.js         # Document parser (HTML/text → sections)
│   └── context-aware.js  # Context-aware extraction wrapper
├── extractors/            # Field-specific extractors
│   └── field-extractors.js # Individual field extraction logic
├── types/                 # Type definitions & configurations
│   └── extractor-config.js # Extractor context & section mappings
├── utils/                 # Utility functions
│   ├── text-formatter.js  # Plain text extraction & formatting
│   └── dom-helpers.js     # CSP-compliant DOM manipulation
├── jobboards/             # Job board-specific selectors (future)
│   └── selectors.js       # Board-specific CSS selectors
├── index.js              # Main API entry point
└── README.md             # This file
```

## API Usage

### In Content Scripts

The extraction module is loaded automatically via `manifest.json` in this order:

1. `extraction/utils/text-formatter.js` - Text utilities
2. `extraction/utils/dom-helpers.js` - DOM helpers
3. `extraction/types/extractor-config.js` - Configurations
4. `extraction/core/parser.js` - Document parser
5. `extraction/core/context-aware.js` - Context-aware extractor
6. `extraction/extractors/field-extractors.js` - Field extractors
7. `extraction/core/engine.js` - Main engine
8. `extraction/index.js` - API interface
9. `content-script.js` - Your content script

### Available APIs

#### ExtractionAPI (Main Interface)

```javascript
// Simplified extraction (URL + content only)
const data = window.ExtractionAPI.extractSimplified();
// Returns: { url, description, source, timestamp }

// Detailed extraction (all fields via context-aware)
const data = window.ExtractionAPI.extractDetailed();
// Returns: { title, company, location, pay, compensation, description, url, etc. }

// Parse document into sections
const doc = window.ExtractionAPI.parseDocument();
// Returns: StructuredDocument with sections
```

#### TextFormatter (Utility)

```javascript
// Extract page content as formatted plain text
const text = window.TextFormatter.extractPageContentAsPlainText();

// Extract source/board name from URL
const source = window.TextFormatter.extractSource(url);

// Clean and normalize text
const clean = window.TextFormatter.cleanText(rawText);
```

#### DOMHelpers (CSP-Compliant DOM Manipulation)

```javascript
// Create elements without inline styles
const element = window.DOMHelpers.createElement('div', 'Hello', ['my-class']);

// Create error messages
const error = window.DOMHelpers.createErrorMessage('Error Title', 'Message');

// Create labeled values
const field = window.DOMHelpers.createLabeledValue('Label', 'Value');

// Clear element contents
window.DOMHelpers.clearElement(container);
```

## Extraction Flow

### Simplified Extraction (Quick Save)

```
User clicks "Quick Save"
  ↓
popup.js sends 'extractJobData' message
  ↓
content-script.js → extractJobData()
  ↓
ExtractionAPI.extractSimplified()
  ↓
Returns: { url, description (plain text), source, timestamp }
```

### Detailed Extraction (Manual Entry)

```
User clicks "Auto-Extract"
  ↓
popup.js sends 'extractJobDataDetailed' message
  ↓
content-script.js → extractJobDataDetailed()
  ↓
ExtractionAPI.extractDetailed()
  ↓
ExtractionEngine.extractJobDataContextAware()
  ↓
1. parseDocument() - Split page into sections
2. extractWithContext() - Extract each field from relevant sections
3. Return structured data with all fields
```

## Context-Aware Extraction

### How It Works

1. **Document Parsing** (`parser.js`)
   - Detects job board type (Indeed, LinkedIn, etc.)
   - Splits document into semantic sections:
     - header (job title, company)
     - compensation (salary, benefits)
     - requirements (qualifications, skills)
     - technicalSkills (programming languages, tools)
     - etc.

2. **Section-Specific Extraction** (`context-aware.js`)
   - Each extractor targets specific sections
   - Pay extractor searches ONLY in compensation section
   - Excludes technicalSkills to avoid false matches
   - Falls back to full document if section confidence is low

3. **Field Extraction** (`field-extractors.js`)
   - Pattern-based extraction (regex)
   - Custom extraction logic per field
   - Returns confidence scores

### Example Configuration

```javascript
// extractor-config.js
pay: {
  searchSections: ['compensation'],
  sectionPriority: ['compensation'],
  minConfidence: 0.7,
  fallbackToFullDoc: false,
  excludeSections: ['technicalSkills', 'requirements'],  // Avoid "$5 years experience"
  description: 'Specific salary or hourly rate'
}
```

## CSP Compliance

All DOM manipulation uses CSP-compliant methods:

### ❌ Don't Do This (CSP Violation)
```javascript
element.innerHTML = `<strong>Error:</strong> ${message}`;
element.style.color = 'red';  // Inline style
```

### ✅ Do This Instead (CSP-Compliant)
```javascript
// Use DOM helpers
const error = window.DOMHelpers.createErrorMessage('Error', message);
container.appendChild(error);

// Or use CSS classes
element.classList.add('error-message');
```

## Adding New Extractors

### 1. Add Extractor Configuration

Edit `extraction/types/extractor-config.js`:

```javascript
EXTRACTOR_CONTEXTS.myNewField = {
  searchSections: ['header', 'jobDescription'],
  sectionPriority: ['header', 'jobDescription'],
  minConfidence: 0.5,
  fallbackToFullDoc: true,
  excludeSections: [],
  description: 'What this field extracts'
};
```

### 2. Implement Extractor Function

Add to `extraction/extractors/field-extractors.js`:

```javascript
function extractMyNewField(element, text) {
  // Your extraction logic here
  const pattern = /pattern-to-match/i;
  const match = text.match(pattern);
  return match ? match[0] : null;
}
```

### 3. Wire It Up

Update `extraction/core/context-aware.js` to call your extractor.

## Testing

Tests are located in `/tests/`:
- `field-extractors.test.js` - Field extractor unit tests
- `extraction.test.js` - Integration tests

Run tests:
```bash
npm test
```

## Migration Notes

### For Developers

**Old Code:**
```javascript
const data = extractJobDataLegacy();
const text = extractPageContentAsPlainText();
```

**New Code:**
```javascript
const data = window.ExtractionAPI.extractSimplified();
const text = window.TextFormatter.extractPageContentAsPlainText();
```

### File Moves

| Old Location | New Location |
|--------------|--------------|
| `extraction-types.js` | `extraction/types/extractor-config.js` |
| `document-parser.js` | `extraction/core/parser.js` |
| `context-aware-extractor.js` | `extraction/core/context-aware.js` |
| `extraction-engine.js` | `extraction/core/engine.js` |
| `field-extractors-testable.js` | `extraction/extractors/field-extractors.js` |

## Design Documents

- [`DESIGN_CONTEXT_AWARE_EXTRACTION.md`](../DESIGN_CONTEXT_AWARE_EXTRACTION.md) - Context-aware extraction design
- Main [README.md](../README.md) - Project overview

## Contributing

When modifying extraction code:
1. Keep functions focused and testable
2. Add JSDoc comments
3. Update tests
4. Maintain CSP compliance
5. Follow the established directory structure

## Future Enhancements

- [ ] Job board-specific parsers in `jobboards/`
- [ ] Machine learning section classification
- [ ] Confidence-based UI indicators
- [ ] Extraction result visualization tools
