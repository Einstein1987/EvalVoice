import * as pdfjsLib from '../vendor/pdfjs/pdf.mjs';
import { extractPdfDocument } from './pdf_extractor.mjs';
import { createResponsesPdf, loadPdfFontFiles } from './pdf_export.mjs';
import { detectQuestions } from './question_parser.mjs';
import { createSessionStore } from './session_store.mjs';
import { splitIntoSpeechChunks } from './speech_chunks.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

const MAX_LOCAL_PDF_SIZE = 20 * 1024 * 1024;
const MAX_REMOTE_PDF_SIZE = 4 * 1024 * 1024;
const RECOGNITION_RESTART_LIMIT = 20;

function joinTranscript(...parts) {
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.;:!?])/gu, '$1')
    .trim();
}

function documentIdFromInput(value) {
  const input = String(value ?? '').trim();
  if (/^[\w-]{20,128}$/u.test(input)) return input;

  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;
    return url.pathname.match(/^\/document\/d\/([\w-]{20,128})(?:\/|$)/u)?.[1] ?? null;
  } catch {
    return null;
  }
}

function filenameWithoutExtension(filename) {
  return String(filename ?? '').replace(/\.pdf$/iu, '').trim();
}

function cleanFilenamePart(value, fallback) {
  const cleaned = String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/giu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 45);
  return cleaned || fallback;
}

class EvalVoiceApp {
  constructor() {
    this.questions = [];
    this.responses = [];
    this.currentQuestion = 0;
    this.evaluationTitle = 'Évaluation';
    this.speechRate = 1;
    this.hasUnsavedWork = false;

    this.synthesis = window.speechSynthesis ?? null;
    this.recognition = null;
    this.recognitionSupported = false;
    this.microphonePermissionGranted = false;
    this.recordingKind = null;
    this.recordingQuestionIndex = null;
    this.recordingBaseText = '';
    this.recordingFinalText = '';
    this.userStoppedRecognition = true;
    this.recognitionRestartCount = 0;
    this.recognitionRestartTimer = null;

    this.speechToken = 0;
    this.currentUtterance = null;
    this.previewUrl = null;
    this.loadSequence = 0;
    this.saveTimer = null;
    this.reviewResolver = null;
    this.pdfFontFilesPromise = null;
    this.store = createSessionStore();
    this.elements = {};
  }

  async init() {
    this.cacheElements();
    this.setupEventListeners();
    this.initializeCapabilities();
    this.restoreSession();

    const docUrl = new URLSearchParams(window.location.search).get('doc');
    if (docUrl && this.questions.length === 0) {
      this.elements.urlInput.value = docUrl;
      await this.loadOnlineDocument();
    }

  }

  cacheElements() {
    const ids = [
      'appShell', 'setupSection', 'evaluationSection', 'studentName',
      'recordStudentInfo', 'urlInput', 'loadDocumentButton', 'fileInput',
      'fileNameDisplay', 'loadingIndicator', 'progressContainer', 'progressBar',
      'progressText', 'prevQuestion', 'nextQuestion',
      'questionHeading', 'questionDisplay', 'stopSpeech', 'replayQuestion',
      'responseInput', 'recordResponseButton', 'stopRecordingButton',
      'recordingIndicator', 'synthesisIndicator', 'speedDown', 'speedUp',
      'speedDisplay', 'autoRecord', 'exportResponses', 'newEvaluation',
      'pdfViewer', 'notifications', 'questionReviewDialog', 'reviewReason',
      'reviewText', 'reviewForm', 'reviewCancel'
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Élément d’interface manquant : #${id}`);
      this.elements[id] = element;
    }
  }

  setupEventListeners() {
    const el = this.elements;

    el.loadDocumentButton.addEventListener('click', () => this.loadOnlineDocument());
    el.urlInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.loadOnlineDocument();
    });
    el.fileInput.addEventListener('change', (event) => this.loadLocalFile(event));

    el.studentName.addEventListener('input', () => this.scheduleSave());
    el.recordStudentInfo.addEventListener('click', () => this.startRecording('student'));
    el.responseInput.addEventListener('input', () => this.saveVisibleResponse(true));
    el.recordResponseButton.addEventListener('click', () => this.startRecording('response'));
    el.stopRecordingButton.addEventListener('click', () => this.stopRecording());

    el.prevQuestion.addEventListener('click', () => this.navigateQuestion(-1));
    el.nextQuestion.addEventListener('click', () => this.navigateQuestion(1));
    el.replayQuestion.addEventListener('click', () => this.speakCurrentQuestion());
    el.stopSpeech.addEventListener('click', () => this.stopSpeech());
    el.speedDown.addEventListener('click', () => this.adjustSpeechRate(-0.1));
    el.speedUp.addEventListener('click', () => this.adjustSpeechRate(0.1));
    el.exportResponses.addEventListener('click', () => this.exportResponses());
    el.newEvaluation.addEventListener('click', () => this.resetEvaluation());

    el.reviewForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const questions = this.parseReviewedQuestions(el.reviewText.value);
      if (questions.length === 0) {
        this.showNotification('Saisissez au moins une question.', 'error');
        return;
      }
      this.finishQuestionReview(questions);
    });
    el.reviewCancel.addEventListener('click', () => this.finishQuestionReview(null));
    el.questionReviewDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.finishQuestionReview(null);
    });

    document.addEventListener('keydown', (event) => this.handleKeyboardShortcut(event));
    window.addEventListener('beforeunload', (event) => this.handleBeforeUnload(event));
    window.addEventListener('pagehide', () => this.revokePreviewUrl());
  }

  initializeCapabilities() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognitionSupported = Boolean(Recognition);

    if (this.recognitionSupported) {
      this.recognition = new Recognition();
      this.recognition.lang = 'fr-FR';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.addEventListener('result', (event) =>
        this.handleRecognitionResult(event)
      );
      this.recognition.addEventListener('error', (event) =>
        this.handleRecognitionError(event)
      );
      this.recognition.addEventListener('end', () => this.handleRecognitionEnd());
      this.elements.recordStudentInfo.disabled = false;
    } else {
      this.elements.recordStudentInfo.disabled = true;
      this.elements.recordResponseButton.disabled = true;
      this.elements.autoRecord.disabled = true;
      this.showNotification(
        'La reconnaissance vocale n’est pas disponible : la saisie au clavier reste utilisable.',
        'warning',
        8_000
      );
    }

    if (!this.synthesis) {
      this.elements.replayQuestion.disabled = true;
      this.elements.stopSpeech.disabled = true;
      this.showNotification(
        'La lecture vocale n’est pas disponible dans ce navigateur.',
        'warning',
        8_000
      );
    }
  }

  restoreSession() {
    const saved = this.store.load();
    if (!saved) return;

    const shouldRestore = window.confirm(
      'Une évaluation non terminée existe dans cet onglet. Voulez-vous la reprendre ?'
    );
    if (!shouldRestore) {
      this.store.clear();
      return;
    }

    this.questions = saved.questions;
    this.responses = saved.responses;
    this.currentQuestion = saved.currentQuestion;
    this.evaluationTitle = saved.evaluationTitle;
    this.speechRate = saved.speechRate;
    this.hasUnsavedWork = saved.hasUnsavedWork;
    this.elements.studentName.value = saved.studentName;
    this.elements.speedDisplay.textContent = `${this.speechRate.toFixed(1)}×`;
    this.startEvaluation({ speak: false, restored: true });
    this.showNotification(
      'Session restaurée. L’aperçu du PDF doit être rechargé si nécessaire.',
      'success',
      7_000
    );
  }

  async loadOnlineDocument() {
    const documentId = documentIdFromInput(this.elements.urlInput.value);
    if (!documentId) {
      this.showNotification('Saisissez une URL Google Docs valide.', 'error');
      return;
    }

    this.setLoading(true, 'Téléchargement du document…');
    const loadId = ++this.loadSequence;

    try {
      const response = await fetch('/api/fetch-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId })
      });

      if (!response.ok) throw new Error(await this.readErrorResponse(response));
      const blob = await response.blob();
      if (blob.size > MAX_REMOTE_PDF_SIZE) {
        throw new Error('Le PDF distant dépasse la taille maximale de 4 Mo.');
      }
      if (loadId !== this.loadSequence) return;

      await this.consumePdf(blob, 'Évaluation Google Docs', loadId);
    } catch (error) {
      if (loadId === this.loadSequence) {
        this.showNotification(error.message || 'Impossible de charger le document.', 'error', 8_000);
      }
    } finally {
      if (loadId === this.loadSequence) this.setLoading(false);
    }
  }

  async readErrorResponse(response) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      if (payload?.error) return payload.error;
    }
    const text = await response.text().catch(() => '');
    return text.slice(0, 300) || `Erreur HTTP ${response.status}`;
  }

  async loadLocalFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' || file.name.toLocaleLowerCase('fr-FR').endsWith('.pdf');
    if (!isPdf) {
      this.showNotification('Sélectionnez un fichier PDF.', 'error');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_LOCAL_PDF_SIZE) {
      this.showNotification('Le fichier local dépasse la limite de 20 Mo.', 'error');
      event.target.value = '';
      return;
    }

    this.elements.fileNameDisplay.textContent = `${file.name} — ${(
      file.size / 1024 / 1024
    ).toFixed(1)} Mo`;
    this.setLoading(true, 'Analyse du PDF…');
    const loadId = ++this.loadSequence;

    try {
      await this.consumePdf(file, filenameWithoutExtension(file.name), loadId);
    } catch (error) {
      if (loadId === this.loadSequence) {
        this.showNotification(error.message || 'Impossible d’analyser ce PDF.', 'error', 8_000);
      }
    } finally {
      if (loadId === this.loadSequence) this.setLoading(false);
    }
  }

  async consumePdf(blob, titleHint, loadId) {
    this.revokePreviewUrl();
    this.previewUrl = URL.createObjectURL(blob);
    this.elements.pdfViewer.src = this.previewUrl;

    const data = new Uint8Array(await blob.arrayBuffer());
    const extracted = await extractPdfDocument(data, pdfjsLib);
    if (loadId !== this.loadSequence) return;

    const detection = detectQuestions(extracted.lines);
    const wasReviewed = detection.requiresReview;
    let questions = detection.questions;
    if (detection.requiresReview) {
      questions = await this.requestQuestionReview(detection);
      if (loadId !== this.loadSequence) return;
    }

    if (!questions?.length) {
      this.showNotification(
        'Chargement annulé : aucune question n’a été validée.',
        'warning',
        7_000
      );
      return;
    }

    this.stopRecording({ announce: false, abort: true });
    this.stopSpeech({ announce: false });
    this.questions = questions;
    this.responses = new Array(questions.length).fill('');
    this.currentQuestion = 0;
    const extractedTitleIsQuestion = questions.some((question) =>
      question.startsWith(extracted.title)
    );
    this.evaluationTitle =
      extracted.title &&
      extracted.title !== 'Évaluation' &&
      !extractedTitleIsQuestion
        ? extracted.title
        : titleHint;
    this.hasUnsavedWork = false;
    this.startEvaluation({ speak: true });

    const strategyMessage = wasReviewed
      ? `${questions.length} question${questions.length > 1 ? 's' : ''} confirmée${questions.length > 1 ? 's' : ''} manuellement.`
      : detection.strategy === 'bold-bloom-verb'
      ? `Tâche complexe reconnue grâce au verbe de Bloom « ${detection.bloomVerb} » en gras.`
      : detection.reason;
    this.showNotification(strategyMessage, 'success', 8_000);
  }

  requestQuestionReview(detection) {
    if (this.reviewResolver) this.finishQuestionReview(null);

    this.elements.reviewReason.textContent = detection.reason;
    this.elements.reviewText.value = detection.suggestion || '';
    this.elements.questionReviewDialog.showModal();
    this.elements.reviewText.focus();

    return new Promise((resolve) => {
      this.reviewResolver = resolve;
    });
  }

  finishQuestionReview(value) {
    const resolver = this.reviewResolver;
    this.reviewResolver = null;
    if (this.elements.questionReviewDialog.open) {
      this.elements.questionReviewDialog.close();
    }
    resolver?.(value);
  }

  parseReviewedQuestions(value) {
    return String(value)
      .split(/\n\s*-{3,}\s*\n/gu)
      .map((question) => question.trim())
      .filter((question) => question.length >= 10)
      .slice(0, 200);
  }

  startEvaluation({ speak = false, restored = false } = {}) {
    if (this.questions.length === 0) return;

    this.elements.setupSection.hidden = true;
    this.elements.evaluationSection.hidden = false;
    this.elements.progressContainer.hidden = false;
    this.elements.exportResponses.disabled = false;
    this.elements.newEvaluation.hidden = false;
    this.elements.recordResponseButton.disabled = !this.recognitionSupported;
    this.elements.replayQuestion.disabled = !this.synthesis;
    this.renderCurrentQuestion();
    this.scheduleSave();

    if (speak && !restored && this.synthesis) this.speakCurrentQuestion();
  }

  renderCurrentQuestion() {
    const question = this.questions[this.currentQuestion] ?? '';
    this.elements.questionHeading.textContent =
      `Question ${this.currentQuestion + 1}`;
    this.elements.questionDisplay.textContent = question;
    this.elements.responseInput.value = this.responses[this.currentQuestion] ?? '';
    this.elements.prevQuestion.disabled = this.currentQuestion === 0;
    this.elements.nextQuestion.disabled =
      this.currentQuestion >= this.questions.length - 1;
    this.updateProgress();
  }

  navigateQuestion(direction) {
    const nextIndex = Math.max(
      0,
      Math.min(this.questions.length - 1, this.currentQuestion + direction)
    );
    if (nextIndex === this.currentQuestion) return;

    this.saveVisibleResponse(false);
    this.stopRecording({ announce: false, abort: true });
    this.stopSpeech({ announce: false });
    this.currentQuestion = nextIndex;
    this.renderCurrentQuestion();
    this.scheduleSave();
    if (this.synthesis) this.speakCurrentQuestion();
  }

  saveVisibleResponse(markDirty) {
    if (this.questions.length === 0) return;
    this.responses[this.currentQuestion] = this.elements.responseInput.value;
    if (markDirty) this.hasUnsavedWork = true;
    this.updateProgress();
    this.scheduleSave();
  }

  updateProgress() {
    const total = this.questions.length;
    if (total === 0) return;

    const current = this.currentQuestion + 1;
    const answered = this.responses.filter((response) => response?.trim()).length;
    this.elements.progressBar.value = current;
    this.elements.progressBar.max = total;
    this.elements.progressBar.setAttribute(
      'aria-valuetext',
      `Question ${current} sur ${total}`
    );
    this.elements.progressText.textContent =
      `Question ${current} sur ${total} — ${answered} réponse${answered > 1 ? 's' : ''} renseignée${answered > 1 ? 's' : ''}`;
  }

  adjustSpeechRate(delta) {
    this.speechRate = Math.round(
      Math.max(0.5, Math.min(2, this.speechRate + delta)) * 10
    ) / 10;
    this.elements.speedDisplay.textContent = `${this.speechRate.toFixed(1)}×`;
    this.scheduleSave();
    this.showNotification(`Vitesse de lecture : ${this.speechRate.toFixed(1)}×`, 'info');
  }

  speakCurrentQuestion() {
    if (!this.synthesis || !this.questions[this.currentQuestion]) return;

    this.stopRecording({ announce: false, abort: true });
    this.stopSpeech({ announce: false });
    this.renderCurrentQuestion();

    // La synthèse est découpée en énoncés courts (≤ 200 caractères) : au-delà,
    // Android/ChromeOS tronque ou échoue silencieusement, notamment sur les
    // tâches complexes longues. Les morceaux sont lus les uns après les autres.
    const chunks = splitIntoSpeechChunks(this.questions[this.currentQuestion]);
    if (chunks.length === 0) return;

    const token = ++this.speechToken;

    const finish = () => {
      if (token !== this.speechToken) return;
      this.elements.synthesisIndicator.hidden = true;
      this.elements.stopSpeech.disabled = true;
      this.currentUtterance = null;

      if (this.elements.autoRecord.checked) {
        if (this.microphonePermissionGranted) {
          this.startRecording('response');
        } else {
          this.showNotification(
            'Cliquez une première fois sur « Dicter » pour autoriser le microphone.',
            'info',
            6_000
          );
        }
      }
    };

    const speakChunk = (index) => {
      if (token !== this.speechToken || index >= chunks.length) return;

      const isFirst = index === 0;
      const isLast = index === chunks.length - 1;
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      this.currentUtterance = utterance;
      utterance.lang = 'fr-FR';
      utterance.rate = this.speechRate;

      utterance.addEventListener('start', () => {
        if (token !== this.speechToken || !isFirst) return;
        this.elements.synthesisIndicator.hidden = false;
        this.elements.stopSpeech.disabled = false;
      });
      utterance.addEventListener('end', () => {
        if (token !== this.speechToken) return;
        if (isLast) finish();
        else speakChunk(index + 1);
      });
      utterance.addEventListener('error', () => {
        if (token !== this.speechToken) return;
        this.elements.synthesisIndicator.hidden = true;
        this.elements.stopSpeech.disabled = true;
        this.currentUtterance = null;
      });

      this.synthesis.speak(utterance);
    };

    speakChunk(0);
  }

  stopSpeech({ announce = true } = {}) {
    const wasActive = Boolean(
      this.synthesis && (this.synthesis.speaking || this.synthesis.pending)
    );
    this.speechToken += 1;
    this.currentUtterance = null;
    if (wasActive) this.synthesis.cancel();
    this.elements.synthesisIndicator.hidden = true;
    this.elements.stopSpeech.disabled = true;
    if (announce && wasActive) this.showNotification('Lecture arrêtée.', 'info');
  }

  async ensureMicrophonePermission() {
    if (!this.recognitionSupported) return false;
    if (this.microphonePermissionGranted) return true;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.showNotification(
        'L’accès au microphone nécessite HTTPS et un navigateur compatible.',
        'error',
        8_000
      );
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.microphonePermissionGranted = true;
      return true;
    } catch {
      this.showNotification(
        'Microphone refusé. Autorisez-le dans les réglages du navigateur ou utilisez le clavier.',
        'error',
        9_000
      );
      return false;
    }
  }

  async startRecording(kind) {
    if (!['student', 'response'].includes(kind)) return;
    if (!(await this.ensureMicrophonePermission())) return;

    this.stopSpeech({ announce: false });
    if (this.recordingKind) {
      this.stopRecording({ announce: false, abort: true });
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }

    this.recordingKind = kind;
    this.recordingQuestionIndex = kind === 'response' ? this.currentQuestion : null;
    this.recordingBaseText =
      kind === 'response'
        ? this.responses[this.recordingQuestionIndex]?.trim() ?? ''
        : '';
    this.recordingFinalText = '';
    this.userStoppedRecognition = false;
    this.recognitionRestartCount = 0;
    this.updateRecordingControls(true);

    try {
      this.recognition.start();
      this.showNotification(
        kind === 'response'
          ? 'Dictée démarrée. Utilisez « Arrêter la dictée » quand la réponse est terminée.'
          : 'Dictez le prénom, le nom et la classe.',
        'info',
        6_000
      );
    } catch (error) {
      this.userStoppedRecognition = true;
      this.recordingKind = null;
      this.updateRecordingControls(false);
      this.showNotification(
        error.name === 'InvalidStateError'
          ? 'Le microphone est déjà actif.'
          : 'Impossible de démarrer la dictée.',
        'error'
      );
    }
  }

  handleRecognitionResult(event) {
    if (!this.recordingKind) return;

    let interim = '';
    let final = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript ?? '';
      if (event.results[index].isFinal) final = joinTranscript(final, transcript);
      else interim = joinTranscript(interim, transcript);
    }

    if (final) this.recordingFinalText = joinTranscript(this.recordingFinalText, final);
    const visibleText = joinTranscript(
      this.recordingBaseText,
      this.recordingFinalText,
      interim
    );

    if (this.recordingKind === 'student') {
      this.elements.studentName.value = visibleText;
      if (final) {
        this.scheduleSave();
        this.stopRecording({ announce: true });
      }
      return;
    }

    const questionIndex = this.recordingQuestionIndex;
    if (!Number.isInteger(questionIndex)) return;
    this.responses[questionIndex] = joinTranscript(
      this.recordingBaseText,
      this.recordingFinalText
    );
    if (questionIndex === this.currentQuestion) {
      this.elements.responseInput.value = visibleText;
    }
    if (final) {
      this.hasUnsavedWork = true;
      this.updateProgress();
      this.scheduleSave();
    }
  }

  handleRecognitionError(event) {
    if (event.error === 'aborted' && this.userStoppedRecognition) return;
    if (event.error === 'no-speech') return;

    const messages = {
      'not-allowed': 'Permission microphone refusée.',
      'service-not-allowed': 'Service de reconnaissance vocale indisponible.',
      'audio-capture': 'Aucun microphone utilisable n’a été trouvé.',
      network: 'Erreur réseau pendant la reconnaissance vocale.'
    };
    this.showNotification(
      messages[event.error] ?? `Erreur de reconnaissance vocale : ${event.error}`,
      'error',
      8_000
    );

    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(event.error)) {
      this.userStoppedRecognition = true;
    }
  }

  handleRecognitionEnd() {
    if (this.userStoppedRecognition || !this.recordingKind) {
      this.recordingKind = null;
      this.recordingQuestionIndex = null;
      this.updateRecordingControls(false);
      this.scheduleSave();
      return;
    }

    if (this.recognitionRestartCount >= RECOGNITION_RESTART_LIMIT) {
      this.userStoppedRecognition = true;
      this.recordingKind = null;
      this.recordingQuestionIndex = null;
      this.updateRecordingControls(false);
      this.showNotification(
        'La dictée a atteint sa durée maximale. Relancez-la pour continuer.',
        'warning',
        7_000
      );
      return;
    }

    this.recognitionRestartCount += 1;
    this.recognitionRestartTimer = window.setTimeout(() => {
      if (this.userStoppedRecognition || !this.recordingKind) return;
      try {
        this.recognition.start();
      } catch {
        this.userStoppedRecognition = true;
        this.recordingKind = null;
        this.recordingQuestionIndex = null;
        this.updateRecordingControls(false);
      }
    }, 250);
  }

  stopRecording({ announce = true, abort = false } = {}) {
    const wasRecording = Boolean(this.recordingKind);
    this.userStoppedRecognition = true;
    window.clearTimeout(this.recognitionRestartTimer);

    if (wasRecording && this.recognition) {
      try {
        if (abort) this.recognition.abort();
        else this.recognition.stop();
      } catch {
        // L'API peut déjà être arrêtée : l'état local reste la source de vérité.
      }
    }

    if (abort) {
      this.recordingKind = null;
      this.recordingQuestionIndex = null;
    }
    this.updateRecordingControls(false);
    this.scheduleSave();
    if (announce && wasRecording) this.showNotification('Dictée arrêtée.', 'info');
  }

  updateRecordingControls(active) {
    this.elements.recordingIndicator.hidden = !active;
    this.elements.stopRecordingButton.hidden = !active;
    this.elements.recordResponseButton.disabled =
      active || !this.recognitionSupported || this.questions.length === 0;
    this.elements.recordStudentInfo.disabled = active || !this.recognitionSupported;
  }

  captureState() {
    return {
      evaluationTitle: this.evaluationTitle,
      questions: this.questions,
      responses: this.responses,
      currentQuestion: this.currentQuestion,
      studentName: this.elements.studentName.value,
      speechRate: this.speechRate,
      hasUnsavedWork: this.hasUnsavedWork
    };
  }

  scheduleSave() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      if (this.questions.length > 0) this.store.save(this.captureState());
    }, 250);
  }

  handleBeforeUnload(event) {
    if (this.questions.length > 0) this.store.save(this.captureState());
    if (!this.hasUnsavedWork) return;
    event.preventDefault();
    event.returnValue = '';
  }

  handleKeyboardShortcut(event) {
    if (event.key === 'Escape') {
      this.stopSpeech({ announce: false });
      this.stopRecording({ announce: false, abort: true });
      return;
    }

    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!this.elements.prevQuestion.disabled) this.navigateQuestion(-1);
    } else if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      if (!this.elements.nextQuestion.disabled) this.navigateQuestion(1);
    } else if (
      event.code === 'Space' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(event.target.tagName)
    ) {
      event.preventDefault();
      this.speakCurrentQuestion();
    }
  }

  async getPdfFontFiles() {
    if (!this.pdfFontFilesPromise) {
      this.pdfFontFilesPromise = loadPdfFontFiles().catch((error) => {
        this.pdfFontFilesPromise = null;
        throw error;
      });
    }
    return this.pdfFontFilesPromise;
  }

  async exportResponses() {
    this.saveVisibleResponse(false);
    this.stopRecording({ announce: false, abort: true });
    const studentName = this.elements.studentName.value.trim();
    if (!studentName) {
      this.showNotification('Renseignez le prénom, le nom et la classe avant l’export.', 'error');
      this.elements.studentName.focus();
      return;
    }
    if (!window.jspdf?.jsPDF) {
      this.showNotification('Le module d’export PDF n’est pas disponible.', 'error');
      return;
    }

    const exportState = {
      evaluationTitle: this.evaluationTitle,
      studentName,
      questions: [...this.questions],
      responses: [...this.responses]
    };
    this.elements.exportResponses.disabled = true;

    try {
      const { jsPDF } = window.jspdf;
      const fontFiles = await this.getPdfFontFiles();
      const doc = createResponsesPdf({
        jsPDF,
        fontFiles,
        ...exportState
      });

      const filename = [
        'Evaluation',
        cleanFilenamePart(exportState.evaluationTitle, 'Sujet'),
        cleanFilenamePart(studentName, 'Eleve')
      ].join('_');
      doc.save(`${filename}.pdf`);
      this.hasUnsavedWork = false;
      this.scheduleSave();
      this.showNotification('Les réponses ont été exportées en PDF.', 'success');
    } catch (error) {
      console.error(error);
      this.showNotification(
        error.message || 'L’export PDF a échoué.',
        'error'
      );
    } finally {
      this.elements.exportResponses.disabled = this.questions.length === 0;
    }
  }

  resetEvaluation() {
    if (
      this.hasUnsavedWork &&
      !window.confirm('Les réponses non exportées seront effacées. Continuer ?')
    ) {
      return;
    }

    this.loadSequence += 1;
    this.stopRecording({ announce: false, abort: true });
    this.stopSpeech({ announce: false });
    this.revokePreviewUrl();
    this.store.clear();
    this.questions = [];
    this.responses = [];
    this.currentQuestion = 0;
    this.evaluationTitle = 'Évaluation';
    this.hasUnsavedWork = false;
    this.elements.studentName.value = '';
    this.elements.responseInput.value = '';
    this.elements.urlInput.value = '';
    this.elements.fileInput.value = '';
    this.elements.fileNameDisplay.textContent = '';
    this.elements.pdfViewer.removeAttribute('src');
    this.elements.setupSection.hidden = false;
    this.elements.evaluationSection.hidden = true;
    this.elements.progressContainer.hidden = true;
    this.elements.newEvaluation.hidden = true;
    this.elements.exportResponses.disabled = true;
    window.history.replaceState({}, '', window.location.pathname);
    this.elements.urlInput.focus();
  }

  revokePreviewUrl() {
    if (!this.previewUrl) return;
    URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }

  setLoading(isLoading, text = '') {
    this.elements.appShell.setAttribute('aria-busy', String(isLoading));
    this.elements.loadingIndicator.hidden = !isLoading;
    this.elements.loadingIndicator.textContent = text;
    this.elements.loadDocumentButton.disabled = isLoading;
    this.elements.fileInput.disabled = isLoading;
  }

  showNotification(message, type = 'info', duration = 4_500) {
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notification.textContent = message;
    this.elements.notifications.append(notification);

    while (this.elements.notifications.children.length > 3) {
      this.elements.notifications.firstElementChild?.remove();
    }
    window.setTimeout(() => notification.remove(), duration);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new EvalVoiceApp();
  app.init().catch((error) => {
    console.error(error);
    const notifications = document.getElementById('notifications');
    if (notifications) {
      notifications.textContent =
        'EvalVoice n’a pas pu démarrer. Rechargez la page ou contactez l’administrateur.';
    }
  });
});

export { EvalVoiceApp, documentIdFromInput, joinTranscript };
