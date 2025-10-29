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

// Demander l'accès au micro dès le chargement de la page
async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    microphonePermissionGranted = true;
    console.log('✅ Permission microphone accordée');
    
    // Afficher un message de succès visuel
    showNotification('✅ Microphone prêt', 'success');
    
    // Activer le bouton d'enregistrement des infos élève
    const recordBtn = document.getElementById('recordStudentInfo');
    if (recordBtn) {
      recordBtn.disabled = false;
      recordBtn.style.opacity = '1';
    }
    
    return true;
  } catch (error) {
    console.error('❌ Permission microphone refusée:', error);
    microphonePermissionGranted = false;
    showNotification('⚠️ Permission microphone refusée. Cliquez sur "Activer le micro" pour réessayer.', 'error');
    
    // Afficher un bouton pour réessayer
    showMicrophoneActivationButton();
    return false;
  }
}

// Afficher un bouton pour activer le micro si la permission est refusée
function showMicrophoneActivationButton() {
  const container = document.querySelector('.input-group');
  if (container && !document.getElementById('activateMicBtn')) {
    const activateBtn = document.createElement('button');
    activateBtn.id = 'activateMicBtn';
    activateBtn.textContent = '🎤 Activer le micro';
    activateBtn.style.backgroundColor = '#e74c3c';
    activateBtn.onclick = async () => {
      const granted = await requestMicrophonePermission();
      if (granted) {
        activateBtn.remove();
      }
    };
    container.insertBefore(activateBtn, container.firstChild);
  }
}

// Afficher une notification temporaire
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 15px 25px;
    background-color: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
    color: white;
    border-radius: 5px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    z-index: 10000;
    font-size: 16px;
    max-width: 80%;
    text-align: center;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = 'opacity 0.5s';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

function initializeRecognition() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    showNotification('❌ Votre navigateur ne supporte pas la reconnaissance vocale', 'error');
    return false;
  }

  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'fr-FR';
  recognition.continuous = false; // Changé pour mieux gérer les arrêts
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      if (recordingStudentInfo) {
        document.getElementById('studentName').value = finalTranscript;
        recordingStudentInfo = false;
        document.getElementById('recordingIndicator').style.display = 'none';
        showNotification('✅ Informations élève enregistrées', 'success');
      } else if (recordingResponse) {
        document.getElementById('responseInput').value = finalTranscript;
        responses[currentQuestion] = finalTranscript;
        recordingResponse = false;
        document.getElementById('recordingIndicator').style.display = 'none';
        showNotification('✅ Réponse enregistrée', 'success');
        // Mettre à jour la barre de progression après enregistrement vocal
        if (typeof updateProgressBar === 'function') {
          updateProgressBar();
        }
      }
    } else if (interimTranscript) {
      // Afficher la transcription temporaire
      if (recordingStudentInfo) {
        document.getElementById('studentName').value = interimTranscript;
      } else if (recordingResponse) {
        document.getElementById('responseInput').value = interimTranscript;
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Recognition error:', event.error);
    document.getElementById('recordingIndicator').style.display = 'none';
    
    // Gestion des erreurs spécifiques
    switch(event.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        showNotification('⚠️ Permission microphone refusée. Autorisez l\'accès au micro dans les paramètres du navigateur.', 'error');
        showMicrophoneActivationButton();
        break;
      case 'no-speech':
        showNotification('⚠️ Aucun son détecté. Parlez plus fort ou vérifiez votre micro.', 'error');
        break;
      case 'audio-capture':
        showNotification('⚠️ Erreur de capture audio. Vérifiez que votre micro est bien branché.', 'error');
        break;
      case 'network':
        showNotification('⚠️ Erreur réseau. Vérifiez votre connexion internet.', 'error');
        break;
      default:
        showNotification(`⚠️ Erreur de reconnaissance vocale : ${event.error}`, 'error');
    }
    
    recordingStudentInfo = false;
    recordingResponse = false;
  };

  recognition.onend = () => {
    // Redémarrer automatiquement si on est en cours d'enregistrement
    if (recordingResponse || recordingStudentInfo) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Impossible de redémarrer la reconnaissance:', e);
      }
    }
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

  if (!recognitionInitialized) {
    showNotification('⚠️ Reconnaissance vocale non initialisée', 'error');
    return;
  }

  recordingResponse = true;
  try {
    recognition.start();
    document.getElementById('recordingIndicator').style.display = 'block';
  } catch (error) {
    console.error('Erreur au démarrage de la reconnaissance:', error);
    // La reconnaissance est peut-être déjà active
    if (error.name === 'InvalidStateError') {
      console.log('Reconnaissance déjà active');
    } else {
      showNotification('⚠️ Impossible de démarrer l\'enregistrement', 'error');
    }
  }
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
      
      // Démarrer automatiquement l'enregistrement après la question
      if (microphonePermissionGranted) {
        setTimeout(() => {
          startRecordingResponse();
        }, 500); // Petit délai pour éviter de capturer la fin de la synthèse
      } else {
        showNotification('⚠️ Cliquez sur le bouton micro pour répondre', 'info');
      }
    };
    synthesis.speak(utterance);
  } else {
    console.error('Synthesis speaking or no question available');
  }
}

function navigateQuestion(direction) {
  // Arrêter toute reconnaissance en cours
  if (recognition && (recordingResponse || recordingStudentInfo)) {
    try {
      recognition.stop();
    } catch (e) {
      console.error('Erreur lors de l\'arrêt de la reconnaissance:', e);
    }
    recordingResponse = false;
    recordingStudentInfo = false;
    document.getElementById('recordingIndicator').style.display = 'none';
  }

  currentQuestion += direction;
  if (currentQuestion < 0) currentQuestion = 0;
  if (currentQuestion >= questions.length) currentQuestion = questions.length - 1;
  
  document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
  document.getElementById('nextQuestion').disabled = (currentQuestion === questions.length - 1);
  document.getElementById('responseInput').value = responses[currentQuestion] || '';
  
  // Mettre à jour la barre de progression à chaque changement de question
  if (typeof updateProgressBar === 'function') {
    updateProgressBar();
  }
  
  askQuestion(currentQuestion);
}

function exportResponses() {
  const studentInfo = document.getElementById('studentName').value;
  if (!studentInfo) {
    showNotification('⚠️ Veuillez renseigner votre identité avant d\'exporter', 'error');
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(16);
    doc.text('Évaluation - Réponses', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Élève : ${studentInfo}`, 10, 25);
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 10, 32);
    
    // Questions et réponses
    let yPosition = 45;
    const lineHeight = 7;
    const maxWidth = 190;
    
    questions.forEach((q, i) => {
      // Vérifier si on a besoin d'une nouvelle page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Question
      doc.setFont(undefined, 'bold');
      const questionLines = doc.splitTextToSize(`Q${i + 1}: ${q}`, maxWidth);
      doc.text(questionLines, 10, yPosition);
      yPosition += questionLines.length * lineHeight;
      
      // Réponse
      doc.setFont(undefined, 'normal');
      const response = responses[i] || 'Pas de réponse.';
      const responseLines = doc.splitTextToSize(`Réponse : ${response}`, maxWidth);
      doc.text(responseLines, 10, yPosition);
      yPosition += responseLines.length * lineHeight + 5;
    });
    
    doc.save(`evaluation_${studentInfo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`);
    showNotification('✅ Réponses exportées avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    showNotification('❌ Erreur lors de l\'export du PDF', 'error');
  }
}

function adjustSpeechRate(delta) {
  speechRate = Math.max(0.5, Math.min(2.0, speechRate + delta));
  document.getElementById('speedDisplay').textContent = speechRate.toFixed(1) + 'x';
}

function startEvaluation() {
  if (!synthesis) {
    showNotification('❌ Synthèse vocale non disponible', 'error');
    return;
  }
  
  if (!recognitionInitialized) {
    showNotification('❌ Reconnaissance vocale non disponible', 'error');
    return;
  }
  
  if (questions.length === 0) {
    showNotification('❌ Aucune question trouvée', 'error');
    return;
  }

  console.log('Starting evaluation...');
  
  // Mettre à jour la barre de progression au démarrage
  if (typeof updateProgressBar === 'function') {
    updateProgressBar();
  }
  
  askQuestion(currentQuestion);
  
  const startBtn = document.getElementById('startEval');
  if (startBtn) startBtn.disabled = true;
  
  document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
  document.getElementById('nextQuestion').disabled = (questions.length === 1);
  document.getElementById('exportResponses').disabled = false;
  
  showNotification('✅ Évaluation démarrée', 'success');
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
  // Vérifier le support des APIs
  if (!('speechSynthesis' in window)) {
    showNotification('❌ Synthèse vocale non supportée par ce navigateur', 'error');
    return;
  }
  
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    showNotification('❌ Reconnaissance vocale non supportée par ce navigateur', 'error');
    return;
  }

  // Initialiser la reconnaissance vocale
  initializeRecognition();
  
  // Demander la permission du micro immédiatement
  await requestMicrophonePermission();
  
  // Event listeners
  const recordStudentInfoBtn = document.getElementById('recordStudentInfo');
  if (recordStudentInfoBtn) {
    recordStudentInfoBtn.addEventListener('click', () => {
      if (!microphonePermissionGranted) {
        showNotification('⚠️ Veuillez d\'abord autoriser l\'accès au microphone', 'error');
        requestMicrophonePermission();
        return;
      }
      
      recordingStudentInfo = true;
      try {
        recognition.start();
        document.getElementById('recordingIndicator').style.display = 'block';
        showNotification('🎤 Parlez maintenant...', 'info');
      } catch (error) {
        console.error('Erreur au démarrage:', error);
        if (error.name === 'InvalidStateError') {
          // Reconnaissance déjà active, on la stoppe et on la redémarre
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
      // Mettre à jour la barre de progression lors de la saisie
      if (typeof updateProgressBar === 'function') {
        updateProgressBar();
      }
    });
  }
});
