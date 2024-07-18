function navigateQuestion(direction) {
    currentQuestion += direction;
    if (currentQuestion < 0) currentQuestion = 0;
    if (currentQuestion >= questions.length) currentQuestion = questions.length - 1;
    document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
    document.getElementById('nextQuestion').disabled = (currentQuestion === questions.length - 1);
    document.getElementById('responseInput').value = responses[currentQuestion] || '';
    askQuestion(currentQuestion);
    }
