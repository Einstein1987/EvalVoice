import { recognition, recordingStudentInfo, recordingResponse, responses, currentQuestion } from './globals.js';

function initializeRecognition() {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            if (recordingStudentInfo) {
              document.getElementById('studentName').value = event.results[i][0].transcript;
              recordingStudentInfo = false;
              document.getElementById('recordingIndicator').style.display = 'none';
            } else if (recordingResponse) {
              document.getElementById('responseInput').value = event.results[i][0].transcript;
              responses[currentQuestion] = event.results[i][0].transcript;
              recordingResponse = false;
              document.getElementById('recordingIndicator').style.display = 'none';
            }
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };

      recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        alert('Une erreur est survenue avec la reconnaissance vocale : ' + event.error);
        document.getElementById('recordingIndicator').style.display = 'none';
      };
    }

/*export default function initializeRecognition() {
  if (!recognition) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          if (recordingStudentInfo) {
            document.getElementById('studentName').value = event.results[i][0].transcript;
            recordingStudentInfo = false;
            document.getElementById('recordingIndicator').style.display = 'none';
          } else if (recordingResponse) {
            document.getElementById('responseInput').value = event.results[i][0].transcript;
            responses[currentQuestion] = event.results[i][0].transcript;
            recordingResponse = false;
            document.getElementById('recordingIndicator').style.display = 'none';
          }
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Recognition error:', event.error);
      alert('Une erreur est survenue avec la reconnaissance vocale : ' + event.error);
      document.getElementById('recordingIndicator').style.display = 'none';
    };
  }
}*/
