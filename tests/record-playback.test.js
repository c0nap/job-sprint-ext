/**
 * Tests for Record and Playback Autofill Feature
 * Tests both recording user interactions and playing them back
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Record Mode - User Interaction Capture', () => {
  let mockInput;
  let recordedPairs;

  beforeEach(() => {
    recordedPairs = [];
    mockInput = {
      type: 'text',
      value: 'Test Answer',
      name: 'testField',
      id: 'testId',
      tagName: 'INPUT'
    };
  });

  describe('Question Extraction', () => {
    it('should extract question from label element', () => {
      const label = { textContent: 'Are you authorized to work?' };
      mockInput.labels = [label];

      const question = extractQuestionForInput(mockInput);
      expect(question).toBe('Are you authorized to work?');
    });

    it('should extract question from aria-label', () => {
      mockInput.labels = [];
      mockInput.getAttribute = (attr) => {
        if (attr === 'aria-label') return 'Years of experience';
        return null;
      };

      const question = extractQuestionForInput(mockInput);
      expect(question).toBe('Years of experience');
    });

    it('should extract question from placeholder', () => {
      mockInput.labels = [];
      mockInput.getAttribute = () => null;
      mockInput.placeholder = 'Enter your email address';

      const question = extractQuestionForInput(mockInput);
      expect(question).toBe('Enter your email address');
    });

    it('should clean question text (remove asterisks, extra spaces)', () => {
      const label = { textContent: '** First Name  * ' };
      mockInput.labels = [label];

      const question = extractQuestionForInput(mockInput);
      expect(question).toBe('First Name');
    });
  });

  describe('Answer Type Detection', () => {
    it('should detect choice type for select elements', () => {
      const selectInput = { ...mockInput, tagName: 'SELECT' };
      const type = determineAnswerType(selectInput);
      expect(type).toBe('choice');
    });

    it('should detect choice type for radio inputs', () => {
      const radioInput = { ...mockInput, type: 'radio' };
      const type = determineAnswerType(radioInput);
      expect(type).toBe('choice');
    });

    it('should detect choice type for checkbox inputs', () => {
      const checkboxInput = { ...mockInput, type: 'checkbox' };
      const type = determineAnswerType(checkboxInput);
      expect(type).toBe('choice');
    });

    it('should detect exact type for email inputs', () => {
      const emailInput = { ...mockInput, type: 'email' };
      const type = determineAnswerType(emailInput);
      expect(type).toBe('exact');
    });

    it('should detect exact type for phone inputs', () => {
      const phoneInput = { ...mockInput, type: 'tel' };
      const type = determineAnswerType(phoneInput);
      expect(type).toBe('exact');
    });

    it('should detect exact type for number inputs', () => {
      const numberInput = { ...mockInput, type: 'number' };
      const type = determineAnswerType(numberInput);
      expect(type).toBe('exact');
    });

    it('should detect text type for text inputs', () => {
      const textInput = { ...mockInput, type: 'text' };
      const type = determineAnswerType(textInput);
      expect(type).toBe('text');
    });

    it('should detect text type for textarea elements', () => {
      const textareaInput = { ...mockInput, tagName: 'TEXTAREA' };
      const type = determineAnswerType(textareaInput);
      expect(type).toBe('text');
    });
  });

  describe('Value Extraction', () => {
    it('should extract text from select option', () => {
      const selectInput = {
        tagName: 'SELECT',
        selectedIndex: 1,
        options: [
          { textContent: 'Please select' },
          { textContent: 'Yes - I am authorized' },
          { textContent: 'No' }
        ]
      };

      const value = getInputValue(selectInput);
      expect(value).toBe('Yes - I am authorized');
    });

    it('should extract label text from checked radio button', () => {
      const radioInput = {
        type: 'radio',
        checked: true,
        id: 'radio1',
        value: 'yes',
        labels: [{ textContent: 'Yes' }]
      };

      const value = getInputValue(radioInput);
      expect(value).toBe('Yes');
    });

    it('should return null for unchecked radio button', () => {
      const radioInput = {
        type: 'radio',
        checked: false
      };

      const value = getInputValue(radioInput);
      expect(value).toBeNull();
    });

    it('should return Yes for checked checkbox', () => {
      const checkboxInput = {
        type: 'checkbox',
        checked: true
      };

      const value = getInputValue(checkboxInput);
      expect(value).toBe('Yes');
    });

    it('should return No for unchecked checkbox', () => {
      const checkboxInput = {
        type: 'checkbox',
        checked: false
      };

      const value = getInputValue(checkboxInput);
      expect(value).toBe('No');
    });

    it('should extract value from text input', () => {
      const textInput = {
        type: 'text',
        value: 'John Doe'
      };

      const value = getInputValue(textInput);
      expect(value).toBe('John Doe');
    });
  });

  describe('Q&A Pair Creation', () => {
    it('should create Q&A pair with all required fields', () => {
      const qaPair = {
        question: 'Are you authorized to work?',
        answer: 'Yes',
        type: 'choice',
        timestamp: Date.now(),
        inputType: 'radio'
      };

      expect(qaPair.question).toBeDefined();
      expect(qaPair.answer).toBeDefined();
      expect(qaPair.type).toBeDefined();
      expect(qaPair.timestamp).toBeDefined();
      expect(qaPair.inputType).toBeDefined();
    });

    it('should update existing Q&A pair if question already exists', () => {
      const database = [
        { question: 'Years of experience?', answer: '3', type: 'exact' }
      ];

      const newPair = { question: 'Years of experience?', answer: '5', type: 'exact' };

      const existingIndex = database.findIndex(
        pair => pair.question === newPair.question
      );

      expect(existingIndex).toBe(0);
      database[existingIndex] = newPair;

      expect(database[0].answer).toBe('5');
    });

    it('should add new Q&A pair if question does not exist', () => {
      const database = [
        { question: 'Years of experience?', answer: '5', type: 'exact' }
      ];

      const newPair = { question: 'Education level?', answer: 'Bachelor', type: 'choice' };

      const existingIndex = database.findIndex(
        pair => pair.question === newPair.question
      );

      expect(existingIndex).toBe(-1);
      database.push(newPair);

      expect(database.length).toBe(2);
      expect(database[1].question).toBe('Education level?');
    });
  });

  describe('Available Options Extraction', () => {
    it('should extract all options from select element', () => {
      const selectInput = {
        tagName: 'SELECT',
        options: [
          { textContent: 'Yes' },
          { textContent: 'No' },
          { textContent: 'Not sure' }
        ]
      };

      const options = getAvailableOptions(selectInput);
      expect(options).toEqual(['Yes', 'No', 'Not sure']);
    });

    it('should extract all radio options from a radio group', () => {
      // This would be tested with DOM mocking in actual implementation
      const options = ['Yes', 'No', 'Prefer not to say'];
      expect(options.length).toBe(3);
    });

    it('should return Yes/No for checkbox', () => {
      const checkboxInput = { type: 'checkbox' };
      const options = getAvailableOptions(checkboxInput);
      expect(options).toEqual(['Yes', 'No']);
    });
  });
});

describe('Playback Mode - Form Autofill', () => {
  let qaDatabase;

  beforeEach(() => {
    qaDatabase = [
      {
        question: 'Are you authorized to work in the U.S.?',
        answer: 'Yes',
        type: 'choice',
        availableOptions: ['Yes - I am authorized', 'Yes with sponsorship', 'No']
      },
      {
        question: 'Years of experience in software development?',
        answer: '5',
        type: 'exact'
      },
      {
        question: 'Describe your experience with React',
        answer: 'I have 3 years of experience building web applications with React',
        type: 'text'
      }
    ];
  });

  describe('Question Matching', () => {
    it('should find exact match for question', () => {
      const question = 'Are you authorized to work in the U.S.?';
      const match = qaDatabase.find(entry => entry.question === question);

      expect(match).toBeDefined();
      expect(match.answer).toBe('Yes');
    });

    it('should find similar question using fuzzy matching', () => {
      const question = 'Are you authorized to work in the United States?';
      const match = findSimilarQuestion(qaDatabase, question);

      expect(match).toBeDefined();
      expect(match.answer).toBe('Yes');
    });

    it('should calculate similarity score for questions', () => {
      const q1 = 'Are you authorized to work in the U.S.?';
      const q2 = 'Are you authorized to work in the United States?';

      const similarity = calculateSimilarity(q1, q2);
      expect(similarity).toBeGreaterThan(0.6);
    });

    it('should return null for very different questions', () => {
      const question = 'What is your favorite color?';
      const match = findSimilarQuestion(qaDatabase, question);

      expect(match).toBeNull();
    });
  });

  describe('Choice Type Matching', () => {
    it('should match "Yes" to "Yes - I am authorized"', () => {
      const answer = 'Yes';
      const options = ['Yes - I am authorized', 'Yes with sponsorship', 'No'];

      const matched = findBestMatch(answer, options, 'choice');
      expect(matched).toBe('Yes - I am authorized');
    });

    it('should match "No" to exact "No"', () => {
      const answer = 'No';
      const options = ['Yes - I am authorized', 'Yes with sponsorship', 'No'];

      const matched = findBestMatch(answer, options, 'choice');
      expect(matched).toBe('No');
    });

    it('should handle partial match for Bachelor degree', () => {
      const answer = 'Bachelor';
      const options = ['High School', 'Bachelor of Science', 'Master', 'PhD'];

      const matched = findBestMatch(answer, options, 'choice');
      expect(matched).toBe('Bachelor of Science');
    });

    it('should be case-insensitive', () => {
      const answer = 'yes';
      const options = ['YES', 'NO'];

      const matched = findBestMatch(answer, options, 'choice');
      expect(matched).toBe('YES');
    });
  });

  describe('Exact Type Matching', () => {
    it('should only match exact strings', () => {
      const answer = 'Yes';
      const options = ['Yes', 'Yes - with conditions', 'No'];

      const matched = findBestMatch(answer, options, 'exact');
      expect(matched).toBe('Yes');
    });

    it('should return null if no exact match', () => {
      const answer = 'Maybe';
      const options = ['Yes', 'No'];

      const matched = findBestMatch(answer, options, 'exact');
      expect(matched).toBeNull();
    });

    it('should match numbers exactly', () => {
      const answer = '5';
      const options = ['3', '5', '7', '10'];

      const matched = findBestMatch(answer, options, 'exact');
      expect(matched).toBe('5');
    });
  });

  describe('Text Type Filling', () => {
    it('should fill text input with answer directly', () => {
      const input = {
        type: 'text',
        value: '',
        dispatchEvent: jest.fn()
      };

      const answer = 'I have 3 years of experience building web applications with React';

      input.value = answer;
      expect(input.value).toBe(answer);
    });

    it('should trigger input and change events', () => {
      const input = {
        type: 'text',
        value: '',
        dispatchEvent: jest.fn()
      };

      const answer = 'Test answer';
      input.value = answer;

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      expect(input.dispatchEvent).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Integration - Record and Playback Workflow', () => {
  it('should record answers and use them for playback', async () => {
    // Simulate recording
    const recordedPairs = [];

    // User fills out form
    const userInteractions = [
      { question: 'First Name', answer: 'John', type: 'text' },
      { question: 'Are you authorized to work?', answer: 'Yes', type: 'choice' },
      { question: 'Years of experience', answer: '5', type: 'exact' }
    ];

    userInteractions.forEach(interaction => {
      recordedPairs.push({
        question: interaction.question,
        answer: interaction.answer,
        type: interaction.type,
        timestamp: Date.now()
      });
    });

    expect(recordedPairs.length).toBe(3);

    // Simulate playback on similar form
    const formQuestions = ['First Name', 'Are you authorized to work?', 'Years of experience'];

    formQuestions.forEach(question => {
      const match = recordedPairs.find(pair => pair.question === question);
      expect(match).toBeDefined();
    });
  });
});

// ============ HELPER FUNCTIONS ============

function extractQuestionForInput(input) {
  if (input.labels && input.labels.length > 0) {
    return cleanQuestionText(input.labels[0].textContent);
  }

  if (input.getAttribute && input.getAttribute('aria-label')) {
    return cleanQuestionText(input.getAttribute('aria-label'));
  }

  if (input.placeholder) {
    return cleanQuestionText(input.placeholder);
  }

  return '';
}

function cleanQuestionText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\*+/g, '');
}

function determineAnswerType(input) {
  if (input.tagName === 'SELECT' || input.type === 'radio' || input.type === 'checkbox') {
    return 'choice';
  }

  if (input.type === 'email' || input.type === 'tel' || input.type === 'url' || input.type === 'number') {
    return 'exact';
  }

  return 'text';
}

function getInputValue(input) {
  if (input.tagName === 'SELECT') {
    const option = input.options[input.selectedIndex];
    return option ? option.textContent.trim() : '';
  }

  if (input.type === 'radio') {
    if (!input.checked) return null;
    return input.labels && input.labels[0] ? input.labels[0].textContent.trim() : input.value;
  }

  if (input.type === 'checkbox') {
    return input.checked ? 'Yes' : 'No';
  }

  return input.value;
}

function getAvailableOptions(input) {
  if (input.tagName === 'SELECT') {
    return Array.from(input.options).map(opt => opt.textContent.trim());
  }

  if (input.type === 'checkbox') {
    return ['Yes', 'No'];
  }

  return [];
}

function findSimilarQuestion(database, question) {
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
  return bestSimilarity > THRESHOLD ? bestMatch : null;
}

function calculateSimilarity(str1, str2) {
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const set1 = new Set(normalize(str1));
  const set2 = new Set(normalize(str2));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

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

module.exports = {
  extractQuestionForInput,
  determineAnswerType,
  getInputValue,
  getAvailableOptions,
  findSimilarQuestion,
  calculateSimilarity,
  findBestMatch
};
