const { extractQuestions } = require('../scripts/extract');

test('extracts different question formats', () => {
  const text = 'Question 1 : Quelle est la capitale de la France ? 2) Qui a decouvert l\'Amerique ? 3. Quelle est la formule de l\'eau ?';
  const result = extractQuestions(text);
  expect(result).toEqual(['Question 1 :', '2)', '3.']);
});
