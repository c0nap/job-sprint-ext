# Context-Aware Extraction System Design

## Overview
This document outlines the design for a context-aware job data extraction system that intelligently searches relevant document sections for each data point.

## Section Types

### 1. Header Section
**Identifiers**: Top of page, h1/h2 tags, "header" class, first 200 characters
**Contains**: Job title, company name, location (often)
**Extractors**: `jobTitle`, `company`, `location`

### 2. Job Description Section
**Identifiers**: "Job Description", "About the Role", "Overview", "The Opportunity"
**Contains**: Role overview, day-to-day responsibilities
**Extractors**: `jobTitle`, `notes`, `role`

### 3. Requirements/Qualifications Section
**Identifiers**: "Requirements", "Qualifications", "What We're Looking For", "Minimum Requirements", "Must Have"
**Contains**: Skills, experience, education requirements
**Extractors**: `tailor`, `notes`

### 4. Compensation/Benefits Section
**Identifiers**: "Compensation", "Salary", "Benefits", "What We Offer", "Pay Range", "Total Rewards"
**Contains**: Salary, pay range, benefits, equity
**Extractors**: `compensation`, `pay`

### 5. Technical Skills Section
**Identifiers**: "Technical Requirements", "Tech Stack", "Skills", "Technologies", "Tools"
**Contains**: Programming languages, frameworks, tools
**Extractors**: `tailor` (but NOT `pay`, `compensation`)

### 6. About Company Section
**Identifiers**: "About Us", "About [Company]", "Company Overview", "Who We Are"
**Contains**: Company description, mission, values
**Extractors**: `company`, `notes`

### 7. Location Section
**Identifiers**: "Location", "Where", "Office", "Work Location", "Remote"
**Contains**: Office location, remote status, timezone
**Extractors**: `location`

### 8. Application Section
**Identifiers**: "How to Apply", "Application Process", "Next Steps"
**Contains**: Application instructions, timeline
**Extractors**: None (informational only)

## Extractor Context Mapping

| Extractor | Primary Sections | Secondary Sections | Fallback |
|-----------|-----------------|-------------------|----------|
| `company` | header, aboutCompany | jobDescription | Full document |
| `jobTitle` | header | jobDescription | Full document |
| `location` | header, location | jobDescription | Full document |
| `compensation` | compensation | Full document | None |
| `pay` | compensation | Full document | None |
| `role` | header, jobDescription | requirements | Full document |
| `tailor` | requirements, technicalSkills | jobDescription | Full document |
| `notes` | All sections | - | Full document |
| `rawDescription` | Full document | - | None |
| `url` | Page metadata | - | None |
| `board` | Page URL/domain | - | None |
| `status` | User-provided | - | None |
| `appliedDate` | Auto-generated | - | None |

## Section Detection Strategies

### For HTML Documents

1. **Semantic HTML Analysis**
   - Look for `<header>`, `<section>`, `<article>` tags
   - Heading hierarchy (h1, h2, h3)
   - Common class/id patterns: "job-description", "requirements", "benefits"

2. **Visual Structure Analysis**
   - DOM tree depth and branching
   - Text density in different regions
   - Heading followed by content pattern

3. **Pattern Matching**
   - Known job board structures (Indeed, LinkedIn, Greenhouse, Lever, etc.)
   - Common heading text patterns

### For Plain Text Documents

1. **Heading Detection**
   - All caps lines: "REQUIREMENTS", "QUALIFICATIONS"
   - Lines ending with colon: "About the Role:", "What We Offer:"
   - Markdown-style headers: "## Requirements", "# Job Description"
   - Lines followed by dashes/equals:
     ```
     Requirements
     ------------
     ```

2. **Content Boundary Detection**
   - Double line breaks often separate sections
   - Bullet point transitions
   - Indentation changes

3. **Keyword Clustering**
   - Group paragraphs by keyword density
   - Salary keywords cluster in compensation section
   - Tech terms cluster in requirements/skills section

## Document Parser API

```javascript
/**
 * Parse a job posting document into structured sections
 * @param {Object} input - { html: string, text: string, url: string }
 * @returns {StructuredDocument}
 */
function parseDocument(input) {
  return {
    fullText: string,
    fullHtml: string,
    url: string,
    sections: {
      header: Section,
      jobDescription: Section,
      requirements: Section,
      compensation: Section,
      technicalSkills: Section,
      aboutCompany: Section,
      location: Section,
      application: Section
    },
    metadata: {
      parseStrategy: 'html' | 'text',
      confidence: number,
      detectedBoard: string
    }
  }
}

/**
 * Section structure
 */
interface Section {
  text: string;          // Plain text content
  html?: string;         // HTML content (if available)
  confidence: number;    // 0.0 - 1.0, how confident we are this is the right section
  startIndex: number;    // Character position in full text
  endIndex: number;      // Character position in full text
  headingText?: string;  // The heading that identified this section
  keywords: string[];    // Key terms found in this section
}

/**
 * Context-aware extractor function signature
 */
function extractWithContext(
  structuredDoc: StructuredDocument,
  extractorType: string,
  options?: ExtractorOptions
): ExtractionResult {
  return {
    value: any,
    confidence: number,
    source: string,        // Which section(s) the data came from
    fallbackUsed: boolean  // Whether we had to use fallback search
  }
}
```

## Extractor Configuration

```javascript
const EXTRACTOR_CONFIG = {
  company: {
    searchSections: ['header', 'aboutCompany', 'jobDescription'],
    sectionPriority: ['header', 'aboutCompany', 'jobDescription'],
    minConfidence: 0.5,
    fallbackToFullDoc: true,
    patterns: [
      /at\s+([A-Z][A-Za-z\s&.]+?)(?:\s+is|\s+are|\s+–|\s+-|\.)/,
      /Join\s+([A-Z][A-Za-z\s&.]+?)(?:\s+as|\s+in|\s+to)/,
      // ... more patterns
    ]
  },

  pay: {
    searchSections: ['compensation'],
    sectionPriority: ['compensation'],
    minConfidence: 0.7,
    fallbackToFullDoc: true,
    excludeSections: ['technicalSkills', 'requirements'], // Don't search here
    patterns: [
      /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:per hour|\/hour|\/hr)/i,
      /\$\s*(\d{1,3}(?:,\d{3})*)\s*-\s*\$\s*(\d{1,3}(?:,\d{3})*)/,
      // ... more patterns
    ]
  },

  compensation: {
    searchSections: ['compensation'],
    sectionPriority: ['compensation'],
    minConfidence: 0.6,
    fallbackToFullDoc: false, // Don't search full doc - too much noise
    excludeSections: ['technicalSkills', 'requirements'],
    patterns: [
      // Full compensation package patterns
    ]
  },

  // ... other extractors
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Groundwork)
- [ ] Define section type enums and interfaces
- [ ] Create StructuredDocument class
- [ ] Implement basic HTML section detector
- [ ] Implement basic text section detector
- [ ] Create section confidence scoring system
- [ ] Write unit tests for section detection

### Phase 2: Extractor Context System
- [ ] Define EXTRACTOR_CONFIG for all extractors
- [ ] Create context-aware extraction wrapper
- [ ] Implement section search with priority
- [ ] Add fallback mechanisms
- [ ] Implement exclude sections logic

### Phase 3: Smart Extractors
- [ ] Update each extractor to use context
- [ ] Add confidence scoring to extractions
- [ ] Implement multi-section search strategies
- [ ] Add extraction result validation

### Phase 4: Integration
- [ ] Update content-script.js extraction flow
- [ ] Update popup.js to handle structured results
- [ ] Add debugging/visualization tools
- [ ] Performance optimization

### Phase 5: Advanced Features
- [ ] Job board-specific parsers (Indeed, LinkedIn, etc.)
- [ ] Machine learning section classification
- [ ] User feedback loop for improving detection
- [ ] A/B testing different strategies

## Benefits

1. **Accuracy**: Pay extractor won't match "$5 years experience with Java"
2. **Performance**: Searching smaller sections is faster
3. **Confidence Scores**: Know which extractions are reliable
4. **Debugging**: Can see which section each value came from
5. **Extensibility**: Easy to add new section types or extractors
6. **Flexibility**: Works with HTML or plain text inputs
7. **Fallbacks**: Graceful degradation when sections unclear

## Example Usage

```javascript
// In content-script.js
const structuredDoc = parseDocument({
  html: document.documentElement.outerHTML,
  text: document.body.innerText,
  url: window.location.href
});

const results = {
  company: extractWithContext(structuredDoc, 'company'),
  jobTitle: extractWithContext(structuredDoc, 'jobTitle'),
  pay: extractWithContext(structuredDoc, 'pay'),
  location: extractWithContext(structuredDoc, 'location'),
  compensation: extractWithContext(structuredDoc, 'compensation')
};

console.log('Extraction Results:', results);
// {
//   company: { value: "Google", confidence: 0.95, source: "header", fallbackUsed: false },
//   jobTitle: { value: "Software Engineer", confidence: 0.9, source: "header", fallbackUsed: false },
//   pay: { value: "$150,000 - $200,000", confidence: 0.85, source: "compensation", fallbackUsed: false },
//   ...
// }
```

## Next Steps

After implementing the groundwork:
1. Extend EXTRACTOR_MODES with new context-aware modes
2. Add specialized extractors for:
   - Benefits extraction
   - Skills/tech stack extraction
   - Experience level extraction
   - Remote status detection
   - Company size/industry classification
3. Create visualization tools for debugging section detection
4. Build confidence-based UI indicators
