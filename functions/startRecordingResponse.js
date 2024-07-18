function startRecordingResponse() {
        recordingResponse = true;
        recognition.start();
        document.getElementById('recordingIndicator').style.display = 'block';
    }
