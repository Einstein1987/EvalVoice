import { extractQuestions } from './extractQuestions.js';
import { questions, synthesis, currentQuestion } from './globals.js';

export default async function loadDocument() {
  const url = document.getElementById('urlInput').value;
  const docId = url.match(/[-\w]{25,}/)[0];
  const pdfUrl = `https://docs.google.com/document/d/${docId}/export?format=pdf`;

  try {
    const response = await fetch(`https://cors-anywhere.herokuapp.com/${pdfUrl}`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const urlBlob = URL.createObjectURL(blob);
    document.getElementById('pdfViewer').src = urlBlob;

    const pdfData = new Uint8Array(await blob.arrayBuffer());
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;

    let textContent = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContentObj = await page.getTextContent();
      textContent += textContentObj.items.map(item => item.str).join(' ') + ' ';
    }

    textContent = textContent.replace(/\s\s+/g, ' '); // Remove extra spaces
    console.log("Extracted Text Content: ", textContent);

    extractQuestions(textContent); // Extract questions from text

    if (questions.length > 0) {
      startEvaluation(); // Start evaluation if questions are found
    }
  } catch (error) {
    console.error('Erreur lors du chargement du document:', error);
    alert('Une erreur est survenue lors du chargement du document.');
  }
}
