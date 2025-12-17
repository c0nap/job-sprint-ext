/**
 * Tests for Feature 2: Extraction
 * Tests job data extraction and logging functionality
 * @jest-environment jsdom
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  }
};

// Mock fetch for testing service worker
global.fetch = jest.fn();

describe('Feature 2: Extraction - Job Data Extraction', () => {
  let originalLocation;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    // Reset fetch mock
    global.fetch.mockClear();
    // Save original location
    originalLocation = window.location;
  });

  afterEach(() => {
    // Restore original location if it was changed
    if (window.location !== originalLocation) {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true
      });
    }
  });

  describe('extractJobData - Basic Extraction', () => {
    test('should extract job title from h1 tag', () => {
      // Setup DOM
      document.body.innerHTML = `
        <h1>Software Engineer</h1>
        <div class="company-name">Tech Corp</div>
        <div class="location">San Francisco, CA</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('Software Engineer');
      expect(data.url).toBeDefined(); // Just verify URL is present
      expect(data.url).toMatch(/^https?:\/\//); // Verify it's a valid URL format
      expect(data.timestamp).toBeDefined();
    });

    test('should extract company name from data attribute', () => {
      document.body.innerHTML = `
        <h1>Product Manager</h1>
        <div data-company-name>Startup Inc</div>
        <div class="location">New York, NY</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.company).toBe('Startup Inc');
    });

    test('should extract location from class selector', () => {
      document.body.innerHTML = `
        <h1>Data Scientist</h1>
        <div class="company-name">Analytics Co</div>
        <div class="job-location">Remote</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.location).toBe('Remote');
    });

    test('should handle missing fields gracefully', () => {
      // Silence the warning for this specific test
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      document.body.innerHTML = `<h1>Developer</h1>`;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('Developer');
      expect(data.company).toBe('');
      expect(data.location).toBe('');
      expect(data.url).toBeDefined();
      expect(data.timestamp).toBeDefined();

      warnSpy.mockRestore(); // Restore so real warnings in other tests show up
    });

    test('should trim whitespace from extracted text', () => {
      document.body.innerHTML = `
        <h1>   Frontend Developer   </h1>
        <div class="company-name">
          Web Company
        </div>
        <div class="location">
          Boston, MA
        </div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('Frontend Developer');
      expect(data.company).toBe('Web Company');
      expect(data.location).toBe('Boston, MA');
    });
  });

  describe('extractJobData - Selector Fallback', () => {
    test('should try multiple selectors for title', () => {
      document.body.innerHTML = `
        <div class="job-title">Backend Engineer</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('Backend Engineer');
    });

    test('should use first matching selector', () => {
      document.body.innerHTML = `
        <h1>First Title</h1>
        <div class="job-title">Second Title</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('First Title');
    });

    test('should skip empty elements when selecting', () => {
      document.body.innerHTML = `
        <h1>   </h1>
        <div class="job-title">Real Title</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('Real Title');
    });
  });

  describe('extractJobData - Real-world Job Board Scenarios', () => {
    test('should extract from LinkedIn-style markup', () => {
      document.body.innerHTML = `
        <h1 class="topcard__title">Senior Software Engineer</h1>
        <a class="topcard__org-name-link" href="/company/linkedin">LinkedIn</a>
        <span class="topcard__flavor topcard__flavor--bullet">Sunnyvale, CA</span>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('Senior Software Engineer');
    });

    test('should extract from Indeed-style markup', () => {
      document.body.innerHTML = `
        <h1 class="jobsearch-JobInfoHeader-title">UX Designer</h1>
        <div class="icl-u-lg-mr--sm icl-u-xs-mr--xs">
          <a href="/cmp/Indeed">Indeed</a>
        </div>
        <div class="jobsearch-JobInfoHeader-subtitle">
          <div class="icl-u-xs-mt--xs">Austin, TX</div>
        </div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('UX Designer');
    });

    test('should handle complex nested structures', () => {
      document.body.innerHTML = `
        <div class="job-header">
          <div class="inner">
            <h1 data-job-title>DevOps Engineer</h1>
          </div>
        </div>
        <div class="company-info">
          <span class="companyName">Cloud Services Ltd</span>
        </div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('DevOps Engineer');
      expect(data.company).toBe('Cloud Services Ltd');
    });
  });

  describe('extractJobData - Edge Cases', () => {
    test('should handle special characters in job data', () => {
      document.body.innerHTML = `
        <h1>C++ Developer & Software Architect</h1>
        <div class="company-name">Tech & Innovation Co.</div>
        <div class="location">São Paulo, Brazil</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('C++ Developer & Software Architect');
      expect(data.company).toBe('Tech & Innovation Co.');
      expect(data.location).toBe('São Paulo, Brazil');
    });

    test('should handle HTML entities correctly', () => {
      document.body.innerHTML = `
        <h1>Sales &amp; Marketing Manager</h1>
        <div class="company-name">Smith &amp; Jones LLC</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data.title).toBe('Sales & Marketing Manager');
      expect(data.company).toBe('Smith & Jones LLC');
    });

    test('should generate valid ISO timestamp', () => {
      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      // Check if timestamp is valid ISO string
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should capture URL from window.location', () => {
      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      // Verify URL is captured (will be test environment URL)
      expect(data.url).toBeDefined();
      expect(typeof data.url).toBe('string');
      expect(data.url.length).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    test('should return object with all required fields', () => {
      // Silence the warning for this specific test
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('company');
      expect(data).toHaveProperty('location');
      expect(data).toHaveProperty('url');
      expect(data).toHaveProperty('timestamp');

      warnSpy.mockRestore(); // Restore so real warnings in other tests show up
    });

    test('should have correct data types', () => {
      document.body.innerHTML = `
        <h1>Test Job</h1>
        <div class="company-name">Test Company</div>
        <div class="location">Test Location</div>
      `;

      const extractJobData = require('../content-script-testable').extractJobData;
      const data = extractJobData();

      expect(typeof data.title).toBe('string');
      expect(typeof data.company).toBe('string');
      expect(typeof data.location).toBe('string');
      expect(typeof data.url).toBe('string');
      expect(typeof data.timestamp).toBe('string');
    });
  });
});

describe('Feature 2: Extraction - Service Worker Integration', () => {
  beforeEach(() => {
    global.fetch.mockClear();
    // Set mock environment variable for testing
    process.env.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
  });

  afterEach(() => {
    // Clean up
    delete process.env.APPS_SCRIPT_URL;
  });

  describe('handleLogJobData', () => {
    test('should send POST request with job data', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const jobData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://example.com/job/123',
        timestamp: new Date().toISOString(),
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const handleLogJobData = require('../service-worker-testable').handleLogJobData;
      const sendResponse = jest.fn();

      await handleLogJobData(jobData, sendResponse);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(jobData)
        })
      );
    });

    test('should call sendResponse with success on successful request', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const jobData = {
        title: 'Test Job',
        company: 'Test Co',
        location: 'Test Location',
        url: 'https://test.com',
        timestamp: new Date().toISOString(),
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const handleLogJobData = require('../service-worker-testable').handleLogJobData;
      const sendResponse = jest.fn();

      await handleLogJobData(jobData, sendResponse);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        timestamp: jobData.timestamp
      });
    });

    test('should handle fetch errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const jobData = {
        title: 'Test Job',
        company: 'Test Co',
        location: 'Test Location',
        url: 'https://test.com',
        timestamp: new Date().toISOString(),
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const handleLogJobData = require('../service-worker-testable').handleLogJobData;
      const sendResponse = jest.fn();

      await handleLogJobData(jobData, sendResponse);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.any(String)
      });
    });

    test('should send data as JSON string', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const jobData = {
        title: 'Data Engineer',
        company: 'Data Corp',
        location: 'Seattle, WA',
        url: 'https://example.com/job/456',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const handleLogJobData = require('../service-worker-testable').handleLogJobData;
      const sendResponse = jest.fn();

      await handleLogJobData(jobData, sendResponse);

      const fetchCall = global.fetch.mock.calls[0];
      const body = fetchCall[1].body;

      expect(body).toBe(JSON.stringify(jobData));
      expect(() => JSON.parse(body)).not.toThrow();
    });
  });
});

describe('Feature 2: Extraction - Integration Tests', () => {
  test('should complete full extraction workflow', () => {
    document.body.innerHTML = `
      <h1>Full Stack Developer</h1>
      <div class="company-name">Web Solutions Inc</div>
      <div class="location">Denver, CO</div>
    `;

    const extractJobData = require('../content-script-testable').extractJobData;
    const data = extractJobData();

    // Verify all fields are populated
    expect(data.title).toBe('Full Stack Developer');
    expect(data.company).toBe('Web Solutions Inc');
    expect(data.location).toBe('Denver, CO');
    expect(data.url).toBeDefined(); // Verify URL is captured
    expect(data.timestamp).toBeDefined();

    // Verify data can be serialized for transmission
    expect(() => JSON.stringify(data)).not.toThrow();
    const serialized = JSON.stringify(data);
    expect(JSON.parse(serialized)).toEqual(data);
  });

  test('should handle extraction with partial data', () => {
    // Silence the warning for this specific test
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    document.body.innerHTML = `
      <h1>Consultant</h1>
    `;

    const extractJobData = require('../content-script-testable').extractJobData;
    const data = extractJobData();

    expect(data.title).toBe('Consultant');
    expect(data.company).toBe('');
    expect(data.location).toBe('');

    // Should still be valid JSON
    expect(() => JSON.stringify(data)).not.toThrow();

    warnSpy.mockRestore(); // Restore so real warnings in other tests show up
  });
});
