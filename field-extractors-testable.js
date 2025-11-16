/**
 * Testable exports for field-specific intelligent extractors
 * These functions are used by the mouse tracking feature for intelligent field-aware extraction
 * @jest-environment jsdom
 */

/**
 * Clean extracted text by removing extra whitespace and newlines
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text with normalized whitespace
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')    // Replace multiple whitespace with single space
    .replace(/\n+/g, ' ')    // Replace newlines with space
    .trim();
}

/**
 * Extract pay amount (single number with optional currency)
 * Looks for patterns like: $75, $75.00, 75/hour, etc.
 * @param {HTMLElement} element - Element being hovered
 * @param {string} text - Text content
 * @returns {string|null} Extracted pay amount or null
 */
function extractPayAmount(element, text) {
  // Look for currency amounts: $XX, $XX.XX, XXk, XX/hour, etc.
  // Order matters: more specific patterns first
  const patterns = [
    /\$\s*\d+\s*k\b/i, // $70k (must come before dollar amounts to catch k notation)
    /\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*\/\s*(?:hour|hr|h)\b/i, // $75.00/hour
    /\$\s*\d+(?:,\d{3})*(?:\.\d+)?/i, // $75.00 or $75,000
    /\d+(?:,\d{3})*(?:\.\d+)?\s*(?:USD|dollars?)/i, // 75 USD
    /\d+\s*k\b/i, // 75k
    /\d+(?:\.\d+)?\s*\/\s*(?:hour|hr|h)\b/i // 75/hour
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Return the full matched text with context
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Extract compensation range (salary range with optional benefits)
 * Looks for patterns like: $65-$75/hour, $100k-$120k, etc.
 * @param {HTMLElement} element - Element being hovered
 * @param {string} text - Text content
 * @returns {string|null} Extracted compensation or null
 */
function extractCompensationRange(element, text) {
  // Look for salary ranges (must contain a dash/range indicator)
  // Order matters: more specific patterns first
  const rangePatterns = [
    /\$\s*\d+\s*k\s*[-–—]\s*\$?\s*\d+\s*k\s*(?:(?:\/|per)\s*(?:hour|hr|year|yr|annually))?/i, // $50k-$60k per year
    /\d+k\s*[-–—]\s*\d+k/i, // 100k-120k
    /\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*[-–—]\s*\$?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:(?:\/|per)\s*(?:hour|hr|year|yr|annually))?/i // $65-$75/hour
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // Fallback: try single pay amount
  return extractPayAmount(element, text);
}

/**
 * Extract location (city, state, or remote)
 * Looks for US state abbreviations, city names, or "Remote"
 * @param {HTMLElement} element - Element being hovered
 * @param {string} text - Text content
 * @returns {string|null} Extracted location or null
 */
function extractLocation(element, text) {
  // Check for special location keywords first (hard-coded as valid locations)
  // These take priority over other patterns to avoid misinterpretation
  // Priority order matters: more specific patterns first

  // Check for "Multiple Locations" and variations FIRST
  // (before Remote, as "Multiple Locations (Remote available)" should return "Multiple Locations")
  if (/\bmultiple\s+locations?\b/i.test(text)) {
    return 'Multiple Locations';
  }

  // Check for "Various Locations"
  if (/\bvarious\s+locations?\b/i.test(text)) {
    return 'Multiple Locations';
  }

  // Check for "Remote" (very common and distinctive)
  if (/\bremote\b/i.test(text)) {
    return 'Remote';
  }

  // Check for "Hybrid"
  if (/\bhybrid\b/i.test(text)) {
    return 'Hybrid';
  }

  // Check for "Nationwide"
  if (/\bnationwide\b/i.test(text)) {
    return 'Nationwide';
  }

  // Check for "On-site" or "Onsite"
  if (/\bon-?site\b/i.test(text)) {
    return 'On-site';
  }

  // Common state abbreviations (defensive - validates actual states)
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];

  // Try to match "City, STATE" format first (most complete)
  const cityStatePattern = /([A-Za-z][A-Za-z\s\.'-]+),\s*([A-Z]{2})\b/;
  const cityStateMatch = text.match(cityStatePattern);
  if (cityStateMatch && validStates.includes(cityStateMatch[2])) {
    return cityStateMatch[0].trim(); // Return "City, STATE"
  }

  // Try to match just state abbreviation
  const statePattern = /\b([A-Z]{2})\b/;
  const stateMatch = text.match(statePattern);
  if (stateMatch && validStates.includes(stateMatch[1])) {
    return stateMatch[1]; // Return just "STATE"
  }

  // Try to match "City, State Name" (full state name)
  const fullStateNames = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  for (const [stateName, abbrev] of Object.entries(fullStateNames)) {
    if (text.includes(stateName)) {
      // Try to extract city if present
      const cityFullStatePattern = new RegExp(`([A-Za-z][A-Za-z\\s\\.'-]+),\\s*${stateName}`, 'i');
      const cityFullStateMatch = text.match(cityFullStatePattern);
      if (cityFullStateMatch) {
        return `${cityFullStateMatch[1].trim()}, ${abbrev}`;
      }
      return abbrev; // Just return state abbreviation
    }
  }

  // Defensive fallback: if nothing matched, return null
  // The system will fall back to word extraction around mouse cursor
  return null;
}

/**
 * Extract job title (typically header text, bold, or prominently displayed)
 * Looks for h1-h3 headers or bold text near top of page
 * @param {HTMLElement} element - Element being hovered
 * @returns {string|null} Extracted job title or null
 */
function extractJobTitle(element) {
  // Guard against null/undefined element
  if (!element) return null;

  // Check for data attributes first (most reliable)
  const dataAttrs = ['data-job-title', 'data-title', 'data-position'];
  for (const attr of dataAttrs) {
    const value = element.getAttribute(attr);
    if (value && value.trim()) {
      return cleanText(value);
    }
  }

  // Check if element itself is a header
  if (['H1', 'H2', 'H3'].includes(element.tagName)) {
    const text = cleanText(element.textContent);
    const wordCount = text.split(/\s+/).length;
    // Headers should be reasonable length for a title
    if (wordCount >= 2 && wordCount <= 10) {
      return text;
    }
  }

  // Check semantic HTML structure (e.g., article > h1, main > h1)
  const semanticParent = element.closest('article, main, [role="main"]');
  if (semanticParent) {
    const headerInParent = semanticParent.querySelector('h1, h2, .job-title, [data-job-title]');
    if (headerInParent && headerInParent.textContent) {
      const text = cleanText(headerInParent.textContent);
      const wordCount = text.split(/\s+/).length;
      if (wordCount >= 2 && wordCount <= 10) {
        return text;
      }
    }
  }

  // Check if element is in top 25% of page (titles usually at top)
  const viewportHeight = window.innerHeight;
  const rect = element.getBoundingClientRect();
  const isNearTop = rect.top < viewportHeight * 0.25;

  // Check if element has bold/strong styling
  const style = window.getComputedStyle(element);
  const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
  const isLarge = parseInt(style.fontSize) >= 18;

  if (isBold && isLarge && isNearTop) {
    const text = cleanText(element.textContent);
    const wordCount = text.split(/\s+/).length;
    // Job titles are usually 2-8 words
    if (wordCount >= 2 && wordCount <= 8) {
      return text;
    }
  }

  // Look for nearby header with common class names
  const nearbyHeader = element.closest('header, [role="heading"], .job-title, .title, .position, .job-header');
  if (nearbyHeader) {
    const headerText = cleanText(nearbyHeader.textContent);
    const wordCount = headerText.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 8) {
      return headerText;
    }
  }

  return null;
}

/**
 * Extract company name (typically bold organization name)
 * Looks for bold text, links, or elements with company-related classes
 * @param {HTMLElement} element - Element being hovered
 * @returns {string|null} Extracted company name or null
 */
function extractCompanyName(element) {
  // Guard against null/undefined element
  if (!element) return null;

  const text = cleanText(element.textContent || '');

  // Return null if text is empty after cleaning
  if (!text) return null;

  // Filter out department names to prevent misinterpretation
  // Department names are not company names
  // Be careful: "Department Store Inc" is a valid company, but "Department of Engineering" is not
  const departmentPatterns = [
    /^department\s+(of|for|:|at)\b/i,    // "Department of/for/:/at..." but NOT "Department Store"
    /^(engineering|sales|marketing|hr|finance|it|operations|legal)\s+department/i,  // "Engineering Department"
    /\bdepartment\s*:\s*(?!store)/i,     // "Department:" label (not "Department: Store")
    /^dept\.?\s+(?!store)/i,             // "Dept." or "Dept" (not "Dept. Store")
    /\b(team|division|group|unit)\s*:/i  // "Team:", "Division:", etc.
  ];

  for (const pattern of departmentPatterns) {
    if (pattern.test(text)) {
      return null; // This is a department, not a company
    }
  }

  // Check for corporate suffixes (strong indicator of company name)
  // Must be at the end of the text to avoid false positives
  // Also filter out generic words like "a Company" or "the Corporation"
  const corporateSuffixes = /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|Co\.?|Company|LP|LLP|PC|PLC|GmbH|SA|AG)\.?$/i;
  if (corporateSuffixes.test(text)) {
    const wordCount = text.split(/\s+/).length;
    // Company names with suffixes are usually 2-6 words
    // Reject if it starts with articles or common sentence starters
    const startsWithArticle = /^(this|that|these|those|the|a|an)\s+/i.test(text);
    if (wordCount >= 1 && wordCount <= 6 && !startsWithArticle) {
      return text;
    }
  }

  // Check for all-caps company names (common in headers)
  const words = text.split(/\s+/);
  const allCapsWords = words.filter(w => w === w.toUpperCase() && w.length > 1 && /[A-Z]/.test(w));
  if (allCapsWords.length >= 1 && allCapsWords.length <= 4) {
    // If most/all words are caps, likely a company name
    if (allCapsWords.length / words.length > 0.5) {
      return allCapsWords.join(' ');
    }
  }

  // Check if element has company-related class or id
  const companyClasses = ['company', 'employer', 'organization', 'org-name', 'org', 'business'];
  const elementClasses = (element.className || '').toLowerCase();
  const elementId = (element.id || '').toLowerCase();

  for (const cls of companyClasses) {
    if ((elementClasses && elementClasses.includes(cls)) || (elementId && elementId.includes(cls))) {
      const wordCount = text.split(/\s+/).length;
      if (wordCount >= 1 && wordCount <= 5) {
        return text;
      }
    }
  }

  // Check if element is a link (companies often link to their pages)
  if (element.tagName === 'A') {
    const wordCount = text.split(/\s+/).length;
    // Company names are usually 1-5 words
    if (wordCount >= 1 && wordCount <= 5) {
      return text;
    }
  }

  // Check for bold styling
  const style = window.getComputedStyle(element);
  const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;

  if (isBold) {
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 1 && wordCount <= 5) {
      return text;
    }
  }

  return null;
}

/**
 * Extract large text block (for job description/notes)
 * Prefers the largest continuous text block near the cursor
 * @param {HTMLElement} element - Element being hovered
 * @returns {string|null} Extracted text block or null
 */
function extractLargeTextBlock(element) {
  // Guard against null/undefined element
  if (!element) return null;

  // Check if element is in a navigation, footer, or sidebar (skip these)
  const excludedTags = ['NAV', 'FOOTER', 'ASIDE', 'HEADER'];
  const excludedRoles = ['navigation', 'banner', 'contentinfo', 'complementary'];
  const excludedClasses = [
    'nav', 'navigation', 'footer', 'sidebar', 'side-bar', 'menu', 'header-',
    'related-jobs', 'similar-jobs', 'job-list', 'job-card',
    'company-info', 'company-about', 'about-company',
    'apply-button', 'apply-now', 'application-form',
    'breadcrumb', 'pagination',
    'advertisement', 'ad-', 'promo'
  ];

  // Check for sidebar-specific content patterns in text
  const text = cleanText(element.textContent || '');
  const sidebarContentPatterns = [
    /^about\s+(this\s+)?company/i,       // "About this company" / "About the company"
    /^how\s+to\s+apply/i,                 // "How to apply"
    /^apply\s+now/i,                      // "Apply now"
    /^related\s+jobs?/i,                  // "Related jobs"
    /^similar\s+(jobs?|positions?)/i,    // "Similar jobs" / "Similar positions"
    /^recommended\s+jobs?/i,              // "Recommended jobs"
    /^you\s+might\s+also\s+like/i,       // "You might also like"
    /^other\s+jobs?\s+(at|from)/i,       // "Other jobs at..." / "Other jobs from..."
    /^share\s+this\s+job/i,              // "Share this job"
    /^save\s+this\s+job/i,               // "Save this job"
    /^report\s+this\s+job/i,             // "Report this job"
    /^company\s+overview/i,               // "Company overview"
    /^company\s+culture/i,                // "Company culture"
    /^company\s+benefits/i,               // "Company benefits"
    /^why\s+work\s+(here|at)/i           // "Why work here" / "Why work at..."
  ];

  for (const pattern of sidebarContentPatterns) {
    if (pattern.test(text)) {
      return null; // This is sidebar content, not job description
    }
  }

  let current = element;
  while (current) {
    // Check tag name
    if (excludedTags.includes(current.tagName)) {
      return null; // Don't extract from these areas
    }

    // Check ARIA role
    const role = current.getAttribute('role');
    if (role && excludedRoles.includes(role)) {
      return null;
    }

    // Check class names
    const className = (current.className || '').toLowerCase();
    if (excludedClasses.some(cls => className.includes(cls))) {
      return null;
    }

    // Check for data attributes that indicate sidebar/auxiliary content
    const dataType = current.getAttribute('data-type');
    const dataSection = current.getAttribute('data-section');
    if (dataType === 'sidebar' || dataType === 'related' ||
        dataSection === 'sidebar' || dataSection === 'recommended') {
      return null;
    }

    current = current.parentElement;
  }

  // Look for semantic main content areas first
  const mainContent = element.closest('main, article, [role="main"], .job-description, .description, .content, .main-content');
  if (mainContent) {
    const text = cleanText(mainContent.textContent);
    // Prefer main content if it's a reasonable size
    if (text.length >= 100 && text.length <= 5000) {
      return text;
    }
  }

  // Look for paragraph containers
  const paragraphParent = element.closest('div.description, div.job-description, section, .text-content');
  if (paragraphParent) {
    const text = cleanText(paragraphParent.textContent);
    if (text.length >= 50 && text.length <= 5000) {
      return text;
    }
  }

  // Walk up the DOM tree to find the largest reasonable text block
  let targetElement = element;
  let maxLength = cleanText(element.textContent).length;
  current = element.parentElement;
  let depth = 0;
  const MAX_DEPTH = 5;

  while (current && depth < MAX_DEPTH) {
    const text = cleanText(current.textContent);

    // Don't select the entire page
    if (text.length > 5000) {
      break;
    }

    // Skip elements that are likely containers
    if (current.tagName === 'BODY' || current.tagName === 'HTML') {
      break;
    }

    // Prefer larger blocks (with diminishing returns as we go up)
    if (text.length > maxLength * 1.5) {
      targetElement = current;
      maxLength = text.length;
    }

    current = current.parentElement;
    depth++;
  }

  const finalText = cleanText(targetElement.textContent);

  // Only return if it's a substantial block
  if (finalText.length >= 50 && finalText.length <= 5000) {
    return finalText;
  }

  return null;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cleanText,
    extractPayAmount,
    extractCompensationRange,
    extractLocation,
    extractJobTitle,
    extractCompanyName,
    extractLargeTextBlock
  };
}
