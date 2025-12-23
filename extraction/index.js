/**
 * JobSprint Extraction Module - Main Entry Point
 *
 * This module provides a unified interface for all job data extraction functionality.
 * It organizes extraction code into logical components for better maintainability.
 *
 * @module extraction
 */

// Core extraction engine and parser
/// <reference path="./core/engine.js" />
/// <reference path="./core/parser.js" />
/// <reference path="./core/context-aware.js" />

// Extractor configuration and types
/// <reference path="./types/extractor-config.js" />

// Field-specific extractors
/// <reference path="./extractors/field-extractors.js" />

// Utilities
/// <reference path="./utils/text-formatter.js" />
/// <reference path="./utils/dom-helpers.js" />

// Job board selectors (if needed)
/// <reference path="./jobboards/selectors.js" />

/**
 * Main Extraction API
 * Provides simplified interface to extraction functionality
 */
const ExtractionAPI = {
  /**
   * Extract job data using context-aware extraction
   * @returns {Object} Extracted job data
   */
  extractJobData() {
    if (typeof window.ExtractionEngine !== 'undefined') {
      return window.ExtractionEngine.extractJobDataContextAware();
    }
    throw new Error('ExtractionEngine not loaded');
  },

  /**
   * Extract simplified job data (URL + content only)
   * This is the "bare-bones" automatic extraction
   * @returns {Object} Simplified job data with url, description, source, timestamp
   */
  extractSimplified() {
    return {
      url: window.location.href,
      description: window.TextFormatter.extractPageContentAsPlainText(),
      source: window.TextFormatter.extractSource(window.location.href),
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Extract detailed job data for manual entry
   * Attempts to extract all fields using intelligent extractors
   * @returns {Object} Detailed job data
   */
  extractDetailed() {
    // Use context-aware extraction if available, fall back to simplified
    if (typeof window.ExtractionEngine !== 'undefined') {
      try {
        const data = window.ExtractionEngine.extractJobDataContextAware();
        if (data && Object.keys(data).length > 3) {
          return data;
        }
      } catch (error) {
        console.warn('Context-aware extraction failed, using simplified:', error);
      }
    }

    // Fallback to simplified extraction
    return this.extractSimplified();
  },

  /**
   * Parse document into structured sections
   * @returns {Object} Structured document with sections
   */
  parseDocument() {
    if (typeof window.parseDocument !== 'undefined') {
      return window.parseDocument({
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        url: window.location.href
      });
    }
    throw new Error('Document parser not loaded');
  }
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.ExtractionAPI = ExtractionAPI;
}

// Also export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtractionAPI;
}
