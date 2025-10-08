// Module de gestion d'état avec sauvegarde automatique
// Ajouter à evalvoice.js

class EvalState {
  constructor() {
    this.storageKey = 'evalvoice_state';
    this.autoSaveInterval = null;
    this.state = this.loadState();
  }

  // Charger l'état depuis sessionStorage
  loadState() {
    try {
      const saved = sessionStorage.getItem(this.storageKey);
      if (saved) {
        const state = JSON.parse(saved);
        console.log('✅ État restauré depuis la session');
        return state;
      }
    } catch (e) {
      console.error('❌ Erreur lors du chargement de l\'état:', e);
    }
    
    return {
      studentName: '',
      questions: [],
      responses: [],
      currentQuestion: 0,
      documentUrl: '',
      timestamp: Date.now()
    };
  }

  // Sauvegarder l'état dans sessionStorage
  saveState() {
    try {
      this.state.timestamp = Date.now();
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.state));
      console.log('💾 État sauvegardé');
    } catch (e) {
      console.error('❌ Erreur lors de la sauvegarde:', e);
      // Si sessionStorage est plein, nettoyer les anciennes données
      if (e.name === 'QuotaExceededError') {
        this.clearState();
        console.warn('⚠️ Stockage plein, état réinitialisé');
      }
    }
  }

  // Démarrer la sauvegarde automatique
  startAutoSave(intervalMs = 5000) {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, intervalMs);
    
    console.log(`✅ Sauvegarde automatique activée (toutes les ${intervalMs/1000}s)`);
  }

  // Arrêter la sauvegarde automatique
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      console.log('⏸️ Sauvegarde automatique désactivée');
    }
  }

  // Mettre à jour l'état
  update(updates) {
    this.state = { ...this.state, ...updates };
    this.saveState();
  }

  // Récupérer l'état
  get() {
    return this.state;
  }

  // Effacer l'état
  clearState() {
    sessionStorage.removeItem(this.storageKey);
    this.state = {
      studentName: '',
      questions: [],
      responses: [],
      currentQuestion: 0,
      documentUrl: '',
      timestamp: Date.now()
    };
    console.log('🗑️ État réinitialisé');
  }

  // Vérifier si une session existe
  hasExistingSession() {
    return this.state.questions.length > 0 || this.state.responses.length > 0;
  }

  // Obtenir le temps écoulé depuis la dernière sauvegarde
  getTimeSinceLastSave() {
    const now = Date.now();
    const elapsed = now - this.state.timestamp;
    return Math.floor(elapsed / 1000); // en secondes
  }

  // Proposer de restaurer la session
  promptRestoreSession() {
    if (!this.hasExistingSession()) {
      return false;
    }

    const timeElapsed = this.getTimeSinceLastSave();
    const minutes = Math.floor(timeElapsed / 60);
    
    const message = `Une session précédente a été trouvée (il y a ${minutes} minute${minutes > 1 ? 's' : ''}).\n\n` +
                    `Questions: ${this.state.questions.length}\n` +
                    `Réponses enregistrées: ${this.state.responses.filter(r => r).length}\n\n` +
                    `Voulez-vous restaurer cette session ?`;
    
    return confirm(message);
  }

  // Restaurer la session
  restoreSession() {
    console.log('🔄 Restauration de la session...');
    
    // Restaurer les questions
    questions = [...this.state.questions];
    responses = [...this.state.responses];
    currentQuestion = this.state.currentQuestion;
    
    // Restaurer le nom de l'élève
    const studentNameInput = document.getElementById('studentName');
    if (studentNameInput && this.state.studentName) {
      studentNameInput.value = this.state.studentName;
    }
    
    // Restaurer l'URL du document
    const urlInput = document.getElementById('urlInput');
    if (urlInput && this.state.documentUrl) {
      urlInput.value = this.state.documentUrl;
    }
    
    console.log(`✅ Session restaurée: ${questions.length} questions, ${responses.filter(r => r).length} réponses`);
    
    return true;
  }
}

// Créer l'instance globale
const evalState = new EvalState();

// Fonction pour initialiser la gestion d'état
function initializeStateManagement() {
  // Vérifier si une session existe
  if (evalState.hasExistingSession()) {
    const shouldRestore = evalState.promptRestoreSession();
    
    if (shouldRestore) {
      evalState.restoreSession();
      
      // Si des questions existent, activer les contrôles
      if (questions.length > 0) {
        document.getElementById('prevQuestion').disabled = false;
        document.getElementById('nextQuestion').disabled = false;
        document.getElementById('exportResponses').disabled = false;
        
        // Afficher la question courante
        updateProgressBar();
        document.getElementById('questionDisplay').textContent = questions[currentQuestion];
        document.getElementById('responseInput').value = responses[currentQuestion] || '';
        
        showNotification('✅ Session restaurée avec succès', 'success');
      }
    } else {
      evalState.clearState();
    }
  }
  
  // Démarrer la sauvegarde automatique
  evalState.startAutoSave(5000); // Toutes les 5 secondes
  
  // Sauvegarder avant de quitter la page
  window.addEventListener('beforeunload', (e) => {
    evalState.saveState();
    
    // Si des réponses non exportées existent, avertir l'utilisateur
    const hasUnsavedWork = responses.some(r => r && r.trim() !== '');
    if (hasUnsavedWork) {
      e.preventDefault();
      e.returnValue = 'Vous avez des réponses non exportées. Êtes-vous sûr de vouloir quitter ?';
      return e.returnValue;
    }
  });
  
  // Écouter les changements pour sauvegarder automatiquement
  document.getElementById('studentName')?.addEventListener('change', (e) => {
    evalState.update({ studentName: e.target.value });
  });
  
  document.getElementById('responseInput')?.addEventListener('input', (e) => {
    const updatedResponses = [...responses];
    updatedResponses[currentQuestion] = e.target.value;
    evalState.update({ responses: updatedResponses });
  });
}

// Modifier la fonction startEvaluation pour sauvegarder l'état
function startEvaluationWithState() {
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
  
  // Sauvegarder l'état initial
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
  
  showNotification('✅ Évaluation démarrée', 'success');
}

// Modifier navigateQuestion pour sauvegarder
function navigateQuestionWithState(direction) {
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
  
  // Sauvegarder la nouvelle position
  evalState.update({ currentQuestion: currentQuestion });
  
  document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
  document.getElementById('nextQuestion').disabled = (currentQuestion === questions.length - 1);
  document.getElementById('responseInput').value = responses[currentQuestion] || '';
  
  askQuestion(currentQuestion);
}

// Export avec confirmation
function exportResponsesWithConfirmation() {
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
    
    const filename = `evaluation_${studentInfo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
    
    showNotification('✅ Réponses exportées avec succès', 'success');
    
    // Proposer de vider la session après l'export
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

// Ajouter un bouton pour réinitialiser la session manuellement
function addResetButton() {
  const container = document.querySelector('.centre');
  if (container && !document.getElementById('resetSessionBtn')) {
    const resetBtn = document.createElement('button');
    resetBtn.id = 'resetSessionBtn';
    resetBtn.textContent = '🔄 Nouvelle évaluation';
    resetBtn.style.backgroundColor = '#e74c3c';
    resetBtn.onclick = () => {
      if (confirm('Êtes-vous sûr de vouloir commencer une nouvelle évaluation ? Les données non exportées seront perdues.')) {
        evalState.clearState();
        location.reload();
      }
    };
    container.appendChild(resetBtn);
  }
}
