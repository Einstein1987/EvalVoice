// Module de détection et compatibilité navigateur
// Ajouter en début de evalvoice.js

const BrowserCompatibility = {
  // Détecter les fonctionnalités disponibles
  detect() {
    return {
      speechSynthesis: 'speechSynthesis' in window,
      speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
      mediaDevices: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
      pdfSupport: typeof pdfjsLib !== 'undefined',
      browser: this.detectBrowser(),
      isMobile: this.isMobileDevice()
    };
  },

  // Détecter le navigateur
  detectBrowser() {
    const ua = navigator.userAgent;
    
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('Edg') > -1) return 'Edge';
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1) return 'Safari';
    if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
    
    return 'Unknown';
  },

  // Détecter si mobile
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Afficher un avertissement de compatibilité
  showCompatibilityWarning(features) {
    const warnings = [];
    
    if (!features.speechRecognition) {
      warnings.push('❌ Reconnaissance vocale non supportée');
    }
    
    if (!features.speechSynthesis) {
      warnings.push('❌ Synthèse vocale non supportée');
    }
    
    if (!features.mediaDevices) {
      warnings.push('❌ Accès micro non supporté');
    }

    if (warnings.length > 0) {
      const warningDiv = document.createElement('div');
      warningDiv.className = 'compatibility-warning';
      warningDiv.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          color: white;
          padding: 20px;
          border-radius: 10px;
          margin: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        ">
          <h2 style="margin-top: 0;">⚠️ Navigateur non compatible</h2>
          <p>Votre navigateur <strong>${features.browser}</strong> ne supporte pas toutes les fonctionnalités nécessaires :</p>
          <ul style="text-align: left; margin: 15px 0;">
            ${warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
          <p><strong>Navigateurs recommandés :</strong></p>
          <ul style="text-align: left;">
            <li>✅ Google Chrome (Desktop & Android)</li>
            <li>✅ Microsoft Edge</li>
            <li>⚠️ Firefox (synthèse vocale uniquement)</li>
            <li>❌ Safari (non compatible)</li>
          </ul>
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: white;
            color: #e74c3c;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 10px;
          ">J'ai compris</button>
        </div>
      `;
      
      document.body.insertBefore(warningDiv, document.body.firstChild);
      
      return false; // Incompatible
    }
    
    return true; // Compatible
  },

  // Proposer des alternatives
  suggestAlternatives(features) {
    if (!features.speechRecognition) {
      // Désactiver les boutons de reconnaissance vocale
      const recordButtons = document.querySelectorAll('#recordStudentInfo, #recordResponseButton');
      recordButtons.forEach(btn => {
        btn.style.display = 'none';
      });
      
      // Afficher un message d'info
      showNotification(
        'ℹ️ Mode clavier uniquement : Entrez vos réponses en tapant au clavier',
        'info'
      );
    }
    
    if (!features.speechSynthesis) {
      // Désactiver les contrôles de vitesse
      document.getElementById('speedDown')?.setAttribute('disabled', 'true');
      document.getElementById('speedUp')?.setAttribute('disabled', 'true');
      
      // Afficher les questions en texte seulement
      showNotification(
        'ℹ️ Lecture vocale non disponible : Les questions s\'afficheront en texte uniquement',
        'info'
      );
    }
  },

  // Vérifier HTTPS (requis pour getUserMedia)
  checkHTTPS() {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      const warningDiv = document.createElement('div');
      warningDiv.className = 'https-warning';
      warningDiv.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #f39c12, #e67e22);
          color: white;
          padding: 15px;
          text-align: center;
          font-weight: bold;
        ">
          ⚠️ ATTENTION : Cette application nécessite HTTPS pour accéder au microphone
        </div>
      `;
      document.body.insertBefore(warningDiv, document.body.firstChild);
      return false;
    }
    return true;
  },

  // Initialisation complète avec vérifications
  initialize() {
    console.log('🔍 Vérification de la compatibilité du navigateur...');
    
    const features = this.detect();
    
    console.log('Navigateur détecté:', features.browser);
    console.log('Mobile:', features.isMobile);
    console.log('Synthèse vocale:', features.speechSynthesis);
    console.log('Reconnaissance vocale:', features.speechRecognition);
    console.log('Accès média:', features.mediaDevices);
    
    // Vérifier HTTPS
    const httpsOk = this.checkHTTPS();
    
    // Vérifier la compatibilité
    const isCompatible = this.showCompatibilityWarning(features);
    
    // Si partiellement compatible, suggérer des alternatives
    if (!isCompatible) {
      this.suggestAlternatives(features);
    }
    
    // Adapter l'interface selon les fonctionnalités disponibles
    if (features.isMobile) {
      this.adaptForMobile();
    }
    
    return {
      features,
      isFullyCompatible: features.speechSynthesis && features.speechRecognition,
      canUseAudio: httpsOk && features.mediaDevices
    };
  },

  // Adapter l'interface pour mobile
  adaptForMobile() {
    // Agrandir les boutons
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        button {
          padding: 15px 20px !important;
          font-size: 18px !important;
          min-height: 50px;
        }
        
        input[type="text"] {
          font-size: 18px !important;
          padding: 15px !important;
        }
        
        .input-group button {
          width: 60px !important;
          height: 60px !important;
        }
        
        #questionDisplay {
          font-size: 20px !important;
          padding: 20px !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    console.log('📱 Interface adaptée pour mobile');
  }
};

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  const compatibility = BrowserCompatibility.initialize();
  
  // Stocker les infos de compatibilité globalement
  window.evalVoiceCompatibility = compatibility;
  
  // Adapter le comportement selon la compatibilité
  if (compatibility.isFullyCompatible) {
    console.log('✅ Navigateur entièrement compatible');
  } else {
    console.warn('⚠️ Compatibilité partielle - certaines fonctionnalités désactivées');
  }
});
