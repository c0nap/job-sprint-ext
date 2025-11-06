# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the JobSprint Extension.

## CI Workflow (`ci.yml`)

Runs automatically on every pull request to the `main` branch.

### Jobs

#### 1. **Validate Manifest & Structure**
- Validates `manifest.json` is valid JSON
- Confirms Manifest V3 is being used
- Verifies all required files exist

#### 2. **JavaScript Syntax Check**
- Runs Node.js syntax validation on all JS files
- Ensures code will parse correctly before testing
- Acts as a "compilation" check for JavaScript

#### 3. **Test Utility Functions**
- Runs Jest tests specifically for `utils.js`
- Uploads test results as artifacts
- Ensures core utility functions work correctly

#### 4. **Full Test Suite with Coverage**
- Runs all Jest tests
- Generates code coverage reports
- Uploads coverage artifacts
- Only runs after manifest validation and syntax checks pass

#### 5. **Code Quality Check**
- Checks for excessive console.log statements
- Validates file sizes aren't too large
- Identifies TODO comments that need attention

#### 6. **CI Pipeline Success**
- Summary job that confirms all checks passed
- Depends on all other jobs completing successfully

### Viewing Results

After a pull request is created:
1. Navigate to the "Actions" tab in GitHub
2. Click on the workflow run for your PR
3. View individual job results
4. Download artifacts (test results, coverage reports) if needed

### Local Testing

Before pushing, you can run the same checks locally:

```bash
# Validate manifest
jq empty manifest.json

# Check JavaScript syntax
node -c service-worker.js
node -c content-script.js
node -c popup.js
node -c utils.js

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Troubleshooting

If the CI pipeline fails:
1. Check the specific job that failed
2. Read the error message in the job logs
3. Run the equivalent command locally to debug
4. Fix the issue and push again

### Adding New Tests

When adding new test files:
1. Place them in the `__tests__/` directory
2. Name them `*.test.js`
3. The CI will automatically pick them up
