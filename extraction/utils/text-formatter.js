/**
 * Text Formatting Utilities for Job Data Extraction
 *
 * Provides functions to extract and format page content as plain text
 * while preserving semantic structure (paragraphs, bullets, headers).
 *
 * @module extraction/utils/text-formatter
 */

/**
 * Extract main page content as plain text while preserving formatting
 * Respects paragraphs, bullets, and headers
 * @returns {string} Formatted plain text content
 */
function extractPageContentAsPlainText() {
  try {
    // Try to find the main content area
    let contentContainer = document.querySelector('main, article, [role="main"], .job-description, .description');

    // If no main content area found, use body but filter out navigation, headers, footers
    if (!contentContainer) {
      contentContainer = document.body;
    }

    // Clone the container to avoid modifying the actual DOM
    const clone = contentContainer.cloneNode(true);

    // Remove unwanted elements (scripts, styles, nav, header, footer, ads)
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer',
      '.navigation', '.navbar', '.nav', '.menu',
      '.advertisement', '.ad', '.ads', '.sidebar',
      'iframe', 'noscript', '[role="navigation"]',
      '[role="banner"]', '[role="complementary"]'
    ];

    unwantedSelectors.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    // Process the DOM tree and build formatted text
    const lines = [];

    function processNode(node, indent = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          return text;
        }
        return '';
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // Headers - add with blank line before and after
        if (/^h[1-6]$/.test(tagName)) {
          const text = getTextContent(node).trim();
          if (text) {
            lines.push('');
            lines.push(text);
            lines.push('');
          }
          return '';
        }

        // Paragraphs - add with blank line after
        if (tagName === 'p') {
          const text = getTextContent(node).trim();
          if (text) {
            lines.push(text);
            lines.push('');
          }
          return '';
        }

        // Lists - process each item
        if (tagName === 'ul' || tagName === 'ol') {
          const items = node.querySelectorAll('li');
          items.forEach((item, index) => {
            const text = getTextContent(item).trim();
            if (text) {
              const bullet = tagName === 'ul' ? '•' : `${index + 1}.`;
              lines.push(`${bullet} ${text}`);
            }
          });
          lines.push('');
          return '';
        }

        // Line breaks
        if (tagName === 'br') {
          lines.push('');
          return '';
        }

        // Divs and sections - process children
        if (tagName === 'div' || tagName === 'section') {
          for (const child of node.childNodes) {
            processNode(child, indent);
          }
          return '';
        }

        // For other elements, just get text content
        const text = getTextContent(node).trim();
        if (text && !hasBlockChildren(node)) {
          return text;
        }
      }

      return '';
    }

    // Helper to get clean text content
    function getTextContent(node) {
      return node.textContent.replace(/\s+/g, ' ').trim();
    }

    // Helper to check if node has block-level children
    function hasBlockChildren(node) {
      const blockTags = ['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];
      for (const child of node.children || []) {
        if (blockTags.includes(child.tagName.toLowerCase())) {
          return true;
        }
      }
      return false;
    }

    // Start processing from root
    for (const child of clone.childNodes) {
      const text = processNode(child);
      if (text) {
        lines.push(text);
      }
    }

    // Join lines and clean up excessive blank lines
    let result = lines.join('\n');
    result = result.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
    result = result.trim();

    return result || 'No content extracted from page';
  } catch (error) {
    console.error('Error extracting page content:', error);
    return 'Error extracting page content: ' + error.message;
  }
}

/**
 * Extract source/board name from URL
 * @param {string} url - Page URL
 * @returns {string} Source name (e.g., "Indeed", "LinkedIn")
 */
function extractSource(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Known job boards
    if (hostname.includes('indeed.')) return 'Indeed';
    if (hostname.includes('linkedin.')) return 'LinkedIn';
    if (hostname.includes('glassdoor.')) return 'Glassdoor';
    if (hostname.includes('ziprecruiter.')) return 'ZipRecruiter';
    if (hostname.includes('monster.')) return 'Monster';
    if (hostname.includes('careerbuilder.')) return 'CareerBuilder';
    if (hostname.includes('dice.')) return 'Dice';
    if (hostname.includes('simplyhired.')) return 'SimplyHired';
    if (hostname.includes('greenhouse.io')) return 'Greenhouse';
    if (hostname.includes('lever.co')) return 'Lever';
    if (hostname.includes('myworkdayjobs.')) return 'Workday';
    if (hostname.includes('smartrecruiters.')) return 'SmartRecruiters';
    if (hostname.includes('jobs.')) return 'Company Careers Page';
    if (hostname.includes('careers.')) return 'Company Careers Page';

    // Extract domain name as fallback
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const domain = parts[parts.length - 2];
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }

    return hostname;
  } catch (error) {
    console.error('Error extracting source:', error);
    return 'Unknown';
  }
}

/**
 * Clean and normalize text
 * Removes extra whitespace, normalizes line breaks
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';

  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .trim();
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract first N sentences from text
 * @param {string} text - Text to extract from
 * @param {number} count - Number of sentences
 * @returns {string} First N sentences
 */
function extractFirstSentences(text, count = 3) {
  if (!text) return '';

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, count).join(' ').trim();
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractPageContentAsPlainText,
    extractSource,
    cleanText,
    truncateText,
    extractFirstSentences
  };
}

// Also expose on window for content script usage
if (typeof window !== 'undefined') {
  window.TextFormatter = {
    extractPageContentAsPlainText,
    extractSource,
    cleanText,
    truncateText,
    extractFirstSentences
  };
}
