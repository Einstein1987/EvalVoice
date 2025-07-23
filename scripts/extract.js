function extractQuestions(textContent) {
  // Nettoyer le texte extrait
  textContent = textContent.replace(/\s\s+/g, ' ');

  let questionsArray = [];
  // Pattern pour plusieurs formats: "Question 1 :", "2)", "3." ou "Question :"
  let questionPattern = /(?:Question \d+ ?:|\d+\)|Question ?:|\d+\.)/gi;
  let match;
  let lastIndex = 0;

  while ((match = questionPattern.exec(textContent)) !== null) {
    if (questionsArray.length > 0) {
      questionsArray[questionsArray.length - 1].text += textContent.substring(lastIndex, match.index).trim();
    }
    questionsArray.push({ index: match.index, text: match[0] });
    lastIndex = questionPattern.lastIndex;
  }

  if (questionsArray.length > 0) {
    questionsArray[questionsArray.length - 1].text += textContent.substring(lastIndex).trim();
  }

  return questionsArray.map(q => q.text);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractQuestions };
} else {
  window.extractQuestions = extractQuestions;
}
