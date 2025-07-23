// Common functions for EvalVoice pages
// Handles speech recognition, speech synthesis, question navigation

let questions = [];
let currentQuestion = 0;
let responses = [];
let recognition;
let synthesis = window.speechSynthesis;
let recordingStudentInfo = false;
let recordingResponse = false;
let speechRate = 1.0;

function initializeRecognition() {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'fr-FR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        if (recordingStudentInfo) {
          document.getElementById('studentName').value = event.results[i][0].transcript;
          recordingStudentInfo = false;
          document.getElementById('recordingIndicator').style.display = 'none';
        } else if (recordingResponse) {
          document.getElementById('responseInput').value = event.results[i][0].transcript;
          responses[currentQuestion] = event.results[i][0].transcript;
          recordingResponse = false;
          document.getElementById('recordingIndicator').style.display = 'none';
        }
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Recognition error:', event.error);
    alert('Une erreur est survenue avec la reconnaissance vocale : ' + event.error);
    document.getElementById('recordingIndicator').style.display = 'none';
  };
}

function startRecordingResponse() {
  recordingResponse = true;
  recognition.start();
  document.getElementById('recordingIndicator').style.display = 'block';
}

function askQuestion(index) {
  if (!synthesis.speaking && questions[index]) {
    console.log(`Asking question ${index + 1}: ${questions[index]}`);
    let utterance = new SpeechSynthesisUtterance(questions[index]);
    utterance.lang = 'fr-FR';
    utterance.rate = speechRate;
    utterance.onstart = () => {
      document.getElementById('questionDisplay').textContent = questions[index];
      document.getElementById('synthesisIndicator').style.display = 'block';
    };
    utterance.onend = () => {
      document.getElementById('synthesisIndicator').style.display = 'none';
      document.getElementById('recordingIndicator').style.display = 'block';
      startRecordingResponse();
    };
    synthesis.speak(utterance);
  } else {
    console.error('Synthesis speaking or no question available');
  }
}

function navigateQuestion(direction) {
  currentQuestion += direction;
  if (currentQuestion < 0) currentQuestion = 0;
  if (currentQuestion >= questions.length) currentQuestion = questions.length - 1;
  document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
  document.getElementById('nextQuestion').disabled = (currentQuestion === questions.length - 1);
  document.getElementById('responseInput').value = responses[currentQuestion] || '';
  askQuestion(currentQuestion);
}

function exportResponses() {
  const studentInfo = document.getElementById('studentName').value;
  if (!studentInfo) {
    alert("Veuillez renseigner votre identité (Prénom, Nom, Classe) avant d'exporter les réponses.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text(`Nom, Prénom, Classe : ${studentInfo}`, 10, 10);
  let output = questions.map((q, i) => `${q}\nRéponse : ${responses[i] || 'Pas de réponse.'}\n\n`).join('');
  doc.text(output, 10, 30);
  doc.save('reponses_evaluation.pdf');
}

function adjustSpeechRate(delta) {
  speechRate = Math.max(0.5, Math.min(2.0, speechRate + delta));
  document.getElementById('speedDisplay').textContent = speechRate.toFixed(1) + 'x';
}

function startEvaluation() {
  if (synthesis && recognition && questions.length > 0) {
    console.log('Starting evaluation...');
    askQuestion(currentQuestion);
    const startBtn = document.getElementById('startEval');
    if (startBtn) startBtn.disabled = true;
    document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
    document.getElementById('nextQuestion').disabled = (questions.length === 1);
    document.getElementById('exportResponses').disabled = false;
  } else {
    alert("Votre navigateur ne supporte pas la synthèse vocale ou la reconnaissance vocale ou aucune question n'a été trouvée.");
  }
}

