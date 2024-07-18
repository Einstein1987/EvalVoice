function adjustSpeechRate(delta) {
      speechRate = Math.max(0.5, Math.min(2.0, speechRate + delta));
      document.getElementById('speedDisplay').textContent = speechRate.toFixed(1) + 'x';
    }
