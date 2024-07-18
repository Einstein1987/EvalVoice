import { questions } from './globals.js';

export function extractQuestions(textContent) {
  textContent = textContent.replace(/\s\s+/g, ' ');
  console.log("Cleaned Text Content: ", textContent);
  
  let questionsArray = [];
  let questionPattern = /(?:Question \d+ :|\d+\)|Question :)/gi;
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

  questions = questionsArray.map(q => q.text);
  console.log("Extracted Questions: ", questions);

  if (questions.length === 0) {
    console.log("No questions found.");
    alert("Aucune question trouvée dans le document PDF.");
  }
}
