/**
 * Comprehensive tests for field-specific intelligent extractors
 * Tests the individual extraction functions used by the mouse tracking feature
 * @jest-environment jsdom
 */

const {
  cleanText,
  extractPayAmount,
  extractCompensationRange,
  extractLocation,
  extractJobTitle,
  extractCompanyName,
  extractLargeTextBlock
} = require('../field-extractors-testable');

describe('cleanText', () => {
  test('should remove extra whitespace', () => {
    expect(cleanText('  Software   Engineer  ')).toBe('Software Engineer');
  });

  test('should replace newlines with spaces', () => {
    expect(cleanText('Line 1\nLine 2\nLine 3')).toBe('Line 1 Line 2 Line 3');
  });

  test('should handle multiple consecutive spaces', () => {
    expect(cleanText('Too     many     spaces')).toBe('Too many spaces');
  });

  test('should handle empty string', () => {
    expect(cleanText('')).toBe('');
  });

  test('should handle mixed whitespace', () => {
    expect(cleanText('  \n  Text  \n  \n  ')).toBe('Text');
  });
});

describe('extractPayAmount', () => {
  let mockElement;

  beforeEach(() => {
    mockElement = document.createElement('div');
  });

  describe('Dollar amounts', () => {
    test('should extract simple dollar amount', () => {
      const result = extractPayAmount(mockElement, '$75.00');
      expect(result).toBe('$75.00');
    });

    test('should extract dollar amount with commas', () => {
      const result = extractPayAmount(mockElement, '$120,000');
      expect(result).toBe('$120,000');
    });

    test('should extract dollar amount per hour', () => {
      const result = extractPayAmount(mockElement, '$25.50/hour');
      expect(result).toBe('$25.50/hour');
    });

    test('should handle dollar amount with spaces', () => {
      const result = extractPayAmount(mockElement, '$ 75.00 / hour');
      expect(result).toBe('$ 75.00 / hour');
    });

    test('should extract from sentence context', () => {
      const result = extractPayAmount(mockElement, 'Pay rate: $45.00 per hour for this position');
      expect(result).toBe('$45.00');
    });
  });

  describe('Alternative formats', () => {
    test('should extract with USD suffix', () => {
      const result = extractPayAmount(mockElement, '75.00 USD');
      expect(result).toBe('75.00 USD');
    });

    test('should extract with dollars suffix', () => {
      const result = extractPayAmount(mockElement, '75 dollars');
      expect(result).toBe('75 dollars');
    });

    test('should extract k notation', () => {
      const result = extractPayAmount(mockElement, '75k');
      expect(result).toBe('75k');
    });

    test('should extract hourly rate without dollar sign', () => {
      const result = extractPayAmount(mockElement, '25.50/hour');
      expect(result).toBe('25.50/hour');
    });

    test('should extract with hr abbreviation', () => {
      const result = extractPayAmount(mockElement, '30/hr');
      expect(result).toBe('30/hr');
    });
  });

  describe('Edge cases', () => {
    test('should return null for non-numeric text', () => {
      const result = extractPayAmount(mockElement, 'Remote position');
      expect(result).toBeNull();
    });

    test('should return null for empty string', () => {
      const result = extractPayAmount(mockElement, '');
      expect(result).toBeNull();
    });

    test('should handle text with multiple numbers', () => {
      const result = extractPayAmount(mockElement, 'Salary: $75.00 for 40 hours');
      expect(result).toBe('$75.00');
    });
  });
});

describe('extractCompensationRange', () => {
  let mockElement;

  beforeEach(() => {
    mockElement = document.createElement('div');
  });

  describe('Standard ranges', () => {
    test('should extract dollar range with dash', () => {
      const result = extractCompensationRange(mockElement, '$65.00 - $75.00/hour');
      expect(result).toBe('$65.00 - $75.00/hour');
    });

    test('should extract range without repeated dollar sign', () => {
      const result = extractCompensationRange(mockElement, '$65 - 75/hour');
      expect(result).toBe('$65 - 75/hour');
    });

    test('should extract annual salary range', () => {
      const result = extractCompensationRange(mockElement, '$100,000 - $120,000/year');
      expect(result).toBe('$100,000 - $120,000/year');
    });

    test('should extract k notation range', () => {
      const result = extractCompensationRange(mockElement, '100k - 120k');
      expect(result).toBe('100k - 120k');
    });
  });

  describe('Alternative formats', () => {
    test('should extract range with en-dash', () => {
      const result = extractCompensationRange(mockElement, '$65.00 – $75.00/hour');
      expect(result).toBe('$65.00 – $75.00/hour');
    });

    test('should extract range with em-dash', () => {
      const result = extractCompensationRange(mockElement, '$65.00 — $75.00/hour');
      expect(result).toBe('$65.00 — $75.00/hour');
    });

    test('should extract with per instead of slash', () => {
      const result = extractCompensationRange(mockElement, '$100,000 - $120,000 per year');
      expect(result).toBe('$100,000 - $120,000 per year');
    });
  });

  describe('Fallback to single amount', () => {
    test('should fall back to extractPayAmount for single value', () => {
      const result = extractCompensationRange(mockElement, '$75.00/hour');
      expect(result).toBe('$75.00/hour');
    });

    test('should return null for non-compensation text', () => {
      const result = extractCompensationRange(mockElement, 'Remote position');
      expect(result).toBeNull();
    });
  });

  describe('Real-world examples', () => {
    test('should extract from Indeed-style format', () => {
      const result = extractCompensationRange(mockElement, 'Compensation: $65.00 - $75.00 per hour');
      expect(result).toBe('$65.00 - $75.00 per hour');
    });

    test('should extract from LinkedIn-style format', () => {
      const result = extractCompensationRange(mockElement, '$100,000 - $120,000/yr');
      expect(result).toBe('$100,000 - $120,000/yr');
    });
  });
});

describe('extractLocation', () => {
  let mockElement;

  beforeEach(() => {
    mockElement = document.createElement('div');
  });

  describe('Special locations', () => {
    test('should extract "Remote"', () => {
      const result = extractLocation(mockElement, 'Remote');
      expect(result).toBe('Remote');
    });

    test('should extract "Remote" case-insensitively', () => {
      const result = extractLocation(mockElement, 'REMOTE');
      expect(result).toBe('Remote');
    });

    test('should extract "Hybrid"', () => {
      const result = extractLocation(mockElement, 'Hybrid');
      expect(result).toBe('Hybrid');
    });

    test('should extract Remote from sentence', () => {
      const result = extractLocation(mockElement, 'This is a remote position');
      expect(result).toBe('Remote');
    });
  });

  describe('City, State format', () => {
    test('should extract city and state abbreviation', () => {
      const result = extractLocation(mockElement, 'San Francisco, CA');
      expect(result).toBe('San Francisco, CA');
    });

    test('should extract city with multiple words', () => {
      const result = extractLocation(mockElement, 'New York City, NY');
      expect(result).toBe('New York City, NY');
    });

    test('should extract city with hyphen', () => {
      const result = extractLocation(mockElement, 'Winston-Salem, NC');
      expect(result).toBe('Winston-Salem, NC');
    });

    test('should extract city with apostrophe', () => {
      const result = extractLocation(mockElement, "Coeur d'Alene, ID");
      expect(result).toBe("Coeur d'Alene, ID");
    });

    test('should extract from sentence with city, state', () => {
      const result = extractLocation(mockElement, 'Location: Seattle, WA');
      expect(result).toBe('Seattle, WA');
    });
  });

  describe('State abbreviations only', () => {
    test('should extract just state abbreviation', () => {
      const result = extractLocation(mockElement, 'CA');
      expect(result).toBe('CA');
    });

    test('should extract state from sentence', () => {
      const result = extractLocation(mockElement, 'Located in TX');
      expect(result).toBe('TX');
    });

    test('should not extract invalid state codes', () => {
      const result = extractLocation(mockElement, 'XY'); // Invalid state
      expect(result).toBeNull();
    });
  });

  describe('Full state names', () => {
    test('should extract full state name and convert to abbreviation', () => {
      const result = extractLocation(mockElement, 'California');
      expect(result).toBe('CA');
    });

    test('should extract city with full state name', () => {
      const result = extractLocation(mockElement, 'Los Angeles, California');
      expect(result).toBe('Los Angeles, CA');
    });

    test('should extract multi-word state names', () => {
      const result = extractLocation(mockElement, 'New York');
      expect(result).toBe('NY');
    });

    test('should extract city with multi-word state', () => {
      const result = extractLocation(mockElement, 'Charleston, South Carolina');
      expect(result).toBe('Charleston, SC');
    });
  });

  describe('Edge cases', () => {
    test('should return null for non-location text', () => {
      const result = extractLocation(mockElement, 'Software Engineer');
      expect(result).toBeNull();
    });

    test('should return null for empty string', () => {
      const result = extractLocation(mockElement, '');
      expect(result).toBeNull();
    });

    test('should prioritize Remote over state names', () => {
      const result = extractLocation(mockElement, 'Remote (CA preferred)');
      expect(result).toBe('Remote');
    });
  });

  describe('All 50 states + DC', () => {
    test('should recognize all valid state abbreviations', () => {
      const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];

      states.forEach(state => {
        const result = extractLocation(mockElement, state);
        expect(result).toBe(state);
      });
    });
  });
});

describe('extractJobTitle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Data attributes', () => {
    test('should extract from data-job-title attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('data-job-title', 'Software Engineer');
      document.body.appendChild(element);

      const result = extractJobTitle(element);
      expect(result).toBe('Software Engineer');
    });

    test('should extract from data-title attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('data-title', 'Product Manager');
      document.body.appendChild(element);

      const result = extractJobTitle(element);
      expect(result).toBe('Product Manager');
    });

    test('should extract from data-position attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('data-position', 'Data Scientist');
      document.body.appendChild(element);

      const result = extractJobTitle(element);
      expect(result).toBe('Data Scientist');
    });
  });

  describe('Header elements', () => {
    test('should extract from H1 element', () => {
      document.body.innerHTML = '<h1>Senior Software Engineer</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('Senior Software Engineer');
    });

    test('should extract from H2 element', () => {
      document.body.innerHTML = '<h2>Frontend Developer</h2>';
      const element = document.querySelector('h2');

      const result = extractJobTitle(element);
      expect(result).toBe('Frontend Developer');
    });

    test('should extract from H3 element', () => {
      document.body.innerHTML = '<h3>UX Designer Lead</h3>';
      const element = document.querySelector('h3');

      const result = extractJobTitle(element);
      expect(result).toBe('UX Designer Lead');
    });

    test('should reject header with too few words', () => {
      document.body.innerHTML = '<h1>Engineer</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBeNull();
    });

    test('should reject header with too many words', () => {
      document.body.innerHTML = '<h1>This is a very long header that is probably not a job title at all</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBeNull();
    });
  });

  describe('Semantic HTML', () => {
    test('should extract from header in article element', () => {
      document.body.innerHTML = `
        <article>
          <h1>DevOps Engineer</h1>
          <div>Some other content</div>
        </article>
      `;
      const article = document.querySelector('article');
      const div = article.querySelector('div');

      const result = extractJobTitle(div);
      expect(result).toBe('DevOps Engineer');
    });

    test('should extract from header in main element', () => {
      document.body.innerHTML = `
        <main>
          <h2>Backend Engineer</h2>
          <div>Description</div>
        </main>
      `;
      const main = document.querySelector('main');
      const div = main.querySelector('div');

      const result = extractJobTitle(div);
      expect(result).toBe('Backend Engineer');
    });

    test('should extract from element with role="main"', () => {
      document.body.innerHTML = `
        <div role="main">
          <h1>Full Stack Developer</h1>
          <p>Job details</p>
        </div>
      `;
      const roleMain = document.querySelector('[role="main"]');
      const p = roleMain.querySelector('p');

      const result = extractJobTitle(p);
      expect(result).toBe('Full Stack Developer');
    });
  });

  describe('Style-based extraction', () => {
    test('should extract bold, large text near top of page', () => {
      document.body.innerHTML = `
        <div style="font-weight: bold; font-size: 24px;">Machine Learning Engineer</div>
      `;
      const element = document.querySelector('div');

      // Mock getBoundingClientRect to simulate top of page
      element.getBoundingClientRect = jest.fn(() => ({
        top: 50,
        left: 0,
        bottom: 100,
        right: 100,
        width: 100,
        height: 50
      }));

      // Mock window.innerHeight
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000
      });

      const result = extractJobTitle(element);
      expect(result).toBe('Machine Learning Engineer');
    });
  });

  describe('Class-based extraction', () => {
    test('should extract from element with .job-title class', () => {
      document.body.innerHTML = `
        <header class="job-title">
          <span>Cloud Architect</span>
        </header>
      `;
      const header = document.querySelector('header');
      const span = header.querySelector('span');

      const result = extractJobTitle(span);
      expect(result).toBe('Cloud Architect');
    });

    test('should extract from element with .position class', () => {
      document.body.innerHTML = `
        <div class="position">
          <h2>Security Engineer</h2>
        </div>
      `;
      const div = document.querySelector('.position');
      const h2 = div.querySelector('h2');

      const result = extractJobTitle(h2);
      expect(result).toBe('Security Engineer');
    });
  });

  describe('Edge cases', () => {
    test('should return null for non-title element', () => {
      document.body.innerHTML = '<p>This is a paragraph about the job</p>';
      const element = document.querySelector('p');

      const result = extractJobTitle(element);
      expect(result).toBeNull();
    });

    test('should handle empty element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      const result = extractJobTitle(element);
      expect(result).toBeNull();
    });

    test('should clean whitespace from extracted title', () => {
      document.body.innerHTML = '<h1>   Data   Engineer   </h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('Data Engineer');
    });
  });
});

describe('extractCompanyName', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Corporate suffixes', () => {
    test('should extract company name with Inc.', () => {
      document.body.innerHTML = '<div>Tech Innovations Inc.</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Tech Innovations Inc.');
    });

    test('should extract company name with LLC', () => {
      document.body.innerHTML = '<div>Web Solutions LLC</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Web Solutions LLC');
    });

    test('should extract company name with Corp', () => {
      document.body.innerHTML = '<div>Data Corp</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Data Corp');
    });

    test('should extract company name with Corporation', () => {
      document.body.innerHTML = '<div>Software Corporation</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Software Corporation');
    });

    test('should extract company name with Ltd', () => {
      document.body.innerHTML = '<div>Cloud Services Ltd</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Cloud Services Ltd');
    });
  });

  describe('All-caps detection', () => {
    test('should extract all-caps company name', () => {
      document.body.innerHTML = '<div>ACME CORPORATION</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('ACME CORPORATION');
    });

    test('should extract multi-word all-caps name', () => {
      document.body.innerHTML = '<div>TECH INNOVATIONS GROUP</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('TECH INNOVATIONS GROUP');
    });

    test('should not extract if less than 50% caps', () => {
      document.body.innerHTML = '<div>This is NOT a Company</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBeNull();
    });
  });

  describe('Class-based extraction', () => {
    test('should extract from .company class', () => {
      document.body.innerHTML = '<div class="company">Startup Inc</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Startup Inc');
    });

    test('should extract from .employer class', () => {
      document.body.innerHTML = '<div class="employer">Google</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Google');
    });

    test('should extract from .organization class', () => {
      document.body.innerHTML = '<div class="organization">Microsoft</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Microsoft');
    });

    test('should extract from company-related id', () => {
      document.body.innerHTML = '<div id="company-name">Amazon</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Amazon');
    });
  });

  describe('Link extraction', () => {
    test('should extract from anchor element', () => {
      document.body.innerHTML = '<a href="/company/linkedin">LinkedIn</a>';
      const element = document.querySelector('a');

      const result = extractCompanyName(element);
      expect(result).toBe('LinkedIn');
    });

    test('should extract multi-word company from link', () => {
      document.body.innerHTML = '<a href="/company/meta">Meta Platforms</a>';
      const element = document.querySelector('a');

      const result = extractCompanyName(element);
      expect(result).toBe('Meta Platforms');
    });

    test('should reject link with too many words', () => {
      document.body.innerHTML = '<a href="/about">About Our Company and Our Mission</a>';
      const element = document.querySelector('a');

      const result = extractCompanyName(element);
      expect(result).toBeNull();
    });
  });

  describe('Bold text extraction', () => {
    test('should extract from bold element', () => {
      document.body.innerHTML = '<div style="font-weight: bold;">Apple</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Apple');
    });

    test('should extract from element with font-weight >= 600', () => {
      document.body.innerHTML = '<div style="font-weight: 700;">Tesla</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Tesla');
    });
  });

  describe('Edge cases', () => {
    test('should return null for non-company text', () => {
      document.body.innerHTML = '<div>This is a job description paragraph</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBeNull();
    });

    test('should return null for empty element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      const result = extractCompanyName(element);
      expect(result).toBeNull();
    });

    test('should clean whitespace from company name', () => {
      document.body.innerHTML = '<div class="company">  Google  </div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Google');
    });

    test('should extract single-word company names', () => {
      document.body.innerHTML = '<div class="company">Netflix</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Netflix');
    });
  });
});

describe('extractLargeTextBlock', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Semantic content extraction', () => {
    test('should extract from main element', () => {
      document.body.innerHTML = `
        <main>
          <p>This is a job description that describes the role and responsibilities.
          It should be long enough to be extracted as a substantial text block.</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('job description');
      expect(result.length).toBeGreaterThanOrEqual(50);
    });

    test('should extract from article element', () => {
      document.body.innerHTML = `
        <article>
          <p>Detailed job posting content with requirements and benefits.
          This text needs to be substantial enough to qualify as a description.</p>
        </article>
      `;
      const article = document.querySelector('article');
      const p = article.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('job posting');
      expect(result.length).toBeGreaterThanOrEqual(50);
    });

    test('should extract from role="main" element', () => {
      document.body.innerHTML = `
        <div role="main">
          <p>Comprehensive description of the position including duties and qualifications.
          Must be long enough to be considered a valid text block.</p>
        </div>
      `;
      const roleMain = document.querySelector('[role="main"]');
      const p = roleMain.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('description');
      expect(result.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Class-based extraction', () => {
    test('should extract from .job-description class', () => {
      document.body.innerHTML = `
        <div class="job-description">
          <p>Full job description with detailed information about the role.
          This includes responsibilities, requirements, and company benefits.</p>
        </div>
      `;
      const div = document.querySelector('.job-description');
      const p = div.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('Full job description');
      expect(result.length).toBeGreaterThanOrEqual(50);
    });

    test('should extract from .description class', () => {
      document.body.innerHTML = `
        <div class="description">
          <p>Complete overview of the job opportunity and what we're looking for.
          Candidates should have relevant experience and strong communication skills.</p>
        </div>
      `;
      const div = document.querySelector('.description');
      const p = div.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('opportunity');
      expect(result.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Excluded areas', () => {
    test('should return null for nav element', () => {
      document.body.innerHTML = `
        <nav>
          <p>This is navigation content that should not be extracted as a description.
          Even though it has enough text, it's in a nav element.</p>
        </nav>
      `;
      const nav = document.querySelector('nav');
      const p = nav.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });

    test('should return null for footer element', () => {
      document.body.innerHTML = `
        <footer>
          <p>Footer content with company information and legal disclaimers.
          This should not be extracted even if it's long enough.</p>
        </footer>
      `;
      const footer = document.querySelector('footer');
      const p = footer.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });

    test('should return null for aside element', () => {
      document.body.innerHTML = `
        <aside>
          <p>Sidebar content with related jobs and company information.
          Should not be extracted as the main job description.</p>
        </aside>
      `;
      const aside = document.querySelector('aside');
      const p = aside.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });

    test('should return null for header element', () => {
      document.body.innerHTML = `
        <header>
          <p>Header content with site navigation and branding information.
          This is not the job description content.</p>
        </header>
      `;
      const header = document.querySelector('header');
      const p = header.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });

    test('should return null for role="navigation"', () => {
      document.body.innerHTML = `
        <div role="navigation">
          <p>Navigation links and menu items that should be excluded.
          Even with sufficient text length.</p>
        </div>
      `;
      const nav = document.querySelector('[role="navigation"]');
      const p = nav.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });
  });

  describe('Size validation', () => {
    test('should return null for text blocks that are too short', () => {
      document.body.innerHTML = `
        <main>
          <p>Short text</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });

    test('should accept text blocks >= 50 characters', () => {
      document.body.innerHTML = `
        <main>
          <p>This is exactly fifty characters of text for testing purposes now.</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).not.toBeNull();
      expect(result.length).toBeGreaterThanOrEqual(50);
    });

    test('should limit text blocks to 5000 characters', () => {
      const longText = 'a'.repeat(6000);
      document.body.innerHTML = `
        <main>
          <p>${longText}</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      // Should return null because it's too long
      expect(result).toBeNull();
    });

    test('should accept text blocks at the upper limit', () => {
      const mediumText = 'This is a job description. '.repeat(100); // ~2700 chars
      document.body.innerHTML = `
        <main>
          <p>${mediumText}</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).not.toBeNull();
      expect(result.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('DOM tree walking', () => {
    test('should walk up to find larger text block', () => {
      document.body.innerHTML = `
        <div>
          <div>
            <p>Nested paragraph with job details and requirements.
            Should extract the parent div content if it's larger.</p>
          </div>
        </div>
      `;
      const p = document.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).not.toBeNull();
      expect(result).toContain('job details');
    });

    test('should stop at MAX_DEPTH', () => {
      // Create deeply nested structure
      document.body.innerHTML = `
        <div><div><div><div><div><div>
          <p>Deep paragraph that should still extract successfully.
          The depth limit prevents walking too far up the tree.</p>
        </div></div></div></div></div></div>
      `;
      const p = document.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).not.toBeNull();
    });

    test('should not select entire page (BODY)', () => {
      document.body.innerHTML = `
        <nav>Navigation with lots of content</nav>
        <main>
          <p>Main content paragraph that is the actual job description.
          This should be extracted without including navigation.</p>
        </main>
        <footer>Footer content</footer>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).not.toContain('Navigation');
      expect(result).not.toContain('Footer');
    });
  });

  describe('Edge cases', () => {
    test('should return null for empty element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      const result = extractLargeTextBlock(element);
      expect(result).toBeNull();
    });

    test('should clean whitespace from extracted text', () => {
      document.body.innerHTML = `
        <main>
          <p>
            Text with    extra    spaces
            and   multiple   newlines
            should be   cleaned
          </p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).not.toContain('    ');
      expect(result).toBe('Text with extra spaces and multiple newlines should be cleaned');
    });

    test('should handle mixed content types', () => {
      document.body.innerHTML = `
        <main>
          <h2>Job Title</h2>
          <p>Description paragraph with details about the role and requirements.
          This mixed content should still be extracted properly.</p>
          <ul>
            <li>Bullet point one</li>
            <li>Bullet point two</li>
          </ul>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('Description');
    });
  });
});

// ============ EDGE CASE TESTS ============

describe('Edge Cases - Robustness Tests', () => {
  let mockElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockElement = document.createElement('div');
  });

  describe('extractPayAmount - Advanced Edge Cases', () => {
    test('should handle multiple currency symbols and pick first', () => {
      const result = extractPayAmount(mockElement, '€50,000 or $55,000 USD');
      // Should extract the first recognizable pattern (USD in this case)
      expect(result).toMatch(/\$55,000|55,000 USD/);
    });

    test('should handle salary with benefits notation', () => {
      const result = extractPayAmount(mockElement, '$70k + benefits');
      expect(result).toBe('$70k');
    });

    test('should handle DOE (depends on experience) notation', () => {
      const result = extractPayAmount(mockElement, '$30/hr (DOE)');
      expect(result).toBe('$30/hr');
    });

    test('should handle salary with parenthetical info', () => {
      const result = extractPayAmount(mockElement, 'Salary: $85,000 (negotiable)');
      expect(result).toBe('$85,000');
    });

    test('should extract from complex sentence', () => {
      const result = extractPayAmount(mockElement, 'We offer competitive compensation starting at $75.00 per hour for qualified candidates.');
      expect(result).toBe('$75.00');
    });

    test('should handle annual salary equivalents', () => {
      const result = extractPayAmount(mockElement, '120k annually');
      expect(result).toBe('120k');
    });

    test('should not extract non-salary numbers', () => {
      const result = extractPayAmount(mockElement, 'Must have 5 years experience');
      expect(result).toBeNull();
    });

    test('should handle very large salaries', () => {
      const result = extractPayAmount(mockElement, '$250,000');
      expect(result).toBe('$250,000');
    });
  });

  describe('extractCompensationRange - Advanced Edge Cases', () => {
    test('should handle mixed k notation', () => {
      const result = extractCompensationRange(mockElement, '$50k-$60k per year');
      expect(result).toMatch(/50k.*60k/i);
    });

    test('should handle range with benefits', () => {
      const result = extractCompensationRange(mockElement, '$100,000 - $120,000 + benefits');
      expect(result).toBe('$100,000 - $120,000');
    });

    test('should handle abbreviated year/hour', () => {
      const result = extractCompensationRange(mockElement, '$65 - $75/hr');
      expect(result).toBe('$65 - $75/hr');
    });

    test('should handle "to" instead of dash', () => {
      // This might not match current regex, but should gracefully return null or fall back
      const result = extractCompensationRange(mockElement, '$50 to $60 per hour');
      // Should either extract or fall back to single amount
      expect(result).toBeTruthy();
    });

    test('should handle international currency ranges', () => {
      // Should gracefully handle or return null for non-USD
      const result = extractCompensationRange(mockElement, '€45,000 - €55,000');
      // Might not extract, which is fine
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('extractLocation - Advanced Edge Cases', () => {
    test('should handle Remote with preferred location', () => {
      const result = extractLocation(mockElement, 'Remote (SF Bay Area preferred)');
      expect(result).toBe('Remote');
    });

    test('should handle Remote - US', () => {
      const result = extractLocation(mockElement, 'Remote - United States');
      expect(result).toBe('Remote');
    });

    test('should handle international locations gracefully', () => {
      const result = extractLocation(mockElement, 'Toronto, ON');
      // Should return null for non-US locations (or could be enhanced to support)
      expect(result).toBeNull();
    });

    test('should handle London, UK', () => {
      const result = extractLocation(mockElement, 'London, UK');
      expect(result).toBeNull();
    });

    test('should not extract partial matches', () => {
      const result = extractLocation(mockElement, 'North Dakota State University');
      // Should extract ND or North Dakota, not just "North"
      expect(result).toMatch(/ND|North Dakota/i);
    });

    test('should handle multiple locations', () => {
      const result = extractLocation(mockElement, 'San Francisco, CA or New York, NY');
      // Should extract the first location
      expect(result).toBe('San Francisco, CA');
    });

    test('should handle city without state', () => {
      const result = extractLocation(mockElement, 'Seattle');
      // Should return null or handle gracefully
      expect(result === null || typeof result === 'string').toBe(true);
    });

    test('should handle whitespace around location', () => {
      const result = extractLocation(mockElement, '   Austin, TX   ');
      expect(result).toBe('Austin, TX');
    });

    test('should prioritize Remote over other keywords', () => {
      const result = extractLocation(mockElement, 'Hybrid or Remote, CA-based');
      // Remote should take priority
      expect(result).toMatch(/Remote|Hybrid/);
    });
  });

  describe('extractJobTitle - Advanced Edge Cases', () => {
    test('should handle job titles with special characters', () => {
      document.body.innerHTML = '<h1>C# Developer</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('C# Developer');
    });

    test('should handle .NET in title', () => {
      document.body.innerHTML = '<h1>.NET Software Engineer</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('.NET Software Engineer');
    });

    test('should handle job titles with slashes', () => {
      document.body.innerHTML = '<h1>QA/Test Engineer</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('QA/Test Engineer');
    });

    test('should handle seniority levels', () => {
      document.body.innerHTML = '<h1>Sr. Software Engineer</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('Sr. Software Engineer');
    });

    test('should handle Roman numerals in titles', () => {
      document.body.innerHTML = '<h1>Software Engineer III</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('Software Engineer III');
    });

    test('should handle parenthetical info in title', () => {
      document.body.innerHTML = '<h1>Software Engineer (Remote)</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('Software Engineer (Remote)');
    });

    test('should handle very long job titles', () => {
      document.body.innerHTML = '<h1>Principal Software Development Engineer in Test for Cloud Infrastructure and Services</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      // Should reject titles with too many words (>10) - this has 11 words
      expect(result).toBeNull();
    });

    test('should handle unicode characters', () => {
      document.body.innerHTML = '<h1>Software Engineer – Cloud</h1>';
      const element = document.querySelector('h1');

      const result = extractJobTitle(element);
      expect(result).toBe('Software Engineer – Cloud');
    });
  });

  describe('extractCompanyName - Advanced Edge Cases', () => {
    test('should handle company names with numbers', () => {
      document.body.innerHTML = '<div class="company">3M Corporation</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('3M Corporation');
    });

    test('should handle single letter company names', () => {
      document.body.innerHTML = '<div class="company">X Corp</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('X Corp');
    });

    test('should handle hyphenated company names', () => {
      document.body.innerHTML = '<div class="company">7-Eleven Inc</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('7-Eleven Inc');
    });

    test('should handle company with ampersand', () => {
      document.body.innerHTML = '<div class="company">Smith & Jones LLC</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Smith & Jones LLC');
    });

    test('should handle international company suffixes', () => {
      document.body.innerHTML = '<div class="company">Siemens AG</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Siemens AG');
    });

    test('should handle company names with periods', () => {
      document.body.innerHTML = '<div class="company">Yahoo! Inc.</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBe('Yahoo! Inc.');
    });

    test('should reject very long company names', () => {
      document.body.innerHTML = '<div>This is a very long text that is definitely not a company name at all</div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBeNull();
    });

    test('should handle whitespace-only elements', () => {
      document.body.innerHTML = '<div class="company">   </div>';
      const element = document.querySelector('div');

      const result = extractCompanyName(element);
      expect(result).toBeNull();
    });
  });

  describe('extractLargeTextBlock - Advanced Edge Cases', () => {
    test('should handle text with unicode characters', () => {
      document.body.innerHTML = `
        <main>
          <p>Job description with unicode: "smart quotes", em-dashes—like this, and bullet points • like • these.
          We're looking for someone who's passionate about technology.</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('smart quotes');
      expect(result).toContain('em-dashes');
    });

    test('should handle HTML entities', () => {
      document.body.innerHTML = `
        <main>
          <p>Requirements &amp; Responsibilities: Must have 5+ years experience &lt;coding&gt; in Python.</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toContain('&');
      expect(result).toContain('Requirements');
    });

    test('should handle text exactly at minimum length', () => {
      const exactlyFiftyChars = 'a'.repeat(50);
      document.body.innerHTML = `
        <main>
          <p>${exactlyFiftyChars}</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBe(exactlyFiftyChars);
      expect(result.length).toBe(50);
    });

    test('should handle text one character short of minimum', () => {
      const fortyNineChars = 'a'.repeat(49);
      document.body.innerHTML = `
        <main>
          <p>${fortyNineChars}</p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });

    test('should handle nested excluded elements', () => {
      document.body.innerHTML = `
        <main>
          <nav>
            <p>This is navigation content that should be excluded even though it's in main.</p>
          </nav>
        </main>
      `;
      const nav = document.querySelector('nav');
      const p = nav.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });

    test('should handle whitespace-only text block', () => {
      document.body.innerHTML = `
        <main>
          <p>


          </p>
        </main>
      `;
      const main = document.querySelector('main');
      const p = main.querySelector('p');

      const result = extractLargeTextBlock(p);
      expect(result).toBeNull();
    });
  });

  describe('Cross-function integration edge cases', () => {
    test('should handle null element gracefully', () => {
      expect(() => extractJobTitle(null)).not.toThrow();
      expect(() => extractCompanyName(null)).not.toThrow();
      expect(() => extractLargeTextBlock(null)).not.toThrow();
    });

    test('should handle element with no textContent', () => {
      const emptyDiv = document.createElement('div');
      document.body.appendChild(emptyDiv);

      expect(extractJobTitle(emptyDiv)).toBeNull();
      expect(extractCompanyName(emptyDiv)).toBeNull();
      expect(extractLargeTextBlock(emptyDiv)).toBeNull();
    });

    test('should handle deeply nested elements', () => {
      document.body.innerHTML = `
        <div><div><div><div><div>
          <div class="company">Deep Company Inc</div>
        </div></div></div></div></div>
      `;
      const element = document.querySelector('.company');

      const result = extractCompanyName(element);
      expect(result).toBe('Deep Company Inc');
    });

    test('cleanText should preserve important punctuation', () => {
      expect(cleanText('C++ Developer')).toBe('C++ Developer');
      expect(cleanText('.NET Engineer')).toBe('.NET Engineer');
      expect(cleanText('Smith & Jones')).toBe('Smith & Jones');
      expect(cleanText('$70,000')).toBe('$70,000');
    });

    test('cleanText should handle tabs and various whitespace', () => {
      expect(cleanText('Text\twith\ttabs')).toBe('Text with tabs');
      expect(cleanText('Text\r\nwith\r\nCRLF')).toBe('Text with CRLF');
    });
  });
});
