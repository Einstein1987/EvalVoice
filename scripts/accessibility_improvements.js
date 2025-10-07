// Module d'amélioration de l'accessibilité
// Ajouter à evalvoice.js

const AccessibilityManager = {
  // Initialiser les améliorations d'accessibilité
  initialize() {
    this.addAriaLabels();
    this.enhanceKeyboardNavigation();
    this.addSkipLinks();
    this.improveFormAccessibility();
    this.addLiveRegions();
    this.addFocusIndicators();
    console.log('♿ Améliorations d\'accessibilité activées');
  },

  // Ajouter des labels ARIA manquants
  addAriaLabels() {
    const elements = [
      { id: 'recordStudentInfo', label: 'Enregistrer vos informations vocalement' },
      { id: 'recordResponseButton', label: 'Enregistrer votre réponse vocalement' },
      { id: 'prevQuestion', label: 'Question précédente' },
      { id: 'nextQuestion', label: 'Question suivante' },
      { id: 'speedDown', label: 'Ralentir la vitesse de lecture' },
      { id: 'speedUp', label: 'Accélérer la vitesse de lecture' },
      { id: 'exportResponses', label: 'Exporter toutes les réponses en PDF' },
      { id: 'loadDocumentButton', label: 'Charger le document d\'évaluation' },
      { id: 'startEval', label: 'Démarrer l\'évaluation' },
      { id: 'pdfViewer', label: 'Aperçu du document PDF' }
    ];

    elements.forEach(({ id, label }) => {
      const element = document.getElementById(id);
      if (element && !element.getAttribute('aria-label')) {
        element.setAttribute('aria-label', label);
      }
    });

    // Ajouter des descriptions supplémentaires
    const questionDisplay = document.getElementById('questionDisplay');
    if (questionDisplay) {
      questionDisplay.setAttribute('role', 'status');
      questionDisplay.setAttribute('aria-live', 'polite');
      questionDisplay.setAttribute('aria-atomic', 'true');
    }
  },

  // Améliorer la navigation au clavier
  enhanceKeyboardNavigation() {
    // Permettre la navigation avec Tab entre les éléments importants
    const focusableElements = [
      'studentName',
      'recordStudentInfo',
      'urlInput',
      'loadDocumentButton',
      'prevQuestion',
      'nextQuestion',
      'responseInput',
      'speedDown',
      'speedUp',
      'exportResponses'
    ];

    focusableElements.forEach((id, index) => {
      const element = document.getElementById(id);
      if (element) {
        element.setAttribute('tabindex', index + 1);
      }
    });

    // Ajouter des raccourcis clavier
    document.addEventListener('keydown', (e) => {
      // Alt + Flèches pour naviguer entre questions
      if (e.altKey) {
        switch(e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            const prevBtn = document.getElementById('prevQuestion');
            if (prevBtn && !prevBtn.disabled) {
              prevBtn.click();
              this.announceToScreenReader('Question précédente');
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            const nextBtn = document.getElementById('nextQuestion');
            if (nextBtn && !nextBtn.disabled) {
              nextBtn.click();
              this.announceToScreenReader('Question suivante');
            }
            break;
        }
      }

      // Alt + R pour enregistrer une réponse vocale
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        const recordBtn = document.getElementById('recordResponseButton') || 
                         document.getElementById('recordStudentInfo');
        if (recordBtn && !recordBtn.disabled) {
          recordBtn.click();
          this.announceToScreenReader('Enregistrement vocal démarré');
        }
      }

      // Alt + E pour exporter
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        const exportBtn = document.getElementById('exportResponses');
        if (exportBtn && !exportBtn.disabled) {
          exportBtn.click();
        }
      }

      // Échap pour arrêter l'enregistrement vocal
      if (e.key === 'Escape') {
        if (recordingResponse || recordingStudentInfo) {
          try {
            recognition.stop();
            recordingResponse = false;
            recordingStudentInfo = false;
            document.getElementById('recordingIndicator').style.display = 'none';
            this.announceToScreenReader('Enregistrement arrêté');
          } catch (err) {
            console.error('Erreur arrêt reconnaissance:', err);
          }
        }
      }
    });

    // Afficher les raccourcis disponibles
    this.displayKeyboardShortcuts();
  },

  // Afficher un panneau d'aide des raccourcis clavier
  displayKeyboardShortcuts() {
    const helpButton = document.createElement('button');
    helpButton.id = 'keyboardHelpButton';
    helpButton.innerHTML = '⌨️';
    helpButton.title = 'Afficher les raccourcis clavier';
    helpButton.setAttribute('aria-label', 'Afficher l\'aide des raccourcis clavier');
    helpButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #9b59b6, #8e44ad);
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      z-index: 1000;
      transition: transform 0.3s;
    `;
    
    helpButton.addEventListener('click', () => {
      this.showKeyboardHelp();
    });
    
    helpButton.addEventListener('mouseenter', () => {
      helpButton.style.transform = 'scale(1.1)';
    });
    
    helpButton.addEventListener('mouseleave', () => {
      helpButton.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(helpButton);
  },

  // Afficher l'aide des raccourcis
  showKeyboardHelp() {
    const existingHelp = document.getElementById('keyboardHelpModal');
    if (existingHelp) {
      existingHelp.remove();
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'keyboardHelpModal';
    modal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      " role="dialog" aria-labelledby="helpTitle" aria-modal="true">
        <div style="
          background: white;
          padding: 30px;
          border-radius: 15px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        ">
          <h2 id="helpTitle" style="margin-top: 0; color: #2c3e50;">⌨️ Raccourcis clavier</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 2px solid #ecf0f1;">
              <th style="padding: 10px; text-align: left;">Raccourci</th>
              <th style="padding: 10px; text-align: left;">Action</th>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px;"><kbd>Alt</kbd> + <kbd>←</kbd></td>
              <td style="padding: 10px;">Question précédente</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px;"><kbd>Alt</kbd> + <kbd>→</kbd></td>
              <td style="padding: 10px;">Question suivante</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px;"><kbd>Alt</kbd> + <kbd>R</kbd></td>
              <td style="padding: 10px;">Enregistrer une réponse vocale</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px;"><kbd>Alt</kbd> + <kbd>E</kbd></td>
              <td style="padding: 10px;">Exporter les réponses</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px;"><kbd>Échap</kbd></td>
              <td style="padding: 10px;">Arrêter l'enregistrement vocal</td>
            </tr>
            <tr>
              <td style="padding: 10px;"><kbd>Tab</kbd></td>
              <td style="padding: 10px;">Naviguer entre les champs</td>
            </tr>
          </table>
          <button onclick="document.getElementById('keyboardHelpModal').remove()" style="
            margin-top: 20px;
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            width: 100%;
          " aria-label="Fermer l'aide">
            Fermer
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Permettre de fermer avec Échap
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeOnEscape);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    
    // Focus sur le bouton de fermeture
    setTimeout(() => {
      modal.querySelector('button').focus();
    }, 100);
  },

  // Ajouter des liens de navigation rapide
  addSkipLinks() {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#questionDisplay" class="skip-link">Aller à la question</a>
      <a href="#responseInput" class="skip-link">Aller à la réponse</a>
      <a href="#exportResponses" class="skip-link">Aller à l'export</a>
    `;
    
    // Styles pour les skip links
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -100px;
        left: 0;
        z-index: 10000;
      }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 10px;
        background: #3498db;
        color: white;
        padding: 10px 20px;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
      }
      .skip-link:focus {
        top: 10px;
      }
    `;
    document.head.appendChild(style);
    document.body.insertBefore(skipLinks, document.body.firstChild);
  },

  // Améliorer l'accessibilité des formulaires
  improveFormAccessibility() {
    // Associer les labels aux inputs
    const studentNameInput = document.getElementById('studentName');
    if (studentNameInput && !studentNameInput.getAttribute('aria-describedby')) {
      const description = document.createElement('span');
      description.id = 'studentNameDesc';
      description.className = 'sr-only';
      description.textContent = 'Entrez votre prénom, nom et classe. Vous pouvez également utiliser le bouton microphone pour dicter ces informations.';
      studentNameInput.parentNode.insertBefore(description, studentNameInput.nextSibling);
      studentNameInput.setAttribute('aria-describedby', 'studentNameDesc');
    }

    const responseInput = document.getElementById('responseInput');
    if (responseInput && !responseInput.getAttribute('aria-describedby')) {
      const description = document.createElement('span');
      description.id = 'responseDesc';
      description.className = 'sr-only';
      description.textContent = 'Entrez votre réponse à la question. Vous pouvez taper au clavier ou utiliser la reconnaissance vocale.';
      responseInput.parentNode.insertBefore(description, responseInput.nextSibling);
      responseInput.setAttribute('aria-describedby', 'responseDesc');
    }

    // Ajouter la classe sr-only pour le texte lisible uniquement par les lecteurs d'écran
    const srOnlyStyle = document.createElement('style');
    srOnlyStyle.textContent = `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
    `;
    document.head.appendChild(srOnlyStyle);
  },

  // Ajouter des régions live pour les annonces
  addLiveRegions() {
    if (!document.getElementById('ariaLiveRegion')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'ariaLiveRegion';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }
  },

  // Annoncer un message aux lecteurs d'écran
  announceToScreenReader(message) {
    const liveRegion = document.getElementById('ariaLiveRegion');
    if (liveRegion) {
      liveRegion.textContent = '';
      setTimeout(() => {
        liveRegion.textContent = message;
      }, 100);
    }
  },

  // Améliorer les indicateurs de focus
  addFocusIndicators() {
    const style = document.createElement('style');
    style.textContent = `
      /* Focus visible amélioré */
      *:focus {
        outline: 3px solid #3498db;
        outline-offset: 2px;
      }
      
      /* Focus pour les boutons */
      button:focus {
        outline: 3px solid #2ecc71;
        outline-offset: 3px;
        box-shadow: 0 0 0 5px rgba(46, 204, 113, 0.2);
      }
      
      /* Focus pour les inputs */
      input:focus {
        outline: 3px solid #3498db;
        outline-offset: 2px;
        box-shadow: 0 0 0 5px rgba(52, 152, 219, 0.2);
      }
      
      /* Indicateur visuel quand un bouton est pressé */
      button:active {
        transform: scale(0.97);
        box-shadow: inset 0 3px 5px rgba(0, 0, 0, 0.2);
      }
      
      /* Mode de navigation au clavier visible */
      body.keyboard-navigation *:focus {
        outline: 4px solid #f39c12 !important;
        outline-offset: 3px !important;
      }
    `;
    document.head.appendChild(style);

    // Détecter la navigation au clavier
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  },

  // Vérifier le contraste des couleurs
  checkColorContrast() {
    console.log('⚠️ Vérification du contraste des couleurs recommandée');
    console.log('Utilisez des outils comme WAVE ou axe DevTools pour vérifier les ratios de contraste');
  },

  // Améliorer les états des boutons
  improveButtonStates() {
    // Ajouter des messages explicatifs pour les boutons désactivés
    const buttons = document.querySelectorAll('button[disabled]');
    buttons.forEach(button => {
      if (!button.getAttribute('title')) {
        button.setAttribute('title', 'Ce bouton sera disponible après le chargement du document');
      }
    });

    // Observer les changements d'état des boutons
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'disabled') {
          const button = mutation.target;
          if (button.disabled) {
            this.announceToScreenReader(`${button.textContent} désactivé`);
          } else {
            this.announceToScreenReader(`${button.textContent} activé`);
          }
        }
      });
    });

    document.querySelectorAll('button').forEach(button => {
      observer.observe(button, { attributes: true });
    });
  }
};

// Fonction pour initialiser toutes les améliorations d'accessibilité
function initializeAccessibility() {
  AccessibilityManager.initialize();
  AccessibilityManager.improveButtonStates();
  AccessibilityManager.checkColorContrast();
  
  console.log('♿ Accessibilité optimisée :');
  console.log('✅ Labels ARIA ajoutés');
  console.log('✅ Navigation clavier améliorée');
  console.log('✅ Lecteurs d\'écran supportés');
  console.log('✅ Raccourcis clavier disponibles (Alt + touches)');
}
