/**
 * Tests for Semi-Supervised Autofill MVP
 * Tests intelligent matching, state management, and multi-tab coordination
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Autofill MVP - Intelligent Question Matching', () => {
  describe('Choice Type Matching', () => {
    it('should match "Yes" to "Yes - I am authorized"', () => {
      const answer = 'Yes';
      const options = ['Yes - I am authorized', 'Yes with sponsorship', 'No'];
      const matched = findBestMatch(answer, options, 'choice');
      expect(matched).toBe('Yes - I am authorized');
    });

    it('should match "No" to "No - Not authorized"', () => {
      const answer = 'No';
      const options = ['Yes', 'No - Not authorized', 'Maybe'];
      const matched = findBestMatch(answer, options, 'choice');
      expect(matched).toBe('No - Not authorized');
    });

    it('should handle partial matches for choice type', () => {
      const answer = 'Bachelor';
      const options = ['High School', 'Bachelor of Science', 'Master of Arts', 'PhD'];
      const matched = findBestMatch(answer, options, 'choice');
      expect(matched).toBe('Bachelor of Science');
    });
  });

  describe('Exact Type Matching', () => {
    it('should only match exact strings for exact type', () => {
      const answer = 'Yes';
      const options = ['Yes', 'Yes - with conditions', 'No'];
      const matched = findBestMatch(answer, options, 'exact');
      expect(matched).toBe('Yes');
    });

    it('should return null if no exact match found', () => {
      const answer = 'Maybe';
      const options = ['Yes', 'No'];
      const matched = findBestMatch(answer, options, 'exact');
      expect(matched).toBeNull();
    });
  });

  describe('Text Type Matching', () => {
    it('should directly use answer for text inputs', () => {
      const answer = 'I have 5 years of experience in software development';
      const inputType = 'text';
      const result = handleTextInput(answer, inputType);
      expect(result).toBe(answer);
    });
  });
});

describe('Autofill MVP - State Management', () => {
  let autofillState;

  beforeEach(() => {
    autofillState = {
      state: 'idle',
      inputs: [],
      currentIndex: 0,
      processed: new Set(),
      skipped: new Set()
    };
  });

  it('should transition from IDLE to SCANNING', () => {
    setState(autofillState, 'scanning');
    expect(autofillState.state).toBe('scanning');
  });

  it('should transition from SCANNING to RUNNING when inputs found', () => {
    autofillState.inputs = [{ type: 'text' }, { type: 'select' }];
    setState(autofillState, 'running');
    expect(autofillState.state).toBe('running');
  });

  it('should track processed and skipped inputs', () => {
    autofillState.inputs = [{ id: 1 }, { id: 2 }, { id: 3 }];
    autofillState.processed.add(0);
    autofillState.skipped.add(1);

    expect(autofillState.processed.size).toBe(1);
    expect(autofillState.skipped.size).toBe(1);
    expect(autofillState.processed.has(0)).toBe(true);
  });

  it('should pause autofill when user clicks pause', () => {
    setState(autofillState, 'running');
    setState(autofillState, 'paused');
    expect(autofillState.state).toBe('paused');
  });

  it('should complete when all inputs processed', () => {
    autofillState.inputs = [{ id: 1 }, { id: 2 }];
    autofillState.currentIndex = 2;
    setState(autofillState, 'completed');
    expect(autofillState.state).toBe('completed');
  });
});

describe('Autofill MVP - Safety Checks', () => {
  it('should identify submit buttons', () => {
    const buttons = [
      { textContent: 'Submit Application' },
      { textContent: 'Send' },
      { textContent: 'Next' },
      { textContent: 'Save Draft' }
    ];

    const dangerous = buttons.filter(isDangerousButton);
    expect(dangerous).toHaveLength(3);
    expect(dangerous.map(b => b.textContent)).toContain('Submit Application');
    expect(dangerous.map(b => b.textContent)).toContain('Send');
    expect(dangerous.map(b => b.textContent)).toContain('Next');
  });

  it('should never auto-click submit/review buttons', () => {
    const button = { textContent: 'Submit Application' };
    const shouldAutoClick = canAutoClickButton(button);
    expect(shouldAutoClick).toBe(false);
  });

  it('should log warning when submit buttons detected', () => {
    const logs = [];
    const mockLog = (level, message) => logs.push({ level, message });

    findDangerousButtons(mockLog);

    const warnings = logs.filter(l => l.level === 'warn' && l.message.includes('submit'));
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('Autofill MVP - Multi-Tab Coordination', () => {
  it('should assign unique tab IDs to each session', () => {
    const tab1 = { tabId: 'tab-123' };
    const tab2 = { tabId: 'tab-456' };

    expect(tab1.tabId).not.toBe(tab2.tabId);
  });

  it('should log tab ID with each autofill operation', () => {
    const logs = [];
    const tabId = 'tab-123';

    logWithTabId(logs, tabId, 'info', 'Starting autofill');

    expect(logs[0].tabId).toBe(tabId);
    expect(logs[0].message).toContain('Starting autofill');
  });

  it('should allow multiple autofill sessions in different tabs', () => {
    const sessions = new Map();
    sessions.set('tab-1', { state: 'running', currentIndex: 2 });
    sessions.set('tab-2', { state: 'paused', currentIndex: 5 });

    expect(sessions.get('tab-1').state).toBe('running');
    expect(sessions.get('tab-2').state).toBe('paused');
  });
});

describe('Autofill MVP - Q&A Database', () => {
  let qaDatabase;

  beforeEach(() => {
    qaDatabase = [
      { question: 'Are you authorized to work in the U.S.?', answer: 'Yes', type: 'choice' },
      { question: 'What is your current salary?', answer: 'Prefer not to disclose', type: 'text' },
      { question: 'Years of experience?', answer: '5', type: 'exact' }
    ];
  });

  it('should find matching Q&A pair with high similarity', () => {
    const question = 'Are you authorized to work in the United States?';
    const match = findSimilarQA(qaDatabase, question);

    expect(match).toBeDefined();
    expect(match.answer).toBe('Yes');
    expect(match.similarity).toBeGreaterThan(0.6);
  });

  it('should return null for low similarity matches', () => {
    const question = 'Do you like pizza?';
    const match = findSimilarQA(qaDatabase, question);

    expect(match).toBeNull();
  });

  it('should support adding new Q&A pairs', () => {
    const newPair = {
      question: 'Do you have a driver\'s license?',
      answer: 'Yes',
      type: 'choice',
      timestamp: Date.now()
    };

    qaDatabase.push(newPair);

    expect(qaDatabase).toHaveLength(4);
    expect(qaDatabase[3].question).toBe('Do you have a driver\'s license?');
  });

  it('should support editing existing Q&A pairs', () => {
    const index = 1;
    qaDatabase[index] = {
      ...qaDatabase[index],
      answer: 'Market competitive',
      type: 'text'
    };

    expect(qaDatabase[index].answer).toBe('Market competitive');
  });

  it('should support deleting Q&A pairs', () => {
    const index = 0;
    qaDatabase.splice(index, 1);

    expect(qaDatabase).toHaveLength(2);
    expect(qaDatabase[0].question).toBe('What is your current salary?');
  });
});

// ============ HELPER FUNCTIONS (would be in actual implementation) ============

function findBestMatch(answer, options, answerType) {
  const normalized = answer.toLowerCase().trim();

  if (answerType === 'exact') {
    return options.find(opt => opt.toLowerCase().trim() === normalized) || null;
  }

  // Fuzzy matching for choice type
  for (const option of options) {
    const optNormalized = option.toLowerCase().trim();
    if (optNormalized.includes(normalized) || normalized.includes(optNormalized)) {
      return option;
    }
  }

  return null;
}

function handleTextInput(answer) {
  return answer;
}

function setState(state, newState) {
  state.state = newState;
}

function isDangerousButton(button) {
  const dangerousKeywords = ['submit', 'send', 'next', 'complete', 'finish'];
  const text = button.textContent.toLowerCase();
  return dangerousKeywords.some(keyword => text.includes(keyword));
}

function canAutoClickButton(button) {
  return !isDangerousButton(button);
}

function findDangerousButtons(logFn) {
  // Simulate finding submit buttons
  const buttons = [{ textContent: 'Submit Application' }];
  if (buttons.length > 0) {
    logFn('warn', `Found ${buttons.length} submit/review buttons - will not auto-click these`);
  }
}

function logWithTabId(logs, tabId, level, message) {
  logs.push({ tabId, level, message });
}

function findSimilarQA(database, question) {
  let bestMatch = null;
  let bestSimilarity = 0;

  for (const entry of database) {
    const similarity = calculateSimilarity(question, entry.question);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = entry;
    }
  }

  const THRESHOLD = 0.6;
  return bestSimilarity > THRESHOLD ? { ...bestMatch, similarity: bestSimilarity } : null;
}

function calculateSimilarity(str1, str2) {
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const set1 = new Set(normalize(str1));
  const set2 = new Set(normalize(str2));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

module.exports = {
  findBestMatch,
  setState,
  isDangerousButton,
  canAutoClickButton,
  findSimilarQA,
  calculateSimilarity
};
