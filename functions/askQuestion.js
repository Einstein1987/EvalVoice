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
        console.error("Synthesis speaking or no question available");
      }
    }
