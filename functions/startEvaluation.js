function startEvaluation() {
      if (synthesis && recognition && questions.length > 0) {
        console.log("Starting evaluation...");
        askQuestion(currentQuestion);
        document.getElementById('prevQuestion').disabled = (currentQuestion === 0);
        document.getElementById('nextQuestion').disabled = (questions.length === 1);
        document.getElementById('exportResponses').disabled = false;
      } else {
        alert("Votre navigateur ne supporte pas la synthèse vocale ou la reconnaissance vocale ou aucune question n'a été trouvée.");
      }
    }
