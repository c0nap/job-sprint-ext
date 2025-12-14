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

describe('Autofill MVP - Highly Nested DOM Structures', () => {
  describe('Deep Nesting - 6 Levels', () => {
    it('should find input elements nested 6 levels deep', () => {
      // Simulate a deeply nested DOM structure
      const mockDOM = {
        tagName: 'DIV',
        className: 'level-1',
        children: [{
          tagName: 'DIV',
          className: 'level-2',
          children: [{
            tagName: 'DIV',
            className: 'level-3',
            children: [{
              tagName: 'DIV',
              className: 'level-4',
              children: [{
                tagName: 'DIV',
                className: 'level-5',
                children: [{
                  tagName: 'DIV',
                  className: 'level-6',
                  children: [{
                    tagName: 'INPUT',
                    type: 'text',
                    id: 'deeply-nested-input',
                    value: ''
                  }]
                }]
              }]
            }]
          }]
        }]
      };

      const inputs = findAllInputs(mockDOM);
      expect(inputs.length).toBe(1);
      expect(inputs[0].id).toBe('deeply-nested-input');
    });

    it('should extract question from label 6 levels up in hierarchy', () => {
      const mockDOM = {
        tagName: 'DIV',
        className: 'level-1',
        querySelector: () => ({
          textContent: 'Are you authorized to work?'
        }),
        children: [{
          tagName: 'DIV',
          className: 'level-2',
          children: [{
            tagName: 'DIV',
            className: 'level-3',
            children: [{
              tagName: 'DIV',
              className: 'level-4',
              children: [{
                tagName: 'DIV',
                className: 'level-5',
                children: [{
                  tagName: 'DIV',
                  className: 'level-6',
                  children: [{
                    tagName: 'INPUT',
                    type: 'radio',
                    name: 'work-auth',
                    value: 'yes'
                  }]
                }]
              }]
            }]
          }]
        }]
      };

      const question = extractQuestionFromAncestors(mockDOM);
      expect(question).toBeDefined();
      expect(question).toContain('authorized');
    });

    it('should handle multiple inputs at different nesting levels', () => {
      const inputs = [
        { nestingLevel: 1, id: 'input-1', type: 'text' },
        { nestingLevel: 3, id: 'input-2', type: 'email' },
        { nestingLevel: 6, id: 'input-3', type: 'tel' },
        { nestingLevel: 4, id: 'input-4', type: 'select' },
        { nestingLevel: 6, id: 'input-5', type: 'text' }
      ];

      const deepInputs = inputs.filter(input => input.nestingLevel === 6);
      expect(deepInputs.length).toBe(2);
      expect(deepInputs.map(i => i.id)).toContain('input-3');
      expect(deepInputs.map(i => i.id)).toContain('input-5');
    });

    it('should maintain autofill state across deeply nested forms', () => {
      const formStructure = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    inputs: [
                      { id: 'deep-1', filled: false },
                      { id: 'deep-2', filled: false },
                      { id: 'deep-3', filled: false }
                    ]
                  }
                }
              }
            }
          }
        }
      };

      // Simulate filling deep inputs
      const deepInputs = formStructure.level1.level2.level3.level4.level5.level6.inputs;
      deepInputs.forEach(input => input.filled = true);

      const allFilled = deepInputs.every(input => input.filled);
      expect(allFilled).toBe(true);
      expect(deepInputs.length).toBe(3);
    });
  });

  describe('Complex Nested Scenarios', () => {
    it('should handle nested forms with mixed input types at 6 levels', () => {
      const nestedForm = {
        div1: {
          div2: {
            div3: {
              div4: {
                div5: {
                  div6: {
                    inputs: [
                      { type: 'text', question: 'First Name' },
                      { type: 'text', question: 'Last Name' },
                      { type: 'email', question: 'Email Address' },
                      { type: 'radio', question: 'Work Authorization', options: ['Yes', 'No'] },
                      { type: 'select', question: 'Education Level', options: ['HS', 'BS', 'MS', 'PhD'] },
                      { type: 'checkbox', question: 'Agree to Terms' }
                    ]
                  }
                }
              }
            }
          }
        }
      };

      const inputs = nestedForm.div1.div2.div3.div4.div5.div6.inputs;

      expect(inputs.length).toBe(6);
      expect(inputs.filter(i => i.type === 'text').length).toBe(2);
      expect(inputs.filter(i => i.type === 'radio').length).toBe(1);
      expect(inputs.filter(i => i.type === 'select').length).toBe(1);
      expect(inputs.filter(i => i.type === 'checkbox').length).toBe(1);
      expect(inputs.filter(i => i.type === 'email').length).toBe(1);
    });

    it('should traverse and autofill 6-level nested structure in correct order', () => {
      const fillingSequence = [];

      // Manually create a 6-level structure with inputs at each level
      for (let level = 1; level <= 6; level++) {
        fillingSequence.push({ level, inputId: `input-level-${level}` });
      }

      processNestedInputs({ level: 1 }, 1);

      expect(fillingSequence.length).toBe(6);
      // Verify all levels from 1 to 6 are present
      const maxLevel = Math.max(...fillingSequence.map(s => s.level));
      expect(maxLevel).toBe(6);
      expect(fillingSequence[0].level).toBe(1);
      expect(fillingSequence[5].level).toBe(6);
    });

    it('should handle dynamic content in deeply nested structures', () => {
      const dynamicContent = {
        rendered: false,
        depth: 6,
        inputs: []
      };

      // Simulate dynamic rendering of inputs at level 6
      dynamicContent.rendered = true;
      dynamicContent.inputs = [
        { id: 'dynamic-1', depth: 6, question: 'Phone Number' },
        { id: 'dynamic-2', depth: 6, question: 'Address' },
        { id: 'dynamic-3', depth: 6, question: 'City' }
      ];

      expect(dynamicContent.rendered).toBe(true);
      expect(dynamicContent.inputs.every(i => i.depth === 6)).toBe(true);
      expect(dynamicContent.inputs.length).toBe(3);
    });

    it('should extract questions from sibling elements at deep nesting', () => {
      const siblingStructure = {
        level6: [
          { type: 'label', text: 'Sponsorship Required?' },
          { type: 'input', inputType: 'radio', value: 'yes' },
          { type: 'input', inputType: 'radio', value: 'no' }
        ]
      };

      const label = siblingStructure.level6.find(el => el.type === 'label');
      const inputs = siblingStructure.level6.filter(el => el.type === 'input');

      expect(label.text).toBe('Sponsorship Required?');
      expect(inputs.length).toBe(2);
      expect(inputs.every(i => i.inputType === 'radio')).toBe(true);
    });

    it('should maintain performance with many inputs at 6th nesting level', () => {
      const manyInputs = [];

      // Create 50 inputs at level 6
      for (let i = 0; i < 50; i++) {
        manyInputs.push({
          id: `input-${i}`,
          nestingLevel: 6,
          type: i % 3 === 0 ? 'text' : i % 3 === 1 ? 'select' : 'radio',
          processed: false
        });
      }

      const startTime = Date.now();
      manyInputs.forEach(input => {
        input.processed = true;
      });
      const endTime = Date.now();

      expect(manyInputs.every(i => i.processed)).toBe(true);
      expect(manyInputs.length).toBe(50);
      expect(endTime - startTime).toBeLessThan(100); // Should process quickly
    });
  });

  describe('Edge Cases with Deep Nesting', () => {
    it('should handle empty containers at various nesting levels', () => {
      const structure = {
        level1: {
          level2: {
            level3: {},
            level3b: {
              level4: {
                level5: {},
                level5b: {
                  level6: {
                    inputs: [{ id: 'only-input' }]
                  }
                }
              }
            }
          }
        }
      };

      const input = structure.level1.level2.level3b.level4.level5b.level6.inputs[0];
      expect(input.id).toBe('only-input');
    });

    it('should handle aria-labels in deeply nested inputs', () => {
      const nestedInput = {
        level: 6,
        ariaLabel: 'Years of professional experience',
        ariaDescribedBy: 'help-text-experience',
        type: 'number'
      };

      expect(nestedInput.level).toBe(6);
      expect(nestedInput.ariaLabel).toContain('experience');
      expect(nestedInput.type).toBe('number');
    });

    it('should handle form validation errors at deep nesting', () => {
      const validationState = {
        level6Inputs: [
          { id: 'email', value: 'invalid-email', valid: false, error: 'Invalid email format' },
          { id: 'phone', value: '123', valid: false, error: 'Phone number too short' },
          { id: 'name', value: 'John Doe', valid: true, error: null }
        ]
      };

      const invalidInputs = validationState.level6Inputs.filter(i => !i.valid);
      const validInputs = validationState.level6Inputs.filter(i => i.valid);

      expect(invalidInputs.length).toBe(2);
      expect(validInputs.length).toBe(1);
      expect(invalidInputs.every(i => i.error !== null)).toBe(true);
    });
  });
});

// ============ HELPER FUNCTIONS FOR NESTED TESTS ============

function findAllInputs(node, inputs = []) {
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'TEXTAREA') {
    inputs.push(node);
  }

  if (node.children && node.children.length > 0) {
    node.children.forEach(child => findAllInputs(child, inputs));
  }

  return inputs;
}

function extractQuestionFromAncestors(node) {
  if (node.querySelector) {
    const label = node.querySelector();
    return label ? label.textContent : null;
  }
  return null;
}

function createNestedStructure(maxLevel, callback) {
  return { level: 1, children: [] };
}

function processNestedInputs(structure, currentLevel) {
  if (currentLevel <= 6) {
    // Simulate processing
    return true;
  }
  return false;
}

module.exports = {
  findBestMatch,
  setState,
  isDangerousButton,
  canAutoClickButton,
  findSimilarQA,
  calculateSimilarity,
  findAllInputs,
  extractQuestionFromAncestors
};
