/**
 * Tests for Local Google Apps Script Mock Endpoint
 *
 * This test suite verifies that the local endpoint behaves correctly
 * and matches the API contract expected by the Job Detail Extraction feature.
 */

const { createApp, validateJobData } = require('../local-gas-endpoint');
const request = require('supertest');

describe('Local GAS Endpoint - Validation', () => {
  describe('validateJobData', () => {
    test('should validate correct job data', () => {
      const validData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        source: 'LinkedIn',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(validData);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject null data', () => {
      const result = validateJobData(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an object');
    });

    test('should reject non-object data', () => {
      const result = validateJobData('not an object');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an object');
    });

    test('should reject data missing title', () => {
      const invalidData = {
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('title');
    });

    test('should reject data missing company', () => {
      const invalidData = {
        title: 'Software Engineer',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('company');
    });

    test('should reject data missing location', () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('location');
    });

    test('should reject data missing url', () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('url');
    });

    test('should reject data missing timestamp', () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    test('should reject data missing spreadsheetId', () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('spreadsheetId');
    });

    test('should reject empty string fields', () => {
      const invalidData = {
        title: '',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('title');
    });

    test('should reject whitespace-only fields', () => {
      const invalidData = {
        title: '   ',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('title');
    });

    test('should reject invalid URL format', () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'not-a-valid-url',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('url');
    });

    test('should reject invalid timestamp format', () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: 'not-a-valid-timestamp',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    test('should accept optional source field', () => {
      const validData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        source: 'LinkedIn',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(validData);
      expect(result.valid).toBe(true);
    });

    test('should accept data without optional source field', () => {
      const validData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const result = validateJobData(validData);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Local GAS Endpoint - API', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /log-job', () => {
    test('should accept valid job data', async () => {
      const jobData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        source: 'LinkedIn',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const response = await request(app)
        .post('/log-job')
        .send(jobData)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toEqual({
        success: true,
        timestamp: jobData.timestamp
      });
    });

    test('should reject job data with missing fields', async () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp'
        // Missing location, url, timestamp
      };

      const response = await request(app)
        .post('/log-job')
        .send(invalidData)
        .expect(400)
        .expect('Content-Type', /json/);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('location');
    });

    test('should reject job data with invalid URL', async () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'invalid-url',
        timestamp: '2025-01-15T10:30:00.000Z',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const response = await request(app)
        .post('/log-job')
        .send(invalidData)
        .expect(400)
        .expect('Content-Type', /json/);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('url');
    });

    test('should reject job data with invalid timestamp', async () => {
      const invalidData = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: 'invalid-timestamp',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const response = await request(app)
        .post('/log-job')
        .send(invalidData)
        .expect(400)
        .expect('Content-Type', /json/);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('timestamp');
    });

    test('should handle multiple job submissions', async () => {
      const jobs = [
        {
          title: 'Software Engineer',
          company: 'Tech Corp',
          location: 'San Francisco, CA',
          url: 'https://linkedin.com/jobs/123',
          timestamp: '2025-01-15T10:30:00.000Z',
          source: 'LinkedIn',
          spreadsheetId: 'test-spreadsheet-id-123'
        },
        {
          title: 'Product Manager',
          company: 'Startup Inc',
          location: 'New York, NY',
          url: 'https://indeed.com/jobs/456',
          timestamp: '2025-01-15T11:00:00.000Z',
          source: 'Indeed',
          spreadsheetId: 'test-spreadsheet-id-123'
        }
      ];

      for (const job of jobs) {
        const response = await request(app)
          .post('/log-job')
          .send(job)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.timestamp).toBe(job.timestamp);
      }
    });

    test('should handle special characters in fields', async () => {
      const jobData = {
        title: 'Senior Engineer (C++ & Python)',
        company: 'Tech Corp™',
        location: 'São Paulo, Brazil',
        url: 'https://example.com/jobs/123?ref=test&source=linkedin',
        timestamp: '2025-01-15T10:30:00.000Z',
        source: 'LinkedIn',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const response = await request(app)
        .post('/log-job')
        .send(jobData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /jobs', () => {
    test('should return empty list when no jobs logged', async () => {
      const response = await request(app)
        .get('/jobs')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toEqual({
        success: true,
        count: 0,
        jobs: []
      });
    });

    test('should return all logged jobs', async () => {
      // First, log some jobs
      const job1 = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        source: 'LinkedIn',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const job2 = {
        title: 'Product Manager',
        company: 'Startup Inc',
        location: 'New York, NY',
        url: 'https://indeed.com/jobs/456',
        timestamp: '2025-01-15T11:00:00.000Z',
        source: 'Indeed',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      await request(app).post('/log-job').send(job1);
      await request(app).post('/log-job').send(job2);

      // Now retrieve all jobs
      const response = await request(app)
        .get('/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.jobs).toHaveLength(2);
      expect(response.body.jobs[0].title).toBe(job1.title);
      expect(response.body.jobs[1].title).toBe(job2.title);
    });
  });

  describe('GET /jobs/latest', () => {
    test('should return 404 when no jobs logged', async () => {
      const response = await request(app)
        .get('/jobs/latest')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No jobs logged');
    });

    test('should return the most recent job', async () => {
      const job1 = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        source: 'LinkedIn',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      const job2 = {
        title: 'Product Manager',
        company: 'Startup Inc',
        location: 'New York, NY',
        url: 'https://indeed.com/jobs/456',
        timestamp: '2025-01-15T11:00:00.000Z',
        source: 'Indeed',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      await request(app).post('/log-job').send(job1);
      await request(app).post('/log-job').send(job2);

      const response = await request(app)
        .get('/jobs/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.job.title).toBe(job2.title);
      expect(response.body.job.company).toBe(job2.company);
    });
  });

  describe('DELETE /jobs', () => {
    test('should clear all jobs', async () => {
      // Log a job
      const job = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        timestamp: '2025-01-15T10:30:00.000Z',
        source: 'LinkedIn',
        spreadsheetId: 'test-spreadsheet-id-123'
      };

      await request(app).post('/log-job').send(job);

      // Verify job was logged
      let response = await request(app).get('/jobs');
      expect(response.body.count).toBe(1);

      // Clear all jobs
      response = await request(app)
        .delete('/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);

      // Verify jobs were cleared
      response = await request(app).get('/jobs');
      expect(response.body.count).toBe(0);
    });

    test('should handle clearing when no jobs exist', async () => {
      const response = await request(app)
        .delete('/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.jobsLogged).toBeGreaterThanOrEqual(0);
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});

describe('Local GAS Endpoint - Integration', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  test('should match Google Apps Script API contract', async () => {
    // This test verifies that the local endpoint matches the expected
    // behavior of the real Google Apps Script endpoint

    const jobData = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      url: 'https://linkedin.com/jobs/123',
      timestamp: '2025-01-15T10:30:00.000Z',
      source: 'LinkedIn',
      spreadsheetId: 'test-spreadsheet-id-123'
    };

    const response = await request(app)
      .post('/log-job')
      .send(jobData)
      .expect(200);

    // Verify response matches GAS contract
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body.success).toBe(true);
    expect(response.body.timestamp).toBe(jobData.timestamp);
  });

  test('should handle the complete extraction flow', async () => {
    // Simulate the complete flow from extraction to logging

    // Step 1: Extract job data (simulated)
    const extractedData = {
      title: 'Senior Software Engineer',
      company: 'Google',
      location: 'Mountain View, CA',
      url: 'https://careers.google.com/jobs/123',
      timestamp: new Date().toISOString(),
      source: 'Google Careers',
      spreadsheetId: 'test-spreadsheet-id-123'
    };

    // Step 2: Log to endpoint
    const response = await request(app)
      .post('/log-job')
      .send(extractedData)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Step 3: Verify it was stored
    const jobsResponse = await request(app)
      .get('/jobs/latest')
      .expect(200);

    expect(jobsResponse.body.job.title).toBe(extractedData.title);
    expect(jobsResponse.body.job.company).toBe(extractedData.company);
  });
});
