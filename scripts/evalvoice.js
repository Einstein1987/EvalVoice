// ============================================================
// VARIABLES GLOBALES EVALVOICE
// ============================================================

let questions = [];
let currentQuestion = 0;
let responses = [];
let recognition;
let synthesis = window.speechSynthesis;
let recordingStudentInfo = false;
let recordingResponse = false;
let speechRate = 1.0;
let microphonePermissionGranted = false;
let recognitionInitialized = false;

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    padding: 15px 25px;
    background-color: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
    color: white; border-radius: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    z-index: 10000; font-size: 16px; max-width: 80%; text-align: center;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.transition = 'opacity 0.5s';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    microphonePermissionGranted = true;
    console.log('✅ Permission microphone accordée');
    showNotification('✅ Microphone prêt', 'success');
    const recordBtn = document.getElementById('recordStudentInfo');
    if (recordBtn) {
      recordBtn.disabled = false;
      recordBtn.style.opacity = '1';
    }
    return true;
  } catch (error) {
    console.error('❌ Permission microphone refusée:', error);
    microphonePermissionGranted = false;
    showNotification('⚠️ Permission microphone refusée', 'error');
    return false;
  }
}

// ============================================================
// RECONNAISSANCE VOCALE
// ============================================================

function initializeRecognition() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    showNotification('❌ Votre navigateur ne supporte pas la reconnaissance vocale', 'error');
    return false;
  }

  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'fr-FR';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      if (recordingStudentInfo) {
        document.getElementById('studentName').value = finalTranscript;
        evalState.update({ studentName: finalTranscript });
        recordingStudentInfo = false;
        document.getElementById('recordingIndicator').style.display = 'none';
        showNotification('✅ Informations élève enregistrées', 'success');
      } else if (recordingResponse) {
        document.getElementById('responseInput').value = finalTranscript;
        responses[currentQuestion] = finalTranscript;
        evalState.update({ responses: responses });
        recordingResponse = false;
        document.getElementById('recordingIndicator').style.display = 'none';
        showNotification('✅ Réponse enregistrée', 'success');
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Recognition error:', event.error);
    document.getElementById('recordingIndicator').style.display = 'none';
    
    switch(event.error) {
      case 'not-allowed':
        showNotification('⚠️ Permission microphone refusée', 'error');
        break;
      case 'no-speech':
        showNotification('⚠️ Aucun son détecté', 'error');
        break;
      default:
        showNotification(`⚠️ Erreur: ${event.error}`, 'error');
    }
    
    recordingStudentInfo = false;
    recordingResponse = false;
  };

  recognitionInitialized = true;
  console.log('✅ Reconnaissance vocale initialisée');
  return true;
}

function startRecordingResponse() {
  if (!microphonePermissionGranted) {
    showNotification('⚠️ Veuillez d\'abord autoriser l\'accès au microphone', 'error');
    requestMicrophonePermission();
    return;
  }

  recordingResponse = true;
  try {
    recognition.start();
    document.getElementById('recordingIndicator').style.display = 'block';
  } catch (error) {
    if (error.name !== 'InvalidStateError') {
      showNotification('⚠️ Impossible de démarrer l\'enregistrement', 'error');
    }
  }
}

// ============================================================
// SYNTHÈSE VOCALE
// ============================================================

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
      if (microphonePermissionGranted) {
        setTimeout(() => startRecordingResponse(), 500);
      }
    };
    synthesis.speak(utterance);
  }
}

function adjustSpeechRate(delta) {
  speechRate = Math.max(0.5, Math.min(2.0, speechRate + delta));
  document.getElementById('speedDisplay').textContent = speechRate.toFixed(1) + 'x';
}

// ============================================================
// NAVIGATION
// ============================================================

function navigateQuestion(direction) {
  if (recognition && (recordingResponse || recordingStudentInfo)) {
    try {
      recognition.stop();
    } catch (e) {}
    recordingResponse = false;
    recordingStudentInfo = false;
    document.getElementById('recordingIndicator').style.display = 'none';
  }

  currentQuestion += direction;
  if (currentQuestion < 0) currentQuestion = 0;
  if (currentQuestion >= questions.length) currentQuestion = questions.length - 1;
  
  evalState.update({ currentQuestion: currentQuestion });
  
  document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
  document.getElementById('nextQuestion').disabled = (currentQuestion === questions.length - 1);
  document.getElementById('responseInput').value = responses[currentQuestion] || '';
  
  updateProgressBar();
  askQuestion(currentQuestion);
}

function updateProgressBar() {
  const total = questions.length;
  const current = currentQuestion + 1;
  const answered = responses.filter(r => r && r.trim() !== '').length;
  
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  if (total > 0 && progressContainer) {
    progressContainer.style.display = 'block';
    const percentage = (current / total) * 100;
    if (progressFill) progressFill.style.width = percentage + '%';
    if (progressText) progressText.textContent = `Question ${current} sur ${total} | ${answered} réponse${answered > 1 ? 's' : ''} enregistrée${answered > 1 ? 's' : ''}`;
  }
}

// ============================================================
// EXPORT
// ============================================================

function exportResponses() {
  const studentInfo = document.getElementById('studentName').value;
  if (!studentInfo) {
    showNotification('⚠️ Veuillez renseigner votre identité avant d\'exporter', 'error');
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Évaluation - Réponses', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Élève : ${studentInfo}`, 10, 25);
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 10, 32);
    
    let yPosition = 45;
    const lineHeight = 7;
    const maxWidth = 190;
    
    questions.forEach((q, i) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFont(undefined, 'bold');
      const questionLines = doc.splitTextToSize(`Q${i + 1}: ${q}`, maxWidth);
      doc.text(questionLines, 10, yPosition);
      yPosition += questionLines.length * lineHeight;
      
      doc.setFont(undefined, 'normal');
      const response = responses[i] || 'Pas de réponse.';
      const responseLines = doc.splitTextToSize(`Réponse : ${response}`, maxWidth);
      doc.text(responseLines, 10, yPosition);
      yPosition += responseLines.length * lineHeight + 5;
    });
    
    const filename = `evaluation_${studentInfo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
    showNotification('✅ Réponses exportées avec succès', 'success');
    
    setTimeout(() => {
      if (confirm('Export réussi ! Voulez-vous terminer cette évaluation et vider la session ?')) {
        evalState.clearState();
        location.reload();
      }
    }, 1000);
    
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    showNotification('❌ Erreur lors de l\'export du PDF', 'error');
  }
}

// ============================================================
// DÉMARRAGE DE L'ÉVALUATION
// ============================================================

function startEvaluation() {
  if (!synthesis || !recognitionInitialized || questions.length === 0) {
    showNotification('❌ Impossible de démarrer l\'évaluation', 'error');
    return;
  }

  console.log('Starting evaluation...');
  
  evalState.update({
    questions: questions,
    responses: responses,
    currentQuestion: currentQuestion
  });
  
  askQuestion(currentQuestion);
  
  const startBtn = document.getElementById('startEval');
  if (startBtn) startBtn.disabled = true;
  
  document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
  document.getElementById('nextQuestion').disabled = (questions.length === 1);
  document.getElementById('exportResponses').disabled = false;
  
  updateProgressBar();
  showNotification('✅ Évaluation démarrée', 'success');
}

// ============================================================
// INITIALISATION AU CHARGEMENT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Vérifier la compatibilité
  const compatibility = BrowserCompatibility.initialize();
  window.evalVoiceCompatibility = compatibility;
  
  // 2. Initialiser l'accessibilité
  AccessibilityManager.initialize();
  
  // 3. Initialiser la reconnaissance vocale
  if (compatibility.isFullyCompatible) {
    initializeRecognition();
    await requestMicrophonePermission();
  }
  
  // 4. Vérifier et restaurer une session existante
  if (evalState.hasExistingSession()) {
    const shouldRestore = evalState.promptRestoreSession();
    if (shouldRestore) {
      evalState.restoreSession();
      if (questions.length > 0) {
        document.getElementById('prevQuestion').disabled = false;
        document.getElementById('nextQuestion').disabled = false;
        document.getElementById('exportResponses').disabled = false;
        updateProgressBar();
        document.getElementById('questionDisplay').textContent = questions[currentQuestion];
        document.getElementById('responseInput').value = responses[currentQuestion] || '';
        showNotification('✅ Session restaurée', 'success');
      }
    } else {
      evalState.clearState();
    }
  }
  
  // 5. Démarrer la sauvegarde automatique
  evalState.startAutoSave(5000);
  
  // 6. Sauvegarder avant de quitter
  window.addEventListener('beforeunload', (e) => {
    evalState.saveState();
    const hasUnsavedWork = responses.some(r => r && r.trim() !== '');
    if (hasUnsavedWork) {
      e.preventDefault();
      e.returnValue = 'Vous avez des réponses non exportées. Êtes-vous sûr de vouloir quitter ?';
      return e.returnValue;
    }
  });
  
  // 7. Event listeners
  const recordStudentInfoBtn = document.getElementById('recordStudentInfo');
  if (recordStudentInfoBtn) {
    recordStudentInfoBtn.addEventListener('click', () => {
      if (!microphonePermissionGranted) {
        requestMicrophonePermission();
        return;
      }
      recordingStudentInfo = true;
      try {
        recognition.start();
        document.getElementById('recordingIndicator').style.display = 'block';
      } catch (error) {
        if (error.name === 'InvalidStateError') {
          recognition.stop();
          setTimeout(() => {
            recognition.start();
            document.getElementById('recordingIndicator').style.display = 'block';
          }, 100);
        }
      }
    });
  }

  const responseInput = document.getElementById('responseInput');
  if (responseInput) {
    responseInput.addEventListener('input', (event) => {
      responses[currentQuestion] = event.target.value;
      // Note: La sauvegarde se fait ici, mais la barre de progression
      // se met à jour uniquement lors de la navigation
      evalState.update({ responses: responses });
    });
  }
  
  const studentNameInput = document.getElementById('studentName');
  if (studentNameInput) {
    studentNameInput.addEventListener('change', (e) => {
      evalState.update({ studentName: e.target.value });
    });
  }
});
