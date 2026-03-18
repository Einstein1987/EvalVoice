/**
 * EvalVoice - Application d'aide à l'évaluation
 * Version 2.0 - Refactorée avec classe et améliorations
 */

class EvalVoiceApp {
  constructor() {
    // État de l'application
    this.questions = [];
    this.currentQuestion = 0;
    this.responses = [];

    this.evaluationTitle = 'Évaluation';  
    
    // Services vocaux
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.currentUtterance = null;
    
    // États d'enregistrement
    this.recordingStudentInfo = false;
    this.recordingResponse = false;
    
    // Configuration
    this.speechRate = 1.0;
    this.microphonePermissionGranted = false;
    this.recognitionInitialized = false;
    this.hasUnsavedWork = false;
    
    // Tentatives de redémarrage de la reconnaissance
    this.restartAttempts = 0;
    this.MAX_RESTART_ATTEMPTS = 3;
    
    // Référence au state manager si disponible
    this.stateManager = window.evalState || null;
  }

  /**
   * Initialisation de l'application
   */
  async init() {
    console.log('🚀 Initialisation EvalVoice...');
    
    // Vérifier le support des APIs
    if (!this.checkBrowserSupport()) {
      return false;
    }

    // Initialiser la reconnaissance vocale
    this.initializeRecognition();
    
    // Configurer les event listeners
    this.setupEventListeners();
    
    // Configurer la confirmation avant quitter
    this.setupBeforeUnloadWarning();
    
    // Demander la permission du micro
    await this.requestMicrophonePermission();
    
    console.log('✅ EvalVoice initialisée');
    return true;
  }

  /**
   * Vérifier le support du navigateur
   */
  checkBrowserSupport() {
    if (!('speechSynthesis' in window)) {
      this.showNotification('❌ Synthèse vocale non supportée par ce navigateur', 'error');
      return false;
    }
    
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      this.showNotification('❌ Reconnaissance vocale non supportée par ce navigateur', 'error');
      return false;
    }
    
    return true;
  }

  /**
   * Configurer les event listeners
   */
  setupEventListeners() {
    // Bouton enregistrement infos élève
    const recordStudentBtn = document.getElementById('recordStudentInfo');
    if (recordStudentBtn) {
      recordStudentBtn.addEventListener('click', () => this.startRecordingStudentInfo());
    }

    // Input de réponse
    const responseInput = document.getElementById('responseInput');
    if (responseInput) {
      responseInput.addEventListener('input', (e) => this.handleResponseInput(e));
    }

    // Navigation
    const prevBtn = document.getElementById('prevQuestion');
    const nextBtn = document.getElementById('nextQuestion');
    if (prevBtn) prevBtn.addEventListener('click', () => this.navigateQuestion(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this.navigateQuestion(1));

    // Export
    const exportBtn = document.getElementById('exportResponses');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportResponses());

    // Contrôles de vitesse
    const speedDown = document.getElementById('speedDown');
    const speedUp = document.getElementById('speedUp');
    if (speedDown) speedDown.addEventListener('click', () => this.adjustSpeechRate(-0.1));
    if (speedUp) speedUp.addEventListener('click', () => this.adjustSpeechRate(0.1));

    // Bouton Stop (nouveau)
    const stopBtn = document.getElementById('stopSpeech');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopSpeech());
    }

    // Bouton rejouer question (nouveau)
    const replayBtn = document.getElementById('replayQuestion');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => this.replayCurrentQuestion());
    }

    // Raccourcis clavier
    this.setupKeyboardShortcuts();
  }

  /**
   * Configurer les raccourcis clavier
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt + Flèches pour navigation
      if (e.altKey) {
        switch(e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (!document.getElementById('prevQuestion')?.disabled) {
              this.navigateQuestion(-1);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (!document.getElementById('nextQuestion')?.disabled) {
              this.navigateQuestion(1);
            }
            break;
        }
      }

      // Ctrl/Cmd + Flèches pour navigation (alternative)
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (!document.getElementById('prevQuestion')?.disabled) {
              this.navigateQuestion(-1);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (!document.getElementById('nextQuestion')?.disabled) {
              this.navigateQuestion(1);
            }
            break;
        }
      }

      // Échap pour arrêter
      if (e.key === 'Escape') {
        this.stopSpeech();
        this.stopRecording();
      }

      // Espace pour rejouer (si pas dans un input)
      if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        this.replayCurrentQuestion();
      }
    });
  }

  /**
   * Configurer l'avertissement avant quitter
   */
  setupBeforeUnloadWarning() {
    window.addEventListener('beforeunload', (e) => {
      // Sauvegarder l'état si le state manager existe
      if (this.stateManager) {
        this.stateManager.saveState();
      }
      
      // Avertir si du travail non sauvegardé existe
      if (this.hasUnsavedWork) {
        e.preventDefault();
        e.returnValue = 'Vous avez des réponses non exportées. Êtes-vous sûr de vouloir quitter ?';
        return e.returnValue;
      }
    });
  }

  /**
   * Demander la permission du microphone
   */
  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.microphonePermissionGranted = true;
      console.log('✅ Permission microphone accordée');
      
      this.showNotification('✅ Microphone prêt', 'success');
      
      // Activer le bouton d'enregistrement
      const recordBtn = document.getElementById('recordStudentInfo');
      if (recordBtn) {
        recordBtn.disabled = false;
        recordBtn.style.opacity = '1';
      }
      
      return true;
    } catch (error) {
      console.error('❌ Permission microphone refusée:', error);
      this.microphonePermissionGranted = false;
      this.showNotification('⚠️ Permission microphone refusée. Cliquez sur "Activer le micro" pour réessayer.', 'error');
      this.showMicrophoneActivationButton();
      return false;
    }
  }

  /**
   * Afficher un bouton pour activer le micro
   */
  showMicrophoneActivationButton() {
    const container = document.querySelector('.input-group');
    if (container && !document.getElementById('activateMicBtn')) {
      const activateBtn = document.createElement('button');
      activateBtn.id = 'activateMicBtn';
      activateBtn.textContent = '🎤 Activer le micro';
      activateBtn.style.backgroundColor = '#e74c3c';
      activateBtn.onclick = async () => {
        const granted = await this.requestMicrophonePermission();
        if (granted) {
          activateBtn.remove();
        }
      };
      container.insertBefore(activateBtn, container.firstChild);
    }
  }

  /**
   * Initialiser la reconnaissance vocale
   */
  initializeRecognition() {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      this.showNotification('❌ Votre navigateur ne supporte pas la reconnaissance vocale', 'error');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'fr-FR';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => this.handleRecognitionResult(event);
    this.recognition.onerror = (event) => this.handleRecognitionError(event);
    this.recognition.onend = () => this.handleRecognitionEnd();

    this.recognitionInitialized = true;
    console.log('✅ Reconnaissance vocale initialisée');
    return true;
  }

  /**
   * Gérer les résultats de reconnaissance
   */
  handleRecognitionResult(event) {
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
      if (this.recordingStudentInfo) {
        document.getElementById('studentName').value = finalTranscript;
        this.recordingStudentInfo = false;
        document.getElementById('recordingIndicator').style.display = 'none';
        this.showNotification('✅ Informations élève enregistrées', 'success');
        
        // Sauvegarder dans le state manager
        if (this.stateManager) {
          this.stateManager.update({ studentName: finalTranscript });
        }
      } else if (this.recordingResponse) {
        document.getElementById('responseInput').value = finalTranscript;
        this.responses[this.currentQuestion] = finalTranscript;
        this.hasUnsavedWork = true;
        this.recordingResponse = false;
        document.getElementById('recordingIndicator').style.display = 'none';
        this.showNotification('✅ Réponse enregistrée', 'success');
        this.updateProgressBar();
        
        // Sauvegarder dans le state manager
        if (this.stateManager) {
          this.stateManager.update({ responses: this.responses });
        }
      }
    } else if (interimTranscript) {
      // Afficher la transcription temporaire
      if (this.recordingStudentInfo) {
        document.getElementById('studentName').value = interimTranscript;
      } else if (this.recordingResponse) {
        document.getElementById('responseInput').value = interimTranscript;
      }
    }
  }

  /**
   * Gérer les erreurs de reconnaissance
   */
  handleRecognitionError(event) {
    console.error('Recognition error:', event.error);
    document.getElementById('recordingIndicator').style.display = 'none';
    
    switch(event.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        this.showNotification('⚠️ Permission microphone refusée. Autorisez l\'accès au micro dans les paramètres du navigateur.', 'error');
        this.showMicrophoneActivationButton();
        break;
      case 'no-speech':
        this.showNotification('⚠️ Aucun son détecté. Parlez plus fort ou vérifiez votre micro.', 'error');
        break;
      case 'audio-capture':
        this.showNotification('⚠️ Erreur de capture audio. Vérifiez que votre micro est bien branché.', 'error');
        break;
      case 'network':
        this.showNotification('⚠️ Erreur réseau. Vérifiez votre connexion internet.', 'error');
        break;
      default:
        this.showNotification(`⚠️ Erreur de reconnaissance vocale : ${event.error}`, 'error');
    }
    
    this.recordingStudentInfo = false;
    this.recordingResponse = false;
    this.restartAttempts = 0;
  }

  /**
   * Gérer la fin de reconnaissance
   */
  handleRecognitionEnd() {
    // Redémarrer automatiquement si on est en cours d'enregistrement (avec limite)
    if ((this.recordingResponse || this.recordingStudentInfo) && 
        this.restartAttempts < this.MAX_RESTART_ATTEMPTS) {
      this.restartAttempts++;
      try {
        setTimeout(() => {
          this.recognition.start();
        }, 100);
      } catch (e) {
        console.error('Impossible de redémarrer la reconnaissance:', e);
        this.restartAttempts = 0;
      }
    } else {
      this.restartAttempts = 0;
    }
  }

  /**
   * Démarrer l'enregistrement des infos élève
   */
  startRecordingStudentInfo() {
    if (!this.microphonePermissionGranted) {
      this.showNotification('⚠️ Veuillez d\'abord autoriser l\'accès au microphone', 'error');
      this.requestMicrophonePermission();
      return;
    }
    
    this.recordingStudentInfo = true;
    this.restartAttempts = 0;
    try {
      this.recognition.start();
      document.getElementById('recordingIndicator').style.display = 'block';
      this.showNotification('🎤 Parlez maintenant...', 'info');
    } catch (error) {
      console.error('Erreur au démarrage:', error);
      if (error.name === 'InvalidStateError') {
        this.recognition.stop();
        setTimeout(() => {
          this.recognition.start();
          document.getElementById('recordingIndicator').style.display = 'block';
        }, 100);
      }
    }
  }

  /**
   * Démarrer l'enregistrement de réponse
   */
  startRecordingResponse() {
    if (!this.microphonePermissionGranted) {
      this.showNotification('⚠️ Veuillez d\'abord autoriser l\'accès au microphone', 'error');
      this.requestMicrophonePermission();
      return;
    }

    if (!this.recognitionInitialized) {
      this.showNotification('⚠️ Reconnaissance vocale non initialisée', 'error');
      return;
    }

    this.recordingResponse = true;
    this.restartAttempts = 0;
    try {
      this.recognition.start();
      document.getElementById('recordingIndicator').style.display = 'block';
    } catch (error) {
      console.error('Erreur au démarrage de la reconnaissance:', error);
      if (error.name === 'InvalidStateError') {
        console.log('Reconnaissance déjà active');
      } else {
        this.showNotification('⚠️ Impossible de démarrer l\'enregistrement', 'error');
      }
    }
  }

  /**
   * Arrêter l'enregistrement
   */
  stopRecording() {
    if (this.recognition && (this.recordingResponse || this.recordingStudentInfo)) {
      try {
        this.recognition.stop();
        this.recordingResponse = false;
        this.recordingStudentInfo = false;
        this.restartAttempts = 0;
        document.getElementById('recordingIndicator').style.display = 'none';
        this.showNotification('⏹️ Enregistrement arrêté', 'info');
      } catch (e) {
        console.error('Erreur lors de l\'arrêt de la reconnaissance:', e);
      }
    }
  }

  /**
   * Gérer l'input de réponse
   */
  handleResponseInput(event) {
    this.responses[this.currentQuestion] = event.target.value;
    this.hasUnsavedWork = true;
    this.updateProgressBar();
    
    // Sauvegarder dans le state manager avec debounce
    if (this.stateManager) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.stateManager.update({ responses: this.responses });
      }, 500);
    }
  }

  /**
   * Poser une question (synthèse vocale)
   */
  askQuestion(index) {
    if (!this.questions[index]) {
      console.error('Question non disponible à l\'index', index);
      return;
    }

    // Arrêter toute synthèse en cours
    this.stopSpeech();

    console.log(`Lecture de la question ${index + 1}: ${this.questions[index]}`);
    
    this.currentUtterance = new SpeechSynthesisUtterance(this.questions[index]);
    this.currentUtterance.lang = 'fr-FR';
    this.currentUtterance.rate = this.speechRate;
    
    this.currentUtterance.onstart = () => {
      document.getElementById('questionDisplay').textContent = this.questions[index];
      document.getElementById('synthesisIndicator').style.display = 'block';
      
      // Activer le bouton Stop
      const stopBtn = document.getElementById('stopSpeech');
      if (stopBtn) stopBtn.disabled = false;
    };
    
    this.currentUtterance.onend = () => {
      document.getElementById('synthesisIndicator').style.display = 'none';
      
      // Désactiver le bouton Stop
      const stopBtn = document.getElementById('stopSpeech');
      if (stopBtn) stopBtn.disabled = true;
      
      // Démarrer automatiquement l'enregistrement après la question
      if (this.microphonePermissionGranted) {
        setTimeout(() => {
          this.startRecordingResponse();
        }, 500);
      } else {
        this.showNotification('⚠️ Cliquez sur le bouton micro pour répondre', 'info');
      }
    };
    
    this.synthesis.speak(this.currentUtterance);
  }

  /**
   * Arrêter la synthèse vocale (NOUVEAU)
   */
  stopSpeech() {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
      document.getElementById('synthesisIndicator').style.display = 'none';
      
      const stopBtn = document.getElementById('stopSpeech');
      if (stopBtn) stopBtn.disabled = true;
      
      this.showNotification('⏹️ Lecture arrêtée', 'info');
    }
  }

  /**
   * Rejouer la question courante (NOUVEAU)
   */
  replayCurrentQuestion() {
    this.askQuestion(this.currentQuestion);
  }

  /**
   * Naviguer entre les questions
   */
  navigateQuestion(direction) {
    // Arrêter toute reconnaissance et synthèse en cours
    this.stopRecording();
    this.stopSpeech();

    this.currentQuestion += direction;
    if (this.currentQuestion < 0) this.currentQuestion = 0;
    if (this.currentQuestion >= this.questions.length) {
      this.currentQuestion = this.questions.length - 1;
    }
    
    // Mettre à jour l'interface
    document.getElementById('prevQuestion').disabled = (this.currentQuestion === 0);
    document.getElementById('nextQuestion').disabled = (this.currentQuestion === this.questions.length - 1);
    document.getElementById('responseInput').value = this.responses[this.currentQuestion] || '';
    
    this.updateProgressBar();
    
    // Sauvegarder la position
    if (this.stateManager) {
      this.stateManager.update({ currentQuestion: this.currentQuestion });
    }
    
    // Lire la nouvelle question
    this.askQuestion(this.currentQuestion);
  }

  /**
   * Mettre à jour la barre de progression
   */
  updateProgressBar() {
    const total = this.questions.length;
    const current = this.currentQuestion + 1;
    const answered = this.responses.filter(r => r && r.trim() !== '').length;
    
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (total > 0 && progressContainer && progressFill && progressText) {
      progressContainer.style.display = 'block';
      const percentage = (current / total) * 100;
      progressFill.style.width = percentage + '%';
      progressText.textContent = `Question ${current} sur ${total} | ${answered} réponse${answered > 1 ? 's' : ''} enregistrée${answered > 1 ? 's' : ''}`;
    }
  }

  /**
   * Ajuster la vitesse de lecture
   */
  adjustSpeechRate(delta) {
    this.speechRate = Math.max(0.5, Math.min(2.0, this.speechRate + delta));
    document.getElementById('speedDisplay').textContent = this.speechRate.toFixed(1) + 'x';
    this.showNotification(`Vitesse: ${this.speechRate.toFixed(1)}x`, 'info');
  }
/**
 * Extraire les questions du texte
 * Cette version détecte mieux les différents formats de questions
 */
extractQuestions(textContent) {
  // Nettoyer le texte
  textContent = textContent.replace(/\s\s+/g, ' ').trim();
  console.log("📄 Texte nettoyé:", textContent.substring(0, 200) + "...");
  
  let questionsArray = [];
  
  // 🎯 PATTERNS AMÉLIORÉS - Dans l'ordre de priorité
  const patterns = [
    {
      name: 'Question numérotée classique',
      regex: /Question\s+(\d+)\s*[:\-\)\.]/gi,
      priority: 1
    },
    {
      name: 'Q + numéro',
      regex: /\bQ(\d+)\s*[:\-\)\.]/gi,
      priority: 2
    },
    {
      name: 'Numéro avec parenthèse (PDFs sans sauts de ligne)',
      regex: /(?:^|\n|\.\s+|[?!]\s+|;\s+)\b(\d+)\s*\)\s+(?=[A-ZÀ-Ú])/gm,
      priority: 3
    },
    {
      name: 'Numéro en début de ligne',
      regex: /(?:^|\n)\s*(\d+)\s*[\)\.\-:]\s+(?=[A-ZÀ-Ú])/gm,
      priority: 4
    },
    {
      name: 'Numéro suivi de point',
      regex: /\b(\d+)\.\s+(?=[A-ZÀ-Ú][a-zà-ú])/g,
      priority: 5
    }
  ];

  // Essayer chaque pattern dans l'ordre de priorité
  for (const patternObj of patterns) {
    const matches = [...textContent.matchAll(patternObj.regex)];
    
    if (matches.length > 1) { // Au moins 2 questions trouvées
      console.log(`✅ Pattern "${patternObj.name}" trouvé: ${matches.length} correspondances`);
      
      matches.forEach((match, idx) => {
        const startIndex = match.index;
        const endIndex = idx < matches.length - 1 ? matches[idx + 1].index : textContent.length;
        
        // Extraire le texte de la question
        let questionText = textContent.substring(startIndex, endIndex).trim();
        
        // Nettoyer les espaces multiples et sauts de ligne excessifs
        questionText = questionText.replace(/\n\s*\n/g, '\n').replace(/\s+/g, ' ');
        
        questionsArray.push({
          number: idx + 1,
          text: questionText
        });
      });
      
      // Si on a trouvé des questions, on arrête
      if (questionsArray.length > 1) {
        console.log(`🎯 ${questionsArray.length} questions extraites avec le pattern "${patternObj.name}"`);
        break;
      } else {
        // Réinitialiser si moins de 2 questions
        questionsArray = [];
      }
    }
  }

  // 🔍 Si aucun pattern n'a fonctionné, essayer une approche alternative
  if (questionsArray.length === 0) {
    console.warn('⚠️ Aucun pattern standard trouvé, essai de découpage intelligent...');
    
    // Essayer de découper sur les doubles sauts de ligne
    const paragraphs = textContent.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    
    if (paragraphs.length > 1) {
      console.log(`📋 Découpage en ${paragraphs.length} paragraphes`);
      questionsArray = paragraphs.map((p, idx) => ({
        number: idx + 1,
        text: p.trim()
      }));
    } else {
      // Essayer de découper sur les sauts de ligne simples avec numéros
      const lines = textContent.split('\n').filter(l => l.trim().length > 10);
      
      if (lines.length > 1) {
        console.log(`📝 Découpage en ${lines.length} lignes`);
        questionsArray = lines.map((l, idx) => ({
          number: idx + 1,
          text: l.trim()
        }));
      } else {
        // Dernier recours : tout mettre dans une seule question
        console.warn('⚠️ Impossible de découper, création d\'une question unique');
        questionsArray = [{
          number: 1,
          text: textContent
        }];
      }
    }
  }

  // Filtrer les questions vides et trop courtes
  questionsArray = questionsArray.filter(q => q.text.length > 10);

  // Mettre à jour l'état
  this.questions = questionsArray.map(q => q.text);
  this.responses = new Array(this.questions.length).fill('');
  
  console.log(`✅ ${this.questions.length} question(s) finale(s) extraite(s)`);
  console.log("📝 Questions:", this.questions.map((q, i) => `Q${i+1}: ${q.substring(0, 50)}...`));

  // Sauvegarder dans le state manager
  if (this.stateManager) {
    this.stateManager.update({
      questions: this.questions,
      responses: this.responses
    });
  }

  return this.questions.length > 0;
}

  /**
   * Démarrer l'évaluation
   */
  startEvaluation() {
    if (!this.synthesis) {
      this.showNotification('❌ Synthèse vocale non disponible', 'error');
      return;
    }
    
    if (!this.recognitionInitialized) {
      this.showNotification('❌ Reconnaissance vocale non disponible', 'error');
      return;
    }
    
    if (this.questions.length === 0) {
      this.showNotification('❌ Aucune question trouvée', 'error');
      return;
    }

    console.log('▶️ Démarrage de l\'évaluation...');
    
    this.updateProgressBar();
    this.askQuestion(this.currentQuestion);
    
    const startBtn = document.getElementById('startEval');
    if (startBtn) startBtn.disabled = true;
    
    document.getElementById('prevQuestion').disabled = (this.currentQuestion === 0);
    document.getElementById('nextQuestion').disabled = (this.questions.length === 1);
    document.getElementById('exportResponses').disabled = false;
    
    // Activer les boutons Stop et Replay
    const stopBtn = document.getElementById('stopSpeech');
    const replayBtn = document.getElementById('replayQuestion');
    if (stopBtn) stopBtn.disabled = false;
    if (replayBtn) replayBtn.disabled = false;
    
    this.hasUnsavedWork = true;
    this.showNotification('✅ Évaluation démarrée', 'success');
  }

  /**
 * Exporter les réponses en PDF avec le titre de l'évaluation
 */
exportResponses() {
  const studentInfo = document.getElementById('studentName').value;
  if (!studentInfo) {
    this.showNotification('⚠️ Veuillez renseigner votre identité avant d\'exporter', 'error');
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // 🆕 TITRE DE L'ÉVALUATION EN HAUT
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    
    // Découper le titre si trop long
    const titleLines = doc.splitTextToSize(this.evaluationTitle || 'Évaluation', 190);
    let yPosition = 15;
    
    titleLines.forEach((line, index) => {
      doc.text(line, 105, yPosition + (index * 8), { align: 'center' });
    });
    
    yPosition += titleLines.length * 8 + 5;
    
    // Ligne de séparation
    doc.setDrawColor(52, 152, 219);
    doc.setLineWidth(0.5);
    doc.line(10, yPosition, 200, yPosition);
    yPosition += 5;
    
    // Informations élève
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Élève : ${studentInfo}`, 10, yPosition);
    yPosition += 7;
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 10, yPosition);
    yPosition += 10;
    
    // Questions et réponses
    const lineHeight = 7;
    const maxWidth = 190;
    
    this.questions.forEach((q, i) => {
      // Vérifier si on a besoin d'une nouvelle page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Question
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      const questionLines = doc.splitTextToSize(`Question ${i + 1} : ${q}`, maxWidth);
      doc.text(questionLines, 10, yPosition);
      yPosition += questionLines.length * lineHeight;
      
      // Réponse
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      const response = this.responses[i] || 'Pas de réponse.';
      const responseLines = doc.splitTextToSize(`Réponse : ${response}`, maxWidth);
      
      // Ajouter une zone colorée pour la réponse
      doc.setFillColor(236, 240, 241);
      doc.rect(8, yPosition - 3, 194, responseLines.length * lineHeight + 2, 'F');
      
      doc.text(responseLines, 10, yPosition);
      yPosition += responseLines.length * lineHeight + 8;
    });
    
    // Pied de page avec le nombre de réponses
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      const answeredCount = this.responses.filter(r => r && r.trim() !== '').length;
      doc.text(
        `Page ${i}/${totalPages} - ${answeredCount}/${this.questions.length} réponses`,
        105, 
        290, 
        { align: 'center' }
      );
    }
    
    // Nom du fichier avec le titre (nettoyé)
    const cleanTitle = this.evaluationTitle
      .replace(/[^a-z0-9àâäéèêëïîôùûüÿæœç\s]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 30);

    const cleanStudent = studentInfo.replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().getTime();
    const filename = `Evaluation_${cleanStudent}_${timestamp}.pdf`;
    
    doc.save(filename);
    
    this.showNotification('✅ Réponses exportées avec succès', 'success');
    
    // Marquer comme sauvegardé
    this.hasUnsavedWork = false;
    
    // Proposer de vider la session après l'export
    setTimeout(() => {
      if (confirm('Export réussi ! Voulez-vous terminer cette évaluation et commencer une nouvelle session ?')) {
        if (this.stateManager) {
          this.stateManager.clearState();
        }
        location.reload();
      }
    }, 1000);
    
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    this.showNotification('❌ Erreur lors de l\'export du PDF', 'error');
  }
}

  /**
   * Afficher une notification
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `message ${type}`;
    notification.textContent = message;
    
    const container = document.querySelector('.left-pane');
    if (container) {
      container.insertBefore(notification, container.firstChild);
      
      setTimeout(() => {
        notification.style.transition = 'opacity 0.5s, transform 0.5s';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 500);
      }, 3000);
    }
  }
}

// Instance globale de l'application
let app = null;

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
  app = new EvalVoiceApp();
  await app.init();
  
  // Exposer globalement pour compatibilité avec le code HTML inline
  window.evalVoiceApp = app;
});
