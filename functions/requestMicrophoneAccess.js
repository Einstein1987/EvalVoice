function requestMicrophoneAccess() {
      return navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          document.getElementById('recordStudentInfo').disabled = false;
        })
        .catch(error => {
          console.error('Microphone access denied:', error);
          throw error;
        });
    }
